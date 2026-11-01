import { describe, expect, it } from "vitest";
import {
  buildLegs,
  distanceNm,
  exportGPX,
  initialTrueBearing,
  isValidCoordinates,
  MAX_WAYPOINTS,
  splitRouteAtDateline,
  totalDistanceNm,
  validateRouteWaypoints,
  type RouteWaypoint,
} from "./route-planner";

const point = (
  id: string,
  latitude: number,
  longitude: number,
  name = id,
): RouteWaypoint => ({ id, name, latitude, longitude });

describe("unverified route checkpoint calculations", () => {
  it("validates coordinate boundaries and rejects non-finite or string coordinates", () => {
    expect(isValidCoordinates(-85, 180)).toBe(true);
    expect(isValidCoordinates(85, -180)).toBe(true);
    for (const [latitude, longitude] of [
      [85.01, 0],
      [0, 180.1],
      [NaN, 0],
      [0, Infinity],
      ["50", -1],
    ])
      expect(isValidCoordinates(latitude, longitude)).toBe(false);
  });
  it("checks persisted shape, IDs, names and route size without mutating source", () => {
    const original = [point("1", 50, -1)];
    const checked = validateRouteWaypoints(original);
    expect(checked).toEqual(original);
    expect(checked[0]).not.toBe(original[0]);
    expect(() => validateRouteWaypoints({})).toThrow();
    expect(() => validateRouteWaypoints([original[0], original[0]])).toThrow();
    expect(() => validateRouteWaypoints([point("1", 50, -1, " ")])).toThrow();
    expect(() =>
      validateRouteWaypoints([point("1", 50, -1, "bad\u0000name")]),
    ).toThrow();
    expect(() =>
      validateRouteWaypoints(
        Array.from({ length: MAX_WAYPOINTS + 1 }, (_, index) =>
          point(String(index), 0, 0),
        ),
      ),
    ).toThrow();
    expect(validateRouteWaypoints([])).toEqual([]);
  });
  it("computes known equatorial distances and cardinal true bearings", () => {
    const origin = point("a", 0, 0);
    expect(distanceNm(origin, point("b", 0, 1))).toBeCloseTo(60.04054, 4);
    expect(initialTrueBearing(origin, point("n", 1, 0))).toBe(0);
    expect(initialTrueBearing(origin, point("e", 0, 1))).toBe(90);
    expect(initialTrueBearing(origin, point("s", -1, 0))).toBe(180);
    expect(initialTrueBearing(origin, point("w", 0, -1))).toBe(270);
  });
  it("uses the short distance across the date line, including equivalent endpoints", () => {
    const a = point("a", 0, 179),
      b = point("b", 0, -179);
    expect(distanceNm(a, b)).toBeCloseTo(120.08108, 4);
    expect(initialTrueBearing(a, b)).toBe(90);
    expect(distanceNm(point("c", 0, 180), point("d", 0, -180))).toBe(0);
  });
  it("does not invent bearings for duplicate or antipodal points", () => {
    const a = point("a", 0, 0);
    expect(distanceNm(a, a)).toBe(0);
    expect(initialTrueBearing(a, a)).toBeNull();
    expect(initialTrueBearing(a, point("b", 0, 180))).toBeNull();
    expect(Number.isFinite(distanceNm(a, point("b", 0, 180)))).toBe(true);
  });
  it("preserves waypoint order in legs and sums only adjacent segments", () => {
    const points = [point("a", 0, 0), point("b", 0, 1), point("c", 0, 2)];
    expect(buildLegs(points).map((leg) => [leg.from.id, leg.to.id])).toEqual([
      ["a", "b"],
      ["b", "c"],
    ]);
    expect(totalDistanceNm(points)).toBeCloseTo(120.08108, 4);
    expect(buildLegs([points[0]])).toEqual([]);
    expect(totalDistanceNm([])).toBe(0);
    expect(
      buildLegs([points[0], { ...points[0], id: "duplicate-position" }])[0]
        .bearingTrue,
    ).toBeNull();
  });
  it("escapes XML in names and exports only selected checkpoints", () => {
    const gpx = exportGPX(
      [
        point("a", 50, -1, 'A < B & "crew"'),
        point("b", 51, -2, "Skipper's checkpoint"),
      ],
      "Route & <one>",
    );
    expect(gpx).toContain("Route &amp; &lt;one&gt;");
    expect(gpx).toContain("A &lt; B &amp; &quot;crew&quot;");
    expect(gpx).toContain("Skipper&apos;s checkpoint");
    expect(gpx.match(/<rtept /g)).toHaveLength(2);
    expect(gpx).toContain('<rtept lat="50" lon="-1">');
    expect(gpx).toContain("Unverified user-entered planning checkpoints");
    expect(() => exportGPX([])).toThrow();
    expect(() =>
      exportGPX([point("a", 50, -1), point("b", 51, -2)], "bad\u0000name"),
    ).toThrow();
  });
  it("splits both directions across the date line without changing route checkpoints", () => {
    const east = [point("a", 10, 179), point("b", 12, -179)];
    expect(splitRouteAtDateline(east)).toEqual([
      [
        [10, 179],
        [11, 180],
      ],
      [
        [11, -180],
        [12, -179],
      ],
    ]);
    expect(splitRouteAtDateline([...east].reverse())).toEqual([
      [
        [12, -179],
        [11, -180],
      ],
      [
        [11, 180],
        [10, 179],
      ],
    ]);
    expect(east).toHaveLength(2);
    expect(splitRouteAtDateline([])).toEqual([]);
    expect(
      splitRouteAtDateline([point("a", 0, 180), point("b", 1, -180)]),
    ).toEqual([
      [
        [0, 180],
        [1, 180],
      ],
      [[1, -180]],
    ]);
  });
});
