export type AISProvider = "finland" | "aisstream";
export type AISShip = {
  mmsi: string;
  name?: string;
  latitude: number;
  longitude: number;
  sog?: number;
  cog?: number;
  /** Provider's position-report timestamp, not the HTTP retrieval time. */
  timestamp: string;
  receivedAt: string;
};
export type AISResponse = {
  configured: boolean;
  provider: AISProvider;
  status: "live" | "empty" | "unconfigured" | "busy" | "error";
  ships: AISShip[];
  retrievedAt: string;
  source: string;
  sourceUrl: string;
  message: string;
  licenseUrl?: string;
};
export type AISArea = { latitude: number; longitude: number; radius: number };
export const AIS_MAX_AGE_MS = 30 * 60 * 1000;

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function number(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
export function aisDistanceNm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(dLon / 2) ** 2;
  return 3440.065 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
function shipFromValues(
  values: {
    mmsi: unknown;
    latitude: unknown;
    longitude: unknown;
    sog: unknown;
    cog: unknown;
    timestamp: unknown;
    name?: unknown;
  },
  area: AISArea,
  now: number,
): AISShip | null {
  const { latitude, longitude, sog, cog } = values;
  const mmsi = String(values.mmsi ?? "");
  if (
    !/^\d{9}$/.test(mmsi) ||
    mmsi === "000000000" ||
    !number(latitude) ||
    !number(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  const timestamp =
    typeof values.timestamp === "number"
      ? values.timestamp
      : Date.parse(String(values.timestamp));
  if (
    !Number.isFinite(timestamp) ||
    now - timestamp > AIS_MAX_AGE_MS ||
    timestamp > now + 60000 ||
    aisDistanceNm(area, { latitude, longitude }) > area.radius
  )
    return null;
  const name =
    typeof values.name === "string"
      ? values.name.replaceAll("@", "").trim().slice(0, 80)
      : "";
  return {
    mmsi,
    latitude,
    longitude,
    timestamp: new Date(timestamp).toISOString(),
    receivedAt: new Date(now).toISOString(),
    ...(name ? { name } : {}),
    ...(number(sog) && sog >= 0 && sog < 102.3 ? { sog } : {}),
    ...(number(cog) && cog >= 0 && cog < 360 ? { cog } : {}),
  };
}

export function parseFinlandShip(
  value: unknown,
  area: AISArea,
  now: number,
): AISShip | null {
  const feature = object(value),
    geometry = object(feature.geometry),
    properties = object(feature.properties);
  if (geometry.type !== "Point" || !Array.isArray(geometry.coordinates))
    return null;
  return shipFromValues(
    {
      mmsi: properties.mmsi ?? feature.mmsi,
      latitude: geometry.coordinates[1],
      longitude: geometry.coordinates[0],
      sog: properties.sog,
      cog: properties.cog,
      timestamp: properties.timestampExternal,
    },
    area,
    now,
  );
}

export function parseAISStreamShip(
  value: unknown,
  area: AISArea,
  now: number,
): AISShip | null {
  const envelope = object(value),
    type = envelope.MessageType;
  if (
    typeof type !== "string" ||
    ![
      "PositionReport",
      "StandardClassBPositionReport",
      "ExtendedClassBPositionReport",
    ].includes(type)
  )
    return null;
  const report = object(object(envelope.Message)[type]),
    metadata = object(envelope.MetaData);
  if (report.Valid !== true || typeof metadata.time_utc !== "string")
    return null;
  const timestamp = metadata.time_utc
    .replace(" ", "T")
    .replace(/ \+0000 UTC$/, "Z")
    .replace(/(\.\d{3})\d+/, "$1");
  return shipFromValues(
    {
      mmsi: report.UserID ?? metadata.MMSI,
      latitude: report.Latitude,
      longitude: report.Longitude,
      sog: report.Sog,
      cog: report.Cog,
      timestamp,
      name: metadata.ShipName ?? report.Name,
    },
    area,
    now,
  );
}

export function aisBoundingBoxes(area: AISArea): number[][][] {
  const latDelta = area.radius / 60;
  const lonDelta =
    area.radius / (60 * Math.cos((area.latitude * Math.PI) / 180));
  const south = Math.max(-90, area.latitude - latDelta),
    north = Math.min(90, area.latitude + latDelta);
  const west = area.longitude - lonDelta,
    east = area.longitude + lonDelta;
  if (west < -180)
    return [
      [
        [south, west + 360],
        [north, 180],
      ],
      [
        [south, -180],
        [north, east],
      ],
    ];
  if (east > 180)
    return [
      [
        [south, west],
        [north, 180],
      ],
      [
        [south, -180],
        [north, east - 360],
      ],
    ];
  return [
    [
      [south, west],
      [north, east],
    ],
  ];
}
