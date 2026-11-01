import { afterEach, expect, it, vi } from "vitest";
import {
  buildDiscoveryQuery,
  DISCOVERY_LIMIT,
  DISCOVERY_ENDPOINTS,
  discoverGazetteerPorts,
  parseDiscoveryArea,
  parseDiscoveryElements,
} from "./discovery";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

it("rejects query injection, oversized areas, duplicate coordinates and mixed query modes", () => {
  for (const query of [
    "lat=50);out;&lon=1",
    "lat=50&lon=1&radiusKm=31",
    "lat=&lon=1",
    "lat=50&lat=51&lon=1",
    "south=-80&west=-180&north=80&east=180",
    "lat=50&lon=1&south=49",
    "lat=NaN&lon=1",
  ])
    expect(() => parseDiscoveryArea(new URLSearchParams(query))).toThrow();
  const area = parseDiscoveryArea(
    new URLSearchParams("lat=-33.86&lon=151.23&radiusKm=3"),
  );
  expect(buildDiscoveryQuery(area)).toContain("(around:3000,-33.86,151.23)");
  expect(buildDiscoveryQuery(area)).toContain(`out center ${DISCOVERY_LIMIT + 1}`);
});

it("accepts small worldwide bounding boxes and point searches across the date line", () => {
  expect(
    parseDiscoveryArea(
      new URLSearchParams("south=-33.88&west=151.2&north=-33.84&east=151.26"),
    ).type,
  ).toBe("bbox");
  expect(
    parseDiscoveryArea(new URLSearchParams("lat=-17&lon=179.99&radiusKm=30"))
      .type,
  ).toBe("point");
  expect(() =>
    parseDiscoveryArea(
      new URLSearchParams("south=-17&west=179.9&north=-16.9&east=-179.9"),
    ),
  ).toThrow(/date-line/);
});

it("sanitizes untrusted listings and distinguishes area centres from entrances", () => {
  const result = parseDiscoveryElements({
    elements: [
      {
        type: "way",
        id: 123,
        center: { lat: -33.86, lon: 151.23 },
        tags: {
          leisure: "marina",
          name: "<b>Test Marina</b>",
          website: "javascript:alert(1)",
          phone: "+61 (0)2 1234 5678",
          "communication:vhf": "80",
          toilets: "yes",
          shower: "no",
        },
      },
      {
        type: "node",
        id: 124,
        lat: 50,
        lon: -1,
        tags: { harbour: "yes", website: "https://user:password@example.com" },
      },
      { type: "node", id: 125, lat: 95, lon: -1, tags: { harbour: "yes" } },
      {
        type: "node",
        id: 126,
        lat: 50,
        lon: -1,
        tags: { harbour: "yes", website: "https://example.com/marina" },
      },
    ],
  });
  expect(result.places).toHaveLength(3);
  expect(result.places[0]).toMatchObject({
    name: "Test Marina",
    kind: "marina",
    facilities: ["Toilets"],
    vhf: "80",
    website: undefined,
    sourceURL: "https://www.openstreetmap.org/way/123",
  });
  expect(result.places[0].provenance).toContain("not an entrance");
  expect(result.places[1].website).toBeUndefined();
  expect(result.places[2].website).toBe("https://example.com/marina");
});

it("caps results and refuses provider partial results", () => {
  const elements = Array.from({ length: DISCOVERY_LIMIT + 1 }, (_, i) => ({
    type: "node",
    id: i + 1,
    lat: 50,
    lon: -1,
    tags: { harbour: "yes" },
  }));
  const result = parseDiscoveryElements({ elements });
  expect(result.places).toHaveLength(DISCOVERY_LIMIT);
  expect(result.truncated).toBe(true);
  expect(() =>
    parseDiscoveryElements({ elements, remark: "runtime error: timeout" }),
  ).toThrow();
});

it("performs bounded failover and reuses a successful result from cache", async () => {
  const { GET } = await import("../app/api/places/route");
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response("", { status: 502 }))
    .mockResolvedValueOnce(
      Response.json({
        elements: [
          {
            type: "node",
            id: 10,
            lat: -33.86,
            lon: 151.23,
            tags: { leisure: "marina", name: "Test Sydney Marina" },
          },
        ],
      }),
    );
  const url = "http://localhost/api/places?lat=-33.86&lon=151.23&radiusKm=3";
  const response = await GET(new Request(url));
  expect(response.status).toBe(200);
  expect((await response.json()).places[0].name).toBe("Test Sydney Marina");
  await GET(new Request(url));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
});

it("returns explicitly labelled bundled ports when all live providers fail", async () => {
  const { GET } = await import("../app/api/places/route");
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValueOnce(new Error("offline"))
    .mockRejectedValueOnce(new Error("offline"));
  const response = await GET(
    new Request(
      "http://localhost/api/places?lat=-33.86&lon=151.23&radiusKm=10",
    ),
  );
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.dataMode).toBe("gazetteer");
  expect(body.limitedCoverage).toBe(true);
  expect(body.warning).toContain("unavailable");
  expect(
    body.places.some((place: { name: string }) => place.name === "Sydney"),
  ).toBe(true);
  expect(
    body.places.every((place: { kind: string }) => place.kind === "port"),
  ).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(DISCOVERY_ENDPOINTS.length);
  expect(
    fetcher.mock.calls.every(
      ([url]) => !String(url).includes("api.openstreetmap.org"),
    ),
  ).toBe(true);
});

it("retains a genuine successful empty live search", async () => {
  const { GET } = await import("../app/api/places/route");
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    Response.json({ elements: [] }),
  );
  const response = await GET(
    new Request("http://localhost/api/places?lat=3&lon=4"),
  );
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.dataMode).toBe("live");
  expect(body.places).toEqual([]);
});

it("filters real worldwide gazetteer points by area and does not fabricate marina details", () => {
  for (const [lat, lon, name] of [
    [-33.86, 151.23, "Sydney"],
    [40.706, -74.009, "New York"],
    [50.76, -1.29, "Portsmouth"],
  ] as const) {
    const result = discoverGazetteerPorts({
      type: "point",
      lat,
      lon,
      radiusKm: 30,
    });
    expect(result.places.some((place) => place.name === name)).toBe(true);
    expect(
      result.places.every(
        (place) =>
          place.facilities.length === 0 &&
          !place.phone &&
          !place.vhf &&
          place.kind === "port",
      ),
    ).toBe(true);
    expect(result.coverage).toContain("not a live marina directory");
  }
  const boxed = discoverGazetteerPorts({
    type: "bbox",
    south: -33.87,
    west: 151.18,
    north: -33.85,
    east: 151.2,
  });
  expect(boxed.places.some((place) => place.name === "Sydney")).toBe(true);
  expect(
    discoverGazetteerPorts({ type: "point", lat: 0, lon: 0, radiusKm: 1 })
      .places,
  ).toEqual([]);
});

it("rejects invalid HTTP searches before requesting any provider", async () => {
  const { GET } = await import("../app/api/places/route");
  const fetcher = vi.spyOn(globalThis, "fetch");
  const response = await GET(
    new Request("http://localhost/api/places?lat=90&lon=0&radiusKm=3000"),
  );
  expect(response.status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
