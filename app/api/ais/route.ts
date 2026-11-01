import WebSocket from "ws";
import {
  aisBoundingBoxes,
  parseAISStreamShip,
  parseFinlandShip,
  type AISArea,
  type AISProvider,
  type AISResponse,
  type AISShip,
} from "@/lib/ais";

export const runtime = "nodejs";
const cache = new Map<string, { expires: number; data: AISResponse }>();
let active: { key: string; promise: Promise<AISResponse> } | undefined;
const headers = { "Cache-Control": "no-store" };

function responseData(
  provider: AISProvider,
  status: AISResponse["status"],
  message: string,
  ships: AISShip[] = [],
): AISResponse {
  return {
    provider,
    configured:
      provider === "finland" || Boolean(process.env.AISSTREAM_API_KEY?.trim()),
    status,
    ships,
    retrievedAt: new Date().toISOString(),
    message,
    source:
      provider === "finland"
        ? "Fintraffic / digitraffic.fi — filtered and reformatted, CC BY 4.0"
        : "AISstream.io — sampled AIS position reports",
    sourceUrl:
      provider === "finland"
        ? "https://www.digitraffic.fi/en/marine-traffic/"
        : "https://aisstream.io/",
    ...(provider === "finland"
      ? { licenseUrl: "https://creativecommons.org/licenses/by/4.0/" }
      : {}),
  };
}

async function finland(area: AISArea): Promise<AISShip[]> {
  const now = Date.now();
  const source = new URL("https://meri.digitraffic.fi/api/ais/v1/locations");
  source.search = new URLSearchParams({
    latitude: String(area.latitude),
    longitude: String(area.longitude),
    radius: String(area.radius * 1.852),
    from: String(now - 1800000),
  }).toString();
  const result = await fetch(source, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: {
      "Digitraffic-User": "SailingAI-Hackathon/1.0",
      "Accept-Encoding": "gzip",
    },
  });
  if (!result.ok) throw new Error("AIS provider unavailable");
  const data: unknown = await result.json();
  if (
    !data ||
    typeof data !== "object" ||
    !("features" in data) ||
    !Array.isArray(data.features) ||
    data.features.length > 50000
  )
    throw new Error("Invalid AIS response");
  const ships = new Map<string, AISShip>();
  for (const feature of data.features) {
    const ship = parseFinlandShip(feature, area, now);
    if (
      ship &&
      (!ships.has(ship.mmsi) ||
        ships.get(ship.mmsi)!.timestamp < ship.timestamp)
    )
      ships.set(ship.mmsi, ship);
  }
  return [...ships.values()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 500);
}

function aisstream(area: AISArea, apiKey: string): Promise<AISShip[]> {
  return new Promise((resolve, reject) => {
    const ships = new Map<string, AISShip>();
    const socket = new WebSocket("wss://stream.aisstream.io/v0/stream", {
      perMessageDeflate: true,
      handshakeTimeout: 8000,
      maxPayload: 1024 * 1024,
    });
    let finished = false,
      confirmed = false;
    let collectTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => finish(new Error("AIS timed out")), 12000);
    function finish(error?: Error) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (collectTimer) clearTimeout(collectTimer);
      socket.terminate();
      if (error) reject(error);
      else resolve([...ships.values()].slice(0, 500));
    }
    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: aisBoundingBoxes(area),
          FilterMessageTypes: [
            "PositionReport",
            "StandardClassBPositionReport",
            "ExtendedClassBPositionReport",
          ],
        }),
      );
      collectTimer = setTimeout(
        () =>
          finish(
            confirmed || ships.size
              ? undefined
              : new Error("AIS subscription not confirmed"),
          ),
        6000,
      );
    });
    socket.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.error || data.Error) {
          finish(new Error("AIS subscription failed"));
          return;
        }
        if (data.MessageType === "SubscriptionConfirmation") confirmed = true;
        const ship = parseAISStreamShip(data, area, Date.now());
        if (ship && (ships.size < 500 || ships.has(ship.mmsi)))
          ships.set(ship.mmsi, ship);
      } catch {
        /* Ignore non-position or malformed messages; never manufacture a position. */
      }
    });
    socket.on("error", () => finish(new Error("AIS connection failed")));
    socket.on("close", () => finish(new Error("AIS connection closed")));
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const provider = params.get("provider") ?? "aisstream";
  const latitude = Number(params.get("lat")),
    longitude = Number(params.get("lon")),
    radius = Number(params.get("radius") ?? "10");
  if (
    !["finland", "aisstream"].includes(provider) ||
    !params.get("lat")?.trim() ||
    !params.get("lon")?.trim() ||
    ![latitude, longitude, radius].every(Number.isFinite) ||
    Math.abs(latitude) > 85 ||
    Math.abs(longitude) > 180 ||
    radius < 1 ||
    radius > 20
  ) {
    return Response.json(
      {
        error:
          "Select finland or aisstream, latitude −85 to 85, longitude −180 to 180, and radius 1–20 nautical miles.",
      },
      { status: 400, headers },
    );
  }
  const chosen = provider as AISProvider;
  const apiKey = process.env.AISSTREAM_API_KEY?.trim();
  if (chosen === "aisstream" && !apiKey)
    return Response.json(
      responseData(
        chosen,
        "unconfigured",
        "Connect an AISstream API key to load this area's AIS reports. The Finnish live example works without a key.",
      ),
      { headers },
    );
  const key = `${provider}:${latitude}:${longitude}:${radius}`;
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now())
    return Response.json(saved.data, { headers });
  if (active && active.key !== key)
    return Response.json(
      responseData(
        chosen,
        "busy",
        "Another AIS area is loading. Retry shortly.",
      ),
      { status: 503, headers },
    );
  if (!active) {
    const area = { latitude, longitude, radius };
    const promise = (async () => {
      try {
        const ships = await (chosen === "finland"
          ? finland(area)
          : aisstream(area, apiKey!));
        const message =
          chosen === "finland"
            ? `${ships.length} recent reports from the Finnish AIS receiver network. Coverage is regional; reports older than 30 minutes are excluded.`
            : `${ships.length} reports received during a six-second sample. This is not a complete traffic picture; reports older than 30 minutes are excluded.`;
        const data = responseData(
          chosen,
          ships.length ? "live" : "empty",
          message,
          ships,
        );
        if (cache.size >= 64) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: Date.now() + 30000, data });
        return data;
      } catch {
        return responseData(
          chosen,
          "error",
          "AIS reports are unavailable. Retry shortly. No vessel positions have been estimated.",
        );
      }
    })();
    active = { key, promise };
    void promise.finally(() => {
      if (active?.promise === promise) active = undefined;
    });
  }
  const data = await active.promise;
  return Response.json(data, {
    status: data.status === "error" ? 502 : 200,
    headers,
  });
}
