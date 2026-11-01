import { describe, it, expect } from "vitest";
import {
  emptyReading,
  Extraction,
  StoredReading,
  validEntryTime,
  exportCSV,
  type Passage,
} from "./logbook";
import {
  validPhotoBytes,
  MAX_PHOTO_BYTES,
  PhotoExtraction,
} from "./photo-logbook";
describe("expanded observations", () => {
  it("migrates old readings without assigning old wind or heading values to new types", () => {
    const legacy = {
      timeText: "10:15",
      location: null,
      windDirection: "E",
      windKnots: 14,
      beaufort: null,
      seaState: "Slight",
      visibility: "Good",
      weather: null,
      precipitation: null,
      heading: 100,
      cog: null,
      reference: null,
      stw: null,
      sog: null,
      notes: null,
      warnings: [],
    };
    const result = StoredReading.parse(legacy);
    expect(result.windKnots).toBe(14);
    expect(result.trueWindKnots).toBeNull();
    expect(result.apparentWindKnots).toBeNull();
    expect(result.compassCourse).toBeNull();
    expect(result.heading).toBe(100);
    expect(result.seaStateCode).toBeNull();
    expect(
      StoredReading.safeParse({ ...legacy, windKnots: "bad" }).success,
    ).toBe(false);
    expect(StoredReading.safeParse({}).success).toBe(false);
  });
  it("preserves independent readings including zero and enforces scales", () => {
    const reading = Extraction.parse({
      ...emptyReading(),
      trueWindKnots: 0,
      apparentWindKnots: 6,
      seaStateCode: 0,
      beaufort: 0,
      logNm: 123.4,
      compassCourse: 98,
      trueCourse: 104,
      cog: 110,
    });
    expect(reading.trueWindKnots).toBe(0);
    expect(reading.apparentWindKnots).toBe(6);
    expect(reading.cog).toBe(110);
    for (const invalid of [
      { seaStateCode: 10 },
      { seaStateCode: 1.5 },
      { logNm: -1 },
      { apparentWindAngle: 181 },
      { latitude: 91 },
      { deviationDirection: "N" },
      { trueWindKnots: -1 },
    ])
      expect(Extraction.safeParse({ ...reading, ...invalid }).success).toBe(
        false,
      );
  });
  it("requires exact hours only for hourly entries and never rounds event times", () => {
    expect(validEntryTime("hourly", "2026-11-01T14:00")).toBe(true);
    expect(validEntryTime("hourly", "2026-11-01T14:15")).toBe(false);
    expect(validEntryTime("hourly", "")).toBe(false);
    expect(validEntryTime("event", "2026-11-01T14:15")).toBe(true);
    expect(validEntryTime(null, "2026-11-01T10:15")).toBe(true);
  });
  it("exports expanded columns with reviewed values", () => {
    const p: Passage = {
      id: "p",
      vessel: "Test",
      departure: "A",
      destination: "B",
      date: "2026-11-01",
      time: "",
      skipper: "",
      draught: "",
      notes: "",
      timezone: "Europe/London",
      entries: [
        {
          id: "e",
          source: "manual",
          original: "test",
          values: {
            ...emptyReading(),
            logNm: 123.4,
            trueWindKnots: 12,
            apparentWindKnots: 18,
            seaStateCode: 3,
            swellDescription: "Low",
            swellDirection: "NW",
          },
          aiDraft: null,
          observedAt: "2026-11-01T14:00",
          createdAt: "",
          updatedAt: "",
        },
      ],
    };
    const csv = exportCSV(p);
    expect(csv).toContain("TWS");
    expect(csv).toContain("AWS");
    expect(csv).toContain('"123.4"');
    expect(csv).toContain('"NW"');
  });
});
describe("photo input boundaries", () => {
  it("checks supported file signatures, size and rejects arbitrary files", () => {
    expect(
      validPhotoBytes(new Uint8Array([255, 216, 255, 0]), "image/jpeg"),
    ).toBe(true);
    expect(
      validPhotoBytes(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        "image/png",
      ),
    ).toBe(true);
    expect(validPhotoBytes(new Uint8Array([1, 2, 3]), "image/jpeg")).toBe(
      false,
    );
    expect(
      validPhotoBytes(new Uint8Array(MAX_PHOTO_BYTES + 1), "image/png"),
    ).toBe(false);
    expect(validPhotoBytes(new Uint8Array([1]), "image/heic")).toBe(false);
  });
  it("bounds row count and keeps unknown readings null", () => {
    const row = { transcription: "[unclear]", reading: emptyReading() };
    expect(
      PhotoExtraction.parse({ rows: [row], warnings: [] }).rows[0].reading
        .logNm,
    ).toBeNull();
    expect(
      PhotoExtraction.safeParse({ rows: Array(13).fill(row), warnings: [] })
        .success,
    ).toBe(false);
  });
});
