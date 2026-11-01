import { harbours } from "./harbours";

export type MapPlace = {
  id: string;
  name: string;
  kind: "harbour" | "marina";
  latitude: number;
  longitude: number;
  harbourId: string;
  marinaIndex?: number;
};
// Approximate overview pins, never approach waypoints or marina entrances.
// Marina positions: OSM way bounding-box centres, checked 2026-11-01.
// Shepards 468762415; East Cowes 205503540; Gosport 498576516; Haslar 225109863.
// Harbour pins are thematic area labels. See docs/DATA-SOURCES.md.
export const mapPlaces: MapPlace[] = [
  {
    id: "cowes",
    name: "Cowes Harbour",
    kind: "harbour",
    latitude: 50.768,
    longitude: -1.297,
    harbourId: "cowes",
  },
  {
    id: "portsmouth",
    name: "Portsmouth Harbour",
    kind: "harbour",
    latitude: 50.801,
    longitude: -1.108,
    harbourId: "gosport",
  },
  {
    id: "shepards",
    name: "Shepards Marina",
    kind: "marina",
    latitude: 50.759752,
    longitude: -1.293224,
    harbourId: "cowes",
    marinaIndex: 0,
  },
  {
    id: "east-cowes",
    name: "East Cowes Marina",
    kind: "marina",
    latitude: 50.751159,
    longitude: -1.290781,
    harbourId: "cowes",
    marinaIndex: 1,
  },
  {
    id: "gosport",
    name: "Gosport Marina",
    kind: "marina",
    latitude: 50.798302,
    longitude: -1.119162,
    harbourId: "gosport",
    marinaIndex: 0,
  },
  {
    id: "haslar",
    name: "Haslar Marina",
    kind: "marina",
    latitude: 50.791244,
    longitude: -1.118396,
    harbourId: "gosport",
    marinaIndex: 1,
  },
];
export function placeDetails(
  place: Pick<MapPlace, "harbourId" | "marinaIndex">,
) {
  const harbour = harbours.find((h) => h.id === place.harbourId)!;
  const marina =
    place.marinaIndex === undefined
      ? undefined
      : harbour.marinas[place.marinaIndex];
  return { harbour, marina };
}
export function distanceNm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad,
    dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLon / 2) ** 2;
  return 3440.065 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
