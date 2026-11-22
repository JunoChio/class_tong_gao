"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { BoardLayoutConfig, ClassBoardData, DEFAULT_BOARD_DATA } from "@/types/board";
import { fetchBoardData } from "@/lib/boardApi";
import { broadcastBoardUpdate, subscribeBoardUpdates } from "@/lib/liveSync";
import { ClassBoardView } from "@/components/ClassBoardView";

declare global {
  interface Window {
    __setDesktopPaused?: (paused: boolean) => void;
  }
}

export default function HomePage() {
  const [data, setData] = useState<ClassBoardData>(DEFAULT_BOARD_DATA);
  const [desktopPaused, setDesktopPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  // 本地拖曳中鎖定短暫防覆寫，避免輪詢把剛拖好的位置蓋回舊值
  const localEditLockUntilRef = useRef<number>(0);

  const isPaused = desktopPaused || tabHidden;

  const loadLatest = useCallback(async () => {
    if (Date.now() < localEditLockUntilRef.current) return;
    const result = await fetchBoardData();
    if (Date.now() < localEditLockUntilRef.current) return;
    setData(result.data);
  }, []);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  // 訂閱來自控制面板（/admin）的跨分頁即時廣播（< 16ms 零延遲同步）
  useEffect(() => {
    return subscribeBoardUpdates((incoming) => {
      localEditLockUntilRef.current = Date.now() + 2500;
      setData(incoming);
    });
  }, []);

  // 監聽桌面端休眠訊號 + 瀏覽器原生 visibilitychange / focus
  useEffect(() => {
    window.__setDesktopPaused = (paused: boolean) => {
      setDesktopPaused(Boolean(paused));
    };

    const handleVisibility = () => {
      setTabHidden(document.hidden);
      if (!document.hidden) {
        loadLatest();
      }
    };
    const handleFocus = () => {
      loadLatest();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      delete window.__setDesktopPaused;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadLatest]);

  // 高頻雲端同步輪詢（休眠時自動暫停）
  useEffect(() => {
    if (isPaused) return;
    loadLatest();
    const intervalMs = Math.max(3, Number(data.refreshIntervalSec) || 5) * 1000;
    const timer = setInterval(() => {
      loadLatest();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [data.refreshIntervalSec, isPaused, loadLatest]);

  // 在展示頁直接拖曳時也同步即時刷新並廣播到控制面板
  const handleLayoutChange = useCallback((nextLayout: BoardLayoutConfig) => {
    localEditLockUntilRef.current = Date.now() + 4000;
    setData((prev) => {
      const updated: ClassBoardData = { ...prev, layout: nextLayout };
      broadcastBoardUpdate(updated);
      return updated;
    });
  }, []);

  const handleLayoutCommit = useCallback((finalLayout: BoardLayoutConfig) => {
    localEditLockUntilRef.current = Date.now() + 3000;
    setData((prev) => {
      const updated: ClassBoardData = { ...prev, layout: finalLayout };
      try {
        window.localStorage.setItem("classboard_local_data_v1", JSON.stringify(updated));
      } catch {
        // ignore
      }
      broadcastBoardUpdate(updated);
      return updated;
    });
  }, []);

  return (
    <ClassBoardView
      data={data}
      paused={isPaused}
      onLayoutChange={handleLayoutChange}
      onLayoutCommit={handleLayoutCommit}
    />
  );
}
