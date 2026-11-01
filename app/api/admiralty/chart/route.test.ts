import { afterEach, expect, it, vi } from "vitest";
import { deflateSync } from "node:zlib";
import { GET } from "./route";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function setup(host = "127.0.0.1:3000", bbox = "-155000,6570000,-145000,6580000") {
  vi.stubEnv("ADMIRALTY_TRIAL_ENABLED", "true");
  vi.stubEnv("ADMIRALTY_API_KEY", "test-secret");
  return new Request(`http://${host}/api/admiralty/chart?request=GetMap&width=512&height=512&bbox=${bbox}`, { headers: { host } });
}
it("blocks public deployment before contacting the provider", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect((await GET(setup("public.example"))).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects malformed bounding boxes", async () => {
  expect((await GET(setup("127.0.0.1:3000", "1,2,NaN,4"))).status).toBe(400);
});
it("treats HTTP 200 provider error text as unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ServiceException")));
  const response = await GET(setup());
  expect(response.status).toBe(502);
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("does not present the provider's transparent PNG as a usable chart", async () => {
  const header = Buffer.alloc(33);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(header);
  header.writeUInt32BE(13,8); header.write("IHDR",12);
  header[24]=8; header[25]=6;
  const pixels = deflateSync(Buffer.alloc(512 * (512 * 4 + 1)));
  const chunk = Buffer.alloc(pixels.length+12);
  chunk.writeUInt32BE(pixels.length); chunk.write("IDAT",4); pixels.copy(chunk,8);
  const fetcher = vi.fn().mockResolvedValue(new Response(Buffer.concat([header,chunk])));
  vi.stubGlobal("fetch",fetcher);
  const response = await GET(setup());
  expect(response.status).toBe(502);
  expect(await response.text()).toContain("blank chart");
  const [url, options] = fetcher.mock.calls[0];
  expect(String(url)).not.toContain("test-secret");
  expect(options.headers["Ocp-Apim-Subscription-Key"]).toBe("test-secret");
});
