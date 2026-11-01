import { z } from "zod";
export const fields = {
  timeText: "Observation time as written",
  location: "Location / event",
  windDirection: "Wind direction",
  windKnots: "Wind speed (knots)",
  beaufort: "Beaufort force",
  seaState: "Sea state",
  visibility: "Visibility",
  weather: "Weather",
  precipitation: "Precipitation",
  heading: "Heading (degrees)",
  cog: "Course over ground (degrees)",
  reference: "True / magnetic reference",
  stw: "Speed through water (knots)",
  sog: "Speed over ground (knots)",
  notes: "Navigation and crew notes",
} as const;
const text = z.string().nullable();
const speed = z.number().min(0).max(300).nullable();
export const Extraction = z.object({
  timeText: text,
  location: text,
  windDirection: text,
  windKnots: speed,
  beaufort: z.number().int().min(0).max(12).nullable(),
  seaState: text,
  visibility: text,
  weather: text,
  precipitation: text,
  heading: z.number().min(0).max(360).nullable(),
  cog: z.number().min(0).max(360).nullable(),
  reference: text,
  stw: speed,
  sog: speed,
  notes: text,
  warnings: z.array(z.string()),
});
export type Reading = z.infer<typeof Extraction>;
export const emptyReading = (): Reading =>
  Object.fromEntries([
    ...Object.keys(fields).map((k) => [k, null]),
    ["warnings", []],
  ]) as Reading;
export const sampleNote =
  "Departed Cowes at 10:15. Wind easterly force 4, sea slight, good visibility, no rain. Heading towards Gosport. All crew well.";
export const sampleReading: Reading = {
  ...emptyReading(),
  timeText: "10:15",
  location: "Departed Cowes",
  windDirection: "Easterly",
  beaufort: 4,
  seaState: "Slight",
  visibility: "Good",
  precipitation: "No rain",
  notes: "Heading towards Gosport. All crew well.",
  warnings: [
    "Confirm the observation date and time below. No wind speed or numeric heading was recorded.",
  ],
};
export type Entry = {
  id: string;
  original: string;
  values: Reading;
  aiDraft: Reading | null;
  source: "openai" | "manual" | "sample";
  observedAt: string;
  createdAt: string;
  updatedAt: string;
};
export type Passage = {
  id: string;
  vessel: string;
  departure: string;
  destination: string;
  date: string;
  time: string;
  skipper: string;
  draught: string;
  notes: string;
  timezone: "Europe/London";
  entries: Entry[];
};
const EntrySchema = z.object({
  id: z.string(),
  original: z.string(),
  values: Extraction,
  aiDraft: Extraction.nullable(),
  source: z.enum(["openai", "manual", "sample"]),
  observedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const StoreSchema = z.object({
  version: z.literal(1),
  passages: z.array(
    z.object({
      id: z.string(),
      vessel: z.string(),
      departure: z.string(),
      destination: z.string(),
      date: z.string(),
      time: z.string(),
      skipper: z.string(),
      draught: z.string(),
      notes: z.string(),
      timezone: z.literal("Europe/London"),
      entries: z.array(EntrySchema),
    }),
  ),
});
export const storageKey = "sailingai.v1";
export function orderEntries(entries: Entry[]) {
  return [...entries].sort((a, b) =>
    a.observedAt && b.observedAt
      ? a.observedAt.localeCompare(b.observedAt)
      : a.observedAt
        ? -1
        : b.observedAt
          ? 1
          : a.createdAt.localeCompare(b.createdAt),
  );
}
export function csvCell(value: unknown) {
  let s = value == null ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function exportCSV(p: Passage) {
  const header = [
    "Vessel",
    "Departure",
    "Destination",
    "Observation local date/time",
    "Timezone",
    "Recorded UTC",
    "Source",
    ...Object.values(fields),
    "Warnings",
    "Original observation",
  ];
  const rows = orderEntries(p.entries).map((e) => [
    p.vessel,
    p.departure,
    p.destination,
    e.observedAt,
    p.timezone,
    e.createdAt,
    e.source,
    ...Object.keys(fields).map((k) => e.values[k as keyof typeof fields]),
    e.values.warnings.join("; "),
    e.original,
  ]);
  return (
    "\uFEFF" +
    [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")
  );
}
// Resolve a wall-clock value by checking real instants. DST folds/gaps require correction.
export function validLondonTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const base = Date.parse(value + "Z");
  if (!Number.isFinite(base)) return false;
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (
    [-120, -60, 0, 60, 120].filter(
      (m) => fmt.format(new Date(base + m * 60000)).replace(" ", "T") === value,
    ).length === 1
  );
}
