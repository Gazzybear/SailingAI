import WebSocket from "ws";
import { AIS_MAX_AGE_MS, aisBoundingBoxes, aisDistanceNm, parseAISStreamShip, type AISArea, type AISShip } from "./ais";

export const MAX_STREAM_SHIPS = 5000;
type StreamState = {
  area: AISArea; socket: WebSocket | null; ships: Map<string, AISShip>;
  confirmed: boolean; error: boolean; lastRequest: number; startedAt: number;
  retryAt: number; failures: number; lastSubscription: number; timer: ReturnType<typeof setInterval>;
};
// One server-side connection, also across development hot reloads. No credentials enter responses.
const shared = globalThis as typeof globalThis & { sailingAISStream?: StreamState };

export function collectShip(ships: Map<string, AISShip>, ship: AISShip, now: number) {
  for (const [id, stored] of ships) if (now - Date.parse(stored.timestamp) > AIS_MAX_AGE_MS) ships.delete(id);
  const previous = ships.get(ship.mmsi);
  if (previous && Date.parse(previous.timestamp) > Date.parse(ship.timestamp)) return;
  ships.set(ship.mmsi, { ...ship, ...(ship.name || !previous?.name ? {} : { name: previous.name }) });
  if (ships.size > MAX_STREAM_SHIPS) {
    let oldest: AISShip | undefined;
    for (const value of ships.values()) if (!oldest || value.timestamp < oldest.timestamp) oldest = value;
    if (oldest) ships.delete(oldest.mmsi);
  }
}

function subscribe(state: StreamState, key: string) {
  if (state.socket?.readyState !== WebSocket.OPEN) return;
  state.lastSubscription = Date.now();
  state.socket.send(JSON.stringify({ APIKey: key, BoundingBoxes: aisBoundingBoxes(state.area),
    FilterMessageTypes: ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport"] }));
}

function connect(state: StreamState, key: string) {
  const socket = new WebSocket("wss://stream.aisstream.io/v0/stream", {
    perMessageDeflate: true, handshakeTimeout: 8000, maxPayload: 1024 * 1024,
  });
  state.socket = socket;
  state.confirmed = false;
  state.error = false;
  socket.on("open", () => subscribe(state, key));
  socket.on("message", raw => {
    if (state.socket !== socket) return;
    try {
      const message = JSON.parse(raw.toString());
      if (message.error || message.Error) { state.error = true; socket.close(); return; }
      if (message.MessageType === "SubscriptionConfirmation") { state.confirmed = true; state.failures = 0; }
      // Validate reports globally so vessels leaving the current area replace their old positions.
      const ship = parseAISStreamShip(message, { latitude: 0, longitude: 0, radius: 12000 }, Date.now());
      if (ship) { state.confirmed = true; collectShip(state.ships, ship, Date.now()); }
    } catch { /* Ignore malformed or non-position messages. */ }
  });
  socket.on("error", () => { state.error = true; });
  socket.on("close", () => {
    if (state.socket !== socket) return;
    state.socket = null;
    state.confirmed = false;
    state.error = true;
    state.retryAt = Date.now() + Math.min(60000, 2000 * 2 ** Math.min(state.failures++, 5)) + Math.random() * 1000;
  });
}

export function streamSnapshot(area: AISArea, key: string) {
  const now = Date.now();
  let state = shared.sailingAISStream;
  if (!state) {
    state = { area, socket: null, ships: new Map(), confirmed: false, error: false,
      lastRequest: now, startedAt: now, retryAt: 0, failures: 0, lastSubscription: 0,
      timer: setInterval(() => {
        const current = shared.sailingAISStream;
        if (current && Date.now() - current.lastRequest > 90000) {
          clearInterval(current.timer); current.socket?.terminate(); delete shared.sailingAISStream;
        }
      }, 30000) };
    state.timer.unref();
    shared.sailingAISStream = state;
  }
  state.lastRequest = now;
  const changed = JSON.stringify(state.area) !== JSON.stringify(area);
  if (changed && now - state.lastSubscription >= 1200) {
    state.area = area;
    subscribe(state, key);
  }
  if (!state.socket && now >= state.retryAt) connect(state, key);
  const ships: AISShip[] = [];
  for (const [id, ship] of state.ships) {
    if (now - Date.parse(ship.timestamp) > AIS_MAX_AGE_MS) state.ships.delete(id);
    else if (aisDistanceNm(area, ship) <= area.radius) ships.push(ship);
  }
  ships.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return { ships, connected: state.confirmed && !state.error,
    error: state.error, startedAt: new Date(state.startedAt).toISOString(),
    limited: state.ships.size >= MAX_STREAM_SHIPS };
}
