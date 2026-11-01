# Worldwide harbour and port discovery

SailingAI searches OpenStreetMap community harbour/marina listings in a bounded area. If the live providers fail, it returns nearby ports from a bundled Natural Earth gazetteer. The response clearly distinguishes the two. Neither source is a nautical chart, current almanac, pilotage service or live berth inventory.

## HTTP contract

`GET /api/places?lat=-33.86&lon=151.23&radiusKm=30`

Alternatively: `GET /api/places?south=-33.88&west=151.2&north=-33.84&east=151.26`

- Point radius defaults to 15 km and accepts 1–30 km. Latitude/longitude use decimal degrees, south/west negative.
- Bounds must be ordered and no greater than 60 km per side or 5 degrees longitude. Use point/radius mode around the date line. Search on an explicit user action, not every map movement.
- HTTP 200 returns usable data (possibly an honestly empty result). HTTP 400 means invalid input. HTTP 503 means the server is busy and includes `error`; never treat that as no nearby harbours.
- Fields: `retrievedAt`, `places`, `truncated`, `coverage`, `attribution`, `attributionURL`, optional `sourceEndpoint`, `dataMode`, `limitedCoverage`, `warning`, `error`. In `live` mode, `retrievedAt` is the provider-fetch time, not verification time. In `gazetteer` mode it is the bundled snapshot download date. Cached responses retain the original date/time.
- Place fields: `id`, `name`, `kind` (`harbour`, `marina`, or `port`), `lat`, `lon`, `facilities`, optional `website`/`phone`/`vhf`, `sourceURL`, `provenance`. Plain-text rendering only; external links use `rel="noopener noreferrer"`.
- Always show attribution, source/provenance, and coverage. Show `warning` prominently in gazetteer mode: live community marina search is unavailable, and these are bundled historical port points. Never label ports as marinas or present snapshot data as live.
- `truncated: true` means more than 150 entries matched; zoom in. Missing data does not mean no ports, marinas, facilities or visitor berths exist.

## Live OpenStreetMap provider

The Overpass query unions `leisure=marina`, `harbour=yes`, and `seamark:type=harbour` for nodes, ways and relations. Area centres are approximate; they are not entrances. Facilities and contacts are unverified community tags and must be confirmed with the operator. Different OSM objects can represent the same physical business.

The server uses only fixed HTTPS endpoints: [Private.coffee](https://overpass.private.coffee/) and [VK Maps](https://maps.mail.ru/osm/tools/overpass/), both listed as global services in the [OpenStreetMap public-instance directory](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances). No registration is required for these endpoints. The application identifies itself using its GitHub project URL in its User-Agent. Coordinates go to the selected provider; vessel names, logbook entries, credentials and account details do not.

There are at most two sequential attempts, four seconds each, inside a fourteen-second deadline. Overpass itself receives a five-second query runtime budget, 32 MiB memory budget and 151-element limit. Redirects are refused, bodies are limited to 1 MB, and partial-result errors are rejected. The request cannot choose its own host or inject query text. Website tags accept HTTP(S), reject embedded credentials/local or numeric hosts, and are never fetched by the server. Tags are stripped of markup/control characters.

At most two distinct requests are in flight per process, identical requests share a promise, successful live results are cached for five minutes, gazetteer fallbacks/errors for fifteen seconds, and the cache holds at most fifty entries. Rate-limit responses cause a thirty-second provider cooldown. These limits are per process: public deployment needs shared cache/rate limits and a suitable hosted or self-hosted read-only provider. Public Overpass does not offer an availability guarantee.

The OSM editing API is **not used**. Its [usage policy](https://operations.osmfoundation.org/policies/api/) identifies editing as its purpose. It is not a production read-only directory substitute. Also, the main overpass-api.de service is deliberately excluded from automatic fallback because its [documented public-service limitations](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) discourage app-backend reliance.

## Bundled Natural Earth port gazetteer

`lib/data/natural-earth-ports.json` contains 1,081 named port points derived from the [pinned Natural Earth vector release v5.1.2](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_ports.geojson). It records the original source URL, release, download date (1 November 2026) and SHA-256 of the original downloaded file. Only source ID, name and latitude/longitude are retained; no historical website, contact or facilities data is inferred or reused.

The [official dataset page](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/ports/) describes global ports derived from High Seas, with generalised positions that may be substantially displaced from real port locations. Its 1:10 million map scale is **not** ten-metre accuracy. Treat the markers as broad discovery references; they may be on land or many miles from an entrance. Data is historical, incomplete, and is not checked against present-day harbour operations.

The [Natural Earth licence](https://www.naturalearthdata.com/about/terms-of-use/) places the data in the public domain, including modification and redistribution. The app nevertheless provides attribution. Point queries use great-circle distance to filter stored coordinates within the requested radius, and bounding queries filter the stored positions. There is no hidden widening of the requested search. Empty snapshot results never imply no nearby real facilities. On provider failure, this static fallback works in development and production without extra requests.

## Other research checked 1 November 2026

- [Overpass query language](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL), [marina tagging](https://wiki.openstreetmap.org/wiki/Tag:leisure%3Dmarina), and [OpenSeaMap harbour tagging](https://wiki.openstreetmap.org/wiki/OpenSeaMap/Harbours) support the selected query tags.
- [OSM attribution and licensing](https://www.openstreetmap.org/copyright): OpenStreetMap live results are under ODbL and credited in their API response.
- [Marinas.com developers](https://marinas.com/developers) states its API was deprecated with removal scheduled for 1 September 2024. SailingAI links to the directory; it does not scrape it or claim a supported API integration.

## Verification

Nine unit tests cover malicious/oversized inputs, worldwide bounding boxes/date-line point searches, untrusted tags, area centres, truncation, partial errors, bounded failover, cache reuse, genuine empty live responses, HTTP validation and real bundled Sydney/New York/Portsmouth data. Fixtures are explicitly tests, never advertised as live observations.

Live-provider probes on 1 November 2026 returned timeouts or capacity errors for Private.coffee, VK Maps and overpass-api.de. A successful current Overpass lookup was not verified. Local HTTP requests were then checked using the actual bundled fallback: Sydney returned HTTP 200 in 8.15 s with Sydney and Botany Bay; New York in 4.44 s with Bayonne, Newark and New York; and the Solent in 8.05 s with Portsmouth and Southampton. Each response supplied `dataMode: gazetteer`, `limitedCoverage: true`, and the explicit live-search-unavailable warning. Do not claim those records came from a live marine-directory API.
