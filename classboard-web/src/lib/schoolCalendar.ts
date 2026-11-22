/**
 * 2026-2027 學年澳坊中學校曆表資料與智慧倒數引擎
 * 內建全學年週次、週訓與重要考試／測驗／假期／活動日程
 */

export type CalendarEventCategory = "exam" | "activity" | "holiday";

export interface SchoolCalendarEvent {
  date: string;       // YYYY-MM-DD（開始日期）
  endDate?: string;   // YYYY-MM-DD（結束日期，可選）
  title: string;      // 事件名稱
  category: CalendarEventCategory;
}

export interface SchoolWeekInfo {
  week: number;
  startDate: string; // YYYY-MM-DD (週日)
  endDate: string;   // YYYY-MM-DD (週六)
  motto: string;     // 週訓
}

export const SCHOOL_CALENDAR_EVENTS: SchoolCalendarEvent[] = [
  { date: "2026-09-01", title: "開學禮", category: "activity" },
  { date: "2026-09-05", title: "高一、高二家長會", category: "activity" },
  { date: "2026-09-10", title: "教師節假期", category: "holiday" },
  { date: "2026-09-26", endDate: "2026-09-28", title: "中秋節假期", category: "holiday" },
  { date: "2026-10-01", endDate: "2026-10-02", title: "國慶假期", category: "holiday" },
  { date: "2026-10-13", endDate: "2026-10-15", title: "主科測驗周", category: "exam" },
  { date: "2026-10-16", title: "蓮峰及松山達標賽", category: "activity" },
  { date: "2026-10-18", endDate: "2026-10-19", title: "重陽節假期", category: "holiday" },
  { date: "2026-10-21", endDate: "2026-10-26", title: "術科測驗周", category: "exam" },
  { date: "2026-11-09", endDate: "2026-11-13", title: "普法教育周", category: "activity" },
  { date: "2026-11-23", endDate: "2026-11-25", title: "校運會", category: "activity" },
  { date: "2026-12-01", endDate: "2026-12-03", title: "主科測驗周", category: "exam" },
  { date: "2026-12-07", endDate: "2026-12-10", title: "術科測驗周", category: "exam" },
  { date: "2026-12-20", endDate: "2026-12-25", title: "回歸／冬至／聖誕假期", category: "holiday" },
  { date: "2027-01-01", title: "元旦假期", category: "holiday" },
  { date: "2027-01-09", title: "家長日", category: "activity" },
  { date: "2027-01-14", endDate: "2027-01-15", title: "中作／英作考試", category: "exam" },
  { date: "2027-01-19", endDate: "2027-01-23", title: "上學期考試", category: "exam" },
  { date: "2027-01-25", title: "下學期開始", category: "activity" },
  { date: "2027-01-31", endDate: "2027-02-14", title: "春節假期", category: "holiday" },
  { date: "2027-02-15", title: "下學期復課", category: "activity" },
  { date: "2027-03-08", title: "婦女節假期", category: "holiday" },
  { date: "2027-03-16", endDate: "2027-03-18", title: "主科測驗周", category: "exam" },
  { date: "2027-03-22", endDate: "2027-03-25", title: "術科測驗周", category: "exam" },
  { date: "2027-03-26", endDate: "2027-03-29", title: "復活節假期", category: "holiday" },
  { date: "2027-04-05", title: "清明節假期", category: "holiday" },
  { date: "2027-04-27", endDate: "2027-04-29", title: "主科測驗周", category: "exam" },
  { date: "2027-05-01", endDate: "2027-05-04", title: "勞動節／青年節假期", category: "holiday" },
  { date: "2027-05-06", endDate: "2027-05-11", title: "術科測驗周", category: "exam" },
  { date: "2027-05-13", title: "佛誕節假期", category: "holiday" },
  { date: "2027-05-22", title: "身心健康周及體育嘉年華頒獎禮", category: "activity" },
  { date: "2027-06-09", title: "端午節假期", category: "holiday" },
  { date: "2027-06-10", endDate: "2027-06-11", title: "中作／英作考試", category: "exam" },
  { date: "2027-06-22", endDate: "2027-06-26", title: "下學期考試", category: "exam" },
  { date: "2027-06-28", endDate: "2027-06-30", title: "研學日", category: "activity" },
  { date: "2027-07-03", title: "畢業禮", category: "activity" },
  { date: "2027-07-07", endDate: "2027-07-09", title: "非畢業班補考", category: "exam" },
  { date: "2027-07-15", title: "結業禮", category: "activity" },
];

const WEEK_RANGES: { start: string; end: string; week: number; motto: string }[] = [
  { start: "2026-08-30", end: "2026-09-05", week: 1, motto: "勤學作帆 志向為舵" },
  { start: "2026-09-06", end: "2026-09-12", week: 2, motto: "勤學作帆 志向為舵" },
  { start: "2026-09-13", end: "2026-09-19", week: 3, motto: "勤學作帆 志向為舵" },
  { start: "2026-09-20", end: "2026-09-26", week: 4, motto: "勤學作帆 志向為舵" },
  { start: "2026-09-27", end: "2026-10-03", week: 5, motto: "揮灑汗水 燃亮賽場" },
  { start: "2026-10-04", end: "2026-10-10", week: 6, motto: "揮灑汗水 燃亮賽場" },
  { start: "2026-10-11", end: "2026-10-17", week: 7, motto: "揮灑汗水 燃亮賽場" },
  { start: "2026-10-18", end: "2026-10-24", week: 8, motto: "揮灑汗水 燃亮賽場" },
  { start: "2026-10-25", end: "2026-10-31", week: 9, motto: "揮灑汗水 燃亮賽場" },
  { start: "2026-11-01", end: "2026-11-07", week: 10, motto: "尊憲守基 行穩致遠" },
  { start: "2026-11-08", end: "2026-11-14", week: 11, motto: "尊憲守基 行穩致遠" },
  { start: "2026-11-15", end: "2026-11-21", week: 12, motto: "尊憲守基 行穩致遠" },
  { start: "2026-11-22", end: "2026-11-28", week: 13, motto: "尊憲守基 行穩致遠" },
  { start: "2026-11-29", end: "2026-12-05", week: 14, motto: "蓮花寶地 青春作翼" },
  { start: "2026-12-06", end: "2026-12-12", week: 15, motto: "蓮花寶地 青春作翼" },
  { start: "2026-12-13", end: "2026-12-26", week: 16, motto: "蓮花寶地 青春作翼" },
  { start: "2026-12-27", end: "2027-01-02", week: 17, motto: "蓮花寶地 青春作翼" },
  { start: "2027-01-03", end: "2027-01-09", week: 18, motto: "蓮花寶地 青春作翼" },
  { start: "2027-01-10", end: "2027-01-16", week: 19, motto: "強健體魄 明亮心靈" },
  { start: "2027-01-17", end: "2027-01-23", week: 20, motto: "強健體魄 明亮心靈" },
  { start: "2027-01-24", end: "2027-02-13", week: 21, motto: "強健體魄 明亮心靈" },
  { start: "2027-02-14", end: "2027-02-20", week: 22, motto: "強健體魄 明亮心靈" },
  { start: "2027-02-21", end: "2027-02-27", week: 23, motto: "解開心晴密碼 喜迎向陽人生" },
  { start: "2027-02-28", end: "2027-03-06", week: 24, motto: "解開心晴密碼 喜迎向陽人生" },
  { start: "2027-03-07", end: "2027-03-13", week: 25, motto: "解開心晴密碼 喜迎向陽人生" },
  { start: "2027-03-14", end: "2027-03-20", week: 26, motto: "解開心晴密碼 喜迎向陽人生" },
  { start: "2027-03-21", end: "2027-03-27", week: 27, motto: "以書為翼 智慧啟航" },
  { start: "2027-03-28", end: "2027-04-03", week: 28, motto: "以書為翼 智慧啟航" },
  { start: "2027-04-04", end: "2027-04-10", week: 29, motto: "以書為翼 智慧啟航" },
  { start: "2027-04-11", end: "2027-04-17", week: 30, motto: "以書為翼 智慧啟航" },
  { start: "2027-04-18", end: "2027-04-24", week: 31, motto: "才華盡顯 閃耀舞台" },
  { start: "2027-04-25", end: "2027-05-01", week: 32, motto: "才華盡顯 閃耀舞台" },
  { start: "2027-05-02", end: "2027-05-08", week: 33, motto: "才華盡顯 閃耀舞台" },
  { start: "2027-05-09", end: "2027-05-15", week: 34, motto: "才華盡顯 閃耀舞台" },
  { start: "2027-05-16", end: "2027-05-22", week: 35, motto: "一步一腳印 時光釀成詩" },
  { start: "2027-05-23", end: "2027-05-29", week: 36, motto: "一步一腳印 時光釀成詩" },
  { start: "2027-05-30", end: "2027-06-05", week: 37, motto: "一步一腳印 時光釀成詩" },
  { start: "2027-06-06", end: "2027-06-12", week: 38, motto: "常懷感恩 永繫於心" },
  { start: "2027-06-13", end: "2027-06-19", week: 39, motto: "常懷感恩 永繫於心" },
  { start: "2027-06-20", end: "2027-06-26", week: 40, motto: "常懷感恩 永繫於心" },
];

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diffDays(fromYmd: string, toYmdStr: string): number {
  const a = new Date(`${fromYmd}T00:00:00`);
  const b = new Date(`${toYmdStr}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export function getCurrentSchoolWeek(now: Date = new Date()): SchoolWeekInfo | null {
  const today = toYmd(now);
  const found = WEEK_RANGES.find((w) => today >= w.start && today <= w.end);
  if (!found) return null;
  return {
    week: found.week,
    startDate: found.start,
    endDate: found.end,
    motto: found.motto,
  };
}

export interface CountdownDisplay {
  title: string;
  daysLeft: number; // 0 表示進行中／就是今天
  isOngoing: boolean;
  targetDate: string;
  category: CalendarEventCategory;
}

export function getNextCalendarCountdown(
  now: Date = new Date(),
  filter: "all" | "exam" = "all"
): CountdownDisplay | null {
  const today = toYmd(now);
  const pool =
    filter === "exam"
      ? SCHOOL_CALENDAR_EVENTS.filter((e) => e.category === "exam")
      : SCHOOL_CALENDAR_EVENTS;

  for (const ev of pool) {
    const end = ev.endDate || ev.date;
    if (today >= ev.date && today <= end) {
      return {
        title: ev.title,
        daysLeft: 0,
        isOngoing: true,
        targetDate: ev.date,
        category: ev.category,
      };
    }
    if (ev.date > today) {
      return {
        title: ev.title,
        daysLeft: diffDays(today, ev.date),
        isOngoing: false,
        targetDate: ev.date,
        category: ev.category,
      };
    }
  }
  return null;
}

export function getCustomCountdown(
  title: string,
  targetDate: string,
  now: Date = new Date()
): CountdownDisplay | null {
  if (!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return null;
  const today = toYmd(now);
  const delta = diffDays(today, targetDate);
  return {
    title: title.trim(),
    daysLeft: Math.max(0, delta),
    isOngoing: delta === 0,
    targetDate,
    category: "exam",
  };
}

/**
 * 獲取近期多筆重要校曆事件（用於「雙倒數並排」或「自動輪播倒數」模式）：
 * 優先同時包含近期活動／假期與近期大考／測驗周，讓學生同時掌握近期活動與考試進度。
 */
export function getUpcomingCalendarCountdowns(
  now: Date = new Date(),
  limit = 3
): CountdownDisplay[] {
  const today = toYmd(now);
  const results: CountdownDisplay[] = [];

  for (const ev of SCHOOL_CALENDAR_EVENTS) {
    const end = ev.endDate || ev.date;
    if (today >= ev.date && today <= end) {
      results.push({
        title: ev.title,
        daysLeft: 0,
        isOngoing: true,
        targetDate: ev.date,
        category: ev.category,
      });
    } else if (ev.date > today) {
      results.push({
        title: ev.title,
        daysLeft: diffDays(today, ev.date),
        isOngoing: false,
        targetDate: ev.date,
        category: ev.category,
      });
    }
    if (results.length >= limit) break;
  }

  // 若為雙倒數模式（limit===2）且前兩筆皆非考試，但後面有近期大考／測驗周，將第二筆替換為最近一次考試
  if (limit === 2 && results.length === 2 && results.every((r) => r.category !== "exam")) {
    const nextExam = getNextCalendarCountdown(now, "exam");
    if (nextExam && !results.some((r) => r.title === nextExam.title && r.targetDate === nextExam.targetDate)) {
      results[1] = nextExam;
    }
  }

  return results;
}

