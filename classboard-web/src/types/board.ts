export type HomeworkTheme = "yellow" | "green" | "blue" | "pink" | "purple" | "orange";

export interface HomeworkCard {
  id: string;
  badgeText?: string; // 科目標識字，例如 "語"、"數"、"英"
  subject: string;    // 科目名稱，例如：語文、數學、英語
  title?: string;     // 功課簡短標題，例如：背誦課文 / 練習冊 / 聽讀
  content: string;    // 具體功課內容（支援換行）
  footerTag?: string; // 高亮小膠囊標籤，例如：完成實驗記錄
  urgent?: boolean;   // 急件／明天交醒目標記
  theme: HomeworkTheme;
}

export interface WidgetRect {
  x: number; // 0 ~ 100 (%)
  y: number; // 0 ~ 100 (%)
  w: number; // 28 ~ 100 (%)
  h: number; // 18 ~ 96 (%)
}

export interface CardSpan {
  colSpan: number; // 1 ~ 3
  rowSpan: number; // 1 ~ 2
}

export interface BoardLayoutConfig {
  noticeRect: WidgetRect;
  homeworkRect: WidgetRect;
  cardSpans: Record<string, CardSpan>;
  /** 「班級通知」字體大小百分比（75 ~ 170，預設 100） */
  noticeFontScale: number;
  /** 「今日功課」字體大小百分比（75 ~ 170，預設 100） */
  homeworkFontScale: number;
}

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri";

export interface DutyEntry {
  role: string;      // 崗位名稱（如：倒垃圾&保持周圍環境整潔、黑板、掃地...）
  shortRole: string; // 精簡顯示名稱（如：倒垃圾、黑板、掃地...）
  student: string;   // 學生姓名與學號（如：甘浩君（1））
}

export interface DutyConfig {
  enabled: boolean;
  displayDay: "auto" | WeekdayKey;
  roster: Record<WeekdayKey, DutyEntry[]>;
  /** 放學時段值日生提醒高亮模式：auto_time=按時段自動高亮、always=常駐高亮預覽、off=關閉 */
  highlightMode: "auto_time" | "always" | "off";
  /** 自動高亮開始時間（HH:mm，預設 "15:30"） */
  highlightStart: string;
  /** 自動高亮結束時間（HH:mm，預設 "17:30"） */
  highlightEnd: string;
  /** 高亮提示語（預設 "放學請留步打掃"） */
  highlightText: string;
}

export interface CountdownConfig {
  mode: "auto_dual" | "auto_carousel" | "auto_all" | "auto_exam" | "custom" | "off";
  customTitle: string;
  customDate: string; // YYYY-MM-DD
}

export interface ClassBoardData {
  className: string;          // 例如：高二戊班
  subtitle?: string;          // 相容舊欄位
  leftSafePercent: number;    // 左側留給桌面圖示的空白寬度百分比（預設 34%）
  glassOpacity: number;       // 主面板毛玻璃不透明度百分比（預設 42%，越低越通透）
  refreshIntervalSec: number; // 桌面自動拉取雲端更新的間隔秒數（預設 5）
  noticeTitle: string;        // 通知標題，預設：班級通知
  notices: string[];          // 統一單塊通知內容列表
  homeworkTitle: string;      // 功課標題，預設：今日功課
  homeworks: HomeworkCard[];  // 自由拖曳自適應網格功課列表
  layout: BoardLayoutConfig;  // 自由拖曳定位與縮放佈局設定（雲端同步）
  countdown: CountdownConfig; // 校曆倒數／自訂倒數設定
  duty: DutyConfig;           // 今日值日生安排（內建高二戊班 35 人完整名單）
  updatedAt?: string;
}

export const WEEKDAY_ORDER: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri"];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "星期一",
  tue: "星期二",
  wed: "星期三",
  thu: "星期四",
  fri: "星期五",
};

export function getActiveDutyWeekday(
  displayDay: "auto" | WeekdayKey,
  now: Date = new Date()
): { key: WeekdayKey; isNextWeekPreview: boolean } {
  if (displayDay !== "auto") {
    return { key: displayDay, isNextWeekPreview: false };
  }
  const d = now.getDay(); // 0=Sun, 1=Mon..5=Fri, 6=Sat
  const map: Record<number, WeekdayKey> = {
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
  };
  if (map[d]) {
    return { key: map[d], isNextWeekPreview: false };
  }
  return { key: "mon", isNextWeekPreview: true };
}

/** 2026-2027 高二戊 上學期完整值日安排（35 位同學） */
export const DEFAULT_DUTY_ROSTER: Record<WeekdayKey, DutyEntry[]> = {
  mon: [
    { role: "倒垃圾&保持周圍環境整潔", shortRole: "倒垃圾", student: "甘浩君（1）" },
    { role: "黑板", shortRole: "黑板", student: "黃天佑（25）" },
    { role: "掃地", shortRole: "掃地", student: "劉銳霖（29）" },
    { role: "拖地", shortRole: "拖地", student: "庄永揚（2）" },
    { role: "移檯", shortRole: "移檯", student: "黃子陽（23）" },
    { role: "教師檯&飲品區", shortRole: "教師檯", student: "黃伊伊（24）" },
    { role: "檢查櫃桶&後方書本", shortRole: "檢查櫃桶", student: "林志翔（10）" },
  ],
  tue: [
    { role: "倒垃圾&保持周圍環境整潔", shortRole: "倒垃圾", student: "陳志洋（18）" },
    { role: "黑板", shortRole: "黑板", student: "趙雋豪（28）" },
    { role: "掃地", shortRole: "掃地", student: "譚國榮（35）" },
    { role: "拖地", shortRole: "拖地", student: "李羽軒（5）" },
    { role: "移檯", shortRole: "移檯", student: "卓俊熙（9）" },
    { role: "教師檯&飲品區", shortRole: "教師檯", student: "陳俊樑（19）" },
    { role: "檢查櫃桶&後方書本", shortRole: "檢查櫃桶", student: "陳柏希（21）" },
  ],
  wed: [
    { role: "倒垃圾&保持周圍環境整潔", shortRole: "倒垃圾", student: "梁天愛（16）" },
    { role: "黑板", shortRole: "黑板", student: "洪國倫（13）" },
    { role: "掃地", shortRole: "掃地", student: "陳鈺琳（22）" },
    { role: "拖地", shortRole: "拖地", student: "呂奕瑤（4）" },
    { role: "移檯", shortRole: "移檯", student: "黃語桁（26）" },
    { role: "教師檯&飲品區", shortRole: "教師檯", student: "蔣家政（31）" },
    { role: "檢查櫃桶&後方書本", shortRole: "檢查櫃桶", student: "陳思滔（20）" },
  ],
  thu: [
    { role: "倒垃圾&保持周圍環境整潔", shortRole: "倒垃圾", student: "蔣齡玉（33）" },
    { role: "黑板", shortRole: "黑板", student: "蔡君煌（32）" },
    { role: "掃地", shortRole: "掃地", student: "胡衍芝（15）" },
    { role: "拖地", shortRole: "拖地", student: "李駿杰（7）" },
    { role: "移檯", shortRole: "移檯", student: "林鈺夕（12）" },
    { role: "教師檯&飲品區", shortRole: "教師檯", student: "洪寧欣（14）" },
    { role: "檢查櫃桶&後方書本", shortRole: "檢查櫃桶", student: "林惠怡（11）" },
  ],
  fri: [
    { role: "倒垃圾&保持周圍環境整潔", shortRole: "倒垃圾", student: "汪偉豪（8）" },
    { role: "黑板", shortRole: "黑板", student: "盧夢煊（34）" },
    { role: "掃地", shortRole: "掃地", student: "潘靜瑤（30）" },
    { role: "拖地", shortRole: "拖地", student: "李嘉良（6）" },
    { role: "移檯", shortRole: "移檯", student: "楊茲童（27）" },
    { role: "教師檯&飲品區", shortRole: "教師檯", student: "陳卉琳（17）" },
    { role: "檢查櫃桶&後方書本", shortRole: "檢查櫃桶", student: "庄則鎧（3）" },
  ],
};

export const DEFAULT_DUTY_CONFIG: DutyConfig = {
  enabled: true,
  displayDay: "auto",
  roster: DEFAULT_DUTY_ROSTER,
  highlightMode: "auto_time",
  highlightStart: "15:30",
  highlightEnd: "17:30",
  highlightText: "放學請留步打掃",
};

export const DEFAULT_COUNTDOWN_CONFIG: CountdownConfig = {
  mode: "auto_dual",
  customTitle: "上學期考試",
  customDate: "2027-01-19",
};

export function isDutyHighlightActive(
  duty: DutyConfig,
  now: Date = new Date()
): boolean {
  if (!duty.enabled || duty.highlightMode === "off") return false;
  if (duty.highlightMode === "always") return true;

  const parseHm = (str: string, fallbackMin: number): number => {
    const m = /^(\d{1,2}):(\d{2})$/.exec((str || "").trim());
    if (!m) return fallbackMin;
    const h = Math.min(23, Math.max(0, Number(m[1])));
    const min = Math.min(59, Math.max(0, Number(m[2])));
    return h * 60 + min;
  };

  const startMin = parseHm(duty.highlightStart, 15 * 60 + 30);
  const endMin = parseHm(duty.highlightEnd, 17 * 60 + 30);
  const curMin = now.getHours() * 60 + now.getMinutes();

  if (startMin <= endMin) {
    return curMin >= startMin && curMin <= endMin;
  }
  return curMin >= startMin || curMin <= endMin;
}

export const DEFAULT_LAYOUT: BoardLayoutConfig = {
  noticeRect: { x: 0, y: 0, w: 100, h: 40 },
  homeworkRect: { x: 0, y: 43, w: 100, h: 57 },
  cardSpans: {},
  noticeFontScale: 100,
  homeworkFontScale: 100,
};

export const PRESET_LAYOUTS: Record<
  "vertical" | "sideBySide" | "bigHomework",
  { label: string; layout: BoardLayoutConfig }
> = {
  vertical: {
    label: "標準上下",
    layout: {
      noticeRect: { x: 0, y: 0, w: 100, h: 40 },
      homeworkRect: { x: 0, y: 43, w: 100, h: 57 },
      cardSpans: {},
      noticeFontScale: 100,
      homeworkFontScale: 100,
    },
  },
  sideBySide: {
    label: "左右並排",
    layout: {
      noticeRect: { x: 0, y: 0, w: 36, h: 100 },
      homeworkRect: { x: 38, y: 0, w: 62, h: 100 },
      cardSpans: {},
      noticeFontScale: 100,
      homeworkFontScale: 100,
    },
  },
  bigHomework: {
    label: "大功課區",
    layout: {
      noticeRect: { x: 0, y: 0, w: 100, h: 28 },
      homeworkRect: { x: 0, y: 31, w: 100, h: 69 },
      cardSpans: {},
      noticeFontScale: 100,
      homeworkFontScale: 100,
    },
  },
};

export const SUBJECT_QUICK_TEMPLATES: {
  subject: string;
  badgeText: string;
  theme: HomeworkTheme;
}[] = [
  { subject: "語文", badgeText: "語", theme: "yellow" },
  { subject: "數學", badgeText: "數", theme: "green" },
  { subject: "英語", badgeText: "英", theme: "blue" },
  { subject: "物理", badgeText: "物", theme: "purple" },
  { subject: "化學", badgeText: "化", theme: "pink" },
  { subject: "生物", badgeText: "生", theme: "green" },
  { subject: "歷史", badgeText: "歷", theme: "orange" },
  { subject: "地理", badgeText: "地", theme: "blue" },
  { subject: "資訊", badgeText: "資", theme: "purple" },
];

export function clampFontScale(val: unknown, fallback = 100): number {
  const num = typeof val === "number" && Number.isFinite(val) ? val : fallback;
  return Math.min(170, Math.max(75, Math.round(num)));
}

export function clampWidgetRect(rect: Partial<WidgetRect> | undefined, fallback: WidgetRect): WidgetRect {
  const rawW = typeof rect?.w === "number" && Number.isFinite(rect.w) ? rect.w : fallback.w;
  const rawH = typeof rect?.h === "number" && Number.isFinite(rect.h) ? rect.h : fallback.h;
  const w = Math.min(100, Math.max(28, Math.round(rawW * 10) / 10));
  const h = Math.min(100, Math.max(18, Math.round(rawH * 10) / 10));

  const rawX = typeof rect?.x === "number" && Number.isFinite(rect.x) ? rect.x : fallback.x;
  const rawY = typeof rect?.y === "number" && Number.isFinite(rect.y) ? rect.y : fallback.y;
  const x = Math.min(100 - w, Math.max(0, Math.round(rawX * 10) / 10));
  const y = Math.min(100 - h, Math.max(0, Math.round(rawY * 10) / 10));

  return { x, y, w, h };
}

export const DEFAULT_BOARD_DATA: ClassBoardData = {
  className: "高二戊班",
  leftSafePercent: 34,
  glassOpacity: 42,
  refreshIntervalSec: 5,
  noticeTitle: "班級通知",
  notices: [
    "本週五下午 15:30 召開期中家長會，請各位同學放學前整理好課桌與作業本。",
    "明天上午大課間進行全校眼保健操與廣播體操檢查，請統一穿秋季校服。",
    "近期早晚溫差較大，請注意及時增減衣物，課間不要在走廊追逐打鬧。",
  ],
  homeworkTitle: "今日功課",
  homeworks: [
    {
      id: "hw-1",
      badgeText: "語",
      subject: "語文",
      title: "背誦與抄寫",
      content: "背誦課文第 2 自然段，生字詞抄寫兩遍並組詞",
      footerTag: "明日早讀抽背",
      urgent: false,
      theme: "yellow",
    },
    {
      id: "hw-2",
      badgeText: "數",
      subject: "數學",
      title: "練習冊",
      content: "完成數學練習冊 P35—36，訂正昨天的錯題並家長簽字",
      footerTag: "",
      urgent: true,
      theme: "green",
    },
    {
      id: "hw-3",
      badgeText: "英",
      subject: "英語",
      title: "聽讀練習",
      content: "跟讀 Unit 3 課文錄音 15 分鐘，熟記本單元重點單詞",
      footerTag: "完成實驗記錄",
      urgent: false,
      theme: "blue",
    },
  ],
  layout: DEFAULT_LAYOUT,
  countdown: DEFAULT_COUNTDOWN_CONFIG,
  duty: DEFAULT_DUTY_CONFIG,
};

function toTraditionalDefaults(text: string): string {
  return text
    .replaceAll("班级通知", "班級通知")
    .replaceAll("今日功课", "今日功課")
    .replaceAll("课后任务", "課後任務")
    .replaceAll("在这里填写具体功课内容", "在這裡填寫具體功課內容")
    .replaceAll("在这里填写新的班级通知内容", "在這裡填寫新的班級通知內容")
    .replaceAll("科学", "科學")
    .replaceAll("语文", "語文")
    .replaceAll("数学", "數學")
    .replaceAll("英语", "英語");
}

export function normalizeBoardData(
  input: Partial<ClassBoardData> | null | undefined
): ClassBoardData {
  if (!input || typeof input !== "object") {
    return DEFAULT_BOARD_DATA;
  }

  const rawHomeworks = Array.isArray(input.homeworks)
    ? input.homeworks.map((h) => ({
        ...h,
        badgeText: h.badgeText ? toTraditionalDefaults(h.badgeText) : h.badgeText,
        subject: toTraditionalDefaults(h.subject || ""),
        title: h.title ? toTraditionalDefaults(h.title) : h.title,
        content: toTraditionalDefaults(h.content || ""),
        footerTag: h.footerTag ? toTraditionalDefaults(h.footerTag) : h.footerTag,
        urgent: Boolean(h.urgent),
      }))
    : DEFAULT_BOARD_DATA.homeworks;

  const rawNotices = Array.isArray(input.notices)
    ? input.notices.map((n) => toTraditionalDefaults(n))
    : DEFAULT_BOARD_DATA.notices;

  const rawLayout = input.layout;
  const normalizedLayout: BoardLayoutConfig = {
    noticeRect: clampWidgetRect(rawLayout?.noticeRect, DEFAULT_LAYOUT.noticeRect),
    homeworkRect: clampWidgetRect(rawLayout?.homeworkRect, DEFAULT_LAYOUT.homeworkRect),
    cardSpans:
      rawLayout?.cardSpans && typeof rawLayout.cardSpans === "object"
        ? rawLayout.cardSpans
        : {},
    noticeFontScale: clampFontScale(rawLayout?.noticeFontScale, 100),
    homeworkFontScale: clampFontScale(rawLayout?.homeworkFontScale, 100),
  };

  const rawCountdown = input.countdown;
  const normalizedCountdown: CountdownConfig = {
    mode:
      rawCountdown?.mode === "auto_dual" ||
      rawCountdown?.mode === "auto_carousel" ||
      rawCountdown?.mode === "auto_all" ||
      rawCountdown?.mode === "auto_exam" ||
      rawCountdown?.mode === "custom" ||
      rawCountdown?.mode === "off"
        ? rawCountdown.mode
        : DEFAULT_COUNTDOWN_CONFIG.mode,
    customTitle: rawCountdown?.customTitle || DEFAULT_COUNTDOWN_CONFIG.customTitle,
    customDate: rawCountdown?.customDate || DEFAULT_COUNTDOWN_CONFIG.customDate,
  };

  const rawDuty = input.duty;
  const normalizedRoster: Record<WeekdayKey, DutyEntry[]> = {
    mon: Array.isArray(rawDuty?.roster?.mon) && rawDuty.roster.mon.length > 0 ? rawDuty.roster.mon : DEFAULT_DUTY_ROSTER.mon,
    tue: Array.isArray(rawDuty?.roster?.tue) && rawDuty.roster.tue.length > 0 ? rawDuty.roster.tue : DEFAULT_DUTY_ROSTER.tue,
    wed: Array.isArray(rawDuty?.roster?.wed) && rawDuty.roster.wed.length > 0 ? rawDuty.roster.wed : DEFAULT_DUTY_ROSTER.wed,
    thu: Array.isArray(rawDuty?.roster?.thu) && rawDuty.roster.thu.length > 0 ? rawDuty.roster.thu : DEFAULT_DUTY_ROSTER.thu,
    fri: Array.isArray(rawDuty?.roster?.fri) && rawDuty.roster.fri.length > 0 ? rawDuty.roster.fri : DEFAULT_DUTY_ROSTER.fri,
  };
  const normalizedDuty: DutyConfig = {
    enabled: typeof rawDuty?.enabled === "boolean" ? rawDuty.enabled : true,
    displayDay:
      rawDuty?.displayDay === "auto" ||
      rawDuty?.displayDay === "mon" ||
      rawDuty?.displayDay === "tue" ||
      rawDuty?.displayDay === "wed" ||
      rawDuty?.displayDay === "thu" ||
      rawDuty?.displayDay === "fri"
        ? rawDuty.displayDay
        : "auto",
    roster: normalizedRoster,
    highlightMode:
      rawDuty?.highlightMode === "auto_time" ||
      rawDuty?.highlightMode === "always" ||
      rawDuty?.highlightMode === "off"
        ? rawDuty.highlightMode
        : DEFAULT_DUTY_CONFIG.highlightMode,
    highlightStart: rawDuty?.highlightStart || DEFAULT_DUTY_CONFIG.highlightStart,
    highlightEnd: rawDuty?.highlightEnd || DEFAULT_DUTY_CONFIG.highlightEnd,
    highlightText: rawDuty?.highlightText
      ? toTraditionalDefaults(rawDuty.highlightText)
      : DEFAULT_DUTY_CONFIG.highlightText,
  };

  return {
    ...DEFAULT_BOARD_DATA,
    ...input,
    noticeTitle: toTraditionalDefaults(input.noticeTitle || DEFAULT_BOARD_DATA.noticeTitle),
    homeworkTitle: toTraditionalDefaults(input.homeworkTitle || DEFAULT_BOARD_DATA.homeworkTitle),
    glassOpacity:
      typeof input.glassOpacity === "number"
        ? Math.min(85, Math.max(12, input.glassOpacity))
        : DEFAULT_BOARD_DATA.glassOpacity,
    notices: rawNotices,
    homeworks: rawHomeworks,
    layout: normalizedLayout,
    countdown: normalizedCountdown,
    duty: normalizedDuty,
  };
}
