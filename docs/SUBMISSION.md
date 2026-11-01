# Submission preparation

**Project:** SailingAI — Your intelligent sailing logbook.

**Description:** SailingAI helps recreational sailors turn plain-English observations into structured, editable voyage records. A skipper creates a passage, prepares a log entry with OpenAI, reviews and corrects the result, saves it in the browser and exports the log as CSV. Manual logging and clearly labelled sample data keep the workflow demonstrable without API access. The app records observations and does not provide navigation guidance.

**Repository:** https://github.com/Gazzybear/SailingAI

**Publication status:** Source was successfully pushed to the public GitHub repository after authentication was refreshed. The remote main branch was verified against the local commit. To publish later changes, run:

```powershell
git -C "C:\Users\gaz85\OneDrive\Documents\AI\Hackathon\SailingAI" push -u origin main
```

**Team:** Pending user-supplied names (solo or up to four people). Contact email belongs in the organiser's form/private handoff, not this public file.

**Deadline:** 17:00 GMT, 1 November 2026. One submission per team. Submission route and opening-brief changes deferred by the user.

**Concrete Codex contribution:** Implemented the extraction model and CSV exporter, including checks for absent measurements, invalid Beaufort values, reviewed field export, quoting and formula-injection escaping. Also implemented the interface, server route and persistence.

## Verification status

- Unit tests: 8 passed, covering data validation, CSV integrity, London time handling, corrupt storage rejection, disabled live calls, missing credentials and invalid request bodies.
- TypeScript: passed initially; production builds also run TypeScript verification.
- ESLint: passed on the final run, with the browser-only hydration exception documented and scoped to that effect.
- Production build: passed after the timestamp fix, including TypeScript verification.
- Browser journey: passed create Cowes–Gosport passage, real AI extraction, review/correct crew note, save, reload, reopen/edit, timestamp correction and CSV download/content inspection. Manual fallback form opened successfully. Screenshot saved in images/passage-log.png.
- Mobile: checked at 390 × 844; document width did not exceed viewport. Screenshot in images/mobile-log.png.
- Real OpenAI extraction: passed via the actual endpoint and browser using gpt-6-luna. Force 4 preserved as Beaufort; wind knots, numeric heading and unreported readings remained null.
- Additional live checks: all seven passed (sparse crew note, unspecified speed, correction, multiple events, embedded instruction, empty input, overlength input). Script: scripts/verify-live.mjs.
- Not run: browser-level failed-storage simulation, request race simulation, actual network timeout/rate-limit simulation, destructive browser delete, second-passage isolation journey and comprehensive accessibility audit. Existing unit checks do not substitute for these browser scenarios.
- Public live extraction: disabled by default; no shared host rate limiter configured.
- Public deployment: not performed; optional event deliverable.
- Demo video: not produced; mandatory event deliverable. See DEMO.md.
- Team details, submission URL, submission receipt: pending.

## Readiness

Core application journey verified; remaining verification limits are listed above. GitHub publication complete. Submission package ready: no (video and team details outstanding). Submission accepted: no submission attempted.
