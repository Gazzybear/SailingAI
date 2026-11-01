import { inflateSync } from "node:zlib";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
let requests: number[] = [];
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers });

// This trial adapter is deliberately local-only: no public redistribution or tile cache.
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.get("host") ?? "") ||
      process.env.ADMIRALTY_TRIAL_ENABLED !== "true") return fail("Local trial only", 403);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return fail("Same-origin requests only", 403);
  const key = process.env.ADMIRALTY_API_KEY;
  if (!key) return fail("ADMIRALTY subscription key is not configured", 503);
  const params = new Map([...url.searchParams].map(([k, v]) => [k.toLowerCase(), v]));
  const bbox = (params.get("bbox") ?? "").split(",").map(Number);
  const width = Number(params.get("width"));
  const height = Number(params.get("height"));
  if (params.get("request")?.toLowerCase() !== "getmap" ||
      bbox.length !== 4 || bbox.some(n => !Number.isFinite(n) || Math.abs(n) > 20037509) ||
      bbox[0] >= bbox[2] || bbox[1] >= bbox[3] ||
      ![256, 512, 1024].includes(width) || ![256, 512, 1024].includes(height)) return fail("Invalid chart bounds or dimensions", 400);
  const now = Date.now();
  requests = requests.filter(t => now - t < 30000);
  if (requests.length >= 25) return fail("Trial rate limit; wait 30 seconds", 429);
  requests.push(now);
  const upstream = new URL("https://admiraltyapi.azure-api.net/avcso-disco/WMSServer");
  upstream.search = new URLSearchParams({ SERVICE: "WMS", REQUEST: "GetMap", VERSION: "1.3.0",
    FORMAT: "image/png", TRANSPARENT: "TRUE", CRS: "EPSG:3857", STYLES: "",
    LAYERS: "21,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0",
    WIDTH: String(width), HEIGHT: String(height), BBOX: bbox.join(",") }).toString();
  try {
    const result = await fetch(upstream, { headers: { "Ocp-Apim-Subscription-Key": key },
      cache: "no-store", signal: AbortSignal.timeout(20000), redirect: "error" });
    if (!result.ok) return fail(`ADMIRALTY unavailable (HTTP ${result.status})`, 502);
    const data = Buffer.from(await result.arrayBuffer());
    if (!data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return fail("ADMIRALTY returned no chart image", 502);
    // Detect the all-zero RGBA PNG currently returned by the Discovery service.
    if (data[24] === 8 && data[25] === 6 && data[28] === 0) {
      const chunks: Buffer[] = [];
      for (let p = 8; p + 12 <= data.length;) {
        const length = data.readUInt32BE(p);
        if (p + length + 12 > data.length) return fail("Invalid chart image", 502);
        if (data.toString("ascii", p + 4, p + 8) === "IDAT") chunks.push(data.subarray(p + 8, p + 8 + length));
        p += length + 12;
      }
      const pixels = inflateSync(Buffer.concat(chunks), { maxOutputLength: 5 * 1024 * 1024 });
      if (pixels.every(value => value === 0)) return fail("ADMIRALTY returned a blank chart for this area", 502);
    }
    return new Response(data, { headers: { ...headers, "Content-Type": "image/png" } });
  } catch {
    return fail("ADMIRALTY chart service unavailable", 502);
  }
}
