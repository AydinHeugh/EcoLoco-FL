# AI Resilience, Debug Off, Full FISC List, USDA Fallback, PlantNet Credit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An OpenAI outage never takes down a scan, recommendations or the letter; Flask debug is opt-in; the FISC list is the complete official 2026 list; plants missing from bundled data get a USDA PLANTS Florida verdict; the result screen credits Pl@ntNet.

**Architecture:** `openai_client.chat` converts every failure into one `AIUnavailable` exception. `identify_plant` catches it and degrades in place (`ai_unavailable: true`); `/recommend` and `/letter` catch it and call bundled-data fallbacks. A new `usda_service.florida_status(name)` (cached) is the last check inside `get_status`. A committed script parses the FISC PDF into `fisc_list.json`, keeping curated `why` lines.

**Tech Stack:** Python 3.14, Flask, requests, pdfplumber (build script only), pytest; Expo 54 / React Native 0.81, `expo-linking`.

**Spec:** the user's "graceful degradation / debug off / full FISC list / USDA fallback / PlantNet attribution" request (this session).

## Global Constraints

- Keep all existing tests passing; don't break the `identify_species` / `get_status` seams (same signatures and return shapes).
- `get_status` order: FISC → bundled `fl_natives` → USDA → unknown. Sources: `"FISC"`, `"fl_natives"`, `"USDA"`, `"unknown"`. USDA native → native; USDA introduced → `native: false, invasive: false` ("non-native"); not found or USDA error → unknown. USDA results cached in memory; errors not cached.
- USDA API (no official docs; routes taken from plants.usda.gov's own client and confirmed live): `GET https://plantsservices.sc.egov.usda.gov/api/PlantSearch?searchText=<name>` → `[{Plant:{Id,Symbol,ScientificName}}]`; `GET .../PlantProfile?symbol=<sym>` → `{Id, Symbol, NativeStatuses:[{Region:"L48",Status}]}`; `POST .../PlantProfile/getDownloadDistributionDocumentation` body `{"Field":"Symbol","Text":<sym>,"SortBy":"sortSciName","Offset":null,"MasterId":<Id>}`, `Accept: text/csv` → CSV with a `State` column.
- Florida native = recorded in Florida AND an L48 status starting with `N`. Otherwise, if USDA knows the plant → introduced (includes US natives not recorded in Florida).
- Degraded scan: plant ID and native/invasive verdict kept; `wildlife_support "unknown"`, `wildlife_support_reason ""`, `endangered_status "unknown"`, `actions []` (invasives still get the two fixed removal actions); unknown-status plants get `invasive_status "unknown"`, `is_native null`; `ai_unavailable: true`. Normal scans return `ai_unavailable: false`.
- `/recommend` and `/letter` responses gain top-level `ai_unavailable`; `result` keeps its current type (list / string).
- Flask debug only when `ECOLOCO_DEV=1`.
- FISC source: https://www.floridainvasives.org/wp-content/uploads/2026/07/FISC-2026-Plant-List-Cat-I-II_April2026.pdf, parsed programmatically. Entry fields: `scientific_name, common_name, synonyms, fisc_category` (+ `zones`); `why` kept for curated species, `null` otherwise.
- Attribution text exactly "Plant identification powered by Pl@ntNet", logo (official `powered-by-plantnet` PNG from my.plantnet.org), links to https://plantnet.org.
- No explanatory comments (memory rule). Done = README + architecture.html updated + `node docs/sync-architecture.mjs` passes.

## Review Focus

1. USDA is slow or down during a scan → status falls back to unknown quickly, nothing crashes, the failure isn't cached. Test: Task 3 `test_usda_error_is_unknown_and_not_cached`.
2. OpenAI returns non-JSON or the wrong JSON type → treated as unavailable, not a 500. Test: Task 1 `test_chat_bad_json_raises_ai_unavailable`, `test_assess_returning_a_list_degrades`.
3. A curated species whose name differs from the official list spelling (e.g. `Psidium cattleyanum` vs `cattleianum`) → curated `why` still attached. Test: Task 2 `test_merge_matches_curated_by_synonym`.
4. A species on both the new full FISC list and `fl_natives.json` → caught. Test: existing `test_no_species_is_on_both_lists`.
5. A USDA-confirmed non-native shows up in AI recommendations → dropped. Test: Task 3 `test_recommendations_drop_usda_non_natives`.

---

### Task 1: OpenAI failures degrade instead of crashing; debug off

**Files:** `backend/services/openai_client.py`, `backend/services/ai_service.py`, `backend/app.py`; tests in `test_openai_client.py`, `test_ai_service.py`, `test_app.py`.

**Produces:** `openai_client.AIUnavailable(Exception)`; `chat` raises it for any client/HTTP/JSON failure. `ai_service.fallback_recommendations(location) -> list` (bundled natives as recommendation items, top 3 with `problem/action/impact`, rest with `benefit`; each `source "fl_natives"`, `why`, `wildlife_support "unknown"`). `ai_service.generate_letter_without_ai(plant_names, score, zip_code) -> str` (same template; benefit sentence from matching natives' `why` lines, else a generic sentence). `app.debug_enabled() -> bool`.

- [ ] Failing tests: `test_chat_raises_ai_unavailable_on_client_error`, `test_chat_bad_json_raises_ai_unavailable`; `test_scan_survives_openai_outage` (Brazilian pepper → `invasive`, `FISC`, fixed actions, wildlife `unknown`, `ai_unavailable True`), `test_scan_unknown_plant_without_ai` (`invasive_status "unknown"`, `is_native None`), `test_assess_returning_a_list_degrades`, `test_normal_scan_has_ai_unavailable_false`; `test_fallback_recommendations_come_from_natives`, `test_letter_without_ai_uses_why_lines`; app: `test_recommend_falls_back_when_ai_down`, `test_letter_falls_back_when_ai_down`, `test_identify_survives_ai_down`; `test_debug_off_by_default`, `test_debug_on_with_dev_flag`.
- [ ] Run → fail; implement; run → full suite green.

### Task 2: Full FISC list from the official PDF

**Files:** create `backend/scripts/build_fisc_list.py`, `backend/tests/test_build_fisc_list.py`; regenerate `backend/data/fisc_list.json`; add `pdfplumber` to `requirements-dev.txt`.

**Produces:** `clean_name(raw) -> (scientific_name, synonyms)` (strips footnote `*`/digits, turns `Genus (=Other) epithet` into name + synonym `Other epithet`); `parse_pdf(path) -> list[entry]` (page with "FISC Category I" → `"I"`, "Category II" → `"II"`; two side-by-side tables split at the header x-positions; lowercase-start name fragments join the previous name; common name = first of `;`-separated names); `merge(entries, curated) -> list` (match by any name/synonym, keep curated `why` + synonyms; others `why: null`); CLI `python scripts/build_fisc_list.py <pdf-or-url> <out.json>` that also reports curated species not on the official list.

- [ ] Failing tests: `test_clean_name_strips_footnotes`, `test_clean_name_extracts_parenthetical_synonym`, `test_merge_keeps_curated_why`, `test_merge_matches_curated_by_synonym`, `test_merge_sets_null_why_for_new_species`; data: `test_fisc_list_is_the_full_official_list` (≥ 100 entries, categories only I/II, both present), and existing data tests updated to allow `why: null` for non-curated FISC entries.
- [ ] Run → fail; implement; run the script against the official PDF; inspect anomalies (names not matching `^[A-Z][a-z-]+ [a-z-]+`); run → green.

### Task 3: USDA PLANTS fallback in `get_status`

**Files:** create `backend/services/usda_service.py`, `backend/tests/test_usda_service.py`; modify `fl_plants_service.py`, `ai_service.py` (non-native mapping, recommendation filtering, parallel status lookups), tests.

**Produces:** `usda_service.florida_status(scientific_name) -> "native" | "introduced" | None` (raises on network/HTTP errors; None = USDA doesn't know it); cache of successful answers by lower-cased binomial.

- [ ] Failing tests (fake `requests.get/post`): `test_usda_native_in_florida`, `test_usda_introduced`, `test_usda_us_native_not_in_florida_is_introduced`, `test_usda_not_found`, `test_usda_matches_search_result_by_binomial`, `test_usda_result_is_cached`; `get_status`: `test_bundled_lists_win_over_usda`, `test_usda_native_status`, `test_usda_non_native_status`, `test_usda_error_is_unknown_and_not_cached`; ai_service: `test_usda_non_native_scan_is_non_native`, `test_recommendations_drop_usda_non_natives`.
- [ ] Run → fail; implement; run → green. Live check against real USDA for Hamelia patens / a US-but-not-FL native / a made-up name.

### Task 4: Pl@ntNet credit on the result screen

**Files:** `frontend/screens/IdentificationScreen.js`; add `assets/powered-by-plantnet-light.png` (official file from my.plantnet.org); `npx expo install expo-linking`.

- [ ] Under the result card: pressable row with the logo image and the text "Plant identification powered by Pl@ntNet", `Linking.openURL('https://plantnet.org')` (expo-linking, errors caught). No JS test runner exists; verify by bundling for web (`npx expo export --platform web`) and a Playwright screenshot of a live result.

### Task 5: Docs + verification

- [ ] README (degraded mode, ECOLOCO_DEV, USDA step, full FISC list, credit), architecture graph (usda_service + USDA live, AIUnavailable path, fallbacks, debug, data node), `node docs/sync-architecture.mjs`; full pytest; `git status`.
