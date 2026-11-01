import { z } from "zod";
import { isTideDate, NOAA_STATIONS, type TideResponse } from "@/lib/tides";

export const runtime = "nodejs";

const predictionSchema = z.object({
  predictions: z
    .array(
      z.object({
        t: z.string().regex(/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d$/),
        v: z
          .string()
          .regex(/^-?\d+(?:\.\d+)?$/)
          .transform(Number)
          .refine(Number.isFinite),
        type: z.enum(["H", "L"]),
      }),
    )
    .min(1)
    .max(24),
});
const cache = new Map<string, { expires: number; value: TideResponse }>();

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const station = NOAA_STATIONS.find(
    (item) => item.id === params.get("station"),
  );
  const date = params.get("date") ?? "";
  if (
    !station ||
    !isTideDate(date) ||
    params.getAll("date").length !== 1 ||
    params.getAll("station").length !== 1
  ) {
    return Response.json(
      {
        error:
          "Choose a supported NOAA station and a valid UTC date (YYYY-MM-DD, 1900–2100).",
      },
      { status: 400 },
    );
  }

  const key = `${station.id}:${date}`;
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return Response.json(saved.value);
  const source = new URL(
    "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter",
  );
  source.search = new URLSearchParams({
    product: "predictions",
    application: "SailingAI",
    station: station.id,
    begin_date: date.replaceAll("-", ""),
    end_date: date.replaceAll("-", ""),
    datum: "MLLW",
    time_zone: "gmt",
    units: "metric",
    interval: "hilo",
    format: "json",
  }).toString();

  try {
    const response = await fetch(source.toString(), {
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("NOAA request failed");
    const parsed = predictionSchema.parse(await response.json());
    if (parsed.predictions.some((item) => item.t.slice(0, 10) !== date))
      throw new Error("Unexpected prediction date");
    const records = parsed.predictions
      .map((item) => ({
        time: `${item.t.replace(" ", "T")}:00Z`,
        height: item.v,
        type: item.type,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
    if (new Set(records.map((item) => item.time)).size !== records.length)
      throw new Error("Duplicate prediction time");
    const value: TideResponse = {
      station: station.id,
      name: station.name,
      date,
      datum: "MLLW",
      timeZone: "UTC",
      sourceUrl: source.toString(),
      retrievedAt: new Date().toISOString(),
      records,
    };
    if (cache.size >= 64) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 600000, value });
    return Response.json(value);
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return Response.json(
      {
        error: timedOut
          ? "NOAA tide predictions timed out. Retry or enter verified almanac values manually."
          : "NOAA predictions are unavailable or invalid for this date. Retry or enter verified almanac values manually.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
