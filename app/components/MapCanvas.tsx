"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { MapPlace } from "@/lib/map-places";
import type { Position } from "@/lib/briefing";
import "leaflet/dist/leaflet.css";

export type MapTarget = Position & { zoom: number; revision: number };
const anchor =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 11H2v4a10 10 0 0 0 20 0v-4h-3M7 12h10"/></svg>';
const boat =
  '<svg viewBox="0 0 32 32" fill="none"><path d="M16 3 25 25l-9-5-9 5Z" fill="currentColor" stroke="white" stroke-width="1.4"/></svg>';
export default function MapCanvas({
  position,
  target,
  places,
  selected,
  onSelect,
  night,
}: {
  position: Position;
  target: MapTarget;
  places: MapPlace[];
  selected: string;
  onSelect: (id: string) => void;
  night: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const initial = useRef(target);
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        library.current = L;
        const instance = L.map(container.current, {
          zoomControl: false,
          scrollWheelZoom: false,
          minZoom: 2,
          maxZoom: 18,
          worldCopyJump: true,
        }).setView(
          [initial.current.latitude, initial.current.longitude],
          initial.current.zoom,
        );
        map.current = instance;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
        })
          .on("tileerror", () => {
            if (!cancelled) setFailed(true);
          })
          .on("tileload", () => {
            if (!cancelled) setFailed(false);
          })
          .addTo(instance);
        L.control.zoom({ position: "bottomright" }).addTo(instance);
        L.control
          .scale({ position: "bottomleft", imperial: false })
          .addTo(instance);
        observer = new ResizeObserver(() => instance.invalidateSize());
        observer.observe(container.current);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setView([target.latitude, target.longitude], target.zoom, {
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }, [ready, target]);
  useEffect(() => {
    const L = library.current;
    if (!ready || !map.current || !L) return;
    const group = L.layerGroup().addTo(map.current);
    const vessel = L.marker([position.latitude, position.longitude], {
      icon: L.divIcon({
        className: "vessel-pin",
        html: `<span>${boat}</span>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      }),
      title: "Your vessel — simulated position",
      alt: "Simulated vessel",
      zIndexOffset: 1000,
    })
      .addTo(group)
      .on("click", () => onSelect("vessel"));
    vessel.bindTooltip("YOUR VESSEL · DEMO", {
      direction: "bottom",
      offset: [0, 25],
      className: "vessel-tooltip",
      permanent: true,
    });
    places.forEach((place) => {
      const marker = L.marker([place.latitude, place.longitude], {
        icon: L.divIcon({
          className: `place-pin ${place.kind} ${selected === place.id ? "is-selected" : ""}`,
          html: `<span>${anchor}</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        title: place.name,
        alt: place.name,
        riseOnHover: true,
      })
        .addTo(group)
        .on("click", () => onSelect(place.id));
      const label = document.createElement("span");
      label.textContent = place.name;
      marker.bindTooltip(label, {
        direction: "top",
        offset: [0, -20],
        permanent: selected === place.id,
        className: "place-tooltip",
      });
    });
    return () => {
      group.remove();
    };
  }, [ready, position, places, selected, onSelect]);
  return (
    <>
      <div className={`map-canvas-shell ${night ? "night-map" : ""}`}>
        <div
          ref={container}
          className="explorer-canvas"
          role="region"
          aria-label="Interactive vessel and harbour map"
        />
      </div>
      {!ready && !failed && (
        <div className="map-loading">Opening your coastal view…</div>
      )}
      {failed && (
        <div className="map-load-error" role="status">
          Some map tiles could not load. Harbour details remain available.
        </div>
      )}
    </>
  );
}
