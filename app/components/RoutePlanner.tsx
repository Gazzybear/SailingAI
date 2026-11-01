"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  MapPin,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  buildLegs,
  totalDistanceNm,
  exportGPX,
  isValidCoordinates,
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
  const [draft, setDraft] = useState<{ id: string; name: string; latitude: string; longitude: string } | null>(null);
  const [editError, setEditError] = useState("");
  const [deleted, setDeleted] = useState<{ point: RouteWaypoint; index: number } | null>(null);
  function edit(point: RouteWaypoint) {
    planner.setEditing(false);
    setDraft({ id: point.id, name: point.name, latitude: String(point.latitude), longitude: String(point.longitude) });
    setEditError("");
  }
  function save() {
    if (!draft) return;
    const latitude = Number(draft.latitude), longitude = Number(draft.longitude);
    if (!draft.name.trim() || !draft.latitude.trim() || !draft.longitude.trim() || !isValidCoordinates(latitude, longitude)) {
      setEditError("Enter a name, latitude from −85 to 85, and longitude from −180 to 180.");
      return;
    }
    if (planner.update(planner.waypoints.map(point => point.id === draft.id ? { ...point, name: draft.name.trim(), latitude, longitude } : point))) {
      setDraft(null);
      setEditError("");
    }
  }
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
              setDraft(null);
              setEditError("");
              if (!planner.editing) onStartEditing();
              planner.setEditing(!planner.editing);
            }}
          >
            <Plus size={15} />
            {planner.editing ? "Finish editing" : planner.waypoints.length ? "Add / move on map" : "Add checkpoints"}
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
      {deleted && (
        <div className="route-undo" role="status">
          <span>Deleted “{deleted.point.name}”.</span>
          <button type="button" onClick={() => {
            const next = [...planner.waypoints];
            next.splice(Math.min(deleted.index, next.length), 0, deleted.point);
            if (planner.update(next)) setDeleted(null);
          }}>Undo delete</button>
        </div>
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
              key={point.id}
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
                <span className="route-checkpoint-caption">Checkpoint {index + 1}</span>
                <strong className="route-checkpoint-name">{point.name}</strong>
                <small>
                  {point.latitude.toFixed(5)}°, {point.longitude.toFixed(5)}°
                  {index > 0 &&
                    ` · ${legs[index - 1].distanceNm.toFixed(2)} nm · ${legs[index - 1].bearingTrue === null ? "—" : `${legs[index - 1].bearingTrue!.toFixed(0)}°T`} from previous`}
                </small>
              </div>
              <div className="route-order">
                <button type="button" aria-label={`Edit checkpoint ${index + 1}`} onClick={() => edit(point)}><Pencil size={14} /> Edit</button>
                <button
                  type="button"
                  aria-label={`Move checkpoint ${index + 1} earlier`}
                  title="Move earlier"
                  disabled={index === 0}
                  onClick={() => reorder(index, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Move checkpoint ${index + 1} later`}
                  title="Move later"
                  disabled={index === planner.waypoints.length - 1}
                  onClick={() => reorder(index, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Delete checkpoint ${index + 1}`}
                  className="route-delete"
                  onClick={() => {
                    if (planner.update(
                      planner.waypoints.filter((p) => p.id !== point.id),
                    )) {
                      setDeleted({ point, index });
                      if (draft?.id === point.id) setDraft(null);
                    }
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
              {draft?.id === point.id && (
                <form className="route-edit-form" aria-label={`Edit checkpoint ${index + 1}`} onSubmit={event => { event.preventDefault(); save(); }}>
                  <label>Name<input autoFocus required maxLength={80} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
                  <div className="route-coordinate-fields">
                    <label>Latitude (decimal degrees)<input type="number" required min={-85} max={85} step="any" value={draft.latitude} onChange={event => setDraft({ ...draft, latitude: event.target.value })} /></label>
                    <label>Longitude (decimal degrees)<input type="number" required min={-180} max={180} step="any" value={draft.longitude} onChange={event => setDraft({ ...draft, longitude: event.target.value })} /></label>
                  </div>
                  <p>Use negative values for south and west. To drag markers, close this editor and choose Add / move on map.</p>
                  {editError && <p className="route-error" role="alert">{editError}</p>}
                  <div className="route-actions"><button type="submit">Save checkpoint</button><button type="button" onClick={() => { setDraft(null); setEditError(""); }}>Cancel</button></div>
                </form>
              )}
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
