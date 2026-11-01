"use client";

import { ExternalLink, Radio, RefreshCw } from "lucide-react";
import type { VesselTraffic } from "./useVesselTraffic";
import "./vessel-traffic.css";

function age(timestamp: string, now: number) {
  const milliseconds = now - Date.parse(timestamp);
  if (!Number.isFinite(milliseconds)) return "Time unavailable";
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ago`;
}
function utc(timestamp: string) {
  const value = new Date(timestamp);
  return Number.isFinite(value.getTime())
    ? `${value.toISOString().slice(0, 19).replace("T", " ")} UTC`
    : "Time unavailable";
}
const number = (value: number | undefined, suffix: string) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(1)}${suffix}`
    : "Not reported";

export default function VesselTrafficPanel({
  traffic,
}: {
  traffic: VesselTraffic;
}) {
  const sourceURL =
    traffic.response?.sourceUrl ||
    (traffic.provider === "finland"
      ? "https://www.digitraffic.fi/en/marine-traffic/"
      : "https://aisstream.io/");
  const sourceName =
    traffic.response?.source ||
    (traffic.provider === "finland" ? "Fintraffic / Digitraffic" : "AISstream");
  const label =
    traffic.status === "off"
      ? "OFF"
      : traffic.status === "loading"
        ? "FETCHING"
        : traffic.status === "live"
          ? "REAL AIS SNAPSHOT"
          : traffic.status === "empty"
            ? "NO REPORTS"
            : traffic.status === "unconfigured"
              ? "NOT CONFIGURED"
              : traffic.status === "busy"
                ? "FEED BUSY"
                : "UNAVAILABLE";
  return (
    <section
      className="vessel-traffic"
      aria-labelledby="vessel-traffic-heading"
    >
      <div className="vessel-traffic-heading">
        <div>
          <span className="vessel-traffic-eyebrow">
            <Radio size={13} /> NEARBY VESSEL REPORTS
          </span>
          <h3 id="vessel-traffic-heading">Vessel traffic</h3>
        </div>
        <span
          className={`traffic-status traffic-status-${traffic.status}`}
          role="status"
        >
          {label}
        </span>
      </div>
      <div className="vessel-traffic-controls">
        <button
          className="button"
          disabled={!traffic.enabled || traffic.loading}
          onClick={traffic.refresh}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      <p className="traffic-coverage">
        {traffic.provider === "finland"
          ? "Fintraffic covers its Finnish receiver network. An empty result outside that region does not mean the sea is clear."
          : "AISstream listens continuously for the map area and accumulates each vessel’s latest report. Global receiver coverage is incomplete."}
      </p>
      {traffic.enabled && (
        <p
          className={`traffic-feed-message ${traffic.status === "error" || traffic.status === "busy" ? "traffic-feed-error" : ""}`}
          role={traffic.status === "error" ? "alert" : "status"}
        >
          {traffic.message}
        </p>
      )}
      {traffic.enabled && traffic.response && (
        <p className="traffic-retrieval">
          Fetched {utc(traffic.response.retrievedAt)} ·{" "}
          {age(traffic.response.retrievedAt, traffic.now)} · Updating every 5
          seconds while enabled · Map radius {traffic.radius} NM
        </p>
      )}
      {traffic.enabled && traffic.ships.length > 0 && (
        <>
          <div className="traffic-table-wrap">
            <table>
              <caption>
                {traffic.ships.length} reported{" "}
                {traffic.ships.length === 1 ? "vessel" : "vessels"} nearby.{" "}
                {traffic.ships.length > 10
                  ? "Showing the first 10 below; all returned current reports are available to the map."
                  : ""}
              </caption>
              <thead>
                <tr>
                  <th>Vessel / MMSI</th>
                  <th>Position report age</th>
                  <th>SOG</th>
                  <th>COG</th>
                </tr>
              </thead>
              <tbody>
                {traffic.ships.slice(0, 10).map((ship) => (
                  <tr key={ship.mmsi}>
                    <th scope="row">
                      <span>{ship.name || "Name not reported"}</span>
                      <small>MMSI {ship.mmsi}</small>
                    </th>
                    <td title={utc(ship.timestamp)}>
                      {age(ship.timestamp, traffic.now)}
                      <small>{utc(ship.timestamp)}</small>
                    </td>
                    <td>{number(ship.sog, " kn")}</td>
                    <td>{number(ship.cog, "°")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {traffic.enabled &&
        traffic.status === "live" &&
        traffic.ships.length === 0 && (
          <p className="traffic-feed-message">
            No reports within the 30-minute freshness window remain. Refresh to
            request a newer snapshot.
          </p>
        )}
      <div className="traffic-source">
        <a href={sourceURL} target="_blank" rel="noreferrer">
          Source: {sourceName} <ExternalLink size={11} />
        </a>
        {traffic.provider === "finland" && (
          <a
            href={
              traffic.response?.licenseUrl ||
              "https://www.digitraffic.fi/en/terms-of-service/"
            }
            target="_blank"
            rel="noreferrer"
          >
            CC BY 4.0 · filtered and reformatted
          </a>
        )}
      </div>
      <p className="traffic-limit">
        Reports may be delayed, incomplete or absent; vessels without a received
        AIS report will not appear. Unknown speed or course stays unreported.
        This display is not for collision avoidance and does not replace a
        proper lookout or onboard instruments.
      </p>
    </section>
  );
}
