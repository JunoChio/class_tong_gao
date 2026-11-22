"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BellRing,
  ClipboardList,
  Flame,
  GripHorizontal,
  Move,
  Sparkles,
} from "lucide-react";
import {
  BoardLayoutConfig,
  CardSpan,
  HomeworkCard,
  HomeworkTheme,
  WidgetRect,
  clampWidgetRect,
} from "@/types/board";
import { SubjectArt } from "./SubjectArt";

const HOMEWORK_THEME_STYLES: Record<
  HomeworkTheme,
  {
    card: string;
    badgeBg: string;
    badgeText: string;
    subjectText: string;
    titlePill: string;
    tagBg: string;
    tagText: string;
  }
> = {
  yellow: {
    card: "bg-[#fff8df]/70 border-[#f4df9e]/75 hover:border-[#eab308]/60",
    badgeBg: "bg-[#f2b749]",
    badgeText: "text-white",
    subjectText: "text-[#5c3d08]",
    titlePill: "bg-[#f59e0b]/20 text-[#854d0e]",
    tagBg: "bg-[#f59e0b]/20 border-[#f59e0b]/35",
    tagText: "text-[#854d0e]",
  },
  green: {
    card: "bg-[#e3faec]/70 border-[#b8ebcd]/75 hover:border-[#22c55e]/60",
    badgeBg: "bg-[#3fb174]",
    badgeText: "text-white",
    subjectText: "text-[#11442a]",
    titlePill: "bg-[#10b981]/20 text-[#065f46]",
    tagBg: "bg-[#10b981]/20 border-[#10b981]/35",
    tagText: "text-[#065f46]",
  },
  blue: {
    card: "bg-[#e3f0ff]/70 border-[#bdd7fa]/75 hover:border-[#3b82f6]/60",
    badgeBg: "bg-[#4f82e4]",
    badgeText: "text-white",
    subjectText: "text-[#17336b]",
    titlePill: "bg-[#3b82f6]/20 text-[#1e40af]",
    tagBg: "bg-[#3b82f6]/20 border-[#3b82f6]/35",
    tagText: "text-[#1e40af]",
  },
  pink: {
    card: "bg-[#ffeaf3]/70 border-[#f8c1d8]/75 hover:border-[#ec4899]/60",
    badgeBg: "bg-[#ea6697]",
    badgeText: "text-white",
    subjectText: "text-[#73183d]",
    titlePill: "bg-[#ec4899]/20 text-[#9d174d]",
    tagBg: "bg-[#ec4899]/20 border-[#ec4899]/35",
    tagText: "text-[#9d174d]",
  },
  purple: {
    card: "bg-[#f1ebff]/70 border-[#d5c3fa]/75 hover:border-[#8b5cf6]/60",
    badgeBg: "bg-[#8860e5]",
    badgeText: "text-white",
    subjectText: "text-[#391b73]",
    titlePill: "bg-[#8b5cf6]/20 text-[#5b21b6]",
    tagBg: "bg-[#8b5cf6]/20 border-[#8b5cf6]/35",
    tagText: "text-[#5b21b6]",
  },
  orange: {
    card: "bg-[#fff0e3]/70 border-[#fad0ab]/75 hover:border-[#f97316]/60",
    badgeBg: "bg-[#ee8138]",
    badgeText: "text-white",
    subjectText: "text-[#6e2d0a]",
    titlePill: "bg-[#f97316]/20 text-[#9a3412]",
    tagBg: "bg-[#f97316]/20 border-[#f97316]/35",
    tagText: "text-[#9a3412]",
  },
};

export type ActiveWidgetKey = "notice" | "homework";

type DragAction =
  | { kind: "move"; widget: ActiveWidgetKey }
  | { kind: "resize"; widget: ActiveWidgetKey; edge: "right" | "bottom" | "corner" | "left" | "top" };

function snapEdge(val: number, targets: number[], threshold = 1.4): number {
  for (const t of targets) {
    if (Math.abs(val - t) <= threshold) return t;
  }
  return Math.round(val * 10) / 10;
}

/**
 * 統一單塊「班級通知」內容區（移除碎片化分欄，內容超出自動平滑向上滾動）
 */
function UnifiedNoticeContent({
  notices,
  paused,
  compact,
  fontScale = 100,
}: {
  notices: string[];
  paused: boolean;
  compact?: boolean;
  fontScale?: number;
}) {
  const vpRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [durationSec, setDurationSec] = useState(16);

  const keySig = JSON.stringify(notices) + `|${fontScale}`;
  const scale = Math.min(1.7, Math.max(0.75, fontScale / 100));

  useEffect(() => {
    const check = () => {
      const vp = vpRef.current;
      const ct = contentRef.current;
      if (!vp || !ct) return;
      const overflow = ct.scrollHeight > vp.clientHeight + 4;
      setShouldScroll(overflow);
      if (overflow) {
        setDurationSec(Math.max(12, Math.round(ct.scrollHeight / 20)));
      }
    };
    check();
    const ro = new ResizeObserver(check);
    if (vpRef.current) ro.observe(vpRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [keySig, compact]);

  const cleanNotices = notices.map((n) => n.trim()).filter(Boolean);

  if (cleanNotices.length === 0) {
    return (
      <div
        style={{
          fontSize: compact
            ? `${Math.round(12 * scale)}px`
            : `calc(clamp(0.96rem, 1.2vw, 1.22rem) * ${scale})`,
        }}
        className="flex-1 flex items-center font-medium text-[#5c4835]/80"
      >
        暫無最新通知，祝同學們學習愉快！
      </div>
    );
  }

  const renderLines = (mirror = false) => (
    <div
      ref={mirror ? undefined : contentRef}
      className={`${compact ? "space-y-1.5" : "space-y-2.5"} ${shouldScroll ? "pb-4" : ""}`}
    >
      {cleanNotices.map((text, idx) => (
        <p
          key={mirror ? `m-${idx}` : idx}
          style={{
            fontSize: compact
              ? `${Math.round(11.5 * scale * 10) / 10}px`
              : `calc(clamp(0.96rem, 1.22vw, 1.26rem) * ${scale})`,
          }}
          className={`font-semibold text-[#231a12] whitespace-pre-line break-words flex items-start gap-2 ${
            compact ? "leading-snug" : "leading-relaxed"
          }`}
        >
          <span
            className={`rounded-full bg-[#ea580c] shrink-0 ${
              compact ? "mt-1.5 w-1 h-1" : "mt-2.5 w-1.5 h-1.5"
            }`}
          />
          <span className="flex-1">{text}</span>
        </p>
      ))}
    </div>
  );

  return (
    <div
      ref={vpRef}
      className={`marquee-viewport relative flex-1 min-h-0 overflow-hidden ${
        shouldScroll && !paused ? "marquee-mask-y" : ""
      }`}
    >
      {shouldScroll && !compact ? (
        <div
          className="marquee-track-y flex flex-col"
          style={{
            animationDuration: `${durationSec}s`,
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {renderLines(false)}
          <div aria-hidden="true">{renderLines(true)}</div>
        </div>
      ) : (
        <div className="min-h-full flex flex-col justify-start pt-0.5">{renderLines(false)}</div>
      )}
    </div>
  );
}

export interface InteractiveBoardCanvasProps {
  noticeTitle: string;
  notices: string[];
  homeworkTitle: string;
  homeworks: HomeworkCard[];
  layout: BoardLayoutConfig;
  paused?: boolean;
  /** 是否處於控制面板預覽畫布模式（更緊湊字級、常駐拖曳視覺反饋） */
  isControlPanel?: boolean;
  /** 當前選中模組（控制面板用來高亮同步屬性面板） */
  selectedWidget?: ActiveWidgetKey;
  onSelectWidget?: (widget: ActiveWidgetKey) => void;
  /** 每次拖曳/縮放即時回調（16ms 內同步刷新外部控制面板與即時預覽） */
  onLayoutChange?: (nextLayout: BoardLayoutConfig) => void;
  /** 拖曳放手時回調（可用於自動儲存或寫入快取） */
  onLayoutCommit?: (finalLayout: BoardLayoutConfig) => void;
  /** 回報即時計算出的網格欄數，供控制面板即時狀態顯示 */
  onMetricsChange?: (metrics: { hwCols: number; hwPixelW: number; hwPixelH: number }) => void;
}

export function InteractiveBoardCanvas({
  noticeTitle,
  notices,
  homeworkTitle,
  homeworks,
  layout,
  paused = false,
  isControlPanel = false,
  selectedWidget,
  onSelectWidget,
  onLayoutChange,
  onLayoutCommit,
  onMetricsChange,
}: InteractiveBoardCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hwViewportRef = useRef<HTMLDivElement>(null);
  const hwContentRef = useRef<HTMLDivElement>(null);

  const [activeDrag, setActiveDrag] = useState<DragAction | null>(null);
  const [resizingCardId, setResizingCardId] = useState<string | null>(null);
  const [hwBoxSize, setHwBoxSize] = useState({ w: 720, h: 300 });
  const [hwShouldScroll, setHwShouldScroll] = useState(false);
  const [hwScrollDuration, setHwScrollDuration] = useState(18);

  // 追蹤最新 layout 以便 PointerUp 時提交最新狀態
  const latestLayoutRef = useRef(layout);
  latestLayoutRef.current = layout;

  const isAnyDragging = activeDrag !== null || resizingCardId !== null;

  // 根據「今日功課」實時寬度決定響應式網格欄數（控制面板按比例換算更精準）
  const effectiveMeasureW = isControlPanel ? hwBoxSize.w * 1.45 : hwBoxSize.w;
  const maxCols =
    effectiveMeasureW < 420
      ? 1
      : effectiveMeasureW < 640
      ? 2
      : 3;
  const effectiveCols = Math.max(1, Math.min(maxCols, homeworks.length || 1));

  // 監聽功課容器實際尺寸與內容溢出（含字體縮放變化）
  const noticeScale = Math.min(1.7, Math.max(0.75, (layout.noticeFontScale || 100) / 100));
  const hwScale = Math.min(1.7, Math.max(0.75, (layout.homeworkFontScale || 100) / 100));

  const hwSig =
    JSON.stringify(homeworks) + JSON.stringify(layout.cardSpans) + `|${layout.homeworkFontScale}`;
  useEffect(() => {
    const measure = () => {
      const vp = hwViewportRef.current;
      const ct = hwContentRef.current;
      if (!vp) return;
      const w = Math.round(vp.clientWidth);
      const h = Math.round(vp.clientHeight);
      setHwBoxSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));

      if (ct) {
        const overflow = ct.scrollHeight > vp.clientHeight + 6;
        setHwShouldScroll(overflow);
        if (overflow) {
          setHwScrollDuration(Math.max(12, Math.round(ct.scrollHeight / 24)));
        }
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (hwViewportRef.current) ro.observe(hwViewportRef.current);
    if (hwContentRef.current) ro.observe(hwContentRef.current);
    return () => ro.disconnect();
  }, [hwSig, layout.homeworkRect.w, layout.homeworkRect.h, isControlPanel]);

  useEffect(() => {
    onMetricsChange?.({
      hwCols: effectiveCols,
      hwPixelW: hwBoxSize.w,
      hwPixelH: hwBoxSize.h,
    });
  }, [effectiveCols, hwBoxSize.w, hwBoxSize.h, onMetricsChange]);

  // 自由拖曳定位 & 邊緣/角落縮放（統一支援滑鼠與觸控，60fps rAF 節流，嚴格邊界約束）
  const startWidgetPointer = (
    action: DragAction,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!onLayoutChange) return;
    e.preventDefault();
    e.stopPropagation();

    const stage = stageRef.current;
    if (!stage) return;

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    onSelectWidget?.(action.widget);
    setActiveDrag(action);

    const stageRect = stage.getBoundingClientRect();
    const stageW = Math.max(120, stageRect.width);
    const stageH = Math.max(120, stageRect.height);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const key = action.widget === "notice" ? "noticeRect" : "homeworkRect";
    const otherKey = action.widget === "notice" ? "homeworkRect" : "noticeRect";
    const initRect: WidgetRect = { ...latestLayoutRef.current[key] };
    const otherRect: WidgetRect = { ...latestLayoutRef.current[otherKey] };

    let rafId = 0;

    const onMove = (ev: PointerEvent) => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const dxPct = ((ev.clientX - startClientX) / stageW) * 100;
        const dyPct = ((ev.clientY - startClientY) / stageH) * 100;

        let nextRect: WidgetRect = { ...initRect };

        if (action.kind === "move") {
          const rawX = initRect.x + dxPct;
          const rawY = initRect.y + dyPct;
          const snappedX = snapEdge(rawX, [0, 100 - initRect.w, otherRect.x, otherRect.x + otherRect.w + 2]);
          const snappedY = snapEdge(rawY, [0, 100 - initRect.h, otherRect.y, otherRect.y + otherRect.h + 3]);
          nextRect = clampWidgetRect(
            { x: snappedX, y: snappedY, w: initRect.w, h: initRect.h },
            initRect
          );
        } else {
          const minW = 28;
          const minH = 18;
          let { x, y, w, h } = initRect;

          if (action.edge === "right" || action.edge === "corner") {
            const rawRight = Math.min(100, Math.max(x + minW, initRect.x + initRect.w + dxPct));
            const snappedRight = snapEdge(rawRight, [100, otherRect.x - 2, otherRect.x + otherRect.w]);
            w = Math.min(100 - x, Math.max(minW, snappedRight - x));
          }
          if (action.edge === "left") {
            const maxLeft = initRect.x + initRect.w - minW;
            const rawLeft = Math.min(maxLeft, Math.max(0, initRect.x + dxPct));
            const snappedLeft = snapEdge(rawLeft, [0, otherRect.x, otherRect.x + otherRect.w + 2]);
            const clampedLeft = Math.min(maxLeft, Math.max(0, snappedLeft));
            w = initRect.x + initRect.w - clampedLeft;
            x = clampedLeft;
          }
          if (action.edge === "bottom" || action.edge === "corner") {
            const rawBottom = Math.min(100, Math.max(y + minH, initRect.y + initRect.h + dyPct));
            const snappedBottom = snapEdge(rawBottom, [100, otherRect.y - 3, otherRect.y + otherRect.h]);
            h = Math.min(100 - y, Math.max(minH, snappedBottom - y));
          }
          if (action.edge === "top") {
            const maxTop = initRect.y + initRect.h - minH;
            const rawTop = Math.min(maxTop, Math.max(0, initRect.y + dyPct));
            const snappedTop = snapEdge(rawTop, [0, otherRect.y, otherRect.y + otherRect.h + 3]);
            const clampedTop = Math.min(maxTop, Math.max(0, snappedTop));
            h = initRect.y + initRect.h - clampedTop;
            y = clampedTop;
          }

          nextRect = clampWidgetRect({ x, y, w, h }, initRect);
        }

        const updatedLayout: BoardLayoutConfig = {
          ...latestLayoutRef.current,
          [key]: nextRect,
        };
        latestLayoutRef.current = updatedLayout;
        onLayoutChange(updatedLayout);
      });
    };

    const onUp = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      setActiveDrag(null);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      onLayoutCommit?.(latestLayoutRef.current);
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  // 單張功課卡片自由拖曳跨欄/跨行（同步回寫至 layout.cardSpans）
  const startCardSpanResize = (
    hwId: string,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!onLayoutChange) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    onSelectWidget?.("homework");
    setResizingCardId(hwId);

    const startX = e.clientX;
    const startY = e.clientY;
    const initSpan: CardSpan = latestLayoutRef.current.cardSpans[hwId] || {
      colSpan: 1,
      rowSpan: 1,
    };
    const colUnit = Math.max(80, hwBoxSize.w / Math.max(1, effectiveCols));
    let rafId = 0;

    const onMove = (ev: PointerEvent) => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const deltaCols = Math.round(dx / (colUnit * 0.55));
        const deltaRows = Math.round(dy / (isControlPanel ? 42 : 76));

        const nextColSpan = Math.min(effectiveCols, Math.max(1, initSpan.colSpan + deltaCols));
        const nextRowSpan = Math.min(2, Math.max(1, initSpan.rowSpan + deltaRows));

        const cur = latestLayoutRef.current.cardSpans[hwId];
        if (cur && cur.colSpan === nextColSpan && cur.rowSpan === nextRowSpan) {
          return;
        }
        const updatedLayout: BoardLayoutConfig = {
          ...latestLayoutRef.current,
          cardSpans: {
            ...latestLayoutRef.current.cardSpans,
            [hwId]: { colSpan: nextColSpan, rowSpan: nextRowSpan },
          },
        };
        latestLayoutRef.current = updatedLayout;
        onLayoutChange(updatedLayout);
      });
    };

    const onUp = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      setResizingCardId(null);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      onLayoutCommit?.(latestLayoutRef.current);
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  const renderHomeworkCards = (isMirror = false) => (
    <div
      ref={isMirror ? undefined : hwContentRef}
      style={{
        gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))`,
      }}
      className={`grid ${
        isControlPanel ? "auto-rows-[minmax(54px,auto)] gap-2" : "auto-rows-[minmax(92px,auto)] gap-3"
      } ${hwShouldScroll && !isControlPanel ? "pb-3" : "min-h-full"}`}
    >
      {homeworks.map((hw, idx) => {
        const style = HOMEWORK_THEME_STYLES[hw.theme] || HOMEWORK_THEME_STYLES.yellow;
        const customSpan = layout.cardSpans[hw.id];
        const autoFillLast =
          !customSpan &&
          effectiveCols === 2 &&
          homeworks.length % 2 === 1 &&
          idx === homeworks.length - 1;
        const span = customSpan || { colSpan: autoFillLast ? 2 : 1, rowSpan: 1 };
        const clampedCol = Math.min(effectiveCols, Math.max(1, span.colSpan));
        const clampedRow = Math.min(2, Math.max(1, span.rowSpan));
        const isWideCard = clampedCol >= 2 || effectiveCols === 1;

        return (
          <article
            key={isMirror ? `${hw.id}-m` : hw.id}
            style={{
              gridColumn: `span ${clampedCol} / span ${clampedCol}`,
              gridRow: `span ${clampedRow} / span ${clampedRow}`,
            }}
            className={`group/card relative rounded-[16px] border backdrop-blur-md ${style.card} shadow-[0_4px_14px_rgba(15,23,42,0.05)] flex flex-col justify-between overflow-hidden ${
              isControlPanel ? "px-2.5 py-2" : "px-4 py-3.5 rounded-[20px]"
            } ${isAnyDragging ? "transition-none" : "transition-all duration-150"} ${
              resizingCardId === hw.id
                ? "ring-2 ring-emerald-500/80"
                : hw.urgent
                ? "ring-2 ring-rose-400/75 border-rose-300/90"
                : ""
            }`}
          >
            {/* 標題列 */}
            <div className={`flex items-center justify-between gap-1.5 ${isControlPanel ? "mb-1" : "mb-2"}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`inline-flex items-center justify-center rounded-lg font-extrabold shadow-sm shrink-0 ${style.badgeBg} ${style.badgeText} ${
                    isControlPanel ? "w-5 h-5 text-[10px]" : "w-8 h-8 rounded-xl text-sm"
                  }`}
                >
                  {hw.badgeText || hw.subject.slice(0, 1)}
                </span>
                <span
                  style={{
                    fontSize: isControlPanel
                      ? `${Math.round(12 * hwScale * 10) / 10}px`
                      : `calc(clamp(1rem, 1.25vw, 1.28rem) * ${hwScale})`,
                  }}
                  className={`font-extrabold tracking-wide truncate ${style.subjectText}`}
                >
                  {hw.subject}
                </span>
                {hw.title && (
                  <span
                    style={{
                      fontSize: isControlPanel
                        ? `${Math.round(10 * hwScale * 10) / 10}px`
                        : `calc(clamp(0.72rem, 0.85vw, 0.85rem) * ${hwScale})`,
                    }}
                    className={`inline-block font-bold rounded-md truncate ${style.titlePill} ${
                      isControlPanel ? "px-1.5 py-0.5" : "px-2 py-0.5"
                    }`}
                  >
                    {hw.title}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {hw.urgent && (
                  <span
                    className={`inline-flex items-center gap-0.5 font-extrabold rounded-full bg-rose-500 text-white shadow-sm shrink-0 ${
                      isControlPanel ? "text-[9px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5"
                    }`}
                  >
                    <Flame className={isControlPanel ? "w-2.5 h-2.5" : "w-3 h-3"} />
                    <span>{isControlPanel ? "急" : "急・明天交"}</span>
                  </span>
                )}
                {isWideCard && hw.footerTag && !isControlPanel && (
                  <span
                    style={{
                      fontSize: `calc(clamp(0.72rem, 0.85vw, 0.86rem) * ${hwScale})`,
                    }}
                    className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${style.tagBg} ${style.tagText}`}
                  >
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span>{hw.footerTag}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 功課正文 */}
            <div className="flex-1 min-h-0 flex items-center justify-between gap-2">
              <p
                style={{
                  fontSize: isControlPanel
                    ? `${Math.round(11 * hwScale * 10) / 10}px`
                    : `calc(clamp(0.9rem, 1.1vw, 1.14rem) * ${hwScale})`,
                }}
                className={`font-semibold text-[#18201b] whitespace-pre-line break-words ${
                  isControlPanel ? "leading-snug line-clamp-2" : "leading-relaxed"
                }`}
              >
                {hw.content}
              </p>
              {isWideCard && !isControlPanel && (
                <div className="hidden sm:block pointer-events-none shrink-0 opacity-85">
                  <SubjectArt theme={hw.theme} />
                </div>
              )}
            </div>

            {!isWideCard && !isControlPanel && (
              <div className="mt-2 flex items-end justify-between gap-2">
                {hw.footerTag ? (
                  <span
                    className={`inline-flex items-center gap-1 text-[clamp(0.72rem,0.84vw,0.84rem)] font-bold px-2.5 py-0.5 rounded-full border truncate ${style.tagBg} ${style.tagText}`}
                  >
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span className="truncate">{hw.footerTag}</span>
                  </span>
                ) : (
                  <span />
                )}
                <div className="pointer-events-none shrink-0 scale-75 origin-bottom-right -mb-1 -mr-1 opacity-80">
                  <SubjectArt theme={hw.theme} />
                </div>
              </div>
            )}

            {/* 單張功課卡片右下角跨欄/跨高拖曳手柄 */}
            {!isMirror && onLayoutChange && (
              <div
                onPointerDown={(e) => startCardSpanResize(hw.id, e)}
                title="拖曳調整該科卡片網格跨度（跨欄／跨行）"
                className={`absolute right-0.5 bottom-0.5 w-5 h-5 rounded cursor-nwse-resize flex items-end justify-end p-1 touch-none z-20 transition-opacity ${
                  isControlPanel ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover/card:opacity-100"
                }`}
              >
                <span className="w-2.5 h-2.5 border-r-2 border-b-2 border-slate-600/75 rounded-br-[2px]" />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );

  const canDrag = Boolean(onLayoutChange);
  const noticeDragging = activeDrag?.widget === "notice";
  const hwDragging = activeDrag?.widget === "homework" || resizingCardId !== null;

  return (
    <div
      ref={stageRef}
      className={`relative flex-1 min-h-0 w-full select-none ${
        isControlPanel
          ? "rounded-2xl bg-[radial-gradient(circle_at_1px_1px,rgba(100,116,139,0.16)_1px,transparent_0)] [background-size:18px_18px]"
          : ""
      }`}
    >
      {/* 1. 自由拖曳＋縮放：「班級通知」統一單塊面板 */}
      <section
        onPointerDown={() => onSelectWidget?.("notice")}
        style={{
          left: `${layout.noticeRect.x}%`,
          top: `${layout.noticeRect.y}%`,
          width: `${layout.noticeRect.w}%`,
          height: `${layout.noticeRect.h}%`,
          zIndex: noticeDragging || selectedWidget === "notice" ? 25 : 10,
        }}
        className={`group/notice absolute rounded-[22px] bg-[#fff8ec]/55 backdrop-blur-md border shadow-[0_8px_24px_rgba(234,88,12,0.06)] flex flex-col ${
          isControlPanel ? "px-3.5 py-2.5" : "px-[clamp(18px,2.2vw,28px)] py-[clamp(14px,1.8vh,20px)] rounded-[24px]"
        } ${isAnyDragging ? "transition-none" : "transition-[box-shadow,border-color] duration-150"} ${
          noticeDragging
            ? "border-orange-400 ring-2 ring-orange-400/60 shadow-xl"
            : isControlPanel && selectedWidget === "notice"
            ? "border-orange-400/90 ring-2 ring-orange-300/60"
            : "border-white/70"
        }`}
      >
        {/* 頂部拖曳定位手柄列 */}
        <div
          onPointerDown={canDrag ? (e) => startWidgetPointer({ kind: "move", widget: "notice" }, e) : undefined}
          title={canDrag ? "按住拖曳移動「班級通知」位置" : undefined}
          className={`flex items-center justify-between gap-2 shrink-0 touch-none ${
            isControlPanel ? "mb-1.5" : "mb-2.5"
          } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#fb923c] to-[#f97316] text-white shadow-sm shrink-0 ${
                isControlPanel ? "w-6 h-6" : "w-8 h-8"
              }`}
            >
              <BellRing className={isControlPanel ? "w-3.5 h-3.5" : "w-4 h-4"} />
            </span>
            <h2
              style={{
                fontSize: isControlPanel
                  ? `${Math.round(13 * Math.min(1.3, noticeScale) * 10) / 10}px`
                  : `calc(clamp(1.1rem, 1.42vw, 1.46rem) * ${Math.min(1.35, noticeScale)})`,
              }}
              className="font-extrabold text-[#7c2d12] tracking-wide truncate"
            >
              {noticeTitle || "班級通知"}
            </h2>
          </div>

          {canDrag && (
            <div className="flex items-center gap-1.5 shrink-0">
              {noticeDragging && (
                <span className="text-[11px] font-bold text-orange-800 bg-orange-100/95 border border-orange-300 px-2 py-0.5 rounded-full shadow-sm tabular-nums">
                  X {Math.round(layout.noticeRect.x)}% · Y {Math.round(layout.noticeRect.y)}% · {Math.round(layout.noticeRect.w)}%×{Math.round(layout.noticeRect.h)}%
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700/80 bg-white/70 px-2 py-0.5 rounded-full transition-opacity ${
                  isControlPanel ? "opacity-90" : "opacity-0 group-hover/notice:opacity-100"
                }`}
              >
                <Move className="w-3 h-3" />
                {isControlPanel && <span>拖曳</span>}
              </span>
            </div>
          )}
        </div>

        <UnifiedNoticeContent
          notices={notices}
          paused={paused || isAnyDragging}
          compact={isControlPanel}
          fontScale={layout.noticeFontScale || 100}
        />

        {/* 四向與角落縮放手柄 */}
        {canDrag && (
          <>
            <div
              onPointerDown={(e) => startWidgetPointer({ kind: "resize", widget: "notice", edge: "right" }, e)}
              className="absolute top-5 bottom-5 -right-1.5 w-3 cursor-ew-resize touch-none z-20 flex items-center justify-center"
              title="左右拖曳調整寬度"
            >
              <span className="w-1 h-8 rounded-full bg-orange-400/0 group-hover/notice:bg-orange-400/50 transition-colors" />
            </div>
            <div
              onPointerDown={(e) => startWidgetPointer({ kind: "resize", widget: "notice", edge: "bottom" }, e)}
              className="absolute left-5 right-5 -bottom-1.5 h-3 cursor-ns-resize touch-none z-20 flex items-center justify-center"
              title="上下拖曳調整高度"
            >
              <span className="h-1 w-10 rounded-full bg-orange-400/0 group-hover/notice:bg-orange-400/50 transition-colors" />
            </div>
            <div
              onPointerDown={(e) => startWidgetPointer({ kind: "resize", widget: "notice", edge: "corner" }, e)}
              title="自由拖曳調整「班級通知」寬高尺寸"
              className={`absolute right-1 bottom-1 w-6 h-6 rounded-lg cursor-nwse-resize flex items-center justify-center text-orange-600/60 hover:text-orange-700 hover:bg-white/80 touch-none z-30 transition-opacity ${
                isControlPanel ? "opacity-90" : "opacity-40 group-hover/notice:opacity-100"
              }`}
            >
              <GripHorizontal className="w-3.5 h-3.5 -rotate-45" />
            </div>
          </>
        )}
      </section>

      {/* 2. 自由拖曳＋縮放：「今日功課」自適應網格元件 */}
      <section
        onPointerDown={() => onSelectWidget?.("homework")}
        style={{
          left: `${layout.homeworkRect.x}%`,
          top: `${layout.homeworkRect.y}%`,
          width: `${layout.homeworkRect.w}%`,
          height: `${layout.homeworkRect.h}%`,
          zIndex: hwDragging || selectedWidget === "homework" ? 26 : 12,
        }}
        className={`group/hw absolute rounded-[22px] bg-white/45 backdrop-blur-md border shadow-[0_8px_28px_rgba(15,23,42,0.07)] flex flex-col ${
          isControlPanel ? "px-3 py-2.5" : "px-[clamp(14px,1.6vw,22px)] py-[clamp(12px,1.5vh,18px)] rounded-[24px]"
        } ${isAnyDragging ? "transition-none" : "transition-[box-shadow,border-color] duration-150"} ${
          hwDragging
            ? "border-emerald-500 ring-2 ring-emerald-500/65 shadow-xl"
            : isControlPanel && selectedWidget === "homework"
            ? "border-emerald-500/90 ring-2 ring-emerald-300/65"
            : "border-white/70"
        }`}
      >
        {/* 頂部拖曳定位手柄列 */}
        <div
          onPointerDown={canDrag ? (e) => startWidgetPointer({ kind: "move", widget: "homework" }, e) : undefined}
          title={canDrag ? "按住拖曳移動「今日功課」位置" : undefined}
          className={`flex items-center justify-between gap-2 shrink-0 touch-none ${
            isControlPanel ? "mb-1.5" : "mb-2.5"
          } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center justify-center rounded-xl bg-[#f5c451]/40 text-[#b46909] shadow-sm shrink-0 ${
                isControlPanel ? "w-6 h-6" : "w-7 h-7"
              }`}
            >
              <ClipboardList className={isControlPanel ? "w-3.5 h-3.5" : "w-4 h-4"} />
            </span>
            <h2
              className={`font-extrabold text-[#18201b] truncate ${
                isControlPanel ? "text-xs sm:text-sm" : "text-[clamp(1.06rem,1.35vw,1.4rem)]"
              }`}
            >
              {homeworkTitle || "今日功課"}
            </h2>
            <span className="text-[11px] font-bold text-[#4b5563] bg-white/65 border border-white/75 px-2 py-0.5 rounded-full shrink-0">
              共 {homeworks.length} 科
            </span>
          </div>

          {canDrag && (
            <div className="flex items-center gap-1.5 shrink-0">
              {hwDragging && (
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/95 border border-emerald-300 px-2 py-0.5 rounded-full shadow-sm tabular-nums">
                  X {Math.round(layout.homeworkRect.x)}% · Y {Math.round(layout.homeworkRect.y)}% · {Math.round(layout.homeworkRect.w)}%×{Math.round(layout.homeworkRect.h)}% · {effectiveCols} 欄
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700/90 bg-white/75 px-2 py-0.5 rounded-full transition-opacity ${
                  isControlPanel ? "opacity-95" : "opacity-0 group-hover/hw:opacity-100"
                }`}
              >
                <Move className="w-3 h-3" />
                {isControlPanel && <span>拖曳</span>}
              </span>
            </div>
          )}
        </div>

        {/* 自適應網格視口 */}
        {homeworks.length === 0 ? (
          <div className="flex-1 rounded-2xl border border-dashed border-slate-400/40 flex items-center justify-center text-slate-500 text-xs">
            今日暫無功課安排
          </div>
        ) : (
          <div
            ref={hwViewportRef}
            className={`marquee-viewport relative flex-1 min-h-0 overflow-hidden ${
              hwShouldScroll && !isAnyDragging && !isControlPanel ? "marquee-mask-y" : ""
            }`}
          >
            {hwShouldScroll && !isControlPanel ? (
              <div
                className="marquee-track-y flex flex-col"
                style={{
                  animationDuration: `${hwScrollDuration}s`,
                  animationPlayState: paused || isAnyDragging ? "paused" : "running",
                }}
              >
                {renderHomeworkCards(false)}
                <div aria-hidden="true">{renderHomeworkCards(true)}</div>
              </div>
            ) : (
              renderHomeworkCards(false)
            )}
          </div>
        )}

        {/* 上、左、右、下、右下角自由縮放手柄 */}
        {canDrag && (
          <>
            <div
              onPointerDown={(e) => startWidgetPointer({ kind: "resize", widget: "homework", edge: "top" }, e)}
              className="absolute left-6 right-6 -top-1.5 h-3 cursor-ns-resize touch-none z-20 flex items-center justify-center"
              title="向上／向下拖曳調整頂部邊界"
            >
              <span className="h-1 w-12 rounded-full bg-emerald-500/20 group-hover/hw:bg-emerald-500/60 transition-colors" />
            </div>
            <div
              onPointerDown={(e) => startWidgetPointer({ kind: "resize", widget: "homework", edge: "left" }, e)}
              className="absolute top-6 bottom-6 -left-1.5 w-3 cursor-ew-resize touch-none z-20 flex items-center justify-center"
              title="向左／向右拖曳調整左邊界"
            >
              <span className="w-1 h-10 rounded-full bg-emerald-500/0 group-hover/hw:bg-emerald-500/55 transition-colors" />
            </div>
            <div
              onPointerDown={(e) => startWidgetPointer({ kind: "resize", widget: "homework", edge: "right" }, e)}
              className="absolute top-6 bottom-6 -right-1.5 w-3 cursor-ew-resize touch-none z-20 flex items-center justify-center"
              title="左右拖曳調整「今日功課」寬度"
            >
              <span className="w-1 h-10 rounded-full bg-emerald-500/25 group-hover/hw:bg-emerald-500/70 transition-colors" />
            </div>
            <div
              onPointerDown={(e) => startWidgetPointer({ kind: "resize", widget: "homework", edge: "bottom" }, e)}
              className="absolute left-6 right-6 -bottom-1.5 h-3 cursor-ns-resize touch-none z-20 flex items-center justify-center"
              title="上下拖曳調整「今日功課」高度"
            >
              <span className="h-1 w-12 rounded-full bg-emerald-500/20 group-hover/hw:bg-emerald-500/60 transition-colors" />
            </div>
            <div
              onPointerDown={(e) => startWidgetPointer({ kind: "resize", widget: "homework", edge: "corner" }, e)}
              title="自由雙向拖曳調整「今日功課」寬高比例"
              className={`absolute right-1 bottom-1 w-6 h-6 rounded-lg cursor-nwse-resize flex items-center justify-center text-emerald-700/65 hover:text-emerald-700 hover:bg-white/85 touch-none z-30 transition-opacity ${
                isControlPanel ? "opacity-95" : "opacity-55 group-hover/hw:opacity-100"
              }`}
            >
              <GripHorizontal className="w-4 h-4 -rotate-45" />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
