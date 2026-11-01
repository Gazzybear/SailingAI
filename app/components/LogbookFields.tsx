"use client";
import {
  fields,
  numericFields,
  type Reading,
  type ReadingField,
} from "@/lib/logbook";

const groups: { title: string; help: string; keys: ReadingField[] }[] = [
  {
    title: "Time, position & distance",
    help: "Hourly entries use HH:00. Event entries retain the actual time. Log is the instrument's cumulative distance through water, not GPS distance.",
    keys: [
      "entryKind",
      "timeText",
      "location",
      "latitude",
      "longitude",
      "logNm",
      "stw",
      "sog",
      "depthMetres",
      "depthReference",
    ],
  },
  {
    title: "Course & compass corrections",
    help: "Record compass course, E/W deviation and variation, and the direction of leeway drift separately. True course is the water track after corrections; COG is the GPS ground track. No courses are calculated automatically.",
    keys: [
      "compassCourse",
      "deviationDegrees",
      "deviationDirection",
      "variationDegrees",
      "variationDirection",
      "leewayDegrees",
      "leewaySide",
      "trueCourse",
      "cog",
      "heading",
      "reference",
    ],
  },
  {
    title: "True & apparent wind",
    help: "Keep instrument TWS and AWS separate. Record the true-wind direction reference (e.g. 090°T). AWA is measured from the bow, with the side the wind comes from. Unspecified wind readings stay unspecified.",
    keys: [
      "trueWindKnots",
      "trueWindDirection",
      "apparentWindKnots",
      "apparentWindAngle",
      "apparentWindSide",
      "beaufort",
      "windKnots",
      "windDirection",
    ],
  },
  {
    title: "Sea state & swell",
    help: "Record sea state and swell separately. Example: code 3 / Low NW. Swell direction is where the swell comes from. Leave unobserved measurements blank.",
    keys: [
      "seaStateCode",
      "seaState",
      "swellHeight",
      "swellDescription",
      "swellDirection",
    ],
  },
  {
    title: "Visibility & weather",
    help: "Your log convention: G >5 NM; M 2–5 NM; P <2 NM; F fog. F describes fog, not a measured distance. These shorthand categories differ from the Met Office's separate very-poor category. Weather letters may be combined: bc = blue sky with detached clouds; r = rain.",
    keys: [
      "visibilityCode",
      "visibilityNm",
      "visibility",
      "weatherNotation",
      "weather",
      "precipitation",
      "pressureHpa",
      "notes",
    ],
  },
];
const choices: Partial<Record<ReadingField, [string, string][]>> = {
  entryKind: [
    ["hourly", "Hourly observation — HH:00"],
    ["event", "Event — actual time"],
  ],
  deviationDirection: [
    ["E", "East"],
    ["W", "West"],
  ],
  variationDirection: [
    ["E", "East"],
    ["W", "West"],
  ],
  leewaySide: [
    ["Port", "Drift to port"],
    ["Starboard", "Drift to starboard"],
  ],
  apparentWindSide: [
    ["Port", "From port"],
    ["Starboard", "From starboard"],
  ],
  visibilityCode: [
    ["G", "G — Good"],
    ["M", "M — Moderate"],
    ["P", "P — Poor"],
    ["F", "F — Fog"],
  ],
  seaStateCode: [
    "Calm / glassy · 0 m",
    "Calm / rippled · 0–0.1 m",
    "Smooth · 0.1–0.5 m",
    "Slight · 0.5–1.25 m",
    "Moderate · 1.25–2.5 m",
    "Rough · 2.5–4 m",
    "Very rough · 4–6 m",
    "High · 6–9 m",
    "Very high · 9–14 m",
    "Phenomenal · >14 m",
  ].map((label, code) => [String(code), `${code} — ${label}`]),
};
export default function LogbookFields({
  values,
  onChange,
}: {
  values: Reading;
  onChange: (key: ReadingField, value: string) => void;
}) {
  return (
    <div className="logbook-field-groups">
      {groups.map((group) => (
        <fieldset key={group.title} className="logbook-fieldset">
          <legend>{group.title}</legend>
          <p>{group.help}</p>
          <div className="review-grid">
            {group.keys.map((key) => (
              <label
                key={key}
                className={`field ${key === "notes" ? "full" : ""}`}
              >
                {fields[key]}
                {choices[key] ? (
                  <select
                    value={values[key] ?? ""}
                    onChange={(e) => onChange(key, e.target.value)}
                  >
                    <option value="">Not recorded</option>
                    {choices[key]!.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={numericFields[key] ? "number" : "text"}
                    {...numericFields[key]}
                    value={values[key] ?? ""}
                    placeholder="Not recorded"
                    onChange={(e) => onChange(key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p className="privacy">
        Reference:{" "}
        <a
          href="https://www.nodc.noaa.gov/OC5/WOD/CODES/s_18_sea_state.html"
          target="_blank"
          rel="noreferrer"
        >
          WMO sea-state codes
        </a>{" "}
        ·{" "}
        <a
          href="https://weather.metoffice.gov.uk/guides/coast-and-sea/glossary"
          target="_blank"
          rel="noreferrer"
        >
          Met Office terminology
        </a>
        . Forecasts are not copied into observed entries.
      </p>
    </div>
  );
}
