import { describe, expect, it } from "vitest";
import {
  parseUTC,
  tidalHours,
  tidalRange,
  worksheetCSV,
  type TidalWorksheet,
} from "./tidal-planner";

const plan: TidalWorksheet = {
  port: "Test port",
  highWaterUTC: "2026-11-01T02:30",
  highWaterHeight: 4.5,
  lowWaterUTC: "2026-10-31T20:30",
  lowWaterHeight: 1.2,
  datum: "Chart datum",
  sourceName: "Skipper's source",
  sourceURL: "",
  sameCycleAndDatum: true,
};

describe("UTC tidal worksheet", () => {
  it("carries HW minus six hours into the previous date", () => {
    const rows = tidalHours("2026-11-01T02:30");
    expect(rows).toHaveLength(13);
    expect(rows[0]).toMatchObject({
      label: "HW−6",
      date: "2026-10-31",
      time: "20:30",
    });
    expect(rows[6]).toMatchObject({
      label: "HW",
      date: "2026-11-01",
      time: "02:30",
    });
    expect(rows[12]).toMatchObject({ label: "HW+6", time: "08:30" });
  });
  it("rolls across years and leap days without local timezone conversion", () => {
    expect(tidalHours("2026-12-31T22:00")[12]).toMatchObject({
      date: "2027-01-01",
      time: "04:00",
    });
    expect(tidalHours("2028-03-01T01:00")[0]).toMatchObject({
      date: "2028-02-29",
      time: "19:00",
    });
    expect(tidalHours("2026-10-25T01:30")[6].utc).toBe(
      "2026-10-25T01:30:00.000Z",
    );
  });
  it("rejects impossible dates and unspecified time bases", () => {
    expect(() => parseUTC("2026-02-29T12:00")).toThrow();
    expect(() => parseUTC("2026-11-01T25:00")).toThrow();
    expect(() => parseUTC("12:30")).toThrow();
  });
  it("shows range only for confirmed compatible complete entries", () => {
    expect(tidalRange(plan)).toBe(3.3);
    expect(tidalRange({ ...plan, sameCycleAndDatum: false })).toBeNull();
    expect(tidalRange({ ...plan, datum: "" })).toBeNull();
    expect(tidalRange({ ...plan, highWaterHeight: 0.5 })).toBeNull();
    expect(tidalRange({ ...plan, lowWaterHeight: null })).toBeNull();
  });
  it("exports dates, provenance and notes without inventing hourly heights", () => {
    const csv = worksheetCSV(plan, { 0: 'Check "stream" atlas', 1: "=1+1" });
    expect(csv).toContain('"2026-10-31","20:30"');
    expect(csv).toContain('Check ""stream"" atlas');
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("No hourly heights or streams are calculated");
  });
});
