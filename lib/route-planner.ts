/** User-entered planning checkpoints. Lines and distances do not establish a navigable route. */
export type RouteWaypoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type RouteLeg = {
  from: RouteWaypoint;
  to: RouteWaypoint;
  /** Spherical great-circle distance, not a chart-checked passage distance. */
  distanceNm: number;
  /** Initial true bearing only. Null for coincident or antipodal points. */
  bearingTrue: number | null;
};

type Coordinates = Pick<RouteWaypoint, "latitude" | "longitude">;
export const MAX_WAYPOINTS = 50;
const EARTH_RADIUS_NM = 6371.0088 / 1.852;
const radians = (degrees: number) => (degrees * Math.PI) / 180;
const longitudeDifference = (from: number, to: number) =>
  ((to - from + 540) % 360) - 180;

/** Restricted to the supported web-map latitude range; rejects NaN and infinities. */
export function isValidCoordinates(
  latitude: unknown,
  longitude: unknown,
): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -85 &&
    latitude <= 85 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function checkCoordinates(point: Coordinates) {
  if (!point || !isValidCoordinates(point.latitude, point.longitude)) {
    throw new Error(
      "Waypoint latitude must be between −85 and 85, and longitude between −180 and 180.",
    );
  }
}

function validXMLText(text: string): boolean {
  return [...text].every((character) => {
    const code = character.codePointAt(0)!;
    return (
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff)
    );
  });
}

/** Validate untrusted persisted route state, returning copies of only the declared fields. */
export function validateRouteWaypoints(value: unknown): RouteWaypoint[] {
  if (!Array.isArray(value))
    throw new Error("The saved route must be a list of waypoints.");
  if (value.length > MAX_WAYPOINTS)
    throw new Error(`A route can contain at most ${MAX_WAYPOINTS} waypoints.`);
  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== "object")
      throw new Error(`Waypoint ${index + 1} is invalid.`);
    const point = item as Record<string, unknown>;
    if (
      typeof point.id !== "string" ||
      !point.id.trim() ||
      point.id.length > 120 ||
      ids.has(point.id)
    )
      throw new Error(`Waypoint ${index + 1} needs a unique, non-empty ID.`);
    if (
      typeof point.name !== "string" ||
      !point.name.trim() ||
      point.name.length > 120 ||
      !validXMLText(point.name)
    )
      throw new Error(
        `Waypoint ${index + 1} needs a valid name of 1–120 characters.`,
      );
    if (!isValidCoordinates(point.latitude, point.longitude))
      throw new Error(
        `Waypoint ${index + 1} is outside the supported coordinate range.`,
      );
    ids.add(point.id);
    return {
      id: point.id,
      name: point.name,
      latitude: point.latitude as number,
      longitude: point.longitude as number,
    };
  });
}

export function distanceNm(from: Coordinates, to: Coordinates): number {
  checkCoordinates(from);
  checkCoordinates(to);
  const lat1 = radians(from.latitude),
    lat2 = radians(to.latitude);
  const deltaLatitude = lat2 - lat1;
  const deltaLongitude = radians(
    longitudeDifference(from.longitude, to.longitude),
  );
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLongitude / 2) ** 2;
  return (
    2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
  );
}

export function initialTrueBearing(
  from: Coordinates,
  to: Coordinates,
): number | null {
  checkCoordinates(from);
  checkCoordinates(to);
  const lat1 = radians(from.latitude),
    lat2 = radians(to.latitude);
  const deltaLongitude = radians(
    longitudeDifference(from.longitude, to.longitude),
  );
  const y = Math.sin(deltaLongitude) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLongitude);
  if (Math.hypot(x, y) < 1e-12) return null;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function buildLegs(waypoints: RouteWaypoint[]): RouteLeg[] {
  const points = validateRouteWaypoints(waypoints);
  return points.slice(1).map((to, index) => ({
    from: points[index],
    to,
    distanceNm: distanceNm(points[index], to),
    bearingTrue: initialTrueBearing(points[index], to),
  }));
}

export function totalDistanceNm(waypoints: RouteWaypoint[]): number {
  return buildLegs(waypoints).reduce((sum, leg) => sum + leg.distanceNm, 0);
}

function xml(text: string): string {
  if (!validXMLText(text))
    throw new Error(
      "The route name contains a character that cannot be exported to XML.",
    );
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Exports user checkpoints only; never labels the route safe or imports calculated routing. */
export function exportGPX(
  waypoints: RouteWaypoint[],
  routeName = "Draft sailing route",
): string {
  const points = validateRouteWaypoints(waypoints);
  if (points.length < 2)
    throw new Error("Add at least two checkpoints before exporting a route.");
  if (
    typeof routeName !== "string" ||
    !routeName.trim() ||
    routeName.length > 200
  )
    throw new Error("Use a route name of 1–200 characters.");
  const name = xml(routeName);
  const warning =
    "Unverified user-entered planning checkpoints. Connecting lines are not navigable routes. Check official charts, hazards, depths and restrictions before use.";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="SailingAI" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${name}</name><desc>${warning}</desc></metadata>\n  <rte>\n    <name>${name}</name>\n    <desc>${warning}</desc>\n${points.map((point) => `    <rtept lat="${point.latitude}" lon="${point.longitude}"><name>${xml(point.name)}</name></rtept>`).join("\n")}\n  </rte>\n</gpx>\n`;
}

/**
 * Display helper: split straight coordinate lines at ±180°, avoiding a line across
 * the whole map. The interpolated boundary points are for drawing only, not new
 * route checkpoints, geodesic routing, navigational fixes or GPX output.
 */
export function splitRouteAtDateline(
  waypoints: RouteWaypoint[],
): Array<Array<[number, number]>> {
  const points = validateRouteWaypoints(waypoints);
  if (!points.length) return [];
  const segments: Array<Array<[number, number]>> = [
    [[points[0].latitude, points[0].longitude]],
  ];
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1],
      next = points[index];
    if (Math.abs(next.longitude - previous.longitude) > 180) {
      const difference = longitudeDifference(
        previous.longitude,
        next.longitude,
      );
      if (difference === 0) {
        // The two representations of the date line refer to the same meridian.
        segments[segments.length - 1].push([next.latitude, previous.longitude]);
        segments.push([[next.latitude, next.longitude]]);
        continue;
      }
      const edge = difference > 0 ? 180 : -180;
      const fraction = (edge - previous.longitude) / difference;
      const latitude =
        previous.latitude + fraction * (next.latitude - previous.latitude);
      segments[segments.length - 1].push([latitude, edge]);
      segments.push([
        [latitude, -edge],
        [next.latitude, next.longitude],
      ]);
    } else segments[segments.length - 1].push([next.latitude, next.longitude]);
  }
  return segments;
}
