"use client";
import { CloudRain, Eye, Waves, Wind } from "lucide-react";
import { bearing, display, forecastAt, weatherLabel, type Briefing, type Position } from "@/lib/briefing";

export const forecastTime = (value: string) => new Date(value).toLocaleString("en-GB", {
  timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
}) + " UTC";

export default function ConditionsCard({ title, name, position, data, loading, error, validTime, onTimeChange, onRefresh }: {
  title: string; name: string; position: Position; data: Briefing | null;
  loading: boolean; error: string; validTime: string | null;
  onTimeChange: (value: string | null) => void; onRefresh: () => void;
}) {
  const row = data ? forecastAt(data.rows, validTime) : undefined;
  return <article className="conditions-card" aria-label={title}>
    <div className="conditions-heading"><div><span className="eyebrow">{title}</span><h3>{name}</h3></div>
      <button type="button" className="button" disabled={loading} onClick={onRefresh}>{loading ? "Updating…" : "Refresh"}</button></div>
    <p className="conditions-meta">Requested point {position.latitude.toFixed(4)}°, {position.longitude.toFixed(4)}°</p>
    <label className="forecast-picker">{title === "Destination" ? "Arrival forecast time" : "Conditions valid time"}
      <select value={validTime ?? "now"} onChange={e => onTimeChange(e.target.value === "now" ? null : e.target.value)}>
        <option value="now">Current hour · follows the clock</option>
        {validTime && !data?.rows.some(r => r.time === validTime) && <option value={validTime}>{forecastTime(validTime)} · unavailable</option>}
        {data?.rows.map(r => <option key={r.time} value={r.time}>{forecastTime(r.time)}</option>)}
      </select>
    </label>
    {loading && <p role="status">Checking the latest available forecast…</p>}
    {error && <p className="alert error" role="alert">{error}</p>}
    {!loading && data && <>
      {data.errors.map(message => <p className="alert error" role="status" key={message}>{message}</p>)}
      {row ? <>
        <p className="conditions-valid">Forecast valid {forecastTime(row.time)}</p>
        <div className="conditions-metrics">
          <div><Waves size={18}/><span>Sea state · total waves</span><strong>{display(row.wave, "m", 2)}</strong><small>Significant height · {display(row.wavePeriod, "s")} · from {bearing(row.waveDirection)}</small></div>
          <div><Eye size={18}/><span>Visibility</span><strong>{display(row.visibility === null ? null : row.visibility / 1852, "NM")}</strong><small>{display(row.visibility === null ? null : row.visibility / 1000, "km")} · modelled horizontal visibility</small></div>
          <div><CloudRain size={18}/><span>Rain / precipitation chance</span><strong>{display(row.rainChance, "%", 0)}</strong><small>{weatherLabel(row.code)} · {display(row.rain, "mm")} precipitation</small></div>
          <div><Wind size={18}/><span>Wind & gusts</span><strong>{display(row.wind, "kn")}</strong><small>From {bearing(row.direction)} · gust {display(row.gust, "kn")}</small></div>
        </div>
        <p className="conditions-secondary">Wind waves {display(row.windWave, "m", 2)} · Swell {display(row.swell, "m", 2)} from {bearing(row.swellDirection)}, {display(row.swellPeriod, "s")}<br/>Temperature {display(row.temperature, "°C")} · Pressure {display(row.pressure, "hPa", 0)}</p>
      </> : <p role="status">No forecast for this hour. Choose an available valid time; no substitute values are shown.</p>}
      <details className="conditions-provenance"><summary>Sources, retrieval times & forecast grid</summary>
        {data.sources.map(s => <p key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a><br/>Retrieved {forecastTime(s.retrievedAt)} · grid {s.latitude.toFixed(4)}°, {s.longitude.toFixed(4)}°</p>)}
        <p>Retrieved time is when the app fetched data, not the model issue time; this feed does not return a single model issue time. Sea grid cells may lie offshore and do not resolve conditions inside a harbour.</p>
      </details>
      <p className="conditions-meta">{data.sources.map(s => `${s.name.includes("marine") ? "Marine" : "Weather"} retrieved ${forecastTime(s.retrievedAt)}`).join(" · ")}</p>
    </>}
  </article>;
}
