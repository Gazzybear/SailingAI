"use client";
import { useEffect, useState } from "react";
import type { Position } from "@/lib/briefing";
import type { DiscoveryResponse } from "@/lib/discovery";

type DiscoveryResult = DiscoveryResponse;
export function usePlaceDiscovery() {
  const [request, setRequest] = useState<
    (Position & { attempt: number }) | null
  >(null);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    fetch(
      `/api/places?lat=${request.latitude}&lon=${request.longitude}&radiusKm=30`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok)
          throw new Error(
            body.error || "Place search is unavailable. Try again shortly.",
          );
        return body as DiscoveryResult;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult(data);
          setError(data.error || "");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Place search unavailable.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);
  function search(position: Position) {
    setError("");
    setResult(null);
    setLoading(true);
    setRequest((old) => ({ ...position, attempt: (old?.attempt ?? 0) + 1 }));
  }
  function clear() {
    setRequest(null);
    setResult(null);
    setError("");
    setLoading(false);
  }
  return { result, loading, error, search, clear };
}
