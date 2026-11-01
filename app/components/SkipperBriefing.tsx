"use client";
import { useEffect, useState } from "react";
import {
  CloudSun,
  Wind,
  Waves,
  Eye,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import {
  bearing,
  Briefing,
  display,
  Position,
  weatherLabel,
} from "@/lib/briefing";
import VesselMap from "./VesselMap";
import HarbourGuide from "./HarbourGuide";
import "./briefing.css";
const time = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function SkipperBriefing({
  vessel,
  passageDate,
}: {
  vessel?: string;
  passageDate?: string;
}) {
  const [position, setPosition] = useState<Position>({
      latitude: 50.77,
      longitude: -1.27,
    }),
    [briefing, setBriefing] = useState<Briefing | null>(null),
    [selected, setSelected] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/briefing?latitude=${position.latitude}&longitude=${position.longitude}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Forecast unavailable");
        return data as Briefing;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setBriefing(data);
        setSelected(
          Math.max(
            0,
            data.rows.findIndex(
              (row) =>
                Date.parse(row.time) >=
                Math.floor(Date.now() / 3600000) * 3600000,
            ),
          ),
        );
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setBriefing(null);
          setError(e.message || "Forecast unavailable");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [position.latitude, position.longitude, reload]);
  function changePosition(next: Position) {
    setLoading(true);
    setBriefing(null);
    setError("");
    setPosition(next);
    setReload((n) => n + 1);
  }
  const row = briefing?.rows[selected];
  const levels = briefing?.rows.slice(selected, selected + 24) ?? [];
  const known = levels.flatMap((r) =>
    r.seaLevel === null ? [] : [r.seaLevel],
  );
  const min = Math.min(...known, 0),
    max = Math.max(...known, 0),
    range = max - min || 1;
  const cards = row
    ? [
        {
          title: "Wind & gusts",
          icon: Wind,
          value: display(row.wind, "kn"),
          detail: `From ${bearing(row.direction)} · gust ${display(row.gust, "kn")}`,
        },
        {
          title: "Sea state · wave model",
          icon: Waves,
          value: display(row.wave, "m"),
          detail: `Significant wave height · period ${display(row.wavePeriod, "s")}`,
        },
        {
          title: "Visibility forecast",
          icon: Eye,
          value: display(
            row.visibility === null ? null : row.visibility / 1000,
            "km",
          ),
          detail: "Modelled horizontal visibility",
        },
        {
          title: "Weather",
          icon: CloudSun,
          value: weatherLabel(row.code),
          detail: `${display(row.temperature, "°C")} · rain ${display(row.rain, "mm")}`,
        },
      ]
    : [];
  return (
    <section className="briefing">
      <div className="briefing-intro">
        <div>
          <span className="eyebrow">SKIPPER BRIEFING</span>
          <h2>Know more before you cast off.</h2>
          <p>
            Weather, water and local knowledge for {vessel || "your vessel"}.
          </p>
        </div>
        <span className="briefing-tag">
          Simulated vessel · real forecast data
        </span>
      </div>
      <VesselMap position={position} onPositionChange={changePosition} />
      <section className="briefing-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">WEATHER & SEA CONDITIONS</span>
            <h2>Look ahead, hour by hour.</h2>
          </div>
          <button
            className="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setReload((n) => n + 1);
            }}
          >
            <RefreshCw size={15} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        <p className="briefing-caption">
          Forecast point {position.latitude.toFixed(4)}°,{" "}
          {position.longitude.toFixed(4)}°. All forecast times are UTC.{" "}
          {passageDate &&
            `Passage date: ${passageDate}; check the forecast valid time below.`}{" "}
          Data is kept separate from observed logbook entries.
        </p>
        {loading && <p role="status">Fetching weather and marine forecasts…</p>}
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {!loading && briefing && (
          <>
            {briefing.errors.map((e) => (
              <div className="alert error" role="status" key={e}>
                {e}
              </div>
            ))}
            <label className="forecast-picker">
              Forecast valid time
              <select
                value={selected}
                onChange={(e) => setSelected(Number(e.target.value))}
              >
                {briefing.rows.map((r, i) => (
                  <option key={r.time} value={i}>
                    {time(r.time)} UTC
                  </option>
                ))}
              </select>
            </label>
            {row && (
              <>
                <div className="forecast-cards">
                  {cards.map(({ title, icon: Icon, value, detail }) => (
                    <article key={title}>
                      <div>
                        <Icon size={19} />
                        <span>{title}</span>
                      </div>
                      <strong>{value}</strong>
                      <p>{detail}</p>
                    </article>
                  ))}
                </div>
                <div className="forecast-details">
                  <span>
                    Pressure <b>{display(row.pressure, "hPa", 0)}</b>
                  </span>
                  <span>
                    Rain chance <b>{display(row.rainChance, "%", 0)}</b>
                  </span>
                  <span>
                    Humidity <b>{display(row.humidity, "%", 0)}</b>
                  </span>
                  <span>
                    Cloud cover <b>{display(row.cloud, "%", 0)}</b>
                  </span>
                  <span>
                    Swell height <b>{display(row.swell, "m")}</b>
                  </span>
                  <span>
                    Waves from <b>{bearing(row.waveDirection)}</b>
                  </span>
                  <span>
                    First forecast day sunrise{" "}
                    <b>
                      {briefing.sunrise
                        ? time(briefing.sunrise) + " UTC"
                        : "Not available"}
                    </b>
                  </span>
                  <span>
                    First forecast day sunset{" "}
                    <b>
                      {briefing.sunset
                        ? time(briefing.sunset) + " UTC"
                        : "Not available"}
                    </b>
                  </span>
                </div>
                {((row.gust ?? 0) >= 25 ||
                  (row.visibility !== null && row.visibility < 1000)) && (
                  <div className="review-warning">
                    Forecast conditions to review:{" "}
                    {(row.gust ?? 0) >= 25 ? `gusts ${row.gust} kn. ` : ""}
                    {row.visibility !== null && row.visibility < 1000
                      ? `visibility ${row.visibility} m. `
                      : ""}
                    Consult official warnings and judge conditions for your
                    vessel and crew.
                  </div>
                )}
                <details>
                  <summary>Hourly forecast table</summary>
                  <div className="forecast-table">
                    <table>
                      <thead>
                        <tr>
                          <th>UTC</th>
                          <th>Wind kn</th>
                          <th>Gust kn</th>
                          <th>Visibility km</th>
                          <th>Wave m</th>
                          <th>Rain mm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {briefing.rows
                          .slice(selected, selected + 24)
                          .map((r) => (
                            <tr key={r.time}>
                              <td>{time(r.time)}</td>
                              <td>{r.wind ?? "—"}</td>
                              <td>{r.gust ?? "—"}</td>
                              <td>
                                {r.visibility === null
                                  ? "—"
                                  : (r.visibility / 1000).toFixed(1)}
                              </td>
                              <td>{r.wave ?? "—"}</td>
                              <td>{r.rain ?? "—"}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                <section className="tide-panel">
                  <span className="eyebrow">
                    TIDAL CONTEXT · MODELLED SEA LEVEL
                  </span>
                  <h3>
                    {display(row.seaLevel, "m")}{" "}
                    <small>relative to global mean sea level</small>
                  </h3>
                  <p>
                    This coarse model includes tidal variation. It is{" "}
                    <strong>not height above chart datum</strong> and cannot
                    establish clearance, safe departure times or local tidal
                    streams. Use official port tide tables and a nautical
                    almanac for those decisions.
                  </p>
                  {known.length > 0 ? (
                    <>
                      <svg
                        viewBox="0 0 720 150"
                        role="img"
                        aria-label="Next 24 hours of modelled sea level relative to mean sea level. Missing values are gaps."
                      >
                        <line
                          x1="35"
                          x2="710"
                          y1={125 - ((0 - min) / range) * 100}
                          y2={125 - ((0 - min) / range) * 100}
                          stroke="#b4c8c1"
                          strokeDasharray="4 4"
                        />
                        {levels.map((r, i) =>
                          r.seaLevel === null ? null : (
                            <g key={r.time}>
                              <title>
                                {time(r.time)} UTC: {r.seaLevel} m relative to
                                mean sea level
                              </title>
                              <circle
                                cx={
                                  40 +
                                  (i * 660) / Math.max(levels.length - 1, 1)
                                }
                                cy={125 - ((r.seaLevel - min) / range) * 100}
                                r="4"
                                fill="#26776e"
                              />
                            </g>
                          ),
                        )}
                        <text x="0" y="20" fontSize="10" fill="#52746b">
                          {max.toFixed(1)} m
                        </text>
                        <text x="0" y="140" fontSize="10" fill="#52746b">
                          {min.toFixed(1)} m
                        </text>
                      </svg>
                      <div className="tide-axis">
                        <span>{levels[0] && time(levels[0].time)} UTC</span>
                        <span>
                          {levels.at(-1) && time(levels.at(-1)!.time)} UTC
                        </span>
                      </div>
                    </>
                  ) : (
                    <p>
                      No sea-level model values available here. No replacement
                      values have been generated.
                    </p>
                  )}
                  <a
                    className="source-link"
                    href="https://easytide.admiralty.co.uk/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    ADMIRALTY EasyTide · official port predictions{" "}
                    <ExternalLink size={13} />
                  </a>
                </section>
              </>
            )}
            <div className="forecast-sources">
              {briefing.sources.map((s) => (
                <p key={s.name}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.name}
                  </a>{" "}
                  · retrieved {time(s.retrievedAt)} UTC · actual model grid{" "}
                  {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                </p>
              ))}
              <p>
                Marine grids can be offshore and do not resolve harbour
                conditions. Forecasts are model predictions, not onboard
                measurements. Data © Open-Meteo and its model providers,{" "}
                <a
                  href="https://open-meteo.com/en/terms"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0 / provider terms
                </a>
                . Free API use is noncommercial.
              </p>
            </div>
          </>
        )}
      </section>
      <section className="official-links">
        <div>
          <span className="eyebrow">CHECK THE OFFICIAL BULLETINS</span>
          <h3>Met Office Coast & Sea</h3>
          <p>
            UK inshore forecasts, shipping forecasts and gale warnings. These
            bulletins are not automatically fetched or checked by this app.
          </p>
        </div>
        <a
          className="button"
          href="https://weather.metoffice.gov.uk/specialist-forecasts/coast-and-sea/inshore-waters-forecast"
          target="_blank"
          rel="noreferrer"
        >
          Inshore & strong winds <ExternalLink size={14} />
        </a>
        <a
          className="button"
          href="https://weather.metoffice.gov.uk/specialist-forecasts/coast-and-sea/shipping-forecast"
          target="_blank"
          rel="noreferrer"
        >
          Shipping forecast <ExternalLink size={14} />
        </a>
      </section>
      <HarbourGuide />
    </section>
  );
}
