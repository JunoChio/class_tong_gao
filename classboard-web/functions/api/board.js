/**
 * Cloudflare Pages Function: /api/board
 * 优先使用 Cloudflare D1（强一致性 SQLite 数据库，写入即生效 0 延迟！），
 * 同时兼容回退至 Cloudflare KV（BOARD_KV）。
 *
 * 绑定要求：
 * - D1 数据库绑定变量名：BOARD_DB
 * - （可选）环境变量管理密码：ADMIN_PASSWORD（默认 123456）
 */

const RECORD_ID = "main";
const KV_KEY = "classboard_data_v1";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Pragma": "no-cache",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    },
  });
}

async function ensureD1Table(db) {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS board_state (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)"
    )
    .run();
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    },
  });
}

export async function onRequestGet(context) {
  const { env } = context;

  // 1. 优先使用强一致性 Cloudflare D1（0 延迟实时读）
  if (env && env.BOARD_DB) {
    try {
      await ensureD1Table(env.BOARD_DB);
      const row = await env.BOARD_DB.prepare(
        "SELECT payload FROM board_state WHERE id = ?"
      )
        .bind(RECORD_ID)
        .first();

      let data = row && row.payload ? JSON.parse(row.payload) : null;

      // 首次从旧 KV 平滑迁移一次（如果 D1 为空但旧 KV 里已有数据）
      if (!data && env.BOARD_KV) {
        try {
          const legacyRaw = await env.BOARD_KV.get(KV_KEY);
          if (legacyRaw) {
            data = JSON.parse(legacyRaw);
            await env.BOARD_DB.prepare(
              "INSERT INTO board_state (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
            )
              .bind(RECORD_ID, JSON.stringify(data), new Date().toISOString())
              .run();
          }
        } catch {
          // 忽略迁移异常
        }
      }

      return jsonResponse({
        ok: true,
        storage: "cloudflare_d1",
        data,
      });
    } catch (err) {
      return jsonResponse(
        {
          ok: false,
          error: "读取 Cloudflare D1 失败: " + String(err),
        },
        500
      );
    }
  }

  // 2. 兼容回退至 KV
  if (env && env.BOARD_KV) {
    try {
      const raw = await env.BOARD_KV.get(KV_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return jsonResponse({
        ok: true,
        storage: "cloudflare_kv",
        data,
      });
    } catch (err) {
      return jsonResponse(
        {
          ok: false,
          error: "读取 Cloudflare KV 失败: " + String(err),
        },
        500
      );
    }
  }

  return jsonResponse({
    ok: true,
    storage: "unconfigured",
    data: null,
    message: "未检测到 BOARD_DB / BOARD_KV 绑定",
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const expectedPassword =
    env && env.ADMIN_PASSWORD ? String(env.ADMIN_PASSWORD) : "123456";
  const providedPassword = request.headers.get("X-Admin-Password") || "";

  if (providedPassword !== expectedPassword) {
    return jsonResponse(
      {
        ok: false,
        error: "管理密碼錯誤，請重新輸入",
      },
      401
    );
  }

  let payload;
  try {
    payload = await request.json();
    if (!payload || typeof payload !== "object") {
      return jsonResponse({ ok: false, error: "請求資料格式不正確" }, 400);
    }
  } catch {
    return jsonResponse({ ok: false, error: "JSON 格式解析失敗" }, 400);
  }

  const nowIso = new Date().toISOString();
  const toSave = {
    ...payload,
    updatedAt: nowIso,
  };
  const serialized = JSON.stringify(toSave);

  // 1. 优先写入强一致性 Cloudflare D1（立即生效，0 缓存延迟）
  if (env && env.BOARD_DB) {
    try {
      await ensureD1Table(env.BOARD_DB);
      await env.BOARD_DB.prepare(
        "INSERT INTO board_state (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
      )
        .bind(RECORD_ID, serialized, nowIso)
        .run();

      return jsonResponse({
        ok: true,
        storage: "cloudflare_d1",
        data: toSave,
      });
    } catch (err) {
      return jsonResponse(
        {
          ok: false,
          error: "写入 Cloudflare D1 失败: " + String(err),
        },
        500
      );
    }
  }

  // 2. 兼容回退至 KV
  if (env && env.BOARD_KV) {
    try {
      await env.BOARD_KV.put(KV_KEY, serialized);
      return jsonResponse({
        ok: true,
        storage: "cloudflare_kv",
        data: toSave,
      });
    } catch (err) {
      return jsonResponse(
        {
          ok: false,
          error: "写入 Cloudflare KV 失败: " + String(err),
        },
        500
      );
    }
  }

  return jsonResponse(
    {
      ok: false,
      error: "服务端尚未绑定数据库 BOARD_DB，无法保存到云端",
    },
    500
  );
}
