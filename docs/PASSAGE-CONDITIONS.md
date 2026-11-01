# Current position and destination forecasts

Skipper briefing has two independent forecast cards above the map. Each shows total significant wave height and period/direction, visibility in nautical miles and kilometres, precipitation probability and amount, wind and gusts, wind-wave height, swell height/direction/period, temperature and pressure.

The current point follows the simulated vessel coordinates. This release does not read GPS. A destination can be selected from the curated harbour pins, entered as global coordinates, or linked to the final route checkpoint. Linked checkpoints update after edits/reordering and disappear when removed. Destination forecasts never move the vessel. Select an available arrival hour independently of the current-position forecast. Unavailable hours show no substitute data.

Both feeds use Open-Meteo best-match weather and marine APIs with `cell_selection=sea`, fetch on location changes, and automatically check every ten minutes while mounted. Server cache is at most five minutes (one minute for partial failures). Refresh buttons re-request the endpoint, subject to that cache. Current-hour mode follows the clock when refreshed. Coordinates, valid times and per-source retrieval times are shown. These feeds do not provide a single model issue timestamp; retrieval is explicitly not described as model issuance. Coverage is three calendar days, not historical passage weather.

Precipitation probability is the probability of more than 0.1 mm in the preceding hour and includes rain/showers/snow. Total wave height is not a measured WMO sea-state code. Forecast cells can be offshore and cannot resolve harbour shelter or local gusts. No claim of guaranteed or universally highest accuracy is made. Consult official marine forecasts/warnings and onboard observations.

Sources: [weather API](https://open-meteo.com/en/docs), [marine API](https://open-meteo.com/en/docs/marine-weather-api). Noncommercial free API usage, Open-Meteo/provider attribution and terms apply.

## Live boat map filter

A single **Boats** button beside Harbours and Marinas toggles the global AISstream feed. It is enabled by default; authentication stays server-side in ignored `.env.local`. The server keeps one compressed WebSocket connection open, accumulates the latest report per MMSI, expires reports after 30 minutes, and reconnects with bounded exponential backoff. The UI polls this collection every five seconds. Markers and popups remain stable across refreshes. Switching off clears markers; the upstream connection closes after 90 seconds without requests.

Panning and zooming update the subscription around the map centre without moving the simulated vessel. The region encloses the viewport up to a 250 NM radius; a visible notice asks the user to zoom in beyond that. Memory is capped at 5,000 recent vessels and cap exhaustion is disclosed. Coverage depends on receivers and transmitting AIS-equipped vessels. This cannot show every boat or supply an exhaustive traffic picture. The continuous collector is intended for this local demo with one active map area per server process; a multi-user deployment requires separate subscriptions/shared area management and a persistent Node worker. Serverless hosts may suspend background sockets.

Harbours, Marinas and All places now trigger discovery and reload for the viewed map area. Queries include marina, harbour and port tagging and allow up to 1,000 results. Detailed search covers up to 30 km from the centre; larger views say to zoom in. Public Overpass services returned errors during live checks (HTTP 406 from the primary service). The UI explicitly labels the bundled port fallback, which does not supply comprehensive marina coverage. It does not claim every harbour worldwide.

## Validation, 1 November 2026

- Solent and Portsmouth endpoint calls returned 72 hourly rows and both sources, including separate wind waves/swell and precipitation probability.
- Browser verified independent Portsmouth 17:00 UTC arrival selection while the vessel remained at the Solent current hour.
- Authenticated AISstream returned real Solent vessel reports; browser verified marker display and off/on removal/restoration. Continuous collection was verified to accumulate more than 40 vessels in the displayed Solent area, increasing as messages arrive.
- Unit suite: 59 passing tests, including missing-hour handling, sea-cell selection, partial-provider failure and preserved null values. Production build and type checking passed.
