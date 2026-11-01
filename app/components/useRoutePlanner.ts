"use client";
import { useCallback, useEffect, useState } from "react";
import {
  isValidCoordinates,
  MAX_WAYPOINTS,
  validateRouteWaypoints,
  type RouteWaypoint,
} from "@/lib/route-planner";
const STORAGE_KEY = "sailingai-route-v1";
export function useRoutePlanner() {
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [ready, setReady] = useState(false),
    [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    // Hydrate this independent browser route store after server rendering.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.version !== 1) throw new Error();
        setWaypoints(validateRouteWaypoints(data.waypoints));
      }
      setReady(true);
    } catch {
      setError(
        "The saved route could not be read. Export your existing data before resetting this route store.",
      );
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  const update = useCallback(
    (next: RouteWaypoint[]) => {
      if (!ready) return false;
      try {
        validateRouteWaypoints(next);
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, waypoints: next }),
        );
        setWaypoints(next);
        setError("");
        return true;
      } catch {
        setError(
          "The route could not be saved. Check coordinates and browser storage; your previous route is unchanged.",
        );
        return false;
      }
    },
    [ready],
  );
  const add = useCallback(
    (position: { latitude: number; longitude: number }) => {
      if (waypoints.length >= MAX_WAYPOINTS) {
        setError(`A route can contain up to ${MAX_WAYPOINTS} checkpoints.`);
        return;
      }
      if (!isValidCoordinates(position.latitude, position.longitude)) {
        setError("Choose a position between 85°S and 85°N.");
        return;
      }
      update([
        ...waypoints,
        {
          id: crypto.randomUUID(),
          name: `Checkpoint ${waypoints.length + 1}`,
          ...position,
        },
      ]);
    },
    [waypoints, update],
  );
  const move = useCallback(
    (id: string, position: { latitude: number; longitude: number }) => {
      if (!isValidCoordinates(position.latitude, position.longitude)) {
        setError("Checkpoint is outside the map range; saved route unchanged.");
        return false;
      }
      return update(
        waypoints.map((p) => (p.id === id ? { ...p, ...position } : p)),
      );
    },
    [waypoints, update],
  );
  return { waypoints, ready, editing, setEditing, error, update, add, move };
}
