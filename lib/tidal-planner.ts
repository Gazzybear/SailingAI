export type TidalWorksheet = {
  port: string;
  highWaterUTC: string;
  highWaterHeight: number | null;
  lowWaterUTC: string;
  lowWaterHeight: number | null;
  datum: string;
  sourceName: string;
  sourceURL: string;
  sameCycleAndDatum: boolean;
};

export type TidalHour = {
  offset: number;
  label: string;
  utc: string;
  date: string;
  time: string;
};

/** Inputs are UTC wall-clock values, regardless of the browser's local timezone. */
export function parseUTC(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Enter a complete UTC date and time.");
  const instant = Date.parse(`${value}:00Z`);
  if (
    !Number.isFinite(instant) ||
    new Date(instant).toISOString().slice(0, 16) !== value
  )
    throw new Error("Enter a valid calendar date and time.");
  return instant;
}

export function tidalHours(highWaterUTC: string): TidalHour[] {
  const reference = parseUTC(highWaterUTC);
  return Array.from({ length: 13 }, (_, index) => {
    const offset = index - 6;
    const utc = new Date(reference + offset * 3600000).toISOString();
    return {
      offset,
      label:
        offset === 0 ? "HW" : `HW${offset < 0 ? "−" : "+"}${Math.abs(offset)}`,
      utc,
      date: utc.slice(0, 10),
      time: utc.slice(11, 16),
    };
  });
}

export function tidalRange(plan: TidalWorksheet): number | null {
  if (
    !plan.sameCycleAndDatum ||
    !plan.datum.trim() ||
    !plan.lowWaterUTC ||
    plan.highWaterHeight === null ||
    plan.lowWaterHeight === null
  )
    return null;
  if (
    !Number.isFinite(plan.highWaterHeight) ||
    !Number.isFinite(plan.lowWaterHeight) ||
    plan.highWaterHeight < plan.lowWaterHeight
  )
    return null;
  return Math.round((plan.highWaterHeight - plan.lowWaterHeight) * 1000) / 1000;
}

function cell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function worksheetCSV(
  plan: TidalWorksheet,
  notes: Record<number, string>,
): string {
  const metadata: unknown[][] = [
    ["Tidal planning worksheet — manually entered predictions"],
    ["Port", plan.port],
    ["Time basis", "UTC / GMT (no daylight-saving adjustment)"],
    ["Source / edition", plan.sourceName],
    ["Source URL", plan.sourceURL],
    ["Height datum", plan.datum],
    ["High water UTC", plan.highWaterUTC],
    ["High water height (m)", plan.highWaterHeight],
    ["Low water UTC", plan.lowWaterUTC],
    ["Low water height (m)", plan.lowWaterHeight],
    ["Same cycle and datum confirmed", plan.sameCycleAndDatum ? "Yes" : "No"],
    ["Entered tidal range (m)", tidalRange(plan)],
    [
      "No hourly heights or streams are calculated. Notes are entered by the skipper.",
    ],
    [],
    [
      "Reference",
      "Date UTC",
      "Time UTC",
      "Skipper's tidal-stream / planning notes",
    ],
  ];
  const rows = tidalHours(plan.highWaterUTC).map((hour) => [
    hour.label,
    hour.date,
    hour.time,
    notes[hour.offset] ?? "",
  ]);
  return (
    "\uFEFF" +
    [...metadata, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")
  );
}
