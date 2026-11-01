import { fields } from "./logbook";
const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
export function paperLogbookTemplate() {
  const labels = [
    "Vessel / passage",
    "Date (YYYY-MM-DD)",
    "Time (HH:MM) / timezone",
    ...Object.values(fields),
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SailingAI printable observation sheet</title><style>
  @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#142b35;max-width:760px;margin:24px auto}h1{font-size:23px;margin:0 0 6px}p{line-height:1.5}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.cell{border:1px solid #9aaeb1;min-height:43px;padding:5px;font-size:9px;break-inside:avoid}.help{font-size:10px;border-top:1px solid #9aaeb1;margin-top:10px;padding-top:7px}.screen{background:#edf4f1;padding:12px}@media print{body{margin:0;max-width:none}.screen{display:none}}</style></head><body>
  <div class="screen"><button type="button" onclick="window.print()">Print / Save as PDF</button><p>Open this downloaded HTML file in a browser, then print to paper or Save as PDF. Photograph the completed sheet and choose Upload paper logbook photo in SailingAI.</p></div>
  <h1>SailingAI · Paper observation sheet</h1><p>One observation per sheet · Write clearly in dark ink · Leave unobserved readings blank</p>
  <div class="grid">${labels.map((label) => `<div class="cell">${escape(label)}</div>`).join("")}</div>
  <p class="help">Hourly observation: HH:00 (24-hour clock). Event: actual time. Log = instrument distance through water. Co Co = compass course; true course = water track after corrections; COG = GPS track. Record E/W for deviation and variation, and drift direction for leeway. TWS and AWS are separate readings. Indicate wind direction reference and depth sounder reference.</p>
  <p class="help">Sea state 0–9: 0 glassy; 1 rippled; 2 smooth; 3 slight; 4 moderate; 5 rough; 6 very rough; 7 high; 8 very high; 9 phenomenal. Record swell separately. Your visibility convention: G &gt;5 NM; M 2–5 NM; P &lt;2 NM; F fog. Weather: bc = blue sky with detached clouds; r = rain. Unspecified wind/heading fields preserve readings whose reference is unknown.</p>
  <p class="help">Source references: WMO code 3700 (NOAA code table); Met Office marine glossary. This is an observation sheet, not a navigation aid. Always review photo transcription before saving.</p></body></html>`;
}
