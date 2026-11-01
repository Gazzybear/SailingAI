import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isTideDate } from "./tides";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
const request = (query: string) =>
  new Request(`http://localhost/api/tides?${query}`);

it("validates calendar dates, including leap years and the supported year range", () => {
  expect(isTideDate("2026-02-29")).toBe(false);
  expect(isTideDate("2024-02-29")).toBe(true);
  expect(isTideDate("2101-01-01")).toBe(false);
  expect(isTideDate("2026-13-01")).toBe(false);
});

it("rejects arbitrary stations and impossible dates before contacting NOAA", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { GET } = await import("../app/api/tides/route");
  expect((await GET(request("station=unknown&date=2026-11-01"))).status).toBe(
    400,
  );
  expect((await GET(request("station=9414290&date=2026-02-30"))).status).toBe(
    400,
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("requests exactly one UTC day and preserves negative MLLW heights and event types", async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      predictions: [
        { t: "2026-11-01 13:40", v: "1.460", type: "H" },
        { t: "2026-11-01 05:56", v: "-0.132", type: "L" },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const { GET } = await import("../app/api/tides/route");
  const result = await GET(request("station=9414290&date=2026-11-01"));
  expect(result.status).toBe(200);
  const data = await result.json();
  expect(data).toMatchObject({
    station: "9414290",
    datum: "MLLW",
    timeZone: "UTC",
  });
  expect(data.records[0]).toEqual({
    time: "2026-11-01T05:56:00Z",
    height: -0.132,
    type: "L",
  });
  const sent = new URL(fetch.mock.calls[0][0]);
  expect(sent.hostname).toBe("api.tidesandcurrents.noaa.gov");
  expect(sent.searchParams.get("begin_date")).toBe("20261101");
  expect(sent.searchParams.get("end_date")).toBe("20261101");
  await GET(request("station=9414290&date=2026-11-01"));
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([
  { error: { message: "No predictions" } },
  { predictions: [] },
  { predictions: [{ t: "2026-11-02 13:40", v: "1.4", type: "H" }] },
  { predictions: [{ t: "2026-11-01 13:40", v: "NaN", type: "H" }] },
])(
  "does not fabricate tides for malformed or unavailable provider responses",
  async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    const { GET } = await import("../app/api/tides/route");
    const response = await GET(request("station=9414290&date=2026-11-01"));
    expect(response.status).toBe(502);
    expect(await response.json()).not.toHaveProperty("records");
  },
);
