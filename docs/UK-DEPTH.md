# UK seabed layer

The existing vessel map has one **Depth layer** selector: Off, UK seabed (EMODnet), or US chart (NOAA). Switching layers does not move the map, vessel, route or checkpoints. The separate **View Solent seabed** shortcut changes the map view and enables the UK layer; it does not move the simulated vessel. The existing San Francisco demo remains available.

When the UK layer is active, clicking the sea queries a numeric mean depth for that grid cell. A numeric label appears at the selected point and the map card shows coordinates and retrieval time. **Read map centre** provides a keyboard-accessible alternative. Map clicks continue to add checkpoints while route editing is active; finish route editing before clicking for depths. The centre-read button remains available.

## Data and interpretation

- Provider: EMODnet Bathymetry Consortium, EMODnet Digital Bathymetry DTM 2024.
- [Official product description](https://emodnet.ec.europa.eu/en/bathymetry), [dataset DOI](https://doi.org/10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1), [web-service documentation](https://emodnet.ec.europa.eu/en/emodnet-web-service-documentation).
- WMS: `https://ows.emodnet-bathymetry.eu/wms`.
- Display layer: `emodnet:mean`, explicitly using its advertised `atlas_land` style, WMS 1.1.1, PNG, Web Mercator (EPSG:3857). This official atlas palette uses white/pale blue for shallow water, darker blue for deeper water and green/brown for elevations above LAT. The overlay is shown at 0.65 opacity so underlying OpenStreetMap features remain visible. Although the capabilities describe this layer as excluding land, a live Solent image also included opaque positive-elevation land cells; transparency alone does not mask these. This is a translucent regional bathymetry/topography overlay, not a land-masked nautical chart.
- The map includes a collapsed inline provider colour key, with a link to the full `GetLegendGraphic` image. Negative values are below LAT; positive values are above LAT. The key shows the unblended provider palette, while the map blends it with the base map. Colours never indicate safe water or available clearance.
- Numeric query: `emodnet:mean`, `GetFeatureInfo`, WMS 1.1.1, EPSG:4326, `application/json`. A 101×101 pixel query centred on the selected coordinate avoids dependence on display zoom. The returned `features[0].properties.Depth` is signed seabed elevation: negative values are displayed as metres below LAT, positive values as metres above LAT. Values are rounded to one decimal with an approximation sign; the original value is not converted to present water depth.
- Grid spacing is 1/16 arc minute, approximately 115 m north–south; east–west spacing varies with latitude. The service capabilities describe this approximately as 125 m. The displayed value is a cell mean, not a surveyed sounding at the exact clicked point. Product metadata link the current layer to DTM 2024.
- Vertical reference: Lowest Astronomical Tide (LAT). This is not present water depth or under-keel clearance. No tide, vessel draught, safe-routing or clearance calculation is applied.
- The source states that the grid must not be used for navigation or safety at sea: [EMODnet 2024 metadata](https://erddap.emodnet.eu/erddap/griddap/bathymetry_dtm_2024.graph). Coarse cells can conceal rocks, shoals and narrow channels. Source survey dates and accuracy vary. Some cells use interpolation or other bathymetry sources. Certified current nautical charts remain necessary for navigation.

The layer is useful around UK waters and also covers much of Europe. It is not a worldwide chart service. Missing, nonnumeric, implausible or null values produce an unavailable indication, not zero depth. Requests have a 12-second timeout and previous point requests are cancelled. Switching off removes the overlay and point label. The browser sends chosen coordinates directly to EMODnet; its service currently permits CORS without authentication.

## Endpoint checks (1 November 2026)

- Live GetCapabilities: layer names, query support, styles, current dataset identifier and JSON response format verified.
- Solent tile GetMap: HTTP 200, `image/png`, 77,131 bytes for the tested viewport.
- The initial multicolour palette above was subsequently replaced by the verified `emodnet:mean` / `atlas_land` display. Its Solent PNG and 86×393 pixel provider legend were fetched and visually inspected. Blue/white seabed colours and green positive land cells were confirmed; numeric lookup is unchanged.
- GetFeatureInfo at 50.7700°N, 1.2700°W: HTTP 200, CORS `*`, `Depth: -22.649999618530273`; shown approximately as 22.6 m below LAT.
- Example point request:
  `https://ows.emodnet-bathymetry.eu/wms?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=emodnet:mean&query_layers=emodnet:mean&styles=&srs=EPSG:4326&bbox=-1.271,50.769,-1.269,50.771&width=101&height=101&x=50&y=50&info_format=application/json&feature_count=1`

The NOAA US overlay retains its explicit `DisplayDepthUnits=1` (metres) setting. Only one depth overlay is shown at a time.
