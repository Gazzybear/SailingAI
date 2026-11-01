"use client";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Anchor,
  ArrowUpRight,
  ChevronRight,
  Compass,
  Droplets,
  Eye,
  Fuel,
  Globe2,
  LocateFixed,
  MapPin,
  Moon,
  Radio,
  Sailboat,
  Sun,
  Waves,
  Wind,
  X,
} from "lucide-react";
import { bearing, display, type ForecastRow } from "@/lib/briefing";
import { distanceNm, mapPlaces, placeDetails } from "@/lib/map-places";
import MapCanvas, { type MapTarget } from "./MapCanvas";
import "./vessel-map.css";

export type VesselPosition = { latitude: number; longitude: number };
const presets = [
  { name: "The Solent", latitude: 50.77, longitude: -1.27 },
  { name: "Portsmouth", latitude: 50.786, longitude: -1.116 },
  { name: "Sydney", latitude: -33.85, longitude: 151.24 },
  { name: "New York", latitude: 40.685, longitude: -74.04 },
];
function validPosition(p: VesselPosition) {
  return (
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 85 &&
    Math.abs(p.longitude) <= 180
  );
}
const formatTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function VesselMap({
  position,
  onPositionChange,
  forecast,
  loading,
  vessel,
}: {
  position: VesselPosition;
  onPositionChange: (p: VesselPosition) => void;
  forecast?: ForecastRow;
  loading?: boolean;
  vessel?: string;
}) {
  const [night, setNight] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState("vessel");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const mapArea = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<MapTarget>({
    ...position,
    zoom: 12,
    revision: 0,
  });
  const focus = useCallback(
    (p: VesselPosition, zoom: number) =>
      setTarget((old) => ({ ...p, zoom, revision: old.revision + 1 })),
    [],
  );
  const select = useCallback(
    (id: string) => {
      setSelected(id);
      mapArea.current?.scrollIntoView({ block: "nearest" });
      const place = mapPlaces.find((p) => p.id === id);
      if (place) focus(place, place.kind === "marina" ? 15 : 14);
    },
    [focus],
  );
  const places = useMemo(
    () =>
      mapPlaces.filter((p) => {
        if (filter === "all") return true;
        if (filter === "harbour") return p.kind === "harbour";
        if (filter === "marina") return p.kind === "marina";
        return (
          placeDetails(p).marina?.facilities.some((f) =>
            f.toLowerCase().includes(filter),
          ) ?? false
        );
      }),
    [filter],
  );
  const nearby = places
    .map((p) => ({ ...p, distance: distanceNm(position, p) }))
    .filter((p) => p.distance < 30)
    .sort((a, b) => a.distance - b.distance);
  const selectedPlace = mapPlaces.find((p) => p.id === selected);
  const details = selectedPlace ? placeDetails(selectedPlace) : null;
  function choose(next: VesselPosition) {
    mapArea.current?.scrollIntoView({ block: "nearest" });
    setError("");
    setSelected("vessel");
    focus(next, 12);
    onPositionChange(next);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const lat = String(data.get("latitude") ?? "").trim(),
      lon = String(data.get("longitude") ?? "").trim();
    const next = { latitude: Number(lat), longitude: Number(lon) };
    if (!lat || !lon || !validPosition(next)) {
      setError("Use latitude −85 to 85 and longitude −180 to 180.");
      return;
    }
    choose(next);
  }
  return (
    <section
      className={`vessel-map ${expanded ? "map-expanded" : ""}`}
      aria-labelledby="vessel-map-heading"
    >
      <div className="explorer-header">
        <div>
          <span className="explorer-eyebrow">
            <Compass size={14} /> YOUR COASTAL PERSPECTIVE
          </span>
          <h2 id="vessel-map-heading">A clearer view of what’s ahead.</h2>
          <p>Explore the coast. Get to know your next harbour.</p>
        </div>
        <span className="vessel-simulation">
          <span /> DEMO POSITION · NO GPS
        </span>
      </div>
      <div className="explorer-toolbar">
        <div className="explorer-filters" aria-label="Map features">
          {[
            { id: "all", label: "All places", icon: MapPin },
            { id: "harbour", label: "Harbours", icon: Compass },
            { id: "marina", label: "Marinas", icon: Anchor },
            { id: "fuel", label: "Fuel", icon: Fuel },
            { id: "water", label: "Water", icon: Droplets },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => {
                setFilter(id);
                setSelected("vessel");
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="map-theme"
          onClick={() => setNight(!night)}
          aria-label={night ? "Switch to day map" : "Switch to night map"}
        >
          {night ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
      <div className="explorer-body">
        <div className="explorer-map-area" ref={mapArea}>
          <MapCanvas
            position={position}
            target={target}
            places={places}
            selected={selected}
            onSelect={select}
            night={night}
          />
          <div className="map-floating-controls">
            <button
              type="button"
              onClick={() => {
                setSelected("vessel");
                focus(position, 13);
              }}
            >
              <LocateFixed size={15} /> My vessel
            </button>
            <button type="button" onClick={() => focus(position, 3)}>
              <Globe2 size={15} /> World
            </button>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Reduce map size" : "Expand map"}
            >
              {expanded ? <X size={16} /> : <ArrowUpRight size={16} />}
            </button>
          </div>
          <div
            className="map-weather-strip"
            aria-label="Forecast at simulated vessel"
          >
            <div>
              <Wind size={16} />
              <span>
                WIND
                <strong>{forecast ? display(forecast.wind, "kn") : "—"}</strong>
              </span>
            </div>
            <div>
              <Waves size={16} />
              <span>
                WAVES
                <strong>{forecast ? display(forecast.wave, "m") : "—"}</strong>
              </span>
            </div>
            <div>
              <Eye size={16} />
              <span>
                VISIBILITY
                <strong>
                  {forecast
                    ? display(
                        forecast.visibility === null
                          ? null
                          : forecast.visibility / 1000,
                        "km",
                      )
                    : "—"}
                </strong>
              </span>
            </div>
            <small>
              {loading
                ? "Fetching forecast…"
                : forecast
                  ? `${formatTime(forecast.time)} UTC · vessel forecast`
                  : "Forecast unavailable"}
            </small>
          </div>
          <div className="map-north" aria-hidden="true">
            N<Compass size={29} />
          </div>
        </div>
        <aside
          key={selected}
          className="map-inspector"
          aria-label="Selected map feature"
          aria-live="polite"
        >
          {selectedPlace && details ? (
            <>
              <div className={`inspector-icon ${selectedPlace.kind}`}>
                <Anchor size={22} />
              </div>
              <span className="inspector-kicker">
                {selectedPlace.kind} · LOCAL KNOWLEDGE
              </span>
              <h3>{selectedPlace.name}</h3>
              <p className="inspector-distance">
                {distanceNm(position, selectedPlace).toFixed(1)} nm from vessel
                · straight line
              </p>
              <p>
                {details.marina?.description ?? details.harbour.introduction}
              </p>
              <div className="inspector-radio">
                <Radio size={17} />
                <span>
                  {details.marina
                    ? `Marina VHF ${details.marina.vhf}`
                    : details.harbour.radio}
                </span>
              </div>
              {details.marina && (
                <>
                  <div className="facility-tags">
                    {details.marina.facilities.map((f) => (
                      <span key={f}>{f}</span>
                    ))}
                  </div>
                  <a
                    className="inspector-phone"
                    href={`tel:${details.marina.phone.replace(/\s/g, "")}`}
                  >
                    {details.marina.phone}
                  </a>
                </>
              )}
              <a
                className="inspector-primary"
                href={details.marina?.website ?? details.harbour.authority.url}
                target="_blank"
                rel="noreferrer"
              >
                {details.marina ? "Visit marina website" : "Harbour authority"}
                <ArrowUpRight size={16} />
              </a>
              <h4>Before you arrive</h4>
              {details.harbour.briefing.map((note) => (
                <p key={note}>{note}</p>
              ))}
              <div className="inspector-links">
                {details.harbour.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.label}
                    <ArrowUpRight size={13} />
                  </a>
                ))}
              </div>
              <small>
                Overview pin, not an approach waypoint. Details checked{" "}
                {details.harbour.checkedAt}. Confirm access and berthing with
                the operator.
              </small>
            </>
          ) : (
            <>
              <div className="inspector-icon">
                <Sailboat size={24} />
              </div>
              <span className="inspector-kicker">YOUR VESSEL · SIMULATED</span>
              <h3>{vessel || "Your sailing companion"}</h3>
              <p className="inspector-coordinates">
                {Math.abs(position.latitude).toFixed(4)}°{" "}
                {position.latitude < 0 ? "S" : "N"}
                <br />
                {Math.abs(position.longitude).toFixed(4)}°{" "}
                {position.longitude < 0 ? "W" : "E"}
              </p>
              <p>
                Select a pin to explore marina facilities, radio channels and
                official harbour guidance.
              </p>
              {forecast && (
                <div className="vessel-forecast-detail">
                  <span>
                    Wind from <b>{bearing(forecast.direction)}</b>
                  </span>
                  <span>
                    Gusts <b>{display(forecast.gust, "kn")}</b>
                  </span>
                  <span>
                    Wave period <b>{display(forecast.wavePeriod, "s")}</b>
                  </span>
                  <span>
                    Sea level · MSL <b>{display(forecast.seaLevel, "m")}</b>
                  </span>
                  <small>
                    Sea level is modelled relative to mean sea level, not chart
                    datum or available depth.
                  </small>
                </div>
              )}
              <a
                className="inspector-primary"
                href="https://easytide.admiralty.co.uk/"
                target="_blank"
                rel="noreferrer"
              >
                Official UK tide predictions
                <ArrowUpRight size={16} />
              </a>
            </>
          )}
        </aside>
      </div>
      <div className="map-discovery">
        <div className="discovery-heading">
          <div>
            <span className="inspector-kicker">EXPLORE NEAR YOUR VESSEL</span>
            <h3>
              {nearby.length
                ? `${nearby.length} ${nearby.length === 1 ? "place" : "places"} in your local guide`
                : "Beyond our local guide"}
            </h3>
          </div>
          <span>Curated Solent coverage · within 30 nm</span>
        </div>
        <div className="nearby-places">
          {nearby.length ? (
            nearby.map((p) => (
              <button
                type="button"
                key={p.id}
                aria-pressed={selected === p.id}
                onClick={() => select(p.id)}
              >
                <span className={`nearby-icon ${p.kind}`}>
                  <Anchor size={17} />
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.kind} · {p.distance.toFixed(1)} nm straight line
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))
          ) : (
            <p>
              {filter === "all"
                ? "The world map and vessel forecast work here. Our curated harbour pins currently cover Cowes and Portsmouth."
                : "No matching places in this guide within 30 nm. Try All places or return to the Solent."}{" "}
              <a
                href="https://marinas.com/browse/marina"
                target="_blank"
                rel="noreferrer"
              >
                Explore Marinas.com ↗
              </a>
            </p>
          )}
        </div>
      </div>
      <div className="map-footer">
        <div className="vessel-map-presets">
          <span>MOVE DEMO VESSEL</span>
          {presets.map((p) => (
            <button type="button" key={p.name} onClick={() => choose(p)}>
              {p.name}
            </button>
          ))}
        </div>
        <details className="vessel-custom">
          <summary>Custom coordinates</summary>
          <form
            key={`${position.latitude},${position.longitude}`}
            onSubmit={submit}
            className="vessel-coordinate-form"
          >
            <label>
              Latitude
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
              Longitude
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
            <button type="submit">Set demo position</button>
          </form>
        </details>
        {error && <p role="alert">{error}</p>}
        <p className="vessel-map-note">
          Overview map, not a nautical chart. Pins do not establish safe entry,
          depth or berth availability. Use current charts, tides and harbour
          notices for navigation. Map tiles: © OpenStreetMap contributors;
          viewing an area sends tile requests to OpenStreetMap.
        </p>
      </div>
    </section>
  );
}
