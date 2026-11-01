import { expect, it } from "vitest";
import { collectShip, MAX_STREAM_SHIPS } from "./ais-stream";
import { AIS_MAX_AGE_MS, type AISShip } from "./ais";
const now = Date.parse("2026-11-01T15:30:00Z");
const ship = (id: string, age = 0): AISShip => ({ mmsi: id, latitude: 50.77, longitude: -1.27, timestamp: new Date(now-age).toISOString(), receivedAt: new Date(now).toISOString() });
it("accumulates separate vessels beyond the old six-second sampling window", () => {
  const ships = new Map<string,AISShip>();
  collectShip(ships, ship("123456789", 60000), now-60000);
  collectShip(ships, ship("987654321"), now);
  expect(ships.size).toBe(2);
});
it("keeps only the newest position per MMSI and preserves a reported name", () => {
  const ships = new Map<string,AISShip>();
  collectShip(ships, {...ship("123456789",1000),name:"Test vessel"},now);
  collectShip(ships, {...ship("123456789"),latitude:51},now);
  collectShip(ships, {...ship("123456789",2000),latitude:49},now);
  expect(ships.get("123456789")).toMatchObject({latitude:51,name:"Test vessel"});
  expect(ships.size).toBe(1);
});
it("expires old positions instead of accumulating them indefinitely", () => {
  const ships = new Map([["123456789",ship("123456789",AIS_MAX_AGE_MS+1)]]);
  collectShip(ships,ship("987654321"),now);
  expect(ships.has("123456789")).toBe(false);
});
it("bounds memory while retaining more recent positions", () => {
  const ships = new Map<string,AISShip>();
  for (let i=0;i<MAX_STREAM_SHIPS;i++) ships.set(String(i),ship(String(i),i+1));
  collectShip(ships,ship("new"),now);
  expect(ships.size).toBe(MAX_STREAM_SHIPS);
  expect(ships.has(String(MAX_STREAM_SHIPS-1))).toBe(false);
  expect(ships.has("new")).toBe(true);
});
