"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Cloud,
  CloudSun,
  Eraser,
  Eye,
  Flame,
  HardDrive,
  LayoutGrid,
  Lock,
  MapPin,
  Move,
  Plus,
  RotateCcw,
  Save,
  Sliders,
  Trash2,
  Type,
  Users,
  Zap,
} from "lucide-react";
import {
  BoardLayoutConfig,
  ClassBoardData,
  CountdownConfig,
  DEFAULT_BOARD_DATA,
  DEFAULT_DUTY_ROSTER,
  DEFAULT_LAYOUT,
  HomeworkCard,
  HomeworkTheme,
  PRESET_LAYOUTS,
  SUBJECT_QUICK_TEMPLATES,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  WeekdayKey,
  WidgetRect,
  clampFontScale,
  clampWidgetRect,
  getActiveDutyWeekday,
  isDutyHighlightActive,
  normalizeBoardData,
} from "@/types/board";
import { StorageSource, fetchBoardData, saveBoardData } from "@/lib/boardApi";
import { MacauWeather, fetchMacauWeather } from "@/lib/weatherApi";
import {
  CountdownDisplay,
  getCurrentSchoolWeek,
  getCustomCountdown,
  getNextCalendarCountdown,
  getUpcomingCalendarCountdowns,
} from "@/lib/schoolCalendar";
import { broadcastBoardUpdate, subscribeBoardUpdates } from "@/lib/liveSync";
import {
  ActiveWidgetKey,
  InteractiveBoardCanvas,
} from "@/components/InteractiveBoardCanvas";

const THEME_OPTIONS: { value: HomeworkTheme; label: string; dot: string }[] = [
  { value: "yellow", label: "暖鵝黃", dot: "bg-[#f2b749]" },
  { value: "green", label: "薄荷綠", dot: "bg-[#43b578]" },
  { value: "blue", label: "晴空藍", dot: "bg-[#5184e6]" },
  { value: "pink", label: "櫻花粉", dot: "bg-[#ec6a9b]" },
  { value: "purple", label: "香芋紫", dot: "bg-[#8b63e6]" },
  { value: "orange", label: "蜜橘橙", dot: "bg-[#f0843c]" },
];

const FONT_SIZE_PRESETS: { label: string; value: number }[] = [
  { label: "小", value: 85 },
  { label: "標準", value: 100 },
  { label: "偏大", value: 115 },
  { label: "大號", value: 130 },
  { label: "特大", value: 150 },
];

function getFontScaleLabel(scale: number): string {
  const exact = FONT_SIZE_PRESETS.find((p) => p.value === scale);
  if (exact) return exact.label;
  if (scale < 92) return "偏小";
  if (scale < 108) return "標準";
  if (scale < 123) return "偏大";
  if (scale < 140) return "大號";
  return "特大";
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function AdminPage() {
  const [data, setData] = useState<ClassBoardData>(DEFAULT_BOARD_DATA);
  const [source, setSource] = useState<StorageSource>("local_preview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [password, setPassword] = useState("123456");
  const [autoCloudSync, setAutoCloudSync] = useState(true);
  const [selectedWidget, setSelectedWidget] = useState<ActiveWidgetKey>("homework");
  const [activeDutyTab, setActiveDutyTab] = useState<WeekdayKey>("mon");
  const [hwMetrics, setHwMetrics] = useState({ hwCols: 3, hwPixelW: 600, hwPixelH: 240 });
  const [lastSyncMs, setLastSyncMs] = useState<number>(0);
  const [weather, setWeather] = useState<MacauWeather | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const autoSaveTimerRef = useRef<number | null>(null);
  const latestDataRef = useRef(data);
  latestDataRef.current = data;
  const latestPasswordRef = useRef(password);
  latestPasswordRef.current = password;

  useEffect(() => {
    const savedPwd = window.sessionStorage.getItem("classboard_admin_pwd");
    if (savedPwd) setPassword(savedPwd);

    fetchBoardData().then((res) => {
      setData(res.data);
      setSource(res.source);
      setLoading(false);
    });

    fetchMacauWeather().then((w) => {
      if (w) setWeather(w);
    });

    const clockTimer = setInterval(() => setNow(new Date()), 15_000);

    const unsub = subscribeBoardUpdates((incoming, latency) => {
      setData(normalizeBoardData(incoming));
      setLastSyncMs(latency);
    });

    return () => {
      clearInterval(clockTimer);
      unsub();
    };
  }, []);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const applyDataUpdate = useCallback(
    (updater: (prev: ClassBoardData) => ClassBoardData) => {
      const t0 = performance.now();
      setData((prev) => {
        const next = updater(prev);
        broadcastBoardUpdate(next);
        setLastSyncMs(Math.max(1, Math.round(performance.now() - t0)));
        return next;
      });
    },
    []
  );

  const pushToCloud = useCallback(
    async (targetData: ClassBoardData, silent = false) => {
      const pwd = latestPasswordRef.current.trim();
      if (!pwd) {
        if (!silent) showToast("error", "請先填寫管理密碼（預設 123456）");
        return;
      }
      setSaving(true);
      window.sessionStorage.setItem("classboard_admin_pwd", pwd);
      const res = await saveBoardData(targetData, pwd);
      setSaving(false);
      setSource(res.source);

      if (res.ok) {
        if (res.data) {
          setData(res.data);
          broadcastBoardUpdate(res.data);
        }
        if (!silent) showToast("success", res.message);
      } else if (!silent) {
        showToast("error", res.message);
      }
    },
    [showToast]
  );

  const handleManualSave = () => {
    pushToCloud(latestDataRef.current, false);
  };

  const handleCanvasLayoutChange = useCallback(
    (nextLayout: BoardLayoutConfig) => {
      applyDataUpdate((prev) => ({ ...prev, layout: nextLayout }));
    },
    [applyDataUpdate]
  );

  const handleCanvasLayoutCommit = useCallback(
    (finalLayout: BoardLayoutConfig) => {
      const nextData: ClassBoardData = {
        ...latestDataRef.current,
        layout: finalLayout,
      };
      broadcastBoardUpdate(nextData);
      if (autoCloudSync) {
        if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = window.setTimeout(() => {
          pushToCloud(nextData, true);
        }, 120);
      }
    },
    [autoCloudSync, pushToCloud]
  );

  const updateSelectedRectField = (field: keyof WidgetRect, value: number) => {
    const key = selectedWidget === "notice" ? "noticeRect" : "homeworkRect";
    const fallback =
      selectedWidget === "notice"
        ? DEFAULT_LAYOUT.noticeRect
        : DEFAULT_LAYOUT.homeworkRect;

    applyDataUpdate((prev) => {
      const cur = prev.layout[key];
      const patched = clampWidgetRect({ ...cur, [field]: value }, fallback);
      return {
        ...prev,
        layout: {
          ...prev.layout,
          [key]: patched,
        },
      };
    });
  };

  const updateSelectedFontScale = (nextScale: number, commitCloud = false) => {
    const field = selectedWidget === "notice" ? "noticeFontScale" : "homeworkFontScale";
    const clamped = clampFontScale(nextScale, 100);
    let updatedSnapshot: ClassBoardData | null = null;
    applyDataUpdate((prev) => {
      const next: ClassBoardData = {
        ...prev,
        layout: {
          ...prev.layout,
          [field]: clamped,
        },
      };
      updatedSnapshot = next;
      return next;
    });
    if (commitCloud && autoCloudSync && updatedSnapshot) {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
      const snapshotToSave = updatedSnapshot;
      autoSaveTimerRef.current = window.setTimeout(() => {
        pushToCloud(snapshotToSave, true);
      }, 150);
    }
  };

  const applyPresetLayout = (presetKey: keyof typeof PRESET_LAYOUTS) => {
    const preset = PRESET_LAYOUTS[presetKey];
    const nextData: ClassBoardData = {
      ...latestDataRef.current,
      layout: {
        ...preset.layout,
        noticeFontScale: latestDataRef.current.layout.noticeFontScale,
        homeworkFontScale: latestDataRef.current.layout.homeworkFontScale,
      },
    };
    applyDataUpdate(() => nextData);
    if (autoCloudSync) {
      pushToCloud(nextData, true);
    }
    showToast("success", `已套用「${preset.label}」佈局並即時更新`);
  };

  // --- 功課快捷操作（10 秒佈置功課效率工具） ---
  const addHomeworkFromTemplate = (tpl?: {
    subject: string;
    badgeText: string;
    theme: HomeworkTheme;
  }) => {
    const themes: HomeworkTheme[] = ["yellow", "green", "blue", "pink", "purple", "orange"];
    const nextTheme = tpl?.theme || themes[data.homeworks.length % themes.length];
    const newCard: HomeworkCard = {
      id: uid("hw"),
      badgeText: tpl?.badgeText || "科",
      subject: tpl?.subject || "新科目",
      title: "",
      content: "",
      footerTag: "",
      urgent: false,
      theme: nextTheme,
    };
    applyDataUpdate((prev) => ({ ...prev, homeworks: [...prev.homeworks, newCard] }));
  };

  const clearYesterdayHomeworks = () => {
    applyDataUpdate((prev) => ({
      ...prev,
      homeworks: prev.homeworks.map((h) => ({
        ...h,
        title: "",
        content: "",
        footerTag: "",
        urgent: false,
      })),
    }));
    showToast("success", "已保留各科卡片並清空昨日功課內容（填寫今日新作業後點儲存即可）");
  };

  const updateHomework = (id: string, patch: Partial<HomeworkCard>) => {
    applyDataUpdate((prev) => ({
      ...prev,
      homeworks: prev.homeworks.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
  };

  const moveHomework = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= data.homeworks.length) return;
    applyDataUpdate((prev) => {
      const next = [...prev.homeworks];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, homeworks: next };
    });
  };

  const removeHomework = (id: string) => {
    applyDataUpdate((prev) => ({
      ...prev,
      homeworks: prev.homeworks.filter((h) => h.id !== id),
    }));
  };

  // --- 值日生編輯操作 ---
  const updateDutyStudent = (day: WeekdayKey, idx: number, student: string) => {
    applyDataUpdate((prev) => {
      const dayList = [...(prev.duty.roster[day] || [])];
      if (!dayList[idx]) return prev;
      dayList[idx] = { ...dayList[idx], student };
      return {
        ...prev,
        duty: {
          ...prev.duty,
          roster: {
            ...prev.duty.roster,
            [day]: dayList,
          },
        },
      };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf7f0] flex items-center justify-center text-slate-500">
        正在載入班級看板控制面板...
      </div>
    );
  }

  const activeRect =
    selectedWidget === "notice" ? data.layout.noticeRect : data.layout.homeworkRect;
  const activeFontScale = clampFontScale(
    selectedWidget === "notice"
      ? data.layout?.noticeFontScale
      : data.layout?.homeworkFontScale,
    100
  );
  const areaCoveragePct = Math.round((activeRect.w * activeRect.h) / 100);
  const glassAlpha = Math.min(0.85, Math.max(0.12, (Number(data.glassOpacity) || 42) / 100));

  const schoolWeek = getCurrentSchoolWeek(now);
  let previewCountdowns: CountdownDisplay[] = [];
  if (data.countdown.mode === "auto_dual") {
    previewCountdowns = getUpcomingCalendarCountdowns(now, 2);
  } else if (data.countdown.mode === "auto_carousel") {
    previewCountdowns = getUpcomingCalendarCountdowns(now, 3);
  } else if (data.countdown.mode === "auto_all") {
    const one = getNextCalendarCountdown(now, "all");
    if (one) previewCountdowns = [one];
  } else if (data.countdown.mode === "auto_exam") {
    const one = getNextCalendarCountdown(now, "exam");
    if (one) previewCountdowns = [one];
  } else if (data.countdown.mode === "custom") {
    const one = getCustomCountdown(data.countdown.customTitle, data.countdown.customDate, now);
    if (one) previewCountdowns = [one];
  }

  const dutyPreviewInfo = getActiveDutyWeekday(data.duty.displayDay, now);
  const dutyPreviewList = data.duty.roster[dutyPreviewInfo.key] || [];
  const dutyPreviewHighlighted = isDutyHighlightActive(data.duty, now);
  const previewTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf6ee] via-[#f7f8f5] to-[#eef7f1] text-slate-800 pb-24">
      {/* 頂部固定操作欄 */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-lg border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="返回看板預覽"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                班級桌面看板 · 控制面板
                {source === "cloudflare_d1" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Cloud className="w-3.5 h-3.5" /> Cloudflare D1 即時秒同步
                  </span>
                ) : source === "cloudflare_kv" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                    <Cloud className="w-3.5 h-3.5" /> Cloudflare KV 同步
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <HardDrive className="w-3.5 h-3.5" /> 本地預覽模式
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500">
                內建 2026-2027 澳坊中學校曆智慧倒數＋高二戊班值日安排，支援即時自由拖曳與秒同步
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center">
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="管理密碼"
                title="管理密碼（預設 123456）"
                className="w-28 sm:w-32 pl-8 pr-2.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">開啟展示頁</span>
            </Link>

            <button
              onClick={handleManualSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm shadow-emerald-600/20 transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "同步中..." : "儲存並推送"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 浮動提示 */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4">
          <div
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl border text-sm font-semibold ${
              toast.type === "success"
                ? "bg-emerald-600 text-white border-emerald-500"
                : "bg-rose-600 text-white border-rose-500"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* 0. 核心互動區：自由拖曳與即時預覽控制面板 */}
        <section className="rounded-3xl bg-white/95 border border-emerald-200/80 shadow-sm p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 inline-flex items-center justify-center">
                  <LayoutGrid className="w-4 h-4" />
                </span>
                自由拖曳排版畫布（滑鼠／觸控即時調整）
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
                  <Zap className="w-3 h-3" /> 刷新延遲 {lastSyncMs}ms
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                按住「班級通知」或「今日功課」標題列拖曳定位，拖曳四邊／右下角縮放大小，或於右側微調字體大小
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCloudSync}
                  onChange={(e) => setAutoCloudSync(e.target.checked)}
                  className="accent-emerald-600 w-3.5 h-3.5"
                />
                <span>拖曳放手自動同步雲端</span>
              </label>

              {(Object.keys(PRESET_LAYOUTS) as Array<keyof typeof PRESET_LAYOUTS>).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => applyPresetLayout(k)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-semibold text-slate-700 transition"
                >
                  {PRESET_LAYOUTS[k].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* 左側 8 欄：16:10 即時比例互動拖曳舞台 */}
            <div className="lg:col-span-8">
              <div className="classboard-wallpaper-stage relative w-full aspect-[16/10] rounded-2xl border border-amber-200/80 shadow-inner overflow-hidden flex">
                {/* 左側桌面圖示預留區示意 */}
                <div
                  style={{ width: `${data.leftSafePercent}%` }}
                  className="shrink-0 h-full border-r border-dashed border-amber-700/20 flex flex-col items-center justify-center p-2 text-center pointer-events-none"
                >
                  <div className="grid grid-cols-2 gap-2 opacity-40 mb-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-6 h-6 rounded-lg bg-white/80 border border-amber-900/15" />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-amber-900/55 bg-white/50 px-2 py-0.5 rounded-full">
                    桌面圖示區 {data.leftSafePercent}%
                  </span>
                </div>

                {/* 右側毛玻璃看板容器 */}
                <div className="flex-1 min-w-0 h-full p-2.5 sm:p-3 flex">
                  <div
                    style={{
                      backgroundColor: `rgba(255, 253, 249, ${glassAlpha})`,
                    }}
                    className="w-full h-full rounded-2xl backdrop-blur-xl border border-white/75 shadow-lg flex flex-col p-2.5 gap-1.5"
                  >
                    {/* 頂部即時標頭預覽（班級＋澳門氣溫＋校曆倒數＋大時鐘） */}
                    <div className="flex items-center justify-between gap-2 pb-1 border-b border-white/60 shrink-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="text-sm font-extrabold text-slate-900 truncate">
                          {data.className || "高二戊班"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white/65 border border-white/80 px-1.5 py-0.5 rounded-full shrink-0">
                          <MapPin className="w-2.5 h-2.5 text-amber-600" />
                          <span>澳門</span>
                          <CloudSun className="w-2.5 h-2.5 text-amber-500" />
                          <span>{weather ? `${weather.temperature}°C` : "--°C"}</span>
                        </span>
                        {previewCountdowns.slice(0, 2).map((cd, idx) => (
                          <span
                            key={`${cd.title}-${idx}`}
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 border ${
                              cd.category === "exam"
                                ? "text-rose-800 bg-rose-50/90 border-rose-200/80"
                                : "text-indigo-800 bg-indigo-50/85 border-indigo-200/80"
                            }`}
                          >
                            <CalendarClock className="w-2.5 h-2.5" />
                            <span>
                              {cd.isOngoing
                                ? `今日：${cd.title}`
                                : `${cd.title} ${cd.daysLeft}天`}
                            </span>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {schoolWeek && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded">
                            第{schoolWeek.week}週
                          </span>
                        )}
                        <span className="text-sm font-black text-slate-900 tabular-nums">
                          {previewTimeStr}
                        </span>
                      </div>
                    </div>

                    {/* 可自由拖曳定位與縮放的內部互動畫布 */}
                    <InteractiveBoardCanvas
                      noticeTitle={data.noticeTitle}
                      notices={data.notices}
                      homeworkTitle={data.homeworkTitle}
                      homeworks={data.homeworks}
                      layout={data.layout}
                      isControlPanel
                      selectedWidget={selectedWidget}
                      onSelectWidget={setSelectedWidget}
                      onLayoutChange={handleCanvasLayoutChange}
                      onLayoutCommit={handleCanvasLayoutCommit}
                      onMetricsChange={setHwMetrics}
                    />

                    {/* 底部值日生即時預覽條（同步呈現放學提醒高亮狀態） */}
                    {data.duty.enabled && dutyPreviewList.length > 0 && (
                      <div
                        className={`shrink-0 rounded-xl border px-2 py-1 flex items-center gap-1 overflow-hidden transition-all ${
                          dutyPreviewHighlighted
                            ? "bg-amber-50/95 border-amber-400 ring-1 ring-amber-400/70"
                            : "bg-white/55 border-white/75"
                        }`}
                      >
                        <span
                          className={`text-[9px] font-extrabold text-white px-1.5 py-0.5 rounded shrink-0 ${
                            dutyPreviewHighlighted ? "bg-amber-600" : "bg-emerald-600"
                          }`}
                        >
                          {WEEKDAY_LABELS[dutyPreviewInfo.key]}值日
                        </span>
                        {dutyPreviewHighlighted && (
                          <span className="text-[9px] font-extrabold text-amber-900 bg-amber-200/70 px-1.5 py-0.5 rounded shrink-0">
                            🔔 {data.duty.highlightText || "放學請留步打掃"}
                          </span>
                        )}
                        <div className="flex items-center gap-1 truncate text-[9px] font-bold text-slate-700">
                          {dutyPreviewList.slice(0, 5).map((d, i) => (
                            <span key={i} className="bg-white/80 px-1.5 py-0.5 rounded truncate">
                              {d.shortRole} {d.student.replace(/（.*）/, "")}
                            </span>
                          ))}
                          {dutyPreviewList.length > 5 && <span>+{dutyPreviewList.length - 5}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 右側 4 欄：即時雙向聯動數值、字體大小與狀態監控面板 */}
            <div className="lg:col-span-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 p-4 flex flex-col justify-between gap-4">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-emerald-600" />
                    選中元件即時參數
                  </span>
                  <button
                    type="button"
                    onClick={() => applyPresetLayout("vertical")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-emerald-700"
                  >
                    <RotateCcw className="w-3 h-3" /> 重設佈局
                  </button>
                </div>

                {/* 元件切換標籤 */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-200/70">
                  <button
                    type="button"
                    onClick={() => setSelectedWidget("notice")}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      selectedWidget === "notice"
                        ? "bg-white text-orange-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    班級通知面板
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWidget("homework")}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      selectedWidget === "homework"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    今日功課網格
                  </button>
                </div>

                {/* 即時同步座標與寬高滑桿 */}
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-0.5">
                      <span>水平位置 X</span>
                      <span className="tabular-nums font-bold text-slate-900">
                        {activeRect.x.toFixed(1)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, 100 - activeRect.w)}
                      step={0.5}
                      value={activeRect.x}
                      onChange={(e) => updateSelectedRectField("x", Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-0.5">
                      <span>垂直位置 Y</span>
                      <span className="tabular-nums font-bold text-slate-900">
                        {activeRect.y.toFixed(1)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, 100 - activeRect.h)}
                      step={0.5}
                      value={activeRect.y}
                      onChange={(e) => updateSelectedRectField("y", Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-0.5">
                      <span>模組寬度 W</span>
                      <span className="tabular-nums font-bold text-slate-900">
                        {activeRect.w.toFixed(1)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={28}
                      max={100}
                      step={0.5}
                      value={activeRect.w}
                      onChange={(e) => updateSelectedRectField("w", Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-0.5">
                      <span>模組高度 H</span>
                      <span className="tabular-nums font-bold text-slate-900">
                        {activeRect.h.toFixed(1)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={18}
                      max={100}
                      step={0.5}
                      value={activeRect.h}
                      onChange={(e) => updateSelectedRectField("h", Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                  </div>

                  {/* 字體大小選擇 */}
                  <div className="pt-2.5 border-t border-slate-200/80">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                      <span className="inline-flex items-center gap-1">
                        <Type className="w-3.5 h-3.5 text-emerald-600" />
                        字體大小
                      </span>
                      <span className="tabular-nums font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px]">
                        目前選取：{activeFontScale}% · {getFontScaleLabel(activeFontScale)}
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1 mb-1.5">
                      {FONT_SIZE_PRESETS.map((preset) => {
                        const isSelected = activeFontScale === preset.value;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => updateSelectedFontScale(preset.value, true)}
                            className={`py-1.5 rounded-lg text-[11px] font-bold border transition ${
                              isSelected
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="range"
                      min={75}
                      max={170}
                      step={5}
                      value={activeFontScale}
                      onChange={(e) => updateSelectedFontScale(Number(e.target.value), false)}
                      onPointerUp={(e) =>
                        updateSelectedFontScale(Number(e.currentTarget.value), true)
                      }
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* 即時狀態指標卡片 */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200/80">
                <div className="rounded-xl bg-white border border-slate-200/70 px-3 py-2">
                  <div className="text-[11px] text-slate-400 font-medium">佔用畫布面積</div>
                  <div className="text-sm font-extrabold text-slate-800 tabular-nums">
                    {areaCoveragePct}%
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-slate-200/70 px-3 py-2">
                  <div className="text-[11px] text-slate-400 font-medium">功課自適應網格</div>
                  <div className="text-sm font-extrabold text-emerald-700 tabular-nums">
                    {hwMetrics.hwCols} 欄排列
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 1. 上半區：班級通知 */}
        <section className="rounded-3xl bg-white/95 border border-orange-200/80 shadow-sm p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 inline-flex items-center justify-center">
                <BellRing className="w-4 h-4" />
              </span>
              班級通知（統一單塊面板展示）
            </h2>
          </div>

          <textarea
            rows={4}
            value={data.notices.join("\n")}
            onChange={(e) => {
              const lines = e.target.value.split("\n");
              applyDataUpdate((prev) => ({ ...prev, notices: lines }));
            }}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-orange-50/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm font-medium leading-relaxed resize-y"
            placeholder="直接輸入班級通知內容，按 Enter 換行可分多條展示（上方畫布與展示頁即時同步更新）..."
          />
        </section>

        {/* 2. 下半區：今日功課（含 10 秒佈置效率工具：一鍵清空昨日內容 + 高中科目快捷新增 + 急件標記） */}
        <section className="rounded-3xl bg-white/95 border border-slate-200/70 shadow-sm p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-yellow-100 text-yellow-700 inline-flex items-center justify-center">
                <ClipboardList className="w-4 h-4" />
              </span>
              今日功課（共 {data.homeworks.length} 科）
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearYesterdayHomeworks}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-xs font-bold transition"
                title="保留所有科目卡片，只清空昨天的作業文字與急件標記"
              >
                <Eraser className="w-3.5 h-3.5" /> 保留科目・清空昨日內容
              </button>
              <button
                type="button"
                onClick={() => addHomeworkFromTemplate()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition"
              >
                <Plus className="w-4 h-4" /> 新增空白科目
              </button>
            </div>
          </div>

          {/* 高中科目一鍵快捷新增列 */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-200/70 rounded-2xl px-3 py-2">
            <span className="text-xs font-bold text-slate-500 mr-1">一鍵新增科目：</span>
            {SUBJECT_QUICK_TEMPLATES.map((tpl) => (
              <button
                key={tpl.subject}
                type="button"
                onClick={() => addHomeworkFromTemplate(tpl)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs font-bold text-slate-700 hover:text-emerald-800 shadow-sm transition"
              >
                <span>+ {tpl.subject}</span>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {data.homeworks.map((hw, idx) => (
              <div
                key={hw.id}
                className={`rounded-2xl border p-4 space-y-3 transition ${
                  hw.urgent
                    ? "border-rose-300 bg-rose-50/35"
                    : "border-slate-200 bg-[#fcfbf8]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500">配色：</span>
                      {THEME_OPTIONS.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => updateHomework(hw.id, { theme: t.value })}
                          title={t.label}
                          className={`w-5 h-5 rounded-full ${t.dot} transition ${
                            hw.theme === t.value
                              ? "ring-2 ring-offset-2 ring-slate-700 scale-110"
                              : "opacity-55 hover:opacity-100"
                          }`}
                        />
                      ))}
                    </div>

                    {/* 單科急件／明天交醒目開關 */}
                    <button
                      type="button"
                      onClick={() => updateHomework(hw.id, { urgent: !hw.urgent })}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition ${
                        hw.urgent
                          ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                          : "bg-white text-slate-500 border-slate-200 hover:border-rose-300 hover:text-rose-600"
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>{hw.urgent ? "已標記：急・明天交" : "標記急件／明天交"}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveHomework(idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      title="上移"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveHomework(idx, 1)}
                      disabled={idx === data.homeworks.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      title="下移"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeHomework(hw.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition"
                      title="刪除此科目"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      單字徽章
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={hw.badgeText || ""}
                      onChange={(e) => updateHomework(hw.id, { badgeText: e.target.value })}
                      placeholder="語"
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-center"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      科目名稱
                    </label>
                    <input
                      type="text"
                      value={hw.subject}
                      onChange={(e) => updateHomework(hw.id, { subject: e.target.value })}
                      placeholder="語文"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      小標題（可選）
                    </label>
                    <input
                      type="text"
                      value={hw.title || ""}
                      onChange={(e) => updateHomework(hw.id, { title: e.target.value })}
                      placeholder="如：練習冊 / 背誦"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      高亮小標籤（可選）
                    </label>
                    <input
                      type="text"
                      value={hw.footerTag || ""}
                      onChange={(e) => updateHomework(hw.id, { footerTag: e.target.value })}
                      placeholder="如：完成實驗記錄（留空不顯示）"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    具體功課內容
                  </label>
                  <textarea
                    rows={2}
                    value={hw.content}
                    onChange={(e) => updateHomework(hw.id, { content: e.target.value })}
                    placeholder="填寫詳細功課要求（支援多行）"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm resize-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. 2026-2027 澳坊中學校曆智慧倒數設定（支援雙倒數並排／自動輪播） */}
        <section className="rounded-3xl bg-white/95 border border-indigo-200/70 shadow-sm p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 inline-flex items-center justify-center">
                <CalendarClock className="w-4 h-4" />
              </span>
              澳坊中學校曆倒數（支援雙倒數並排與自動輪播）
            </h2>
            {previewCountdowns.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {previewCountdowns.map((cd, i) => (
                  <span
                    key={`${cd.title}-${i}`}
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      cd.category === "exam"
                        ? "text-rose-800 bg-rose-50 border-rose-200"
                        : "text-indigo-700 bg-indigo-50 border-indigo-200"
                    }`}
                  >
                    {cd.isOngoing
                      ? `今日「${cd.title}」`
                      : `距離「${cd.title}」${cd.daysLeft} 天（${cd.targetDate}）`}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                倒數顯示模式
              </label>
              <select
                value={data.countdown.mode}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({
                    ...prev,
                    countdown: {
                      ...prev.countdown,
                      mode: e.target.value as CountdownConfig["mode"],
                    },
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-semibold"
              >
                <option value="auto_dual">雙倒數並排（近期活動＋近期測驗大考同時顯示・推薦）</option>
                <option value="auto_carousel">自動輪播倒數（每 7 秒柔和切換近期 3 項重要日程）</option>
                <option value="auto_all">單項倒數（僅顯示最近 1 項校曆事件）</option>
                <option value="auto_exam">僅大考／測驗周倒數（只顯示最近 1 次測驗或考試）</option>
                <option value="custom">自訂倒數標題與目標日期</option>
                <option value="off">關閉倒數膠囊</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                自訂事件名稱（選「自訂」時生效）
              </label>
              <input
                type="text"
                disabled={data.countdown.mode !== "custom"}
                value={data.countdown.customTitle}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({
                    ...prev,
                    countdown: { ...prev.countdown, customTitle: e.target.value },
                  }))
                }
                placeholder="例如：上學期考試"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                自訂目標日期
              </label>
              <input
                type="date"
                disabled={data.countdown.mode !== "custom"}
                value={data.countdown.customDate}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({
                    ...prev,
                    countdown: { ...prev.countdown, customDate: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-sm"
              />
            </div>
          </div>
        </section>

        {/* 4. 今日值日生管理（已內建高二戊班上學期 35 位同學完整值日表） */}
        <section className="rounded-3xl bg-white/95 border border-emerald-200/70 shadow-sm p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 inline-flex items-center justify-center">
                <Users className="w-4 h-4" />
              </span>
              今日值日生安排（已內建高二戊班 35 位同學完整輪值表）
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={data.duty.enabled}
                  onChange={(e) =>
                    applyDataUpdate((prev) => ({
                      ...prev,
                      duty: { ...prev.duty, enabled: e.target.checked },
                    }))
                  }
                  className="accent-emerald-600 w-3.5 h-3.5"
                />
                <span>在桌面底部顯示值日生</span>
              </label>

              <select
                value={data.duty.displayDay}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({
                    ...prev,
                    duty: {
                      ...prev.duty,
                      displayDay: e.target.value as "auto" | WeekdayKey,
                    },
                  }))
                }
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700"
              >
                <option value="auto">按當天星期自動切換（推薦）</option>
                {WEEKDAY_ORDER.map((d) => (
                  <option key={d} value={d}>
                    固定顯示{WEEKDAY_LABELS[d]}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  applyDataUpdate((prev) => ({
                    ...prev,
                    duty: { ...prev.duty, roster: DEFAULT_DUTY_ROSTER },
                  }));
                  showToast("success", "已恢復高二戊班上學期原始值日表");
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 恢復原表
              </button>
            </div>
          </div>

          {/* 值日生放學提醒高亮設定列 */}
          <div className="mb-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3.5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4">
              <label className="block text-xs font-bold text-amber-900 mb-1">
                🔔 值日生放學提醒高亮模式
              </label>
              <select
                value={data.duty.highlightMode}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({
                    ...prev,
                    duty: {
                      ...prev.duty,
                      highlightMode: e.target.value as "auto_time" | "always" | "off",
                    },
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="auto_time">放學時段自動高亮（推薦）</option>
                <option value="always">常駐高亮（全天醒目提醒／立即預覽）</option>
                <option value="off">關閉高亮提醒</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                開始時間
              </label>
              <input
                type="time"
                disabled={data.duty.highlightMode !== "auto_time"}
                value={data.duty.highlightStart}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({
                    ...prev,
                    duty: { ...prev.duty, highlightStart: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-xl border border-amber-200 bg-white disabled:bg-slate-100 text-xs font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                結束時間
              </label>
              <input
                type="time"
                disabled={data.duty.highlightMode !== "auto_time"}
                value={data.duty.highlightEnd}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({
                    ...prev,
                    duty: { ...prev.duty, highlightEnd: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-xl border border-amber-200 bg-white disabled:bg-slate-100 text-xs font-bold"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                提醒標語
              </label>
              <input
                type="text"
                disabled={data.duty.highlightMode === "off"}
                value={data.duty.highlightText}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({
                    ...prev,
                    duty: { ...prev.duty, highlightText: e.target.value },
                  }))
                }
                placeholder="放學請留步打掃"
                className="w-full px-3 py-1.5 rounded-xl border border-amber-200 bg-white disabled:bg-slate-100 text-xs font-bold"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {WEEKDAY_ORDER.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setActiveDutyTab(day)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeDutyTab === day
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {WEEKDAY_LABELS[day]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(data.duty.roster[activeDutyTab] || []).map((entry, idx) => (
              <div
                key={`${activeDutyTab}-${idx}`}
                className="rounded-2xl border border-slate-200/80 bg-[#f8fbf9] p-3"
              >
                <label
                  className="block text-[11px] font-bold text-emerald-800 mb-1 truncate"
                  title={entry.role}
                >
                  {entry.role}
                </label>
                <input
                  type="text"
                  value={entry.student}
                  onChange={(e) => updateDutyStudent(activeDutyTab, idx, e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            ))}
          </div>
        </section>

        {/* 5. 基本資訊與通透度/留白設定 */}
        <section className="rounded-3xl bg-white/95 border border-slate-200/70 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 inline-flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </span>
              基本資訊與桌面通透度／留白設定
            </h2>
            <button
              onClick={() => {
                applyDataUpdate(() => DEFAULT_BOARD_DATA);
                showToast("success", "已恢復預設範例資料（記得點右上角儲存）");
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 恢復範例資料
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                班級名稱
              </label>
              <input
                type="text"
                value={data.className}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({ ...prev, className: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm font-semibold"
                placeholder="例如：高二戊班"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                背景玻璃通透度 ({data.glassOpacity}%)
              </label>
              <input
                type="range"
                min={15}
                max={85}
                value={data.glassOpacity}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({
                    ...prev,
                    glassOpacity: Number(e.target.value),
                  }))
                }
                className="w-full accent-emerald-600 mt-2"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>極透(15%)</span>
                <span>通透(42%)</span>
                <span>偏實(85%)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                左側桌面圖示留白 ({data.leftSafePercent}%)
              </label>
              <input
                type="range"
                min={18}
                max={46}
                value={data.leftSafePercent}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({
                    ...prev,
                    leftSafePercent: Number(e.target.value),
                  }))
                }
                className="w-full accent-emerald-600 mt-2"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>看板更大(18%)</span>
                <span>標準(34%)</span>
                <span>多圖示(46%)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                教室桌面自動同步頻率
              </label>
              <select
                value={data.refreshIntervalSec}
                onChange={(e) =>
                  applyDataUpdate((prev) => ({
                    ...prev,
                    refreshIntervalSec: Number(e.target.value),
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
              >
                <option value={3}>每 3 秒同步一次（極速）</option>
                <option value={5}>每 5 秒同步一次（推薦）</option>
                <option value={10}>每 10 秒同步一次</option>
                <option value={30}>每 30 秒同步一次</option>
                <option value={60}>每 1 分鐘同步一次</option>
              </select>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
