export interface MacauWeather {
  city: string;
  temperature: number;
  humidity: number | null;
  weatherCode: number;
  label: string;
}

const MACAU_OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=22.1987&longitude=113.5439&current=temperature_2m,relative_humidity_2m,weather_code&timezone=Asia%2FMacau";

function mapWmoCode(code: number): string {
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

export async function fetchMacauWeather(): Promise<MacauWeather | null> {
  try {
    const res = await fetch("/api/weather", { cache: "no-store" });
    if (res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const json = await res.json();
        if (json && json.ok && typeof json.temperature === "number") {
          const code = Number(json.weatherCode ?? 0);
          return {
            city: "澳門",
            temperature: Math.round(json.temperature),
            humidity: typeof json.humidity === "number" ? json.humidity : null,
            weatherCode: code,
            label: mapWmoCode(code),
          };
        }
      }
    }
  } catch {
    // 回退直連 Open-Meteo
  }

  try {
    const res = await fetch(MACAU_OPEN_METEO_URL, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const cur = json?.current;
      if (cur && typeof cur.temperature_2m === "number") {
        const code = Number(cur.weather_code ?? 0);
        return {
          city: "澳門",
          temperature: Math.round(cur.temperature_2m),
          humidity:
            typeof cur.relative_humidity_2m === "number"
              ? Math.round(cur.relative_humidity_2m)
              : null,
          weatherCode: code,
          label: mapWmoCode(code),
        };
      }
    }
  } catch {
    // 離線狀態靜默兜底
  }

  return null;
}
