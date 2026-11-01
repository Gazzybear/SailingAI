# Chart display and AIS integrations — 1 November 2026

## Numerical chart depths

The NOAA public [GIS services catalogue](https://www.nauticalcharts.noaa.gov/data/gis-data-and-services.html) provides an ENC chart reference display. It covers US waters and explicitly states it must not be used for navigation. SailingAI uses its [Maritime Chart Service WMS](https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer/exts/MaritimeChartService/WMSServer), EPSG:3857, WMS 1.3.0, layers 0–7 and 12 (overscale warning). It is not a worldwide depth feed, bathymetric survey or clearance calculator. Selecting the layer transmits visible map bounds to NOAA.

The service defaults to feet. The request explicitly uses `display_params` with `ECDISParameters.version=10.9.1`, `DynamicParameters.Parameter=[{name:"DisplayDepthUnits",value:1}]` to request metres. This was verified against the live service: default and explicit feet produced identical images; metres produced a different image. Provider chart colours remain unfiltered. Numeric soundings were visually checked in the browser in San Francisco Bay. Chart display scale, datum, source dates and official chart limitations still matter; the application cannot determine where a vessel can safely sail.

For UK/global nautical chart coverage, [ADMIRALTY APIs](https://www.admiralty.co.uk/access-data/apis) and [Garmin Navionics Web API](https://developer.garmin.com/marine-charts/web/) require suitable provider access and licences. No provider key, subscription, certified navigation use or worldwide coverage is claimed here. No coarse global relief grid is presented as harbour soundings.

## Real regional AIS now

[Fintraffic Digitraffic marine API](https://www.digitraffic.fi/en/marine-traffic/) supplies Finnish-network vessel positions without an API key. Server endpoint `GET /api/ais?provider=finland&lat=60.15&lon=24.96&radius=10` requests nearby recent reports, validates each point, and returns a bounded snapshot. Radius is nautical miles in SailingAI and is converted to kilometres for the provider. `timestampExternal` is the report timestamp; the AIS second-of-minute field is not used as an epoch time.

UI updates every 30 seconds when enabled and reports older than 30 minutes are excluded. The latest received position can still be delayed; an absent marker does not mean no vessel is present. Source and UTC timestamps are displayed. Speeds use knots, courses degrees true. Missing speed/course/name stays unreported; unknown course uses a nondirectional dot. The server and client filter stale reports. Data for an old vessel position/provider is cleared immediately when the selection changes.

Attribution: **Fintraffic / digitraffic.fi; filtered and reformatted**, [CC BY 4.0 terms](https://www.digitraffic.fi/en/terms-of-service/). Actual Helsinki responses and map markers were tested, including recent reports seconds old. This is regional receiver coverage, not worldwide AIS or a replacement for lookout/radar/onboard AIS.

## Global AISstream

[AISstream documentation](https://aisstream.io/documentation) specifies server-side authenticated, compressed WebSocket access. The local app now keeps one connection open and accumulates the latest report per MMSI rather than taking six-second samples. The single Boats filter follows the map area. Display refresh is five seconds, report expiry 30 minutes, area limit 250 NM and memory limit 5,000 vessels; limits and report timestamps are visible. It closes idle connections and reconnects with exponential backoff. The private key was configured and real Solent reports/markers were verified on 1 November 2026. Keys are never committed or included in responses. See [implementation and deployment limits](PASSAGE-CONDITIONS.md).

The unauthenticated Fintraffic API remains available as a regional backend option, but Helsinki/provider choices have been removed from the map interface.

## UK and worldwide chart availability

[ADMIRALTY AVCS Online Discovery instructions](https://admiraltyapi.developer.azure-api.net/discovery-api-instructions) offer a free south-coast England WMS trial, requiring an account and subscription key. It permits 2,000 calls/day at 30 calls/30 seconds. Crucially, the trial ENC data is **not up to date and not routinely updated**. Full AVCS Online has more than 15,000 ENCs, updated weekly, through approved technical solution providers for shore-based planning. Trial charts cannot satisfy a current-chart requirement.

[Garmin Navionics Web API](https://developer.garmin.com/marine-charts/web/) offers worldwide cartography with daily updates. Its free Standard viewer requires a developer key, must be free for users, and prohibits additional features over the charts. The paid Enhanced plan permits vessel tracking, route and POI overlays. Consequently the free viewer does not meet this app's requested combined map workflow. Neither service is connected; access credentials and appropriate licence terms are the remaining dependency, not simply a missing map style.

The existing EMODnet UK layer is a coarse seabed model and must not be relabelled as an official nautical chart. OpenSeaMap community seamarks and crowdsourced depths also do not establish equivalent comprehensive, maintained official chart coverage. No free, unrestricted, current worldwide chart source meeting all these requirements was verified.

## Editable planning routes

Checkpoint coordinates are validated (map latitude±85°, longitude±180°), stored in an independent versioned browser record and capped at 50 points. GPX exports escape XML and identify the route as unverified. Great-circle distances use nautical miles; bearings are true. Zero-length/antipodal legs have no invented bearing. Date-line display segments wrap across the shortest longitude boundary without changing the exported checkpoints.

Lines are straight joins and are not checked against land, depths, charted dangers, traffic separation, closures or local regulations. No routing engine or safety/clearance approval is claimed.
