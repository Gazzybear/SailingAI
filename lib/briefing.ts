export type Position = { latitude: number; longitude: number };
export type ForecastRow = {
  time: string;
  temperature: number | null;
  wind: number | null;
  gust: number | null;
  direction: number | null;
  visibility: number | null;
  rain: number | null;
  rainChance: number | null;
  pressure: number | null;
  humidity: number | null;
  cloud: number | null;
  code: number | null;
  wave: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  swell: number | null;
  seaLevel: number | null;
};
export type ForecastSource = {
  name: string;
  url: string;
  retrievedAt: string;
  latitude: number;
  longitude: number;
};
export type Briefing = {
  position: Position;
  rows: ForecastRow[];
  sources: ForecastSource[];
  errors: string[];
  sunrise: string | null;
  sunset: string | null;
};
export function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function weatherLabel(code: number | null) {
  if (code === null) return "Not available";
  if (code === 0) return "Clear sky";
  if (code <= 3) return ["", "Mainly clear", "Partly cloudy", "Overcast"][code];
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Weather code " + code;
}
export function bearing(value: number | null) {
  if (value === null) return "—";
  return (
    ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(value / 45) % 8] +
    " " +
    Math.round(value) +
    "°"
  );
}
export function display(value: number | null, unit: string, digits = 1) {
  return value === null ? "Not available" : value.toFixed(digits) + " " + unit;
}
