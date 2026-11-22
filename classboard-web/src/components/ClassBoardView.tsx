"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  BellRing,
  CalendarClock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  MapPin,
  RotateCcw,
  Settings,
  Sun,
  ThermometerSnowflake,
  Umbrella,
  Users,
} from "lucide-react";
import {
  BoardLayoutConfig,
  ClassBoardData,
  DEFAULT_LAYOUT,
  WEEKDAY_LABELS,
  getActiveDutyWeekday,
  isDutyHighlightActive,
} from "@/types/board";
import { MacauWeather, fetchMacauWeather } from "@/lib/weatherApi";
import {
  CountdownDisplay,
  getCurrentSchoolWeek,
  getCustomCountdown,
  getNextCalendarCountdown,
  getUpcomingCalendarCountdowns,
} from "@/lib/schoolCalendar";
import { InteractiveBoardCanvas } from "./InteractiveBoardCanvas";

const CN_WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function formatDateTimeInfo(now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekday = CN_WEEKDAYS[now.getDay()];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return {
    dateStr: `${year}年${month}月${day}日`,
    weekdayStr: weekday,
    timeStr: `${hh}:${mm}`,
  };
}

function WeatherGlyph({ code }: { code: number }) {
  if (code === 0) return <Sun className="w-4 h-4 text-amber-500" />;
  if (code === 1 || code === 2) return <CloudSun className="w-4 h-4 text-amber-500" />;
  if (code === 3) return <Cloud className="w-4 h-4 text-slate-500" />;
  if (code === 45 || code === 48) return <CloudFog className="w-4 h-4 text-slate-500" />;
  if (code >= 95) return <CloudLightning className="w-4 h-4 text-indigo-500" />;
  if (code >= 51) return <CloudRain className="w-4 h-4 text-sky-500" />;
  return <CloudSun className="w-4 h-4 text-amber-500" />;
}

/** 澳門天氣貼心小提示（下雨帶傘／低溫保暖／高溫防暑） */
function getMacauWeatherCareTip(weather: MacauWeather | null): {
  text: string;
  tone: "rain" | "cold" | "hot";
} | null {
  if (!weather) return null;
  if (weather.weatherCode >= 51) {
    return { text: "記得帶傘", tone: "rain" };
  }
  if (weather.temperature <= 16) {
    return { text: "注意保暖", tone: "cold" };
  }
  if (weather.temperature >= 32) {
    return { text: "注意防暑", tone: "hot" };
  }
  return null;
}

export function ClassBoardView({
  data,
  paused = false,
  onLayoutChange,
  onLayoutCommit,
}: {
  data: ClassBoardData;
  paused?: boolean;
  onLayoutChange?: (nextLayout: BoardLayoutConfig) => void;
  onLayoutCommit?: (finalLayout: BoardLayoutConfig) => void;
}) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [weather, setWeather] = useState<MacauWeather | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);

  // 即時時鐘（每 5 秒對時確保分鐘切換與放學時段提醒精準，休眠時自動暫停）
  useEffect(() => {
    if (paused) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 5_000);
    return () => clearInterval(timer);
  }, [paused]);

  // 倒數輪播計時器（每 7 秒柔和切換一次近期重要校曆日程）
  useEffect(() => {
    if (paused || data.countdown.mode !== "auto_carousel") return;
    const timer = setInterval(() => {
      setCarouselIdx((prev) => prev + 1);
    }, 7_000);
    return () => clearInterval(timer);
  }, [paused, data.countdown.mode]);

  // 澳門即時氣溫（每 10 分鐘更新）
  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    const loadWeather = async () => {
      const w = await fetchMacauWeather();
      if (!cancelled && w) setWeather(w);
    };
    loadWeather();
    const timer = setInterval(loadWeather, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [paused]);

  const handleResetLayout = useCallback(() => {
    onLayoutChange?.(DEFAULT_LAYOUT);
    onLayoutCommit?.(DEFAULT_LAYOUT);
  }, [onLayoutChange, onLayoutCommit]);

  const { dateStr, weekdayStr, timeStr } = formatDateTimeInfo(now);
  const safeLeft = Math.min(50, Math.max(0, Number(data.leftSafePercent) || 34));
  const glassAlpha = Math.min(0.85, Math.max(0.12, (Number(data.glassOpacity) || 42) / 100));

  const schoolWeek = getCurrentSchoolWeek(now);
  const careTip = getMacauWeatherCareTip(weather);

  // 計算倒數膠囊列表（支援：雙倒數並排／自動輪播／最近單項／僅大考／自訂日期／關閉）
  let countdownBadges: CountdownDisplay[] = [];
  if (data.countdown.mode === "auto_dual") {
    countdownBadges = getUpcomingCalendarCountdowns(now, 2);
  } else if (data.countdown.mode === "auto_carousel") {
    const pool = getUpcomingCalendarCountdowns(now, 3);
    if (pool.length > 0) {
      countdownBadges = [pool[carouselIdx % pool.length]];
    }
  } else if (data.countdown.mode === "auto_all") {
    const one = getNextCalendarCountdown(now, "all");
    if (one) countdownBadges = [one];
  } else if (data.countdown.mode === "auto_exam") {
    const one = getNextCalendarCountdown(now, "exam");
    if (one) countdownBadges = [one];
  } else if (data.countdown.mode === "custom") {
    const one = getCustomCountdown(data.countdown.customTitle, data.countdown.customDate, now);
    if (one) countdownBadges = [one];
  }

  // 計算今日值日生名單與放學提醒高亮狀態
  const dutyInfo = getActiveDutyWeekday(data.duty.displayDay, now);
  const todayDutyList = data.duty.roster[dutyInfo.key] || [];
  const dutyDayBadge = dutyInfo.isNextWeekPreview
    ? `下週${WEEKDAY_LABELS[dutyInfo.key].replace("星期", "")}值日`
    : `${WEEKDAY_LABELS[dutyInfo.key]}值日`;
  const dutyHighlighted = isDutyHighlightActive(data.duty, now);

  const isCustomLayout =
    JSON.stringify(data.layout) !== JSON.stringify(DEFAULT_LAYOUT);

  return (
    <main className="classboard-wallpaper-stage relative w-screen h-screen overflow-hidden select-none flex">
      {/* 左側完全留空，透出教室電腦系統原桌布，專供放置桌面圖示與課件 */}
      <div
        className="shrink-0 h-full pointer-events-none"
        style={{ width: `${safeLeft}%` }}
        aria-hidden="true"
      />

      {/* 右側輕盈通透玻璃主看板 */}
      <div className="flex-1 min-w-0 h-full flex py-[clamp(16px,3.2vh,36px)] pr-[clamp(18px,2.6vw,42px)] pl-2">
        <section
          style={{
            backgroundColor: `rgba(255, 253, 249, ${glassAlpha})`,
          }}
          className="group/board w-full h-full rounded-[30px] backdrop-blur-xl border border-white/65 shadow-[0_20px_54px_rgba(15,23,42,0.12)] flex flex-col px-[clamp(18px,2.4vw,38px)] py-[clamp(14px,2.1vh,26px)] gap-[clamp(10px,1.5vh,16px)]"
        >
          {/* 頂部標題列：班級大標題 + 澳門氣溫＆貼心提示 + 校曆智慧倒數（支援雙並排／輪播） + 日期週次＆即時大時鐘 */}
          <header className="flex items-center justify-between gap-3 pb-[clamp(8px,1.2vh,14px)] border-b border-white/55 shrink-0">
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <h1 className="text-[clamp(1.85rem,2.85vw,3.05rem)] font-extrabold tracking-tight text-[#141b17] leading-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)] mr-1">
                {data.className || "高二戊班"}
              </h1>

              {/* 澳門即時氣溫＋貼心天氣小提示 */}
              <div
                title={
                  weather?.humidity != null
                    ? `澳門即時天氣：${weather.label} · 相對濕度 ${weather.humidity}%`
                    : "澳門即時氣溫"
                }
                className="inline-flex items-center gap-1.5 bg-white/60 backdrop-blur-md border border-white/75 shadow-[0_2px_10px_rgba(15,23,42,0.05)] px-3 py-1.5 rounded-full"
              >
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[clamp(0.78rem,0.92vw,0.94rem)] font-bold text-[#2b332e]">
                  澳門
                </span>
                {weather ? (
                  <>
                    <WeatherGlyph code={weather.weatherCode} />
                    <span className="text-[clamp(0.86rem,1.05vw,1.08rem)] font-extrabold text-[#111827] tabular-nums">
                      {weather.temperature}°C
                    </span>
                    <span className="text-[clamp(0.74rem,0.86vw,0.88rem)] font-semibold text-[#4b5563]">
                      {weather.label}
                    </span>
                    {careTip && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                          careTip.tone === "rain"
                            ? "bg-sky-500/15 text-sky-800 border border-sky-400/35"
                            : careTip.tone === "cold"
                            ? "bg-amber-500/20 text-amber-900 border border-amber-400/40"
                            : "bg-rose-500/15 text-rose-800 border border-rose-400/35"
                        }`}
                      >
                        {careTip.tone === "rain" ? (
                          <Umbrella className="w-3 h-3" />
                        ) : (
                          <ThermometerSnowflake className="w-3 h-3" />
                        )}
                        <span>{careTip.text}</span>
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs font-semibold text-[#64748b]">獲取氣溫中...</span>
                )}
              </div>

              {/* 2026-2027 澳坊中學校曆智慧倒數膠囊（支援雙倒數並排／自動輪播） */}
              {countdownBadges.map((cd, i) => (
                <div
                  key={`${cd.title}-${cd.targetDate}-${i}`}
                  title={
                    schoolWeek
                      ? `目標日期：${cd.targetDate} ｜ 本週週訓：${schoolWeek.motto}`
                      : `目標日期：${cd.targetDate}`
                  }
                  className={`inline-flex items-center gap-1.5 backdrop-blur-md border shadow-[0_2px_10px_rgba(15,23,42,0.05)] px-3 py-1.5 rounded-full transition-all duration-300 ${
                    cd.category === "exam"
                      ? "bg-rose-50/80 border-rose-200/85 text-rose-900"
                      : cd.category === "holiday"
                      ? "bg-emerald-50/80 border-emerald-200/85 text-emerald-900"
                      : "bg-indigo-50/80 border-indigo-200/85 text-indigo-900"
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  {cd.isOngoing ? (
                    <span className="text-[clamp(0.75rem,0.9vw,0.92rem)] font-extrabold">
                      今日：{cd.title}
                    </span>
                  ) : (
                    <span className="text-[clamp(0.75rem,0.9vw,0.92rem)] font-bold">
                      距離 <strong className="font-extrabold">{cd.title}</strong>{" "}
                      <span className="tabular-nums font-extrabold text-[clamp(0.84rem,1.02vw,1.04rem)]">
                        {cd.daysLeft}
                      </span>{" "}
                      天
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* 右側：日期週次 + 清晰即時大時鐘 */}
            <div className="shrink-0 flex items-center gap-3.5">
              {isCustomLayout && onLayoutChange && (
                <button
                  type="button"
                  onClick={handleResetLayout}
                  title="恢復預設佈局"
                  className="web-only-controls opacity-0 group-hover/board:opacity-100 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-700 bg-white/75 hover:bg-white border border-white/80 px-2.5 py-1 rounded-full shadow-sm transition-all"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>重設佈局</span>
                </button>
              )}

              <div
                className="text-right leading-tight"
                title={schoolWeek ? `本週週訓：${schoolWeek.motto}` : undefined}
              >
                <div
                  suppressHydrationWarning
                  className="text-[clamp(0.88rem,1.08vw,1.1rem)] font-extrabold text-[#1a221d]"
                >
                  {dateStr}
                </div>
                <div className="mt-0.5 text-[clamp(0.76rem,0.92vw,0.94rem)] font-bold text-[#475569] flex items-center justify-end gap-1.5">
                  <span suppressHydrationWarning>{weekdayStr}</span>
                  {schoolWeek && (
                    <span className="text-[11px] font-extrabold text-amber-800 bg-amber-100/80 border border-amber-200/70 px-1.5 py-0.5 rounded-md">
                      第 {schoolWeek.week} 週
                    </span>
                  )}
                </div>
              </div>

              {/* 即時大時鐘 */}
              <div className="pl-3 border-l border-slate-400/25">
                <div
                  suppressHydrationWarning
                  className="text-[clamp(1.75rem,2.6vw,2.75rem)] font-black tracking-tight text-[#111827] leading-none tabular-nums drop-shadow-[0_1px_1px_rgba(255,255,255,0.65)]"
                >
                  {timeStr}
                </div>
              </div>
            </div>
          </header>

          {/* 中間主體：自由拖曳定位＋縮放畫布（班級通知 + 今日功課） */}
          <InteractiveBoardCanvas
            noticeTitle={data.noticeTitle}
            notices={data.notices}
            homeworkTitle={data.homeworkTitle}
            homeworks={data.homeworks}
            layout={data.layout}
            paused={paused}
            onLayoutChange={onLayoutChange}
            onLayoutCommit={onLayoutCommit}
          />

          {/* 底部精簡玻璃條：今日值日生（支援放學時段提醒高亮模式！） */}
          {data.duty.enabled && todayDutyList.length > 0 && (
            <footer
              className={`shrink-0 rounded-[18px] backdrop-blur-md border px-3.5 py-2 flex items-center gap-2.5 flex-wrap transition-all duration-300 ${
                dutyHighlighted
                  ? "bg-gradient-to-r from-[#fff4db]/90 via-[#fff9eb]/90 to-[#fff3d6]/90 border-amber-400/95 ring-2 ring-amber-400/55 shadow-[0_8px_24px_rgba(245,158,11,0.18)]"
                  : "bg-white/50 border-white/70 shadow-[0_4px_16px_rgba(15,23,42,0.05)]"
              }`}
            >
              <div
                className={`inline-flex items-center gap-1.5 text-white text-xs font-extrabold px-2.5 py-1 rounded-xl shrink-0 shadow-sm ${
                  dutyHighlighted
                    ? "bg-gradient-to-r from-amber-600 to-orange-600"
                    : "bg-emerald-600/90"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{dutyDayBadge}</span>
              </div>

              {/* 放學時段自動醒目提醒膠囊 */}
              {dutyHighlighted && (
                <div className="inline-flex items-center gap-1 bg-amber-500/20 border border-amber-400/60 text-amber-950 text-xs font-extrabold px-2.5 py-1 rounded-xl shrink-0 animate-pulse">
                  <BellRing className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                  <span>{data.duty.highlightText || "放學請留步打掃"}</span>
                </div>
              )}

              <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                {todayDutyList.map((item, idx) => (
                  <div
                    key={`${dutyInfo.key}-${idx}`}
                    title={`${item.role}：${item.student}`}
                    className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[clamp(0.72rem,0.86vw,0.86rem)] ${
                      dutyHighlighted
                        ? "bg-white/95 border-amber-300/80 shadow-[0_2px_6px_rgba(245,158,11,0.1)]"
                        : "bg-white/75 border-white/85 shadow-[0_1px_4px_rgba(15,23,42,0.04)]"
                    }`}
                  >
                    <span
                      className={`font-bold ${
                        dutyHighlighted ? "text-amber-800" : "text-emerald-800/90"
                      }`}
                    >
                      {item.shortRole}
                    </span>
                    <span className="font-extrabold text-[#18201b]">{item.student}</span>
                  </div>
                ))}
              </div>
            </footer>
          )}
        </section>
      </div>

      {/* 僅普通瀏覽器訪問時顯示的編輯後台入口（DesktopBoard.exe 桌面模式下自動完全隱藏） */}
      <div className="web-only-controls fixed right-5 bottom-4 z-50">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/85 hover:bg-white text-slate-700 hover:text-emerald-700 backdrop-blur-md border border-white/90 shadow-lg px-4 py-2 text-sm font-semibold transition-all"
        >
          <Settings className="w-4 h-4" />
          <span>編輯看板內容</span>
        </Link>
      </div>
    </main>
  );
}
