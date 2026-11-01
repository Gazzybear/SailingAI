"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  BookOpen,
  Clock3,
  Copy,
  ExternalLink,
  Printer,
  Waves,
} from "lucide-react";
import {
  parseUTC,
  tidalHours,
  tidalRange,
  worksheetCSV,
  type TidalWorksheet,
} from "@/lib/tidal-planner";
import { NOAA_STATIONS, type TideResponse } from "@/lib/tides";
import "./almanac.css";

const references = [
  {
    title: "Reeds Nautical Almanac 2026",
    tag: "AUTHORIZED 2026 EDITION",
    description:
      "Open the publisher’s 2026 edition for the full purchased almanac. Check your edition and corrections; its copyrighted port and tide tables are not reproduced here.",
    url: "https://www.bloomsbury.com/uk/reeds-nautical-almanac-2026-9781399424950/",
  },
  {
    title: "ADMIRALTY Tide Tables",
    tag: "PUBLISHED ALMANAC",
    description:
      "Standard and secondary port predictions, corrections and exceptional tidal factors. Use the appropriate current volume and its instructions.",
    url: "https://www.admiralty.co.uk/publications/publications-and-reference-guides/admiralty-tide-tables",
  },
  {
    title: "ADMIRALTY Tidal Stream Atlases",
    tag: "HOURLY STREAM REFERENCE",
    description:
      "Use the atlas’s named reference-port high water when reading its hourly stream diagrams. Add source-backed directions and rates to your worksheet notes.",
    url: "https://www.admiralty.co.uk/publications/miscellaneous-tidal-publications/admiralty-tidal-stream-atlases",
  },
  {
    title: "ADMIRALTY EasyTide",
    tag: "7-DAY REFERENCE",
    description:
      "Look up short-range tide times and heights. EasyTide explicitly says it must not be used by vessels for navigation; check its GMT / GMT+1 setting.",
    url: "https://easytide.admiralty.co.uk/",
  },
];

export default function AlmanacGuide({
  position,
}: {
  position?: { latitude: number; longitude: number };
}) {
  const [plan, setPlan] = useState<TidalWorksheet | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [imported, setImported] = useState<TideResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [highIndex, setHighIndex] = useState("");
  const [lowIndex, setLowIndex] = useState("");
  const [prefill, setPrefill] = useState<Partial<TidalWorksheet>>({});
  const [formVersion, setFormVersion] = useState(0);
  const nearSolent =
    position &&
    position.latitude > 50.5 &&
    position.latitude < 51 &&
    position.longitude > -1.8 &&
    position.longitude < -0.7;
  const range = plan ? tidalRange(plan) : null;

  async function loadPredictions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setImporting(true);
    setImportError("");
    setImported(null);
    setHighIndex("");
    setLowIndex("");
    try {
      const query = new URLSearchParams({
        station: String(data.get("station")),
        date: String(data.get("date")),
      });
      const response = await fetch(`/api/tides?${query}`, {
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Tide predictions are unavailable.");
      setImported(result as TideResponse);
    } catch (caught) {
      setImportError(
        caught instanceof Error
          ? caught.message
          : "Could not load predictions. You can still use the manual form below.",
      );
    } finally {
      setImporting(false);
    }
  }
  function usePredictions() {
    if (!imported || highIndex === "") return;
    const high = imported.records[Number(highIndex)],
      low = lowIndex === "" ? null : imported.records[Number(lowIndex)];
    if (!high || high.type !== "H" || (low && low.type !== "L")) return;
    setPrefill({
      port: imported.name,
      highWaterUTC: high.time.slice(0, 16),
      highWaterHeight: high.height,
      lowWaterUTC: low?.time.slice(0, 16) || "",
      lowWaterHeight: low?.height ?? null,
      datum: "Metres above Mean Lower Low Water (MLLW)",
      sourceName: `NOAA CO-OPS station ${imported.station}; retrieved ${imported.retrievedAt}`,
      sourceURL: imported.sourceUrl,
    });
    setFormVersion((current) => current + 1);
    setMessage(
      "Selected NOAA predictions copied to the form. Review the port, events and datum, then prepare your worksheet. Any previous worksheet remains unchanged until then.",
    );
  }

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const height = (name: string) =>
      text(name) === "" ? null : Number(text(name));
    try {
      const highWaterUTC = text("highWaterUTC"),
        lowWaterUTC = text("lowWaterUTC");
      parseUTC(highWaterUTC);
      if (lowWaterUTC) parseUTC(lowWaterUTC);
      const highWaterHeight = height("highWaterHeight"),
        lowWaterHeight = height("lowWaterHeight");
      if (
        [highWaterHeight, lowWaterHeight].some(
          (value) => value !== null && !Number.isFinite(value),
        )
      )
        throw new Error(
          "Use numeric heights in metres, or leave the height blank.",
        );
      if (
        highWaterHeight !== null &&
        lowWaterHeight !== null &&
        highWaterHeight < lowWaterHeight
      )
        throw new Error(
          "High-water height is below low-water height. Check the events and height datum before creating the worksheet.",
        );
      const sourceURL = text("sourceURL");
      if (
        sourceURL &&
        !["https:", "http:"].includes(new URL(sourceURL).protocol)
      )
        throw new Error("Use an http or https source link.");
      if (!text("port") || !text("sourceName"))
        throw new Error("Enter the reference port and source / edition.");
      const next: TidalWorksheet = {
        port: text("port"),
        highWaterUTC,
        highWaterHeight,
        lowWaterUTC,
        lowWaterHeight,
        datum: text("datum"),
        sourceName: text("sourceName"),
        sourceURL,
        sameCycleAndDatum: data.get("sameCycleAndDatum") === "on",
      };
      setPlan(next);
      setNotes({});
      setMessage(
        "Worksheet prepared from your entered prediction. All hourly offsets are in UTC.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Check the entered prediction.",
      );
    }
  }

  function exportSheet() {
    if (!plan) return;
    const url = URL.createObjectURL(
      new Blob([worksheetCSV(plan, notes)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "sailingai-tidal-worksheet.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copySheet() {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(
        worksheetCSV(plan, notes).replace(/^\uFEFF/, ""),
      );
      setMessage("Worksheet copied as CSV text.");
    } catch {
      setError("Clipboard access was unavailable. Use Download CSV instead.");
    }
  }

  return (
    <section className="almanac-guide" aria-labelledby="almanac-heading">
      <header className="almanac-header">
        <div>
          <span className="almanac-eyebrow">
            <BookOpen size={15} /> THE SKIPPER’S REFERENCE DESK
          </span>
          <h2 id="almanac-heading">Almanac &amp; tides</h2>
          <p>
            Take a published high-water prediction and lay out the hours around
            it, ready for your passage notebook.
          </p>
        </div>
        <span className="almanac-status">MANUAL PREDICTIONS · UTC</span>
      </header>
      <div className="almanac-body">
        <div className="almanac-steps">
          <div>
            <span>01</span>
            <p>
              Check your port, edition, date, time basis and datum in the
              source.
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              Enter the published high and low water. Convert times to UTC
              first.
            </p>
          </div>
          <div>
            <span>03</span>
            <p>Add your tidal-stream notes against HW−6 through HW+6.</p>
          </div>
        </div>
        <section
          className="almanac-import"
          aria-labelledby="almanac-import-heading"
        >
          <div>
            <span className="almanac-eyebrow">
              OPTIONAL · REAL PREDICTIONS VIA API
            </span>
            <h3 id="almanac-import-heading">Try the NOAA tide connection</h3>
            <p>
              Import published high and low water for two US demo stations.
              These are US station predictions, not Solent tides. UK ports use
              the sourced manual workflow below until a suitable licensed tide
              API is connected.
            </p>
          </div>
          <form onSubmit={loadPredictions} className="almanac-import-form">
            <label>
              NOAA reference station
              <select name="station" disabled={importing}>
                {NOAA_STATIONS.map((station) => (
                  <option value={station.id} key={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              UTC date
              <input
                name="date"
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                required
                disabled={importing}
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <button className="button" disabled={importing}>
              {importing ? "Loading predictions…" : "Fetch NOAA tides"}
            </button>
          </form>
          {importError && (
            <p className="almanac-error" role="alert">
              {importError}
            </p>
          )}
          {imported && (
            <div className="almanac-import-results">
              <p>
                <strong>{imported.name}</strong> · {imported.date} UTC · Heights
                in metres above MLLW · Retrieved{" "}
                {new Date(imported.retrievedAt).toLocaleString("en-GB", {
                  timeZone: "UTC",
                })}{" "}
                UTC ·{" "}
                <a href={imported.sourceUrl} target="_blank" rel="noreferrer">
                  NOAA source
                </a>
              </p>
              <div className="almanac-import-form">
                <label>
                  Choose reference high water
                  <select
                    value={highIndex}
                    onChange={(event) => setHighIndex(event.target.value)}
                  >
                    <option value="">Select a high-water event</option>
                    {imported.records.map(
                      (record, index) =>
                        record.type === "H" && (
                          <option key={record.time} value={index}>
                            {record.time.slice(0, 10)} ·{" "}
                            {record.time.slice(11, 16)} UTC · {record.height} m
                          </option>
                        ),
                    )}
                  </select>
                </label>
                <label>
                  Choose low water (optional)
                  <select
                    value={lowIndex}
                    onChange={(event) => setLowIndex(event.target.value)}
                  >
                    <option value="">Leave low water unrecorded</option>
                    {imported.records.map(
                      (record, index) =>
                        record.type === "L" && (
                          <option key={record.time} value={index}>
                            {record.time.slice(0, 10)} ·{" "}
                            {record.time.slice(11, 16)} UTC · {record.height} m
                          </option>
                        ),
                    )}
                  </select>
                </label>
                <button
                  className="button primary"
                  disabled={highIndex === ""}
                  onClick={usePredictions}
                >
                  Use selected predictions
                </button>
              </div>
              <p>
                The source returns events in the selected UTC day. A
                neighbouring low water may fall on another date. Select the
                correct tidal cycle; no pair is chosen automatically.
              </p>
            </div>
          )}
        </section>
        <div className="almanac-layout">
          <form key={formVersion} className="almanac-inputs" onSubmit={prepare}>
            <h3>
              <Waves size={18} /> Enter a published prediction
            </h3>
            <p className="almanac-help">
              Use values from your chosen published source, or select NOAA
              events above. This worksheet stays on screen until you leave or
              reload; export a copy to retain it.
            </p>
            <label>
              Reference port / station
              <input
                name="port"
                required
                maxLength={150}
                defaultValue={prefill.port}
                placeholder={
                  nearSolent
                    ? "e.g. Portsmouth — confirm your reference port"
                    : "Port exactly as named in the source"
                }
              />
            </label>
            <div className="almanac-pair">
              <label>
                High water — date &amp; time UTC
                <input
                  name="highWaterUTC"
                  type="datetime-local"
                  required
                  defaultValue={prefill.highWaterUTC}
                />
              </label>
              <label>
                HW height (m)
                <input
                  name="highWaterHeight"
                  type="number"
                  step="0.001"
                  placeholder="Not entered"
                  defaultValue={prefill.highWaterHeight ?? ""}
                />
              </label>
            </div>
            <div className="almanac-pair">
              <label>
                Low water — date &amp; time UTC
                <input
                  name="lowWaterUTC"
                  type="datetime-local"
                  defaultValue={prefill.lowWaterUTC}
                />
              </label>
              <label>
                LW height (m)
                <input
                  name="lowWaterHeight"
                  type="number"
                  step="0.001"
                  placeholder="Not entered"
                  defaultValue={prefill.lowWaterHeight ?? ""}
                />
              </label>
            </div>
            <p className="almanac-time-note">
              <Clock3 size={15} /> All times entered here are UTC / GMT. If your
              source shows BST (UTC+1), subtract one hour and check the date.
              Browser timezone is not used.
            </p>
            <label>
              Height datum, exactly as published
              <input
                name="datum"
                maxLength={120}
                placeholder="e.g. metres above Chart Datum"
                defaultValue={prefill.datum}
              />
            </label>
            <label>
              Source / edition / page
              <input
                name="sourceName"
                required
                maxLength={250}
                placeholder="Publication or provider, year and reference"
                defaultValue={prefill.sourceName}
              />
            </label>
            <label>
              Source link (optional)
              <input
                name="sourceURL"
                type="url"
                maxLength={1000}
                placeholder="https://…"
                defaultValue={prefill.sourceURL}
              />
            </label>
            <label className="almanac-check">
              <input name="sameCycleAndDatum" type="checkbox" />
              <span>
                I checked that HW and LW belong to the same tidal cycle and use
                the same height datum.
              </span>
            </label>
            <button className="button primary" type="submit">
              <BookOpen size={16} /> Prepare hourly worksheet
            </button>
            {plan && (
              <p className="almanac-help">
                Preparing again replaces this worksheet and clears its hourly
                notes.
              </p>
            )}
          </form>
          <div className="almanac-output">
            {error && (
              <p className="almanac-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="almanac-message" role="status">
                {message}
              </p>
            )}
            {!plan ? (
              <div className="almanac-empty">
                <div>
                  <Clock3 size={30} />
                </div>
                <h3>
                  Your high-water reference,
                  <br />
                  written out hour by hour.
                </h3>
                <p>
                  Enter HW on the left to create a dated UTC schedule. Each row
                  has space for the tidal-stream direction, rate and notes you
                  read from your own source.
                </p>
                <span>HW−6 · HW−5 · … · HW · … · HW+6</span>
              </div>
            ) : (
              <>
                <div className="almanac-actions">
                  <button className="button" onClick={exportSheet}>
                    <ArrowDownToLine size={15} /> Download CSV
                  </button>
                  <button className="button" onClick={copySheet}>
                    <Copy size={15} /> Copy
                  </button>
                  <button className="button" onClick={() => window.print()}>
                    <Printer size={15} /> Print
                  </button>
                </div>
                <div className="almanac-sheet">
                  <div className="almanac-sheet-heading">
                    <div>
                      <span className="almanac-eyebrow">
                        ENTERED PREDICTIONS · UTC
                      </span>
                      <h3>{plan.port}</h3>
                      <p>
                        HW {plan.highWaterUTC.replace("T", " · ")} UTC
                        {plan.highWaterHeight !== null
                          ? ` · ${plan.highWaterHeight} m`
                          : " · height not entered"}
                      </p>
                      {plan.lowWaterUTC && (
                        <p>
                          LW {plan.lowWaterUTC.replace("T", " · ")} UTC
                          {plan.lowWaterHeight !== null
                            ? ` · ${plan.lowWaterHeight} m`
                            : " · height not entered"}
                        </p>
                      )}
                    </div>
                    <div className="almanac-range">
                      <span>ENTERED RANGE</span>
                      <strong>
                        {range === null ? "—" : `${range.toFixed(2)} m`}
                      </strong>
                    </div>
                  </div>
                  <p className="almanac-provenance">
                    Source: {plan.sourceName}
                    {plan.sourceURL && (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={plan.sourceURL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open source <ExternalLink size={10} />
                        </a>
                      </>
                    )}
                    <br />
                    Datum: {plan.datum || "Not entered"}.{" "}
                    {range === null
                      ? "Range requires complete heights, LW time and confirmation of the same cycle and datum."
                      : "Range is the difference between the two entered heights."}
                  </p>
                  <div className="almanac-table-wrap">
                    <table>
                      <caption>
                        Hourly offsets from the entered high water. Dates and
                        times are UTC.
                      </caption>
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Date · UTC</th>
                          <th>Time</th>
                          <th>Your tidal-stream / planning notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tidalHours(plan.highWaterUTC).map((hour) => (
                          <tr
                            key={hour.offset}
                            className={hour.offset === 0 ? "almanac-hw" : ""}
                          >
                            <th scope="row">{hour.label}</th>
                            <td>{hour.date}</td>
                            <td>{hour.time}</td>
                            <td>
                              <input
                                aria-label={`Notes for ${hour.label}`}
                                value={notes[hour.offset] ?? ""}
                                maxLength={500}
                                placeholder="From your atlas / almanac"
                                onChange={(event) =>
                                  setNotes((current) => ({
                                    ...current,
                                    [hour.offset]: event.target.value,
                                  }))
                                }
                              />
                              <span className="almanac-print-note">
                                {notes[hour.offset] || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="almanac-sheet-note">
                    These offsets are clock arithmetic, not predictions of
                    hourly height, stream direction or speed. High water does
                    not necessarily coincide with slack water. Use the reference
                    port specified by your tidal-stream atlas. This worksheet
                    does not calculate clearance or a safe departure time.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="almanac-references">
          <h3>Open the source before you plan</h3>
          <div>
            {references.map((reference) => (
              <a
                href={reference.url}
                key={reference.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>{reference.tag}</span>
                <h4>
                  {reference.title}
                  <ExternalLink size={14} />
                </h4>
                <p>{reference.description}</p>
              </a>
            ))}
          </div>
          <p>
            Links checked 1 November 2026. Published tables and almanacs remain
            with their owners; this app does not contain or reproduce a licensed
            almanac. Entered predictions are planning references, separate from
            vessel observations in the logbook.
          </p>
        </div>
      </div>
    </section>
  );
}
