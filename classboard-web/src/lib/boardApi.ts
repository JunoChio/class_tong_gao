import { ClassBoardData, DEFAULT_BOARD_DATA, normalizeBoardData } from "@/types/board";

const LOCAL_STORAGE_KEY = "classboard_local_data_v1";

export type StorageSource = "cloudflare_d1" | "cloudflare_kv" | "local_preview";

export interface FetchBoardResult {
  data: ClassBoardData;
  source: StorageSource;
}

export async function fetchBoardData(): Promise<FetchBoardResult> {
  try {
    const res = await fetch(`/api/board?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
    });

    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        if (json && json.ok) {
          if (json.storage === "cloudflare_d1" || json.storage === "cloudflare_kv") {
            const normalized = normalizeBoardData(json.data);
            saveToLocalCache(normalized);
            return { data: normalized, source: json.storage };
          }
        }
      }
    }
  } catch {
    // 本地開發模式或離線時自動降級讀取本地快取
  }

  const localData = loadFromLocalCache();
  return {
    data: localData || DEFAULT_BOARD_DATA,
    source: "local_preview",
  };
}

export interface SaveBoardResult {
  ok: boolean;
  source: StorageSource;
  message: string;
  data?: ClassBoardData;
}

export async function saveBoardData(
  data: ClassBoardData,
  password: string
): Promise<SaveBoardResult> {
  const normalized = normalizeBoardData({
    ...data,
    updatedAt: new Date().toISOString(),
  });

  try {
    const res = await fetch("/api/board", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Password": password,
      },
      body: JSON.stringify(normalized),
    });

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await res.json();
      const src: StorageSource =
        json.storage === "cloudflare_d1" ? "cloudflare_d1" : "cloudflare_kv";
      if (res.status === 401) {
        return {
          ok: false,
          source: src,
          message: json.error || "管理密碼不正確，請檢查後再試",
        };
      }
      if (res.ok && json.ok) {
        const saved = normalizeBoardData(json.data || normalized);
        saveToLocalCache(saved);
        return {
          ok: true,
          source: src,
          message:
            src === "cloudflare_d1"
              ? "已即時寫入雲端 D1 資料庫！教室桌面 5 秒內自動秒同步。"
              : "已儲存至雲端！教室桌面將自動同步更新。",
          data: saved,
        };
      }
      return {
        ok: false,
        source: src,
        message: json.error || "雲端儲存失敗，請檢查 Cloudflare 資料庫綁定",
      };
    }
  } catch {
    // 非 Cloudflare Pages 執行環境
  }

  if (password !== "123456") {
    return {
      ok: false,
      source: "local_preview",
      message: "本地預覽預設密碼為 123456",
    };
  }
  saveToLocalCache(normalized);
  return {
    ok: true,
    source: "local_preview",
    message: "已儲存至本地瀏覽器預覽",
    data: normalized,
  };
}

function saveToLocalCache(data: ClassBoardData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function loadFromLocalCache(): ClassBoardData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return normalizeBoardData(JSON.parse(raw));
  } catch {
    return null;
  }
}
