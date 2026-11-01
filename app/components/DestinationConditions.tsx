"use client";
import { useEffect, useState, type FormEvent } from "react";
import { type Briefing, type Position } from "@/lib/briefing";
import { mapPlaces } from "@/lib/map-places";
import ConditionsCard from "./ConditionsCard";

export type ForecastDestination = Position & { name: string };

function DestinationFeed({ destination }: { destination: ForecastDestination }) {
  const [data, setData] = useState<Briefing | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [validTime, setValidTime] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setRevision(value => value + 1), 600000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/briefing?latitude=${destination.latitude}&longitude=${destination.longitude}`, { signal: controller.signal, cache: "no-store" })
        .then(async response => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Destination forecast unavailable");
          return body as Briefing;
        })
        .then(value => { if (!controller.signal.aborted) { setData(value); setError(""); } })
        .catch(() => { if (!controller.signal.aborted) { setData(null); setError("Destination forecast unavailable. Retry or consult official forecasts."); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [destination.latitude, destination.longitude, revision]);
  return <ConditionsCard title="Destination" name={destination.name} position={destination} data={data} loading={loading} error={error}
    validTime={validTime} onTimeChange={setValidTime} onRefresh={() => setRevision(value => value + 1)}/>;
}

export default function DestinationConditions({ passageDestination, routeDestination }: { passageDestination?: string; routeDestination: ForecastDestination | null }) {
  const [destination, setDestination] = useState<ForecastDestination | null>(null);
  const [useRoute, setUseRoute] = useState(false);
  const [error, setError] = useState("");
  const active = useRoute ? routeDestination : destination;
  function manual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const lat = String(values.get("lat") ?? "").trim(), lon = String(values.get("lon") ?? "").trim();
    const latitude = Number(lat), longitude = Number(lon);
    if (!lat || !lon || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 85 || Math.abs(longitude) > 180) {
      setError("Enter latitude −85 to 85 and longitude −180 to 180."); return;
    }
    setDestination({ latitude, longitude, name: String(values.get("name") || "Destination") }); setUseRoute(false); setError("");
  }
  return <div className="destination-conditions">
    <details className="destination-setup" open={!active || undefined}>
      <summary>{active ? "Change destination forecast point" : "Choose your destination forecast point"}</summary>
      {passageDestination && <p>Passage destination: <strong>{passageDestination}</strong>. Confirm its forecast point below.</p>}
      <label>Known harbour or marina<select aria-label="Destination harbour" value="" onChange={event => {
        const place = mapPlaces.find(p => p.id === event.target.value);
        if (place) { setDestination(place); setUseRoute(false); setError(""); }
      }}><option value="">Choose a harbour…</option>{mapPlaces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button type="button" className="button" disabled={!routeDestination} onClick={() => { setUseRoute(true); setError(""); }}>Use final route checkpoint{routeDestination ? ` · ${routeDestination.name}` : ""}</button>
      <p>Or enter a destination anywhere in the world. Harbour pins are approximate overview points.</p>
      <form className="destination-form" onSubmit={manual}>
        <label>Destination name<input name="name" defaultValue={passageDestination ?? ""} maxLength={120}/></label>
        <label>Destination latitude<input name="lat" type="number" step="any" min="-85" max="85" required/></label>
        <label>Destination longitude<input name="lon" type="number" step="any" min="-180" max="180" required/></label>
        <button className="button" type="submit">Show destination forecast</button>
      </form>
      {error && <p role="alert" className="alert error">{error}</p>}
    </details>
    {useRoute && <p className="conditions-meta">Following the final checkpoint: edits and deletions update this forecast point.</p>}
    {active ? <DestinationFeed key={`${active.latitude},${active.longitude}`} destination={active}/> : <div className="conditions-card conditions-empty"><span className="eyebrow">DESTINATION</span><h3>Your arrival conditions</h3><p>Select a harbour, the final route checkpoint, or enter coordinates to see the same sea state, visibility, precipitation and wind forecast for your destination.</p></div>}
  </div>;
}
