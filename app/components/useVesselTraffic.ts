"use client";

import { useEffect, useState } from "react";
import type { AISArea, AISResponse, AISShip } from "@/lib/ais";

export type TrafficProvider = "finland" | "aisstream";
export type VesselTraffic = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  provider: TrafficProvider;
  radius: number;
  ships: AISShip[];
  status: AISResponse["status"] | "off" | "loading";
  loading: boolean;
  message: string;
  response: AISResponse | null;
  now: number;
  refresh: () => void;
};

type Snapshot = {
  key: string;
  response: AISResponse | null;
  error: string;
  loading: boolean;
};

/** Continuous server collection, displayed every five seconds for the visible area. */
export function useVesselTraffic(position: AISArea): VesselTraffic {
  const [enabled, setEnabled] = useState(true);
  const provider: TrafficProvider = "aisstream";
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const key = `${enabled}|${provider}|${position.latitude}|${position.longitude}|${position.radius}|${revision}`;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let running = false;
    let controller: AbortController | null = null;
    async function load() {
      if (!active || running) return;
      running = true;
      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(() => request.abort(), 20000);
      // Keep markers steady during same-area polls; area changes and failures clear them.
      setSnapshot(previous => previous?.key === key && previous.response ? previous : { key, response: null, error: "", loading: true });
      setNow(Date.now());
      try {
        const query = new URLSearchParams({
          provider,
          lat: String(position.latitude),
          lon: String(position.longitude),
          radius: String(position.radius),
        });
        const result = await fetch(`/api/ais?${query}`, {
          signal: request.signal,
          cache: "no-store",
        });
        const body = await result.json();
        if (!active) return;
        if (
          body &&
          typeof body.status === "string" &&
          Array.isArray(body.ships) &&
          typeof body.retrievedAt === "string"
        ) {
          setSnapshot({
            key,
            response: body as AISResponse,
            error: "",
            loading: false,
          });
        } else
          throw new Error(
            body?.error ||
              "The vessel traffic feed returned an unreadable response.",
          );
      } catch (error) {
        if (!active) return;
        setSnapshot({
          key,
          response: null,
          loading: false,
          error:
            error instanceof Error && error.name !== "AbortError"
              ? error.message
              : "The vessel traffic request timed out. Try refreshing.",
        });
      } finally {
        clearTimeout(timeout);
        running = false;
        if (active) setNow(Date.now());
      }
    }
    const first = setTimeout(() => {
      void load();
    }, 1400);
    const polling = setInterval(() => {
      void load();
    }, 5000);
    const clock = setInterval(() => setNow(Date.now()), 10000);
    return () => {
      active = false;
      clearTimeout(first);
      clearInterval(polling);
      clearInterval(clock);
      controller?.abort();
    };
  }, [enabled, provider, position.latitude, position.longitude, position.radius, key]);

  const current = enabled && snapshot?.key === key ? snapshot : null;
  const response = current?.response ?? null;
  const status = !enabled
    ? "off"
    : !current || current.loading
      ? "loading"
      : (response?.status ?? "error");
  const ships =
    status === "live" && response
      ? response.ships.filter((ship) => {
          const timestamp = Date.parse(ship.timestamp);
          return (
            Number.isFinite(timestamp) &&
            timestamp <= now + 60000 &&
            now - timestamp <= 30 * 60000
          );
        })
      : [];
  return {
    enabled,
    setEnabled,
    provider,
    radius: position.radius,
    ships,
    status,
    loading: status === "loading",
    response,
    now,
    message: !enabled
      ? "Enable the traffic layer to request nearby AIS reports."
      : current?.error || response?.message || "Loading nearby vessel reports…",
    refresh: () => setRevision((value) => value + 1),
  };
}

export default useVesselTraffic;
