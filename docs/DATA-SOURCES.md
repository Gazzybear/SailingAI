# Marine data choices — checked 1 November 2026

## Implemented

- **Weather:** [Open-Meteo forecast API](https://open-meteo.com/en/docs), best-match models. 72 hourly timestamps covering today and the next two calendar days; temperature, wind and gusts in knots, wind direction, visibility in metres (shown in km), rain amount/probability, pressure, humidity, cloud and weather code. Sunrise/sunset are explicitly labelled for the first forecast day. All displayed times are UTC.
- **Sea conditions:** [Open-Meteo marine API](https://open-meteo.com/en/docs/marine-weather-api). Significant wave height, period and direction, swell height and sea level including tides. Null values stay unavailable. Actual weather/marine grid coordinates can differ from the requested point and are displayed with retrieval timestamps and source request links.
- **Tidal context:** a 24-hour plot of the returned hourly modelled sea levels, relative to global mean sea level. This is NOT chart datum/LAT, an authoritative high/low table, a local tidal-stream prediction or an under-keel-clearance calculation. The provider warns that its approximately 8 km tide/current model is unsuitable for coastal navigation or replacing an almanac. Missing data is plotted as gaps. [ADMIRALTY EasyTide](https://easytide.admiralty.co.uk/) supplies the official port-prediction reference link.
- **Map:** [OpenStreetMap](https://wiki.openstreetmap.org/wiki/Export) embed with a simulated position marker. World/local extent, Cowes/Gosport/Sydney/New York demo presets and validated custom coordinates. Map panning does not change the forecast point; choose a preset or enter coordinates. No GPS, depth information or safe route is implied. Coordinates are sent to OSM and the forecast provider.
- **Harbours:** source-checked Cowes and Gosport guides with four marina cards. Authority and operator sources, check date, contact channels, phones and facilities are provided in `lib/harbours.ts`. This is curated reference information, not a live notices, prices or berth-availability feed. Global marina discovery links to Marinas.com.
- **Official UK bulletins:** [Met Office inshore/strong-wind forecast](https://weather.metoffice.gov.uk/specialist-forecasts/coast-and-sea/inshore-waters-forecast) and [shipping forecast](https://weather.metoffice.gov.uk/specialist-forecasts/coast-and-sea/shipping-forecast). The app links these; it does not claim to ingest or monitor these bulletins. The numerical cards use Open-Meteo best-match data and are not labelled official Met Office forecasts.

Weather results are cached in a bounded server memory map for ten minutes (one minute for partial failures). Provider retrieval times are preserved. Each provider fails independently; successful weather can remain visible when marine data fails. The stored logbook is never automatically populated with forecast readings. The source requests have a 15-second timeout.

## Research and next integrations

| Source | Finding | What is needed |
| --- | --- | --- |
| [Met Office Weather DataHub](https://datahub.metoffice.gov.uk/docs/getting-started) | Direct API available, with its own account/subscription and API key. | Obtain the appropriate key and licence; the OpenAI key cannot authenticate it. |
| [UKMO through Open-Meteo](https://open-meteo.com/en/docs/ukmo-api) | `models=ukmo_seamless` was verified by the research agent. UK/global model data with provider-specific licensing and open-data delay. | Optional future provider selection; preserve UKMO attribution and CC BY-SA terms. Not the default integration shipped here. |
| [UKHO Discovery](https://www.api.gov.uk/ukho/uk-tidal-api-discovery/) | Official high/low predictions for the current day plus six days, free one-year subscription requiring a separate key. | Register and configure UKHO credentials. [Official FAQ](https://admiraltyapi.developer.azure-api.net/faqs) prohibits caching Discovery data; keep it out of stored snapshots/exports unless licensed. GMT is used, without BST adjustment. |
| UKHO Foundation/Premium | More detailed tidal services with different usage/caching rights. | Appropriate subscription and licence before integration. |
| [Marinas.com developer notice](https://marinas.com/developers) | API deprecated; notice specified removal on 1 September 2024. | Use [the directory](https://marinas.com/browse/marina) and direct operator sources. Do not depend on retired API endpoints or scrape around access restrictions. |

The free Open-Meteo hosted service is for noncommercial use within its published quotas. Attribution and model-provider terms apply; commercial hosting needs the appropriate subscription. Review [terms](https://open-meteo.com/en/terms) before public/commercial scaling. A free forecast feed is not a licensed digital nautical almanac.

## Verification

Live weather and marine requests for Solent/Gosport returned 72 merged hourly records with actual source-grid positions and retrieval times. Browser checks verified coordinate-preset changes, forecast-hour selection, harbour selection and the embedded map controls. Unit tests verify null handling, coordinate rejection, joining by valid time, source provenance and independent provider failure. No operational sea trial or navigation validation has been performed.
