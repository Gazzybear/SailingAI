import {
  discoverPlaces,
  discoveryEnvelope,
  parseDiscoveryArea,
} from "@/lib/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  let area;
  try {
    area = parseDiscoveryArea(new URL(request.url).searchParams);
  } catch (error) {
    return Response.json(
      discoveryEnvelope(
        [],
        error instanceof Error ? error.message : "Invalid search area.",
      ),
      { status: 400 },
    );
  }
  const result = await discoverPlaces(area);
  return Response.json(result, {
    status: result.error ? 503 : 200,
    headers: result.error
      ? { "Cache-Control": "no-store", "Retry-After": "30" }
      : { "Cache-Control": "private, max-age=60" },
  });
}
