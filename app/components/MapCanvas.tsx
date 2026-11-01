"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { MapPlace } from "@/lib/map-places";
import { splitRouteAtDateline, type RouteWaypoint } from "@/lib/route-planner";
import type { AISShip } from "@/lib/ais";
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
  onViewChange,
  waypoints,
  routeEditing,
  onAddWaypoint,
  onMoveWaypoint,
  charts,
  ships,
}: {
  position: Position;
  target: MapTarget;
  places: (Omit<MapPlace, "kind"> & { kind: "marina" | "harbour" | "port" })[];
  selected: string;
  onSelect: (id: string) => void;
  night: boolean;
  onViewChange: (position: Position) => void;
  waypoints: RouteWaypoint[];
  routeEditing: boolean;
  onAddWaypoint: (position: Position) => void;
  onMoveWaypoint: (id: string, position: Position) => boolean;
  charts: boolean;
  ships: AISShip[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const initial = useRef(target);
  const [chartStatus, setChartStatus] = useState("loading");
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
        instance.on("moveend", () => {
          const centre = instance.getCenter().wrap();
          onViewChange({ latitude: centre.lat, longitude: centre.lng });
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          className: "overview-base-tiles",
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
  }, [onViewChange]);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setView([target.latitude, target.longitude], target.zoom, {
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }, [ready, target]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !routeEditing) return;
    const add = (event: Leaflet.LeafletMouseEvent) => {
      const point = event.latlng.wrap();
      onAddWaypoint({ latitude: point.lat, longitude: point.lng });
    };
    instance.on("click", add);
    const element = container.current;
    element?.classList.add("route-editing");
    return () => {
      instance.off("click", add);
      element?.classList.remove("route-editing");
    };
  }, [ready, routeEditing, onAddWaypoint]);

  useEffect(() => {
    const L = library.current,
      instance = map.current;
    if (!ready || !L || !instance) return;
    const group = L.layerGroup().addTo(instance);
    for (const segment of splitRouteAtDateline(waypoints))
      L.polyline(segment, {
        color: "#d9862c",
        weight: 3,
        dashArray: "8 7",
        opacity: 0.9,
        interactive: false,
      }).addTo(group);
    waypoints.forEach((point, index) => {
      const marker = L.marker([point.latitude, point.longitude], {
        draggable: routeEditing,
        autoPan: true,
        zIndexOffset: 1500,
        icon: L.divIcon({
          className: "route-waypoint",
          html: `<span>${index + 1}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        title: `Checkpoint ${index + 1}: ${point.name}`,
      }).addTo(group);
      const label = document.createElement("span");
      label.textContent = point.name;
      marker.bindTooltip(label, { direction: "top", offset: [0, -16] });
      marker.on("dragend", () => {
        const p = marker.getLatLng().wrap();
        if (!onMoveWaypoint(point.id, { latitude: p.lat, longitude: p.lng }))
          marker.setLatLng([point.latitude, point.longitude]);
      });
    });
    return () => {
      group.remove();
    };
  }, [ready, waypoints, routeEditing, onMoveWaypoint]);

  useEffect(() => {
    const L = library.current,
      instance = map.current;
    if (!ready || !L || !instance || !charts) return;
    let tileErrors = 0;
    const layer = L.tileLayer
      .wms(
        "https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer/exts/MaritimeChartService/WMSServer",
        {
          display_params: JSON.stringify({
            ECDISParameters: {
              version: "10.9.1",
              DynamicParameters: {
                Parameter: [{ name: "DisplayDepthUnits", value: 1 }],
              },
            },
          }),
          layers: "0,1,2,3,4,5,6,7,12",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          maxZoom: 18,
          zIndex: 3,
          attribution:
            '<a href="https://www.nauticalcharts.noaa.gov/data/gis-data-and-services.html" target="_blank" rel="noreferrer">NOAA chart display</a> · US only · not for navigation',
        } as Leaflet.WMSOptions & { display_params: string },
      )
      .on("loading", () => {
        tileErrors = 0;
        setChartStatus("loading");
      })
      .on("tileerror", () => {
        tileErrors++;
        setChartStatus("error");
      })
      .on("load", () => setChartStatus(tileErrors ? "error" : "ready"))
      .addTo(instance);
    return () => {
      layer.remove();
    };
  }, [ready, charts]);

  useEffect(() => {
    const L = library.current,
      instance = map.current;
    if (!ready || !L || !instance) return;
    const group = L.layerGroup().addTo(instance);
    ships.forEach((ship) => {
      const direction = Number.isFinite(ship.cog) ? ship.cog : 0;
      const marker = L.marker([ship.latitude, ship.longitude], {
        icon: L.divIcon({
          className: "ais-ship-pin",
          html:
            ship.cog === undefined
              ? '<span class="ais-unknown">●</span>'
              : `<span style="transform:rotate(${direction}deg)">${boat}</span>`,
          iconSize: [27, 27],
          iconAnchor: [13, 13],
        }),
        title: `AIS ${ship.name || ship.mmsi}`,
        zIndexOffset: 700,
      }).addTo(group);
      const panel = document.createElement("div");
      panel.textContent = `${ship.name || "Vessel"} · MMSI ${ship.mmsi}\nReported ${new Date(ship.timestamp).toLocaleString("en-GB", { timeZone: "UTC" })} UTC\nSpeed ${ship.sog === undefined ? "unavailable" : `${ship.sog.toFixed(1)} kn`} · Course ${ship.cog === undefined ? "unavailable" : `${ship.cog.toFixed(0)}°T`}\nAIS reports can be delayed or incomplete.`;
      panel.style.whiteSpace = "pre-line";
      marker.bindPopup(panel);
    });
    return () => {
      group.remove();
    };
  }, [ready, ships]);
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
      {charts && (
        <div className="chart-layer-status" role="status">
          {chartStatus === "loading"
            ? "Loading NOAA reference chart…"
            : chartStatus === "error"
              ? "Some chart tiles failed to load. Depth coverage is incomplete."
              : "NOAA reference display · depth soundings in metres · US coverage only"}
        </div>
      )}
      {ships.length > 0 && (
        <div className={`ais-map-legend ${charts ? "below-chart" : ""}`}>
          <span /> {ships.length} received AIS reports · select a ship for its
          timestamp
        </div>
      )}
      {failed && (
        <div className="map-load-error" role="status">
          Some map tiles could not load. Harbour details remain available.
        </div>
      )}
    </>
  );
}
