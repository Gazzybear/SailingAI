import { Anchor, ArrowUpRight, Radio } from "lucide-react";
import type { DiscoveryPlace } from "@/lib/discovery";
export default function DiscoveredPlaceDetails({
  place,
  distance,
}: {
  place: DiscoveryPlace;
  distance: number;
}) {
  return (
    <>
      <div className={`inspector-icon ${place.kind}`}>
        <Anchor size={22} />
      </div>
      <span className="inspector-kicker">
        {place.kind} · WORLDWIDE DISCOVERY
      </span>
      <h3>{place.name}</h3>
      <p className="inspector-distance">
        {distance.toFixed(1)} nm from vessel · straight line
      </p>
      <p>
        {place.kind === "port"
          ? "Generalized port reference from Natural Earth. Locations can be displaced by up to 20 miles; never use this pin for an approach or an entrance."
          : "Community-mapped location from OpenStreetMap. Confirm approach, access, facilities and visitor arrangements directly with the operator."}
      </p>
      {place.vhf && (
        <div className="inspector-radio">
          <Radio size={17} />
          <span>Listed VHF: {place.vhf}</span>
        </div>
      )}
      <div className="facility-tags">
        {place.facilities.map((facility) => (
          <span key={facility}>{facility}</span>
        ))}
      </div>
      {!place.facilities.length && (
        <p>No facilities supplied in this listing.</p>
      )}
      {place.phone && (
        <a
          className="inspector-phone"
          href={`tel:${place.phone.replace(/[^\d+]/g, "")}`}
        >
          {place.phone}
        </a>
      )}
      {place.website && (
        <a
          className="inspector-primary"
          href={place.website}
          target="_blank"
          rel="noreferrer"
        >
          Listed website
          <ArrowUpRight size={16} />
        </a>
      )}
      <a
        className="inspector-primary"
        href={place.sourceURL}
        target="_blank"
        rel="noreferrer"
      >
        View source record
        <ArrowUpRight size={16} />
      </a>
      <a
        className="inspector-primary"
        href="https://marinas.com/browse/marina"
        target="_blank"
        rel="noreferrer"
      >
        Marinas.com directory
        <ArrowUpRight size={16} />
      </a>
      <small>
        Overview position, not an entrance or approach waypoint. This listing is
        not an endorsement of navigational safety or a live berth-availability
        feed. Missing facilities may simply be unmapped.
      </small>
    </>
  );
}
