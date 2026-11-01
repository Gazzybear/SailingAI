export const NOAA_STATIONS = [
  {
    id: "9414290",
    name: "San Francisco, California",
    latitude: 37.806305,
    longitude: -122.46589,
  },
  {
    id: "8518750",
    name: "The Battery, New York",
    latitude: 40.700554,
    longitude: -74.01417,
  },
] as const;

export type TideRecord = {
  /** UTC prediction time, not an observation. */
  time: string;
  /** Metres above Mean Lower Low Water; negative heights are valid. */
  height: number;
  type: "H" | "L";
};

export type TideResponse = {
  station: string;
  name: string;
  /** Requested UTC calendar date. */
  date: string;
  datum: "MLLW";
  timeZone: "UTC";
  sourceUrl: string;
  retrievedAt: string;
  records: TideRecord[];
};

export function isTideDate(value: string): boolean {
  if (!/^(19\d{2}|20\d{2}|2100)-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
