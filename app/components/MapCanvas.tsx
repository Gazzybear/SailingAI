"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type * as Leaflet from "leaflet";
import type { MapPlace } from "@/lib/map-places";
import { splitRouteAtDateline, type RouteWaypoint } from "@/lib/route-planner";
import { aisDistanceNm, type AISArea, type AISShip } from "@/lib/ais";
import type { Position } from "@/lib/briefing";
import "leaflet/dist/leaflet.css";

export type MapTarget = Position & { zoom: number; revision: number };
export type DepthLayer = "off" | "uk" | "us";
type DepthReading = Position & {
  status: "loading" | "ready" | "empty" | "error";
  elevation?: number;
  retrievedAt?: string;
};
const emodnetWms = "https://ows.emodnet-bathymetry.eu/wms";
const emodnetLegend = `${emodnetWms}?service=WMS&version=1.1.1&request=GetLegendGraphic&format=image%2Fpng&layer=emodnet%3Amean&style=atlas_land`;
function depthLabel(elevation: number) {
  return elevation <= 0
    ? `≈ ${Math.abs(elevation).toFixed(1)} m below LAT`
    : `≈ ${elevation.toFixed(1)} m above LAT`;
}
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
  onTrafficAreaChange,
  waypoints,
  routeEditing,
  onAddWaypoint,
  onMoveWaypoint,
  depthLayer,
  ships,
}: {
  position: Position;
  target: MapTarget;
  places: (Omit<MapPlace, "kind"> & { kind: "marina" | "harbour" | "port" })[];
  selected: string;
  onSelect: (id: string) => void;
  night: boolean;
  onViewChange: (position: Position) => void;
  onTrafficAreaChange: (area: AISArea) => void;
  waypoints: RouteWaypoint[];
  routeEditing: boolean;
  onAddWaypoint: (position: Position) => void;
  onMoveWaypoint: (id: string, position: Position) => boolean;
  depthLayer: DepthLayer;
  ships: AISShip[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const aisMarkers = useRef(new Map<string, Leaflet.Marker>());
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const initial = useRef(target);
  const [chartStatus, setChartStatus] = useState("loading");
  const [depthReading, setDepthReading] = useState<DepthReading | null>(null);
  const depthRequest = useRef<AbortController | null>(null);
  const readDepth = useCallback(async (point: Position) => {
    depthRequest.current?.abort();
    const controller = new AbortController();
    depthRequest.current = controller;
    if (
      point.latitude < 15 ||
      point.latitude > 85 ||
      point.longitude < -36 ||
      point.longitude > 43
    ) {
      setDepthReading({ ...point, status: "empty" });
      return;
    }
    setDepthReading({ ...point, status: "loading" });
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const query = new URLSearchParams({
        service: "WMS",
        version: "1.1.1",
        request: "GetFeatureInfo",
        layers: "emodnet:mean",
        query_layers: "emodnet:mean",
        styles: "",
        srs: "EPSG:4326",
        bbox: `${point.longitude - 0.001},${point.latitude - 0.001},${point.longitude + 0.001},${point.latitude + 0.001}`,
        width: "101",
        height: "101",
        x: "50",
        y: "50",
        info_format: "application/json",
        feature_count: "1",
      });
      const response = await fetch(`${emodnetWms}?${query}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Depth service unavailable");
      const data: unknown = await response.json();
      if (
        !data ||
        typeof data !== "object" ||
        !("features" in data) ||
        !Array.isArray(data.features)
      )
        throw new Error("Invalid depth response");
      const elevation: unknown = data.features[0]?.properties?.Depth;
      if (depthRequest.current !== controller) return;
      const valid =
        typeof elevation === "number" &&
        Number.isFinite(elevation) &&
        elevation >= -12000 &&
        elevation <= 100;
      setDepthReading({
        ...point,
        status: valid ? "ready" : "empty",
        ...(valid ? { elevation } : {}),
        retrievedAt: new Date().toISOString(),
      });
    } catch {
      if (depthRequest.current === controller)
        setDepthReading({ ...point, status: "error" });
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    const markers = aisMarkers.current;
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
        const reportView = () => {
          const centre = instance.getCenter().wrap();
          onViewChange({ latitude: centre.lat, longitude: centre.lng });
          const bounds = instance.getBounds();
          const centrePoint = { latitude: centre.lat, longitude: centre.lng };
          const radius = Math.max(...[bounds.getNorthEast(), bounds.getNorthWest(), bounds.getSouthEast(), bounds.getSouthWest()].map(corner => aisDistanceNm(centrePoint, { latitude: corner.lat, longitude: corner.lng })));
          if (Number.isFinite(radius)) onTrafficAreaChange({ latitude: Number(centre.lat.toFixed(3)), longitude: Number(centre.lng.toFixed(3)), radius: Math.max(5, Math.min(250, Math.ceil(radius))) });
        };
        instance.on("moveend", reportView);
        reportView();
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
      markers.clear();
      map.current?.remove();
      map.current = null;
    };
  }, [onViewChange, onTrafficAreaChange]);
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
    if (!ready || !L || !instance || depthLayer === "off") return;
    let tileErrors = 0;
    let cancelled = false;
    const options: Leaflet.WMSOptions & { display_params?: string } =
      depthLayer === "uk"
        ? {
            layers: "emodnet:mean",
            styles: "atlas_land",
            format: "image/png",
            transparent: true,
            version: "1.1.1",
            maxZoom: 18,
            zIndex: 3,
            opacity: 0.65,
            attribution:
              '<a href="https://emodnet.ec.europa.eu/en/bathymetry" target="_blank" rel="noreferrer">EMODnet Bathymetry Consortium · DTM 2024</a> · not for navigation',
          }
        : {
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
          };
    const layer = L.tileLayer
      .wms(
        depthLayer === "uk"
          ? emodnetWms
          : "https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer/exts/MaritimeChartService/WMSServer",
        options,
      )
      .on("loading", () => {
        tileErrors = 0;
        if (!cancelled) setChartStatus("loading");
      })
      .on("tileerror", () => {
        tileErrors++;
        if (!cancelled) setChartStatus("error");
      })
      .on("load", () => {
        if (!cancelled) setChartStatus(tileErrors ? "error" : "ready");
      })
      .addTo(instance);
    return () => {
      cancelled = true;
      layer.remove();
    };
  }, [ready, depthLayer]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || depthLayer !== "uk") return;
    const click = (event: Leaflet.LeafletMouseEvent) => {
      if (routeEditing) return;
      const point = event.latlng.wrap();
      void readDepth({ latitude: point.lat, longitude: point.lng });
    };
    instance.on("click", click);
    return () => {
      instance.off("click", click);
      depthRequest.current?.abort();
      depthRequest.current = null;
      setDepthReading(null);
    };
  }, [ready, depthLayer, routeEditing, readDepth]);

  useEffect(() => {
    const instance = map.current,
      L = library.current;
    if (
      !ready ||
      !instance ||
      !L ||
      depthLayer !== "uk" ||
      depthReading?.status !== "ready" ||
      depthReading.elevation === undefined
    )
      return;
    const label = document.createElement("span");
    label.textContent = `${depthLabel(depthReading.elevation)} · cell mean`;
    const marker = L.circleMarker(
      [depthReading.latitude, depthReading.longitude],
      {
        radius: 6,
        color: "#574191",
        fillColor: "#fff",
        fillOpacity: 1,
        weight: 2,
        interactive: false,
      },
    )
      .bindTooltip(label, {
        permanent: true,
        direction: "top",
        offset: [0, -8],
        className: "uk-depth-tooltip",
      })
      .addTo(instance);
    return () => {
      marker.remove();
    };
  }, [ready, depthLayer, depthReading]);

  useEffect(() => {
    const L = library.current,
      instance = map.current;
    if (!ready || !L || !instance) return;
    const visible = new Set(ships.map(ship => ship.mmsi));
    for (const [mmsi, marker] of aisMarkers.current) if (!visible.has(mmsi)) { marker.remove(); aisMarkers.current.delete(mmsi); }
    ships.forEach((ship) => {
      const direction = Number.isFinite(ship.cog) ? ship.cog : 0;
      const options = {
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
        alt: `AIS ${ship.name || ship.mmsi}`,
        zIndexOffset: 700,
      };
      let marker = aisMarkers.current.get(ship.mmsi);
      if (!marker) {
        marker = L.marker([ship.latitude, ship.longitude], options).addTo(instance);
        aisMarkers.current.set(ship.mmsi, marker);
      } else {
        marker.setLatLng([ship.latitude, ship.longitude]);
        marker.setIcon(options.icon);
      }
      marker.getElement()?.setAttribute("aria-label", options.title);
      const panel = document.createElement("div");
      panel.textContent = `${ship.name || "Vessel"} · MMSI ${ship.mmsi}\nReported ${new Date(ship.timestamp).toLocaleString("en-GB", { timeZone: "UTC" })} UTC\nSpeed ${ship.sog === undefined ? "unavailable" : `${ship.sog.toFixed(1)} kn`} · Course ${ship.cog === undefined ? "unavailable" : `${ship.cog.toFixed(0)}°T`}\nAIS reports can be delayed or incomplete.`;
      panel.style.whiteSpace = "pre-line";
      panel.style.width = "230px";
      if (marker.getPopup()) marker.setPopupContent(panel); else marker.bindPopup(panel);
    });
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
      {depthLayer !== "off" && (
        <div className="chart-layer-status" role="status">
          {chartStatus === "loading"
            ? `Loading ${depthLayer === "uk" ? "UK seabed model" : "NOAA reference chart"}…`
            : chartStatus === "error"
              ? "Some chart tiles failed to load. Depth coverage is incomplete."
              : depthLayer === "uk"
                ? "EMODnet DTM 2024 · coarse seabed model · not for navigation"
                : "NOAA reference display · depth soundings in metres · US coverage only"}
        </div>
      )}
      {depthLayer === "uk" && (
        <div className="uk-depth-readout" aria-label="UK seabed depth lookup">
          <strong>UK seabed · cell mean</strong>
          <div role="status" aria-live="polite">
            {!depthReading
              ? "Click the sea to read a depth."
              : depthReading.status === "loading"
                ? "Reading EMODnet grid…"
                : depthReading.status === "error"
                  ? "Depth lookup unavailable. Try again."
                  : depthReading.status === "empty"
                    ? "No depth value at this point; land or outside coverage."
                    : depthLabel(depthReading.elevation!)}
          </div>
          {depthReading && (
            <small>
              {depthReading.latitude.toFixed(4)}°,{" "}
              {depthReading.longitude.toFixed(4)}°
              {depthReading.retrievedAt
                ? ` · read ${new Date(depthReading.retrievedAt).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })} UTC`
                : ""}
            </small>
          )}
          <small>
            Grid ≈115 m · metres relative to LAT. Not water depth now or
            under-keel clearance.
          </small>
          <div className="uk-depth-actions">
            <button
              type="button"
              disabled={!ready || depthReading?.status === "loading"}
              onClick={() => {
                const centre = map.current?.getCenter().wrap();
                if (centre)
                  void readDepth({
                    latitude: centre.lat,
                    longitude: centre.lng,
                  });
              }}
            >
              Read map centre
            </button>
            <a href={emodnetLegend} target="_blank" rel="noreferrer">
              Full key ↗
            </a>
          </div>
          <details className="uk-depth-colour-key">
            <summary>Depth colour key</summary>
            <small>
              Provider palette, shown translucently on the map. Negative values
              are below LAT; positive values are above LAT. Colours do not
              indicate safe water.
            </small>
            <Image
              src={emodnetLegend}
              alt="EMODnet atlas colour scale: white at zero, increasingly blue below LAT, green and brown above LAT. Values in metres."
              width={86}
              height={393}
              unoptimized
            />
          </details>
          {routeEditing && (
            <small>Finish checkpoint editing to read depths by clicking.</small>
          )}
        </div>
      )}
      {ships.length > 0 && (
        <div
          className={`ais-map-legend ${depthLayer !== "off" ? "below-chart" : ""}`}
        >
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
