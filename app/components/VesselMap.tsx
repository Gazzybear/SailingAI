"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, Globe2, LocateFixed, Sailboat } from "lucide-react";
import "./vessel-map.css";

export type VesselPosition = { latitude: number; longitude: number };

const presets = [
  { name: "Cowes / Solent", latitude: 50.775, longitude: -1.29 },
  { name: "Gosport / Portsmouth", latitude: 50.786, longitude: -1.116 },
  { name: "Sydney Harbour", latitude: -33.85, longitude: 151.24 },
  { name: "New York Harbour", latitude: 40.685, longitude: -74.04 },
];

function validPosition(position: VesselPosition) {
  return (
    Number.isFinite(position.latitude) &&
    Number.isFinite(position.longitude) &&
    Math.abs(position.latitude) <= 85 &&
    Math.abs(position.longitude) <= 180
  );
}

export default function VesselMap({
  position,
  onPositionChange,
}: {
  position: VesselPosition;
  onPositionChange: (position: VesselPosition) => void;
}) {
  const [world, setWorld] = useState(false);
  const [error, setError] = useState("");
  const valid = validPosition(position);
  const latitude = valid ? position.latitude : 0;
  const longitude = valid ? position.longitude : 0;
  const bounds = world
    ? [-180, -85, 180, 85]
    : [
        Math.max(-180, longitude - 0.12),
        Math.max(-85, latitude - 0.065),
        Math.min(180, longitude + 0.12),
        Math.min(85, latitude + 0.065),
      ];
  const query = new URLSearchParams({
    bbox: bounds.join(","),
    layer: "mapnik",
    marker: `${latitude},${longitude}`,
  });
  const mapURL = `https://www.openstreetmap.org/export/embed.html?${query}`;
  const externalURL = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${world ? 2 : 12}/${latitude}/${longitude}`;

  function choose(next: VesselPosition) {
    setError("");
    onPositionChange(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const lat = String(data.get("latitude") ?? "").trim();
    const lon = String(data.get("longitude") ?? "").trim();
    const next = { latitude: Number(lat), longitude: Number(lon) };
    if (!lat || !lon || !validPosition(next)) {
      setError(
        "Enter latitude between −85 and 85 and longitude between −180 and 180. This map does not cover the poles.",
      );
      return;
    }
    choose(next);
  }

  return (
    <section className="vessel-map" aria-labelledby="vessel-map-heading">
      <div className="vessel-map-heading">
        <div>
          <span className="eyebrow">YOUR VESSEL IN CONTEXT</span>
          <h2 id="vessel-map-heading">
            <Sailboat size={23} /> Vessel position
          </h2>
        </div>
        <span className="vessel-simulation">SIMULATED · NO GPS</span>
      </div>
      <p className="vessel-map-intro">
        Explore the world or inspect your local area. The marker represents the
        selected demo position; it is not a live vessel fix.
      </p>
      <div className="vessel-map-controls" aria-label="Map extent">
        <button
          type="button"
          className="button"
          aria-pressed={!world}
          onClick={() => setWorld(false)}
        >
          <LocateFixed size={15} /> Local area
        </button>
        <button
          type="button"
          className="button"
          aria-pressed={world}
          onClick={() => setWorld(true)}
        >
          <Globe2 size={15} /> World view
        </button>
        {valid && (
          <span className="vessel-coordinates">
            {Math.abs(latitude).toFixed(4)}° {latitude < 0 ? "S" : "N"} ·{" "}
            {Math.abs(longitude).toFixed(4)}° {longitude < 0 ? "W" : "E"}
          </span>
        )}
      </div>
      {valid ? (
        <iframe
          key={mapURL}
          title="OpenStreetMap with simulated vessel position"
          src={mapURL}
          loading="lazy"
          className="vessel-map-frame"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <p role="alert" className="vessel-map-error">
          This position is outside the supported map range. Select a demo
          location below.
        </p>
      )}
      <div className="vessel-map-credit">
        <span>
          ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap contributors
          </a>{" "}
          · General map, not a nautical chart.
        </span>
        {valid && (
          <a href={externalURL} target="_blank" rel="noreferrer">
            Open larger map <ExternalLink size={12} />
          </a>
        )}
      </div>
      <div
        className="vessel-map-presets"
        aria-label="Simulated vessel locations"
      >
        {presets.map((preset) => (
          <button
            type="button"
            className="button"
            key={preset.name}
            onClick={() =>
              choose({ latitude: preset.latitude, longitude: preset.longitude })
            }
          >
            {preset.name}
          </button>
        ))}
      </div>
      <details className="vessel-custom">
        <summary>Set a custom simulated position</summary>
        <form
          key={`${position.latitude},${position.longitude}`}
          onSubmit={submit}
          className="vessel-coordinate-form"
        >
          <label>
            Latitude (decimal degrees)
            <input
              name="latitude"
              type="number"
              step="any"
              min="-85"
              max="85"
              required
              defaultValue={position.latitude}
            />
          </label>
          <label>
            Longitude (decimal degrees)
            <input
              name="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              required
              defaultValue={position.longitude}
            />
          </label>
          <button className="button primary" type="submit">
            Set demo position
          </button>
        </form>
        <p>
          Use negative values for south and west. This changes the briefing
          location; it does not record a measured position in your logbook.
        </p>
      </details>
      {error && (
        <p role="alert" className="vessel-map-error">
          {error}
        </p>
      )}
      <p className="vessel-map-note">
        Use official nautical charts for navigation. The map has no depth,
        clearance or route-safety information. Loading it sends the selected
        coordinates to OpenStreetMap.
      </p>
    </section>
  );
}
