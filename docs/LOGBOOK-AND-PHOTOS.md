# Expanded logbook and paper workflow

The reviewed observation schema now separates instrument log distance, compass course, deviation and variation (magnitude plus E/W), leeway (magnitude plus drift direction), true water track, GPS COG, TWS, AWS, AWA, WMO sea-state code, swell, visibility shorthand, measured visibility, weather notation, pressure, position and sounder depth/reference. Unknown or unspecified wind/heading values retain their original fields. No navigation corrections or wind conversions are calculated automatically, and forecast data is not used as observations.

Routine manual entries default to hourly mode, requiring a confirmed Europe/London date and HH:00. Event mode permits the actual minute. Existing entries preserve their times and receive null for newly introduced fields. Storage remains version 1 with a narrowly scoped reader migration; missing or malformed original fields still fail validation.

The log has a horizontally scrollable traditional table, editable full details and CSV export of all fields. Sea-state codes follow WMO 3700 via https://www.nodc.noaa.gov/OC5/WOD/CODES/s_18_sea_state.html. Visibility G/M/P/F and weather letters use the user's requested logbook convention, not a claim of a universal Royal Navy standard. Met Office terminology differs, notably its separate very-poor visibility category: https://weather.metoffice.gov.uk/guides/coast-and-sea/glossary.

## Paper workflow

1. Open **Paper logbook · download template or upload a photo** within Passages & logbook.
2. Download the blank HTML sheet or open **Preview / print sheet** (`/paper-logbook`). Use the browser's Print / Save as PDF. The template has one observation per sheet.
3. Choose JPEG, PNG or WebP, up to 6 MiB. HEIC and PDF require conversion first. Include column headings and clear writing.
4. **Read photo with AI** sends that image to OpenAI using the Responses API, `input_image`, high detail, structured output and `store:false`. Requires the existing server configuration. Reading the preview or selecting a file does not send it to OpenAI.
5. Up to 12 draft rows are returned. Review each row, confirm its date/time, correct uncertain values, then save. Blank or unreadable cells remain null or are flagged. Each row's transcription and warnings are retained; the photo is not stored by the app.

Unsaved photo rows remain in memory while reviewing the same passage, including switching New observation / Passage log. Leaving the passage workspace or reloading discards them. Already saved rows are marked in that import session; importing the same file again creates a new session and is not a global duplicate detector. Keep the original paper/image as evidence.

The server bounds streaming uploads even without Content-Length, checks supported signatures, and rejects oversized/unsupported inputs before calling AI. The existing live-AI hosting restrictions still apply. Handwriting recognition can be wrong; a successful synthetic printed-image test is not a guarantee for real handwriting.

## Validation

Automated tests cover old-record migration, null/zero preservation, independent wind readings, numeric ranges, hourly/event time validation, expanded CSV fields and photo type/size/row limits. Live extraction was checked with `docs/images/paper-logbook-test.png`, explicitly synthetic printed test data. A browser test confirmed review, save, reload and CSV export, then removed only the generated test record. The user's original entry remained intact.
