import { z } from "zod";
import { Briefing, finite, ForecastRow, Position } from "@/lib/briefing";
export const runtime = "nodejs";
const grid = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: z
    .object({ time: z.array(z.string()) })
    .catchall(z.array(z.number().nullable()).or(z.array(z.string()))),
  daily: z
    .object({ sunrise: z.array(z.string()), sunset: z.array(z.string()) })
    .optional(),
});
const cache = new Map<string, { expires: number; value: Briefing }>();
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("latitude")),
    longitude = Number(params.get("longitude"));
  if (
    !params.get("latitude") ||
    !params.get("longitude") ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return Response.json(
      {
        error:
          "Enter a latitude between -90 and 90 and longitude between -180 and 180.",
      },
      { status: 400 },
    );
  const position: Position = { latitude, longitude };
  const key = `${latitude},${longitude}`;
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return Response.json(saved.value);
  const common = `latitude=${latitude}&longitude=${longitude}&timezone=GMT&forecast_days=3&cell_selection=sea`;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?${common}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover&daily=sunrise,sunset&wind_speed_unit=kn`;
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction,swell_wave_period,sea_level_height_msl`;
  const sources: Briefing["sources"] = [],
    errors: string[] = [];
  const merged = new Map<string, ForecastRow>();
  let sunrise: string | null = null,
    sunset: string | null = null;
  const results = await Promise.allSettled(
    [weatherUrl, marineUrl].map(async (url) => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Provider returned " + response.status);
      return {
        data: grid.parse(await response.json()),
        retrievedAt: new Date().toISOString(),
      };
    }),
  );
  results.forEach((result, index) => {
    const name =
      index === 0
        ? "Open-Meteo weather · best-match models"
        : "Open-Meteo marine · best-match models";
    if (result.status === "rejected") {
      errors.push(
        `${index === 0 ? "Weather" : "Marine"} forecast unavailable. Retry later or consult the official sources.`,
      );
      return;
    }
    const { data, retrievedAt } = result.value;
    sources.push({
      name,
      url: index === 0 ? weatherUrl : marineUrl,
      retrievedAt,
      latitude: data.latitude,
      longitude: data.longitude,
    });
    if (index === 0) {
      sunrise = data.daily?.sunrise[0] ?? null;
      sunset = data.daily?.sunset[0] ?? null;
    }
    const mapping: Record<string, string> =
      index === 0
        ? {
            temperature: "temperature_2m",
            wind: "wind_speed_10m",
            gust: "wind_gusts_10m",
            direction: "wind_direction_10m",
            visibility: "visibility",
            rain: "precipitation",
            rainChance: "precipitation_probability",
            pressure: "pressure_msl",
            humidity: "relative_humidity_2m",
            cloud: "cloud_cover",
            code: "weather_code",
          }
        : {
            wave: "wave_height",
            wavePeriod: "wave_period",
            waveDirection: "wave_direction",
            swell: "swell_wave_height",
            windWave: "wind_wave_height",
            swellPeriod: "swell_wave_period",
            swellDirection: "swell_wave_direction",
            seaLevel: "sea_level_height_msl",
          };
    data.hourly.time.forEach((t, i) => {
      const time = t + "Z";
      const row = merged.get(time) ?? {
        time,
        temperature: null,
        wind: null,
        gust: null,
        direction: null,
        visibility: null,
        rain: null,
        rainChance: null,
        pressure: null,
        humidity: null,
        cloud: null,
        code: null,
        wave: null,
        wavePeriod: null,
        waveDirection: null,
        swell: null,
        windWave: null,
        swellPeriod: null,
        swellDirection: null,
        seaLevel: null,
      };
      for (const [field, variable] of Object.entries(mapping)) {
        Object.assign(row, { [field]: finite(data.hourly[variable]?.[i]) });
      }
      merged.set(time, row);
    });
  });
  const value: Briefing = {
    position,
    rows: [...merged.values()].sort((a, b) => a.time.localeCompare(b.time)),
    sources,
    errors,
    sunrise: sunrise ? sunrise + "Z" : null,
    sunset: sunset ? sunset + "Z" : null,
  };
  if (!sources.length)
    return Response.json(
      { error: "Forecast services are unavailable. Your logbook still works." },
      { status: 502 },
    );
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(key, {
    expires: Date.now() + (errors.length ? 60000 : 300000),
    value,
  });
  return Response.json(value);
}
