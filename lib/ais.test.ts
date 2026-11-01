import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { aisBoundingBoxes, parseAISStreamShip, parseFinlandShip } from "./ais";

const now = Date.parse("2026-11-01T14:00:00Z");
const area = { latitude: 60.15, longitude: 24.96, radius: 20 };
const feature = (properties: Record<string, unknown> = {}) => ({
  geometry: { type: "Point", coordinates: [24.96, 60.15] },
  properties: {
    mmsi: 230994270,
    timestamp: 12,
    timestampExternal: now - 1000,
    sog: 0,
    cog: 360,
    ...properties,
  },
});

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("uses provider epoch milliseconds, preserves true zero speed, and omits unavailable course", () => {
  const ship = parseFinlandShip(feature(), area, now);
  expect(ship?.timestamp).toBe("2026-11-01T13:59:59.000Z");
  expect(ship?.sog).toBe(0);
  expect(ship).not.toHaveProperty("cog");
  expect(
    parseFinlandShip(feature({ sog: 102.3 }), area, now),
  ).not.toHaveProperty("sog");
});

it("rejects stale, future, invalid GPS and out-of-area positions", () => {
  expect(
    parseFinlandShip(feature({ timestampExternal: now - 1800001 }), area, now),
  ).toBeNull();
  expect(
    parseFinlandShip(feature({ timestampExternal: now + 120000 }), area, now),
  ).toBeNull();
  expect(
    parseFinlandShip(feature(), { ...area, longitude: -1 }, now),
  ).toBeNull();
  expect(
    parseFinlandShip(
      { ...feature(), geometry: { type: "Point", coordinates: [181, 91] } },
      area,
      now,
    ),
  ).toBeNull();
});

it("parses AISstream UTC metadata and requires a valid position report", () => {
  const message = {
    MessageType: "StandardClassBPositionReport",
    MetaData: {
      time_utc: "2026-11-01 13:59:59.123456789 +0000 UTC",
      ShipName: "EXAMPLE@@",
    },
    Message: {
      StandardClassBPositionReport: {
        Valid: true,
        UserID: 230994270,
        Latitude: 60.15,
        Longitude: 24.96,
        Sog: 3.5,
        Cog: 182,
      },
    },
  };
  expect(parseAISStreamShip(message, area, now)).toMatchObject({
    mmsi: "230994270",
    name: "EXAMPLE",
    timestamp: "2026-11-01T13:59:59.123Z",
    sog: 3.5,
  });
  message.Message.StandardClassBPositionReport.Valid = false;
  expect(parseAISStreamShip(message, area, now)).toBeNull();
  expect(
    aisBoundingBoxes({ latitude: 0, longitude: 179.9, radius: 20 }),
  ).toHaveLength(2);
});

it("returns an honest unconfigured response and rejects oversized requests without fetching", async () => {
  vi.stubEnv("AISSTREAM_API_KEY", "");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { GET } = await import("../app/api/ais/route");
  const response = await GET(
    new Request("http://localhost/api/ais?lat=50.8&lon=-1.2"),
  );
  expect(await response.json()).toMatchObject({
    configured: false,
    status: "unconfigured",
    ships: [],
  });
  expect(
    (
      await GET(
        new Request(
          "http://localhost/api/ais?provider=finland&lat=60&lon=24&radius=100",
        ),
      )
    ).status,
  ).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});

it("bounds the regional request, attributes the data and caches concurrent requests", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ features: [feature({ timestampExternal: Date.now() })] }),
    );
  vi.stubGlobal("fetch", fetch);
  const { GET } = await import("../app/api/ais/route");
  const request = () =>
    new Request(
      "http://localhost/api/ais?provider=finland&lat=60.15&lon=24.96&radius=20",
    );
  const [first, second] = await Promise.all([GET(request()), GET(request())]);
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(await first.json()).toMatchObject({
    status: "live",
    configured: true,
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  });
  const url = new URL(fetch.mock.calls[0][0]);
  expect(Number(url.searchParams.get("radius"))).toBeCloseTo(37.04);
  expect(url.hostname).toBe("meri.digitraffic.fi");
  await GET(request());
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("does not label a failed provider as empty traffic", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })),
  );
  const { GET } = await import("../app/api/ais/route");
  const response = await GET(
    new Request(
      "http://localhost/api/ais?provider=finland&lat=60.15&lon=24.96",
    ),
  );
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({ status: "error", ships: [] });
});
