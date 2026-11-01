import portGazetteer from "./data/natural-earth-ports.json";

/** Community harbour directory discovery. This module does not provide navigation data. */
export type DiscoveryPlace = {
  id: string;
  name: string;
  kind: "harbour" | "marina" | "port";
  lat: number;
  lon: number;
  facilities: string[];
  website?: string;
  phone?: string;
  vhf?: string;
  sourceURL: string;
  provenance: string;
};

export type DiscoveryArea =
  | { type: "point"; lat: number; lon: number; radiusKm: number }
  | { type: "bbox"; south: number; west: number; north: number; east: number };

export type DiscoveryResponse = {
  retrievedAt: string;
  places: DiscoveryPlace[];
  truncated: boolean;
  coverage: string;
  attribution: string;
  attributionURL: string;
  sourceEndpoint?: string;
  limitedCoverage?: boolean;
  dataMode?: "live" | "gazetteer";
  warning?: string;
  error?: string;
};

export const DISCOVERY_LIMIT = 1000;
export const DISCOVERY_COVERAGE =
  "OpenStreetMap community listings in the requested area; coverage is incomplete and some entries may be outdated or duplicated. Markers for areas are approximate centres, not entrances. Facilities and contacts are unverified map tags; confirm with the operator. This is a directory, not a nautical chart or pilotage guide.";
export const DISCOVERY_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
] as const;

const cache = new Map<string, { expires: number; value: DiscoveryResponse }>();
const pending = new Map<string, Promise<DiscoveryResponse>>();
const cooldown = new Map<string, number>();
const CACHE_LIMIT = 50;
const MAX_BODY_BYTES = 4_000_000;
const ATTEMPT_MS = 4_000;
const TOTAL_MS = 14_000;
const PORTS_SOURCE =
  "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/ports/";

export function discoveryEnvelope(
  places: DiscoveryPlace[] = [],
  error?: string,
): DiscoveryResponse {
  return {
    retrievedAt: new Date().toISOString(),
    places,
    truncated: false,
    coverage: DISCOVERY_COVERAGE,
    attribution: "© OpenStreetMap contributors (ODbL)",
    attributionURL: "https://www.openstreetmap.org/copyright",
    ...(error ? { error } : {}),
  };
}

function coordinate(
  params: URLSearchParams,
  key: string,
  min: number,
  max: number,
): number {
  const raw = params.get(key);
  if (
    raw === null ||
    raw.trim() === "" ||
    params.getAll(key).length !== 1 ||
    !/^-?\d+(\.\d+)?$/.test(raw)
  ) {
    throw new Error(`Provide a single numeric ${key}.`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${key} must be between ${min} and ${max}.`);
  return value;
}

export function parseDiscoveryArea(params: URLSearchParams): DiscoveryArea {
  const point = ["lat", "lon", "radiusKm"].some((key) => params.has(key));
  const bbox = ["south", "west", "north", "east"].some((key) =>
    params.has(key),
  );
  if (point && bbox)
    throw new Error(
      "Use either lat/lon/radiusKm or south/west/north/east, not both.",
    );
  if (point)
    return {
      type: "point",
      lat: coordinate(params, "lat", -90, 90),
      lon: coordinate(params, "lon", -180, 180),
      radiusKm: params.has("radiusKm")
        ? coordinate(params, "radiusKm", 1, 30)
        : 15,
    };
  if (!bbox) throw new Error("Provide lat and lon, or south/west/north/east.");
  const south = coordinate(params, "south", -90, 90),
    north = coordinate(params, "north", -90, 90);
  const west = coordinate(params, "west", -180, 180),
    east = coordinate(params, "east", -180, 180);
  if (south >= north || west >= east)
    throw new Error(
      "Bounds must have south < north and west < east. For a date-line crossing use a point/radius search.",
    );
  const nearestEquator =
    south <= 0 && north >= 0 ? 0 : Math.min(Math.abs(south), Math.abs(north));
  const widthKm =
    (east - west) * 111.32 * Math.cos((nearestEquator * Math.PI) / 180);
  if ((north - south) * 111.32 > 60 || widthKm > 60 || east - west > 5) {
    throw new Error(
      "Zoom in: bounds must be at most 60 km across and 5 degrees of longitude.",
    );
  }
  return { type: "bbox", south, west, north, east };
}

export function buildDiscoveryQuery(area: DiscoveryArea): string {
  const spatial =
    area.type === "point"
      ? `around:${area.radiusKm * 1000},${area.lat},${area.lon}`
      : `${area.south},${area.west},${area.north},${area.east}`;
  return `[out:json][timeout:5][maxsize:33554432];(nwr["leisure"="marina"](${spatial});nwr["harbour"="yes"](${spatial});nwr["seamark:type"="harbour"](${spatial});nwr["landuse"="port"](${spatial});nwr["industrial"="port"](${spatial});nwr["seamark:harbour:category"~"marina"](${spatial}););out center ${DISCOVERY_LIMIT + 1};`;
}

function textTag(value: unknown, max = 120): string | undefined {
  if (typeof value !== "string") return undefined;
  // Tags are untrusted text, never HTML. Remove markup and control characters as defence in depth.
  const clean = value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
    .trim()
    .slice(0, max);
  return clean || undefined;
}

function websiteTag(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048 || /[\s<>]/.test(value))
    return undefined;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return undefined;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      !host.includes(".") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      host.includes(":")
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

const facilities: [string, string][] = [
  ["toilets", "Toilets"],
  ["shower", "Showers"],
  ["drinking_water", "Drinking water"],
  ["harbour:water_tap", "Water tap"],
  ["harbour:electricity", "Shore power"],
  ["power_supply", "Shore power"],
  ["sanitary_dump_station", "Waste disposal"],
  ["washing_machine", "Laundry"],
  ["harbour:visitor_berth", "Visitor berths"],
  ["harbour:visitors_mooring", "Visitor moorings"],
];

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseDiscoveryElements(value: unknown): {
  places: DiscoveryPlace[];
  truncated: boolean;
} {
  const body = record(value);
  if (!body || !Array.isArray(body.elements) || body.remark || body.error)
    throw new Error(
      "The directory provider returned incomplete or invalid data.",
    );
  const places: DiscoveryPlace[] = [];
  const seen = new Set<string>();
  for (const item of body.elements.slice(0, DISCOVERY_LIMIT + 1)) {
    const element = record(item),
      tags = record(element?.tags);
    if (
      !element ||
      !tags ||
      !["node", "way", "relation"].includes(String(element.type)) ||
      !Number.isSafeInteger(element.id) ||
      Number(element.id) < 1
    )
      continue;
    const marina =
      tags.leisure === "marina" ||
      tags["seamark:harbour:category"] === "marina" ||
      tags["seamark:harbour:category"] === "marina_no_facilities";
    const port = tags.landuse === "port" || tags.industrial === "port";
    if (!marina && !port && tags.harbour !== "yes" && tags["seamark:type"] !== "harbour")
      continue;
    const centre = element.type === "node" ? element : record(element.center);
    const lat = centre?.lat,
      lon = centre?.lon;
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      continue;
    const id = `osm-${element.type}-${element.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const name =
      textTag(tags.name) ??
      textTag(tags["seamark:name"]) ??
      textTag(tags["seamark:harbour:name"]) ??
      `Unnamed ${marina ? "marina" : "harbour"}`;
    const phoneValue = textTag(tags.phone ?? tags["contact:phone"], 60);
    const phone =
      phoneValue && /^[+\d\s().;/#-]{3,60}$/.test(phoneValue)
        ? phoneValue
        : undefined;
    const vhfValue = textTag(
      tags["seamark:harbour:vhf_channel"] ??
        tags["communication:vhf"] ??
        tags.vhf,
      40,
    );
    const vhf =
      vhfValue && /^[\dA-Za-z\s.,;/-]{1,40}$/.test(vhfValue)
        ? vhfValue
        : undefined;
    places.push({
      id,
      name,
      kind: marina ? "marina" : port ? "port" : "harbour",
      lat,
      lon,
      facilities: [
        ...new Set(
          facilities
            .filter(([key]) => tags[key] === "yes")
            .map(([, label]) => label),
        ),
      ],
      website: websiteTag(tags.website ?? tags["contact:website"]),
      phone,
      vhf,
      sourceURL: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      provenance: `OpenStreetMap community tags; not verified by the operator.${element.type === "node" ? "" : " Position is an approximate area centre, not an entrance."}`,
    });
  }
  return {
    places: places.slice(0, DISCOVERY_LIMIT),
    truncated: body.elements.length > DISCOVERY_LIMIT,
  };
}

async function boundedJSON(
  response: Response,
  maxBytes = MAX_BODY_BYTES,
): Promise<unknown> {
  if (!response.body) throw new Error("Empty directory response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error("Directory response was too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radians = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * radians) / 2) ** 2 +
    Math.cos(lat1 * radians) *
      Math.cos(lat2 * radians) *
      Math.sin(((lon2 - lon1) * radians) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function discoverGazetteerPorts(area: DiscoveryArea): DiscoveryResponse {
  const matches = portGazetteer.ports.filter((port) =>
    area.type === "point"
      ? distanceKm(area.lat, area.lon, port.lat, port.lon) <= area.radiusKm
      : port.lat >= area.south &&
        port.lat <= area.north &&
        port.lon >= area.west &&
        port.lon <= area.east,
  );
  const places: DiscoveryPlace[] = matches
    .slice(0, DISCOVERY_LIMIT)
    .map((port) => ({
      id: `natural-earth-${port.id}`,
      name: textTag(port.name) ?? "Unnamed port",
      kind: "port",
      lat: port.lat,
      lon: port.lon,
      facilities: [],
      sourceURL: PORTS_SOURCE,
      provenance: `Natural Earth ports, vector release ${portGazetteer.release}; bundled snapshot downloaded ${portGazetteer.downloadedAt}. Historical, generalised port location, not a marina or entrance.`,
    }));
  return {
    ...discoveryEnvelope(places),
    retrievedAt: portGazetteer.downloadedAt,
    dataMode: "gazetteer",
    limitedCoverage: true,
    truncated: matches.length > DISCOVERY_LIMIT,
    sourceEndpoint: portGazetteer.source,
    attribution: "Made with Natural Earth (public domain)",
    attributionURL: "https://www.naturalearthdata.com/about/terms-of-use/",
    warning:
      "Live community marina search is unavailable. Showing a bundled port gazetteer instead.",
    coverage: `Bundled Natural Earth port gazetteer (${portGazetteer.ports.length} ports worldwide, release ${portGazetteer.release}, downloaded ${portGazetteer.downloadedAt}). Only stored port points inside the requested area are shown. This is a historical, incomplete list of ports, not a live marina directory or almanac. Locations are generalised and can be substantially displaced from the actual port; never use these markers as entrances or navigation waypoints. No facilities, contacts or berth availability are inferred. An empty result does not mean there are no ports or marinas nearby.`,
  };
}

async function requestDiscovery(
  area: DiscoveryArea,
): Promise<DiscoveryResponse> {
  const deadline = Date.now() + TOTAL_MS;
  for (const endpoint of DISCOVERY_ENDPOINTS) {
    if ((cooldown.get(endpoint) ?? 0) > Date.now()) continue;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        redirect: "error",
        headers: {
          "User-Agent":
            "SailingAI/0.1 (+https://github.com/Gazzybear/SailingAI)",
          Accept: "application/json",
        },
        body: new URLSearchParams({ data: buildDiscoveryQuery(area) }),
        signal: AbortSignal.timeout(Math.min(ATTEMPT_MS, remaining)),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 429 || response.status === 406)
          cooldown.set(endpoint, Date.now() + 30_000);
        continue;
      }
      const result = parseDiscoveryElements(await boundedJSON(response));
      return {
        ...discoveryEnvelope(result.places),
        dataMode: "live",
        truncated: result.truncated,
        sourceEndpoint: endpoint,
      };
    } catch {
      /* One bounded failover; never reinterpret an outage as no harbours. */
    }
  }
  return discoverGazetteerPorts(area);
}

export async function discoverPlaces(
  area: DiscoveryArea,
): Promise<DiscoveryResponse> {
  const key = JSON.stringify(area);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= 2)
    return discoveryEnvelope(
      [],
      "Harbour search is busy. Wait for the current searches to finish and try again.",
    );
  const request = requestDiscovery(area)
    .then((value) => {
      for (const [entryKey, entry] of cache)
        if (entry.expires <= Date.now()) cache.delete(entryKey);
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
      cache.set(key, {
        expires:
          Date.now() +
          (value.error || value.dataMode === "gazetteer" ? 15_000 : 300_000),
        value,
      });
      return value;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, request);
  return request;
}
