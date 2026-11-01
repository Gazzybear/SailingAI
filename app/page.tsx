"use client";
import Link from "next/link";
import SkipperBriefing from "./components/SkipperBriefing";
import { useEffect, useRef, useState } from "react";
import {
  Anchor,
  ArrowDownToLine,
  ArrowRight,
  Check,
  Compass,
  FileText,
  Flag,
  Plus,
  Sailboat,
  Sparkles,
  Trash2,
  Waves,
  Wind,
  X,
} from "lucide-react";
import {
  emptyReading,
  Entry,
  exportCSV,
  Extraction,
  fields,
  orderEntries,
  Passage,
  Reading,
  sampleNote,
  sampleReading,
  storageKey,
  StoreSchema,
  validLondonTime,
} from "@/lib/logbook";

type Draft = {
  original: string;
  values: Reading;
  aiDraft: Reading | null;
  source: Entry["source"];
  observedAt: string;
  editId?: string;
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const freshPassage = () => ({
  vessel: "",
  departure: "",
  destination: "",
  date: today(),
  time: "",
  skipper: "",
  draught: "",
  notes: "",
});
function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Home() {
  const [deskView, setDeskView] = useState<"briefing" | "logbook">("briefing");
  const [passages, setPassages] = useState<Passage[]>([]),
    [selected, setSelected] = useState(""),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false),
    [form, setForm] = useState(freshPassage),
    [note, setNote] = useState(""),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [storageBlocked, setStorageBlocked] = useState(false),
    [tab, setTab] = useState<"write" | "log">("write");
  const observationDate = useRef<HTMLInputElement>(null);
  const generation = useRef(0),
    saving = useRef(false),
    requestActive = useRef(false);
  const p = passages.find((p) => p.id === selected);
  // Browser storage is read once after hydration to avoid server/client markup mismatch.
  /* eslint-disable react-hooks/set-state-in-effect -- Hydrate once from browser-only storage after the server render. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const store = StoreSchema.parse(JSON.parse(raw));
        setPassages(store.passages);
        setSelected(store.passages[0]?.id || "");
      }
    } catch {
      setStorageBlocked(true);
      setError(
        "Saved browser data could not be read. Download a recovery copy before changing browser storage. Writes are disabled to protect your records.",
      );
    }
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  function persist(next: Passage[]) {
    if (storageBlocked) {
      setError("Storage is protected. Download a recovery copy first.");
      return false;
    }
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ version: 1, passages: next }),
      );
      setPassages(next);
      return true;
    } catch {
      setError(
        "Could not save to this browser. Your edits remain open. Export existing records and check browser storage settings.",
      );
      return false;
    }
  }
  function changePassage(id: string) {
    setDeskView("logbook");
    generation.current++;
    setSelected(id);
    setDraft(null);
    setNote("");
    setError("");
    setNotice("");
    setTab("write");
  }
  function samplePassage() {
    setForm({
      ...freshPassage(),
      vessel: "Sea Venture",
      departure: "Cowes, Isle of Wight",
      destination: "Gosport, Portsmouth Harbour",
      time: "10:00",
      notes: "Illustrative sample passage. Conditions are not live.",
    });
    setCreating(true);
  }
  function create(e: React.FormEvent) {
    e.preventDefault();
    const n: Passage = {
      ...form,
      id: crypto.randomUUID(),
      timezone: "Europe/London",
      entries: [],
    };
    if (persist([...passages, n])) {
      changePassage(n.id);
      setCreating(false);
      setNotice("Passage created. Ready for your first observation.");
    }
  }
  function begin(
    source: Entry["source"],
    values = emptyReading(),
    original = note,
  ) {
    setDraft({
      original,
      values: structuredClone(values),
      aiDraft: source === "manual" ? null : structuredClone(values),
      source,
      observedAt: "",
    });
    setNotice("");
  }
  async function extract() {
    if (!p || requestActive.current || !note.trim()) return;
    requestActive.current = true;
    setBusy(true);
    setError("");
    const token = ++generation.current;
    const original = note;
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observation: original }),
        signal: AbortSignal.timeout(35000),
      });
      const data = await response.json();
      if (token !== generation.current) return;
      if (!response.ok)
        throw new Error(data.error || "Could not prepare entry.");
      begin("openai", Extraction.parse(data.reading), original);
    } catch (e) {
      if (token === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : "Request failed. Add your note manually.",
        );
    } finally {
      requestActive.current = false;
      setBusy(false);
    }
  }
  function save() {
    if (!p || !draft || saving.current) return;
    saving.current = true;
    try {
      const observedAt = observationDate.current?.value ?? draft.observedAt;
      if (observedAt && !validLondonTime(observedAt)) {
        setError(
          "Choose an unambiguous, valid Europe/London date and time. Daylight-saving gaps or repeated times need correction.",
        );
        return;
      }
      const validated = Extraction.safeParse(draft.values);
      if (!validated.success) {
        setError(
          "Check numeric readings: Beaufort 0–12, headings 0–360 and speeds 0–300 knots.",
        );
        return;
      }
      const timestamp = new Date().toISOString();
      const existing = p.entries.find((e) => e.id === draft.editId);
      const entry: Entry = {
        id: existing?.id || crypto.randomUUID(),
        original: draft.original,
        values: validated.data,
        aiDraft: draft.aiDraft,
        source: draft.source,
        observedAt,
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
      };
      const entries = existing
        ? p.entries.map((e) => (e.id === existing.id ? entry : e))
        : [...p.entries, entry];
      if (
        persist(
          passages.map((item) => (item.id === p.id ? { ...p, entries } : item)),
        )
      ) {
        setDraft(null);
        setNote("");
        setTab("log");
        setError("");
        setNotice("Reviewed entry saved to this browser.");
      }
    } finally {
      saving.current = false;
    }
  }
  function remove(id: string) {
    if (
      !p ||
      !confirm(
        "Delete this saved entry? Export a copy first if you need to keep it.",
      )
    )
      return;
    if (
      persist(
        passages.map((item) =>
          item.id === p.id
            ? { ...p, entries: p.entries.filter((e) => e.id !== id) }
            : item,
        ),
      )
    )
      setNotice("Entry deleted.");
  }
  function edit(entry: Entry) {
    setDraft({
      original: entry.original,
      values: structuredClone(entry.values),
      aiDraft: entry.aiDraft,
      source: entry.source,
      observedAt: entry.observedAt,
      editId: entry.id,
    });
    setTab("write");
    setError("");
  }
  function updateField(key: keyof typeof fields, value: string) {
    if (!draft) return;
    const numeric = [
      "windKnots",
      "beaufort",
      "heading",
      "cog",
      "stw",
      "sog",
    ].includes(key);
    setDraft({
      ...draft,
      values: {
        ...draft.values,
        [key]: value === "" ? null : numeric ? Number(value) : value,
      },
    });
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Sailboat size={25} />
          </span>
          Sailing<span>AI</span>
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <button
          className="side-link active"
          onClick={() => {
            setDeskView("logbook");
            setTab("write");
          }}
        >
          <Compass size={18} />
          Passage desk
          <span className="small-dot" />
        </button>
        <button
          className="side-link"
          onClick={() => {
            if (p) {
              setDeskView("logbook");
              setTab("log");
            } else setNotice("Create a passage to open its logbook.");
          }}
        >
          <FileText size={18} />
          Logbook
          <span className="count">
            {passages.reduce((n, p) => n + p.entries.length, 0)}
          </span>
        </button>
        <div className="side-heading">
          PASSAGES
          <button
            aria-label="Create passage"
            onClick={() => {
              setForm(freshPassage());
              setCreating(true);
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <nav className="passage-list">
          {passages.map((item) => (
            <button
              key={item.id}
              onClick={() => changePassage(item.id)}
              className={selected === item.id ? "selected" : ""}
            >
              <Sailboat size={15} />
              <span>
                {item.departure.split(",")[0]} →{" "}
                {item.destination.split(",")[0]}
                <small>{item.vessel}</small>
              </span>
            </button>
          ))}
          {!passages.length && (
            <p>
              Your next adventure
              <br />
              starts here.
            </p>
          )}
        </nav>
        <div className="side-bottom">
          <span className="local-icon">
            <Check size={15} />
          </span>
          <div>
            Stored on this device<small>Export regularly to keep a copy</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="breadcrumb">WORKSPACE</span>
            <span className="slash">/</span>Passage desk
          </div>
          <span className="status">
            <span />
            Skipper-reviewed logging
          </span>
        </header>
        <div className="content">
          <div className="page-title">
            <div>
              <div className="eyebrow">A CLEARER RECORD OF EVERY PASSAGE</div>
              <h1>
                Your time on the water,
                <br />
                <em>well recorded.</em>
              </h1>
              <p>Make a note. Capture the details. Keep the story.</p>
            </div>
            <button
              className="button primary"
              disabled={!ready || storageBlocked}
              onClick={() => {
                setForm(freshPassage());
                setCreating(true);
              }}
            >
              <Plus size={17} />
              New passage
            </button>
          </div>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="alert" role="status">
              {notice}
            </div>
          )}
          {storageBlocked && (
            <button
              className="button"
              onClick={() => {
                try {
                  download(
                    "sailingai-recovery.json",
                    localStorage.getItem(storageKey) || "",
                    "application/json",
                  );
                } catch {
                  setError(
                    "Browser storage is inaccessible. Check browser permissions.",
                  );
                }
              }}
            >
              Download recovery copy
            </button>
          )}
          <div className="workspace-switch">
            <button
              className={
                "button " + (deskView === "briefing" ? "selected" : "")
              }
              onClick={() => setDeskView("briefing")}
            >
              Skipper briefing
            </button>
            <button
              className={"button " + (deskView === "logbook" ? "selected" : "")}
              onClick={() => setDeskView("logbook")}
            >
              Passages & logbook
            </button>
          </div>
          {deskView === "briefing" ? (
            <SkipperBriefing vessel={p?.vessel} passageDate={p?.date} />
          ) : (
            <>
              {!p ? (
                <>
                  <section className="welcome">
                    <div className="welcome-copy">
                      <span className="pill">
                        <Waves size={14} />
                        THE LOGBOOK, REIMAGINED
                      </span>
                      <h2>
                        Less paperwork.
                        <br />
                        More horizon.
                      </h2>
                      <p>
                        Turn your everyday sailing notes into a structured
                        logbook. You bring the observations. SailingAI helps put
                        them in order.
                      </p>
                      <button
                        className="button primary"
                        onClick={() => {
                          setForm(freshPassage());
                          setCreating(true);
                        }}
                      >
                        Start your first passage
                        <ArrowRight size={17} />
                      </button>
                      <button className="text-button" onClick={samplePassage}>
                        Or explore a sample passage <ArrowRight size={14} />
                      </button>
                    </div>
                    <div
                      className="sea-art"
                      aria-label="Illustration of a sailing yacht on calm water"
                      role="img"
                    >
                      <div className="sun" />
                      <div className="island" />
                      <Sailboat className="hero-boat" strokeWidth={0.7} />
                      <div className="sea-line line-one" />
                      <div className="sea-line line-two" />
                      <div className="coordinates">
                        SOLENT, UNITED KINGDOM
                        <br />
                        <span>A new page for every passage.</span>
                      </div>
                    </div>
                  </section>
                  <div className="feature-grid">
                    {[
                      [
                        Compass,
                        "01",
                        "Start a passage",
                        "Give your journey a home.",
                      ],
                      [
                        Sparkles,
                        "02",
                        "Capture the moment",
                        "Plain English becomes clear details.",
                      ],
                      [
                        FileText,
                        "03",
                        "Keep your record",
                        "Review, save and take it with you.",
                      ],
                    ].map(([Icon, n, title, copy]) => (
                      <div className="feature" key={String(n)}>
                        <div className="feature-top">
                          {typeof Icon !== "string" && <Icon size={22} />}
                          <span>{String(n)}</span>
                        </div>
                        <h3>{String(title)}</h3>
                        <p>{String(copy)}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <section className="passage-banner">
                    <div>
                      <div className="eyebrow light">
                        CURRENT PASSAGE · {p.vessel}
                      </div>
                      <h2>
                        {p.departure.split(",")[0]} <ArrowRight size={24} />{" "}
                        {p.destination.split(",")[0]}
                      </h2>
                      <p>
                        {p.date} {p.time && `· Planned departure ${p.time}`} ·
                        Europe/London
                      </p>
                    </div>
                    <div className="passage-badge">
                      <Sailboat size={27} />
                      <span>
                        {p.entries.length}{" "}
                        {p.entries.length === 1 ? "entry" : "entries"} recorded
                      </span>
                    </div>
                  </section>
                  <div className="desk-grid">
                    <section className="desk-main">
                      <div className="tabs">
                        <button
                          className={tab === "write" ? "chosen" : ""}
                          onClick={() => {
                            setDeskView("logbook");
                            setTab("write");
                          }}
                        >
                          <Sparkles size={16} />
                          New observation
                        </button>
                        <button
                          className={tab === "log" ? "chosen" : ""}
                          onClick={() => setTab("log")}
                        >
                          <FileText size={16} />
                          Passage log <span>{p.entries.length}</span>
                        </button>
                      </div>
                      {tab === "write" ? (
                        draft ? (
                          <section className="editor">
                            <div className="section-heading">
                              <div>
                                <span className="eyebrow">
                                  {draft.source === "sample"
                                    ? "SAMPLE DATA · NO LIVE AI REQUEST"
                                    : draft.source === "openai"
                                      ? "AI-PREPARED · REQUIRES SKIPPER REVIEW"
                                      : "MANUAL ENTRY"}
                                </span>
                                <h2>Make it your record.</h2>
                              </div>
                              <button
                                className="icon-button"
                                aria-label="Cancel review"
                                onClick={() => setDraft(null)}
                              >
                                <X size={18} />
                              </button>
                            </div>
                            <details open>
                              <summary>Original observation</summary>
                              <p className="original">
                                {draft.original ||
                                  "No original note — manual entry."}
                              </p>
                            </details>
                            {draft.values.warnings.length > 0 && (
                              <div className="review-warning">
                                {draft.values.warnings.map((w, i) => (
                                  <p key={i}>{w}</p>
                                ))}
                              </div>
                            )}
                            <label className="field full">
                              Confirmed observation date and time
                              <input
                                ref={observationDate}
                                type="datetime-local"
                                value={draft.observedAt}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    observedAt: e.target.value,
                                  })
                                }
                              />
                              <small>
                                Europe/London. Optional; confirm the date for
                                overnight passages. Untimed entries remain
                                untimed.
                              </small>
                            </label>
                            <div className="review-grid">
                              {Object.entries(fields).map(([key, label]) => (
                                <label
                                  className={
                                    "field " + (key === "notes" ? "full" : "")
                                  }
                                  key={key}
                                >
                                  {label}
                                  <input
                                    type={
                                      [
                                        "windKnots",
                                        "beaufort",
                                        "heading",
                                        "cog",
                                        "stw",
                                        "sog",
                                      ].includes(key)
                                        ? "number"
                                        : "text"
                                    }
                                    step="any"
                                    value={
                                      draft.values[
                                        key as keyof typeof fields
                                      ] ?? ""
                                    }
                                    placeholder="Not recorded"
                                    onChange={(e) =>
                                      updateField(
                                        key as keyof typeof fields,
                                        e.target.value,
                                      )
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                            {draft.aiDraft && (
                              <details>
                                <summary>View original prepared values</summary>
                                <pre>
                                  {JSON.stringify(draft.aiDraft, null, 2)}
                                </pre>
                              </details>
                            )}
                            <div className="editor-actions">
                              <button className="button primary" onClick={save}>
                                <Check size={17} />
                                Save reviewed entry
                              </button>
                              <button
                                className="button"
                                onClick={() => setDraft(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </section>
                        ) : (
                          <section className="composer">
                            <div className="section-heading">
                              <div>
                                <span className="eyebrow">
                                  IN YOUR OWN WORDS
                                </span>
                                <h2>What’s happening on board?</h2>
                              </div>
                              <Wind className="muted" size={25} />
                            </div>
                            <p>
                              Wind, weather, a change of course, or simply how
                              the crew are doing.
                            </p>
                            <label className="sr-only" htmlFor="observation">
                              Sailing observation
                            </label>
                            <textarea
                              id="observation"
                              maxLength={4000}
                              value={note}
                              onChange={(e) => {
                                generation.current++;
                                setNote(e.target.value);
                              }}
                              placeholder={
                                "“Departed Cowes at 10:15. Wind easterly force 4, sea slight, good visibility. All crew well.”"
                              }
                            />
                            <div className="note-meta">
                              <span>
                                You observe. You review. You’re in control.
                              </span>
                              <span>{note.length}/4000</span>
                            </div>
                            <div className="composer-actions">
                              <button
                                className="button primary"
                                disabled={busy || !note.trim()}
                                onClick={extract}
                              >
                                <Sparkles size={16} />
                                {busy
                                  ? "Preparing your entry…"
                                  : "Prepare log entry"}
                              </button>
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => begin("manual")}
                              >
                                Add entry manually
                                <ArrowRight size={15} />
                              </button>
                            </div>
                            <p className="privacy">
                              AI preparation sends this note to OpenAI. Nothing
                              is saved until you review and approve.
                            </p>
                            <div className="sample-box">
                              <div>
                                <span className="eyebrow">
                                  TAKE IT FOR A TEST SAIL
                                </span>
                                <p>Try a fixed example. No API key needed.</p>
                              </div>
                              <button
                                className="button"
                                disabled={busy}
                                onClick={() => {
                                  setNote(sampleNote);
                                  begin("sample", sampleReading, sampleNote);
                                }}
                              >
                                Review sample
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </section>
                        )
                      ) : (
                        <section className="log">
                          <div className="section-heading">
                            <div>
                              <span className="eyebrow">THE STORY SO FAR</span>
                              <h2>Passage log</h2>
                            </div>
                            <button
                              className="button"
                              disabled={!p.entries.length}
                              onClick={() =>
                                download(
                                  "sailingai-log.csv",
                                  exportCSV(p),
                                  "text/csv;charset=utf-8",
                                )
                              }
                            >
                              <ArrowDownToLine size={16} />
                              Export CSV
                            </button>
                          </div>
                          {!p.entries.length ? (
                            <div className="empty-log">
                              <FileText size={32} />
                              <h3>A fresh page awaits.</h3>
                              <p>
                                Your reviewed observations will appear here.
                              </p>
                              <button
                                className="text-button"
                                onClick={() => {
                                  setDeskView("logbook");
                                  setTab("write");
                                }}
                              >
                                Add your first observation
                                <ArrowRight size={15} />
                              </button>
                            </div>
                          ) : (
                            orderEntries(p.entries).map((entry) => (
                              <article className="log-entry" key={entry.id}>
                                <div className="entry-top">
                                  <span className="entry-time">
                                    {entry.observedAt
                                      ? entry.observedAt.replace("T", " · ")
                                      : "Observation time not recorded"}
                                  </span>
                                  <span className="source">
                                    {entry.source === "sample"
                                      ? "Sample · no live AI"
                                      : entry.source === "openai"
                                        ? "AI prepared · reviewed"
                                        : "Manual entry"}
                                  </span>
                                </div>
                                <h3>{entry.values.location || "On passage"}</h3>
                                <div className="readings">
                                  {entry.values.windDirection && (
                                    <span>
                                      <Wind size={14} />
                                      {entry.values.windDirection}
                                      {entry.values.beaufort !== null
                                        ? ` · F${entry.values.beaufort}`
                                        : ""}
                                    </span>
                                  )}
                                  {entry.values.seaState && (
                                    <span>
                                      <Waves size={14} />
                                      {entry.values.seaState}
                                    </span>
                                  )}
                                  {entry.values.visibility && (
                                    <span>
                                      Visibility: {entry.values.visibility}
                                    </span>
                                  )}
                                </div>
                                <p>{entry.values.notes}</p>
                                <details>
                                  <summary>
                                    All saved details and original note
                                  </summary>
                                  <dl>
                                    {Object.entries(fields).map(
                                      ([key, label]) => (
                                        <div key={key}>
                                          <dt>{label}</dt>
                                          <dd>
                                            {entry.values[
                                              key as keyof typeof fields
                                            ] ?? "Not recorded"}
                                          </dd>
                                        </div>
                                      ),
                                    )}
                                  </dl>
                                  <p className="original">{entry.original}</p>
                                  {entry.values.warnings.map((w, i) => (
                                    <p key={i}>{w}</p>
                                  ))}
                                  <small>
                                    Recorded {entry.createdAt} · Last edited{" "}
                                    {entry.updatedAt}
                                  </small>
                                </details>
                                <div className="entry-actions">
                                  <button
                                    className="text-button"
                                    onClick={() => edit(entry)}
                                  >
                                    Edit entry
                                  </button>
                                  <button
                                    className="icon-button"
                                    aria-label="Delete entry"
                                    onClick={() => remove(entry.id)}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </article>
                            ))
                          )}
                        </section>
                      )}
                    </section>
                    <aside className="desk-aside">
                      <span className="mini-icon">
                        <Anchor size={21} />
                      </span>
                      <h3>
                        A good log starts
                        <br />
                        with your observations.
                      </h3>
                      <p>Record what you know. Leave the rest open.</p>
                      <div className="tip">
                        <span>01</span>
                        <p>
                          Include the time, location and conditions when you
                          have them.
                        </p>
                      </div>
                      <div className="tip">
                        <span>02</span>
                        <p>
                          Check every prepared field. Missing details stay
                          unrecorded.
                        </p>
                      </div>
                      <div className="tip">
                        <span>03</span>
                        <p>
                          Save your reviewed entry, then export a copy for
                          safekeeping.
                        </p>
                      </div>
                      <div className="aside-footer">
                        <Flag size={16} />
                        YOUR PASSAGE, YOUR RECORD
                      </div>
                    </aside>
                  </div>
                </>
              )}
            </>
          )}
          <footer>
            <Compass size={17} />
            <p>
              SailingAI records your observations. It is not a navigation
              system. The skipper remains responsible for safe navigation and
              checking official charts, forecasts, Notices to Mariners and
              harbour instructions.
            </p>
            <span>BUILT WITH CODEX</span>
          </footer>
          <p className="storage-note">
            Records stay in this browser on this site. No cloud sync or backup.
            Clearing browser data can remove them. Export regularly.
          </p>
        </div>
      </main>
      {creating && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-passage-title"
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">EVERY PASSAGE HAS A STORY</span>
                <h2 id="new-passage-title">Start a new passage</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setCreating(false)}
                aria-label="Close passage form"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={create}>
              <div className="review-grid">
                {Object.entries({
                  vessel: "Vessel name",
                  departure: "Departure port",
                  destination: "Destination port",
                  date: "Passage date",
                  time: "Planned departure time",
                  skipper: "Skipper (optional)",
                  draught: "Draught in metres (optional)",
                  notes: "Passage notes (optional)",
                }).map(([key, label]) => (
                  <label
                    className={
                      "field " +
                      (key === "vessel" || key === "notes" ? "full" : "")
                    }
                    key={key}
                  >
                    {label}
                    <input
                      autoFocus={key === "vessel"}
                      required={[
                        "vessel",
                        "departure",
                        "destination",
                        "date",
                      ].includes(key)}
                      type={
                        key === "date"
                          ? "date"
                          : key === "time"
                            ? "time"
                            : key === "draught"
                              ? "number"
                              : "text"
                      }
                      min={key === "draught" ? "0" : undefined}
                      step={key === "draught" ? "0.1" : undefined}
                      maxLength={500}
                      value={form[key as keyof typeof form]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <p className="privacy">
                Passage timezone: Europe/London. Departure details are planned,
                not observed.
              </p>
              <div className="editor-actions">
                <button className="button primary" disabled={storageBlocked}>
                  Create passage
                  <ArrowRight size={16} />
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={samplePassage}
                >
                  Use sample journey
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
