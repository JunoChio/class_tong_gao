/**
 * Cloudflare Pages Function: /api/weather
 * 獲取澳門即時氣溫與天氣狀況（基於 Open-Meteo 免費開源氣象介面，無需 API Key）
 */

const MACAU_LAT = 22.1987;
const MACAU_LON = 113.5439;

function mapWmoCodeToLabel(code) {
  if (code === 0) return "晴";
  if (code === 1) return "晴間多雲";
  if (code === 2) return "多雲";
  if (code === 3) return "陰";
  if (code === 45 || code === 48) return "有霧";
  if (code >= 51 && code <= 57) return "毛毛雨";
  if (code >= 61 && code <= 65) return "降雨";
  if (code >= 66 && code <= 67) return "凍雨";
  if (code >= 71 && code <= 77) return "降雪";
  if (code >= 80 && code <= 82) return "陣雨";
  if (code >= 95 && code <= 99) return "雷陣雨";
  return "多雲";
}

export async function onRequestGet() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${MACAU_LAT}&longitude=${MACAU_LON}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code&timezone=Asia%2FMacau`;

  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }
    const json = await res.json();
    const cur = json && json.current ? json.current : null;
    if (!cur || typeof cur.temperature_2m !== "number") {
      throw new Error("Invalid weather payload");
    }

    const code = Number(cur.weather_code ?? 0);
    return new Response(
      JSON.stringify({
        ok: true,
        city: "澳門",
        temperature: Math.round(cur.temperature_2m),
        humidity:
          typeof cur.relative_humidity_2m === "number"
            ? Math.round(cur.relative_humidity_2m)
            : null,
        weatherCode: code,
        label: mapWmoCodeToLabel(code),
        updatedAt: cur.time || new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        city: "澳門",
        error: String(err),
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
