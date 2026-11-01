import { describe, it, expect } from "vitest";
import {
  csvCell,
  emptyReading,
  exportCSV,
  Extraction,
  orderEntries,
  Passage,
  sampleReading,
  StoreSchema,
  validLondonTime,
} from "./logbook";
describe("logbook data integrity", () => {
  it("keeps unrecorded measurements null and rejects invalid ranges", () => {
    expect(sampleReading.windKnots).toBeNull();
    expect(sampleReading.heading).toBeNull();
    expect(
      Extraction.safeParse({ ...emptyReading(), beaufort: 13 }).success,
    ).toBe(false);
  });
  it("rejects corrupt and unknown-version storage", () => {
    expect(StoreSchema.safeParse({ version: 2, passages: [] }).success).toBe(
      false,
    );
    expect(StoreSchema.safeParse({ version: 1, passages: [{}] }).success).toBe(
      false,
    );
  });
  it("escapes quoted multiline notes and spreadsheet formulas", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell('  =HYPERLINK("x")')).toBe('"\'  =HYPERLINK(""x"")"');
  });
  it("exports real reviewed values and preserves the original text", () => {
    const entry = {
      id: "e",
      original: "raw note",
      values: { ...emptyReading(), notes: "Corrected crew note" },
      aiDraft: null,
      source: "manual" as const,
      observedAt: "",
      createdAt: "2026-11-01T10:00:00Z",
      updatedAt: "2026-11-01T10:00:00Z",
    };
    const p: Passage = {
      id: "p",
      vessel: "Test yacht",
      departure: "Cowes",
      destination: "Gosport",
      date: "2026-11-01",
      time: "",
      skipper: "",
      draught: "",
      notes: "",
      timezone: "Europe/London",
      entries: [entry],
    };
    const csv = exportCSV(p);
    expect(csv).toContain("Corrected crew note");
    expect(csv).toContain("raw note");
    expect(csv).not.toContain("Sea Venture");
    expect(
      orderEntries([
        { ...entry, id: "untimed" },
        { ...entry, id: "timed", observedAt: "2026-11-01T11:00" },
      ])[0].id,
    ).toBe("timed");
  });
  it("rejects London daylight saving gaps, folds and invalid dates", () => {
    expect(validLondonTime("2026-03-29T01:30")).toBe(false);
    expect(validLondonTime("2026-10-25T01:30")).toBe(false);
    expect(validLondonTime("2026-11-01T10:15")).toBe(true);
    expect(validLondonTime("2026-02-30T10:15")).toBe(false);
  });
});
