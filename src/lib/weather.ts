// Open-Meteo (no API key) — current conditions + 7-day rainfall sum.
// Docs: https://open-meteo.com/en/docs

export interface FieldWeather {
  temperatureC: number;
  windKph: number;
  weatherCode: number;
  weatherLabel: string;
  rainfall7dMm: number;
  fetchedAt: string;
}

const WEATHER_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Heavy showers",
  82: "Violent showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ hail",
  99: "Thunderstorm w/ hail",
};

export async function fetchFieldWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<FieldWeather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,wind_speed_10m,weather_code");
  url.searchParams.set("daily", "precipitation_sum");
  url.searchParams.set("past_days", "7");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);
  const data = await res.json();

  const code = data.current?.weather_code ?? 0;
  const past7: number[] = (data.daily?.precipitation_sum ?? []).slice(0, 7);
  const rainfall7dMm = past7.reduce((sum, n) => sum + (typeof n === "number" ? n : 0), 0);

  return {
    temperatureC: data.current?.temperature_2m ?? 0,
    windKph: data.current?.wind_speed_10m ?? 0,
    weatherCode: code,
    weatherLabel: WEATHER_LABELS[code] ?? "Unknown",
    rainfall7dMm: Math.round(rainfall7dMm * 10) / 10,
    fetchedAt: new Date().toISOString(),
  };
}
