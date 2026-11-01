"use client";
import {
  ArrowDown,
  ArrowUp,
  Download,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import {
  buildLegs,
  totalDistanceNm,
  exportGPX,
  type RouteWaypoint,
} from "@/lib/route-planner";
import type { useRoutePlanner } from "./useRoutePlanner";
type Planner = ReturnType<typeof useRoutePlanner>;
export default function RoutePlanner({
  planner,
  onFocus,
  onStartEditing,
}: {
  planner: Planner;
  onFocus: (point: RouteWaypoint) => void;
  onStartEditing: () => void;
}) {
  const legs = buildLegs(planner.waypoints);
  function reorder(index: number, direction: number) {
    const next = [...planner.waypoints];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    planner.update(next);
  }
  function download() {
    const blob = new Blob(
      [exportGPX(planner.waypoints, "SailingAI planning route")],
      { type: "application/gpx+xml" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sailingai-planning-route.gpx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="route-planner" aria-label="Route checkpoints">
      <div className="route-heading">
        <div>
          <span className="inspector-kicker">YOUR PASSAGE ON THE MAP</span>
          <h3>Build a route, checkpoint by checkpoint.</h3>
          <p>
            {planner.waypoints.length} checkpoints ·{" "}
            {totalDistanceNm(planner.waypoints).toFixed(2)} nm of straight-line
            legs
          </p>
        </div>
        <div className="route-actions">
          <button
            type="button"
            disabled={!planner.ready}
            aria-pressed={planner.editing}
            onClick={() => {
              if (!planner.editing) onStartEditing();
              planner.setEditing(!planner.editing);
            }}
          >
            <Plus size={15} />
            {planner.editing ? "Finish editing" : "Add checkpoints"}
          </button>
          <button
            type="button"
            disabled={planner.waypoints.length < 2}
            onClick={download}
          >
            <Download size={15} />
            GPX
          </button>
        </div>
      </div>
      {planner.editing && (
        <p className="route-editing-message" role="status">
          Click the map to add a checkpoint. Drag a numbered marker to move it.
          Edit names and order below.
        </p>
      )}
      {planner.error && (
        <p className="route-error" role="alert">
          {planner.error}
        </p>
      )}
      {!planner.waypoints.length ? (
        <p className="route-empty">
          Start with Add checkpoints, then tap the locations you want to
          include. Your planning route is saved on this device.
        </p>
      ) : (
        <div className="route-checkpoints">
          {planner.waypoints.map((point, index) => (
            <div
              key={`${point.id}:${point.latitude}:${point.longitude}`}
              className="route-checkpoint"
            >
              <button
                className="route-number"
                type="button"
                aria-label={`Show checkpoint ${index + 1} on map`}
                onClick={() => onFocus(point)}
              >
                {index + 1}
              </button>
              <div>
                <label>
                  Checkpoint {index + 1}
                  <input
                    aria-label={`Name for checkpoint ${index + 1}`}
                    defaultValue={point.name}
                    maxLength={80}
                    onBlur={(event) => {
                      const name =
                        event.target.value.trim() || `Checkpoint ${index + 1}`;
                      if (name !== point.name)
                        planner.update(
                          planner.waypoints.map((p) =>
                            p.id === point.id ? { ...p, name } : p,
                          ),
                        );
                    }}
                  />
                </label>
                <small>
                  {point.latitude.toFixed(5)}°, {point.longitude.toFixed(5)}°
                  {index > 0 &&
                    ` · ${legs[index - 1].distanceNm.toFixed(2)} nm · ${legs[index - 1].bearingTrue === null ? "—" : `${legs[index - 1].bearingTrue!.toFixed(0)}°T`} from previous`}
                </small>
              </div>
              <div className="route-order">
                <button
                  type="button"
                  aria-label={`Move checkpoint ${index + 1} earlier`}
                  disabled={index === 0}
                  onClick={() => reorder(index, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Move checkpoint ${index + 1} later`}
                  disabled={index === planner.waypoints.length - 1}
                  onClick={() => reorder(index, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Delete checkpoint ${index + 1}`}
                  onClick={() =>
                    planner.update(
                      planner.waypoints.filter((p) => p.id !== point.id),
                    )
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="route-note">
        <MapPin size={13} /> Dashed legs join your points directly. They may
        cross land, shoals or restrictions and are not checked for safe passage.
        Bearings are true, not compass headings. Verify against current nautical
        charts before using any exported route.
      </p>
    </section>
  );
}
