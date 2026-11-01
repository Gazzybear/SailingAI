import {
  fields,
  orderEntries,
  type Entry,
  type ReadingField,
} from "@/lib/logbook";
const columns: ReadingField[] = [
  "logNm",
  "compassCourse",
  "deviationDegrees",
  "deviationDirection",
  "variationDegrees",
  "variationDirection",
  "leewayDegrees",
  "leewaySide",
  "trueCourse",
  "cog",
  "stw",
  "sog",
  "trueWindKnots",
  "apparentWindKnots",
  "seaStateCode",
  "swellHeight",
  "swellDescription",
  "swellDirection",
  "visibilityCode",
  "visibilityNm",
  "weatherNotation",
];
export default function LogbookTable({ entries }: { entries: Entry[] }) {
  if (!entries.length) return null;
  return (
    <div
      className="logbook-table-scroll"
      role="region"
      aria-label="Traditional logbook table"
      tabIndex={0}
    >
      <table className="logbook-table">
        <caption>
          Traditional logbook · 24-hour Europe/London time · scroll across for
          all columns · — means not recorded
        </caption>
        <thead>
          <tr>
            <th scope="col">Date / time</th>
            <th scope="col">Entry type</th>
            {columns.map((key) => (
              <th scope="col" key={key}>
                {fields[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orderEntries(entries).map((entry) => (
            <tr key={entry.id}>
              <th scope="row">
                {entry.observedAt.replace("T", " ") || "Untimed"}
              </th>
              <td>{entry.values.entryKind ?? "Unspecified"}</td>
              {columns.map((key) => (
                <td key={key}>{entry.values[key] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
