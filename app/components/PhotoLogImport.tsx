"use client";
/* eslint-disable @next/next/no-img-element -- Preview local blob URLs without uploading them to an image optimiser. */
import { useEffect, useRef, useState } from "react";
import { MAX_PHOTO_BYTES, PhotoExtraction } from "@/lib/photo-logbook";
import { paperLogbookTemplate } from "@/lib/paper-template";
import type { Entry, Reading } from "@/lib/logbook";
type Row = { original: string; reading: Reading };
export default function PhotoLogImport({
  onReview,
  entries,
  disabled,
}: {
  onReview: (reading: Reading, original: string) => void;
  entries: Entry[];
  disabled: boolean;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState("");
  const [rows, setRows] = useState<Row[]>([]),
    [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // The preview is tied to this selected file and released when it changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function downloadTemplate() {
    const url = URL.createObjectURL(
      new Blob([paperLogbookTemplate()], { type: "text/html;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "sailingai-paper-logbook.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function readPhoto() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setRows([]);
    setWarnings([]);
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 70000);
    try {
      const response = await fetch("/api/extract-photo", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not read this photo.");
      const validated = PhotoExtraction.safeParse(data);
      if (!validated.success)
        throw new Error(
          "The extracted page has incomplete or invalid fields. Try again with a clearer photo, or enter the readings manually.",
        );
      const result = validated.data,
        importId = crypto.randomUUID();
      setWarnings(result.warnings);
      setRows(
        result.rows.map((row, index) => ({
          original: `Paper photo: ${file.name} · row ${index + 1} · import ${importId}\n${row.transcription}`,
          reading: {
            ...row.reading,
            warnings: [
              ...result.warnings,
              ...row.reading.warnings,
              "Transcribed from a photo. Verify every value, column, date and time against the original paper.",
            ],
          },
        })),
      );
      if (!result.rows.length)
        setError(
          "No readable observation rows were found. Try a sharper photo of the completed logbook.",
        );
    } catch (error) {
      if (!abort.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Photo reading failed.",
        );
      else setError("Photo reading cancelled or timed out. Nothing was saved.");
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }
  return (
    <details className="paper-upload">
      <summary>Paper logbook · download template or upload a photo</summary>
      <h3>From paper to your passage log</h3>
      <p>
        Download a blank sheet, print it and write your observations. You can
        also upload a photo of your existing paper logbook. Review each
        recognised row separately.
      </p>
      <button type="button" className="button" onClick={downloadTemplate}>
        Download printable logbook (HTML)
      </button>
      <a
        className="button"
        href="/paper-logbook"
        target="_blank"
        rel="noreferrer"
      >
        Preview / print sheet
      </a>
      <p>
        Open the download and use Print / Save as PDF. For photos, include
        column headings and use good light. Up to 12 rows per photo.
      </p>
      <label className="field">
        Upload paper logbook photo
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || disabled}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (!chosen) return;
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(
                chosen.type,
              ) ||
              chosen.size > MAX_PHOTO_BYTES
            ) {
              setError(
                "Choose JPEG, PNG or WebP, up to 6 MB. Convert HEIC or PDF first.",
              );
              event.target.value = "";
              return;
            }
            setFile(chosen);
            setRows([]);
            setWarnings([]);
            setError("");
          }}
        />
      </label>
      {file && preview && (
        <>
          <p>{file.name}</p>
          <img
            className="paper-preview"
            src={preview}
            alt="Selected paper logbook for transcription"
          />
        </>
      )}
      <p className="privacy">
        Read photo sends the selected image to OpenAI. The app saves only
        reviewed text, not the photo. Keep the original paper or image. Nothing
        is entered in your log automatically.
      </p>
      <button
        type="button"
        className="button primary"
        disabled={!file || busy || disabled}
        onClick={readPhoto}
      >
        {busy ? "Reading handwriting…" : "Read photo with AI"}
      </button>
      {busy && (
        <button
          type="button"
          className="button"
          onClick={() => controller.current?.abort()}
        >
          Cancel reading
        </button>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {warnings.map((warning, index) => (
        <p key={index}>{warning}</p>
      ))}
      {rows.length > 0 && (
        <div>
          <p>
            {rows.length} draft rows · confirm the observation date/time for
            each. These drafts remain here while you review this passage;
            leaving it or reloading discards unsaved drafts.
          </p>
          {rows.map((row, index) => {
            const saved = entries.some(
              (entry) => entry.original === row.original,
            );
            return (
              <div className="photo-row" key={row.original}>
                <span>
                  Row {index + 1} · {row.reading.timeText || "Time unclear"}
                </span>
                <button
                  className="button"
                  type="button"
                  disabled={disabled || saved}
                  onClick={() => onReview(row.reading, row.original)}
                >
                  {saved ? "Saved to log" : `Review row ${index + 1}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {disabled && (
        <p>
          Finish or cancel the current entry before reading or reviewing another
          row.
        </p>
      )}
    </details>
  );
}
