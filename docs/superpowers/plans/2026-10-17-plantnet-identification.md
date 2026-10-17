# PlantNet Multi-Image Identification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify a plant from 1–5 photos with PlantNet first, let OpenAI adjudicate when PlantNet is unsure, fall back to OpenAI vision when PlantNet fails, and never crash — all behind `identify_species`.

**Architecture:** `identification_service.py` gains a public `identify_with_plantnet(images)` (HTTP client + parser) and private OpenAI helpers for adjudication and fallback vision. `identify_species(images, location)` orchestrates them and adds `source` and `needs_confirmation` to the existing standard shape. `identify_plant` and `/identify` pass a list of images through and expose the two new fields.

**Tech Stack:** Python 3.14, `requests`, Flask, pytest (backend venv).

**Spec:** the user's "real multi-image identification with an uncertainty path" request (this session). PlantNet API facts below come from https://my.plantnet.org/doc/api/identify, plus a live 401 probe.

## Global Constraints

- PlantNet: `POST https://my-api.plantnet.org/v2/identify/all`, query `api-key=<PLANTNET_API_KEY>`, multipart field `images` repeated per photo; optional query `nb-results`, `lang`; organs omitted (defaults to `auto`).
- PlantNet limits: 1–5 images of the same plant; `image/jpeg` or `image/png` only; 50 MB total.
- PlantNet response: `results[]` sorted by `score` (0–1); name from `species.scientificNameWithoutAuthor`; common name from `species.commonNames[0]` (may be empty). Errors are JSON with a non-2xx status (e.g. 401 "Bad token").
- `identify_species` returns `{scientific_name, common_name, confidence, candidates, source, needs_confirmation}`; `candidates` are the *other* possibilities, ranked, each `{scientific_name, common_name, confidence}`.
- `source` ∈ `"plantnet"`, `"openai_adjudicated"`, `"openai_fallback"`; plus `"none"` when every identifier failed (empty names, confidence 0.0).
- `needs_confirmation` = top confidence < 0.80, or top minus runner-up ≤ 0.15. The same rule decides when PlantNet is "unsure" and needs adjudication.
- Never crash on PlantNet/OpenAI failure. Never log the API key (it is in the request URL, so never log raw exception text).
- Frontend untouched. Don't break the existing 51 tests (only fixture/expected dicts may gain the two new keys).
- Done = README + `docs/architecture.html` updated, `node docs/sync-architecture.mjs` passes (CLAUDE.md).

## Review Focus

1. A PlantNet error message containing the request URL leaks the key into server logs → logs must only say the error type/status. Test: Task 2 `test_plantnet_failure_log_never_contains_key`.
2. Tests (or CI) running with a real `.env` would hit PlantNet → all tests must be offline. Test: Task 1 autouse `no_network` fixture; `test_plantnet_without_key_raises`.
3. A photo that isn't JPEG/PNG (e.g. WebP) → PlantNet can't take it; must fall back to OpenAI, not crash. Test: Task 1 `test_plantnet_rejects_non_jpeg_png`.
4. The adjudicator answers with a species that isn't one of PlantNet's candidates → ignore it, keep PlantNet's top with `needs_confirmation: true`. Test: Task 2 `test_adjudicator_off_list_answer_keeps_plantnet_top`.
5. Six photos, or an empty list, reach `/identify` → 400, not a 500. Test: Task 3 `test_identify_rejects_bad_image_counts`.

---

### Task 1: PlantNet client

**Files:** Create `backend/tests/conftest.py`; modify `backend/services/identification_service.py`; test `backend/tests/test_plantnet.py`.

**Interfaces — Produces:** `identify_with_plantnet(images: list[str]) -> list[dict]` (ranked `{scientific_name, common_name, confidence}`; raises on any failure: missing key, non-JPEG/PNG, HTTP error, bad JSON). Images may be raw base64, `data:image/...` URLs, or http(s) URLs (downloaded with `requests.get`, timeout 15 s). POST timeout 20 s; query `nb-results=5`, `lang=en`.

- [ ] **Step 1:** `conftest.py` autouse fixture `no_network`: deletes `PLANTNET_API_KEY` and replaces `requests.post` / `requests.get` with a function raising `RuntimeError("network blocked in tests")`.
- [ ] **Step 2: failing tests** in `test_plantnet.py` (fake `requests.post` returning an object with `status_code`, `raise_for_status()`, `json()`):
  - `test_plantnet_request_matches_api`: with `PLANTNET_API_KEY=test-key` and two JPEG images → URL `https://my-api.plantnet.org/v2/identify/all`, `params == {"api-key": "test-key", "nb-results": 5, "lang": "en"}`, two `("images", (name, <decoded bytes>, "image/jpeg"))` files, a timeout is passed.
  - `test_plantnet_parses_ranked_results`: doc-shaped JSON with scores 0.8312/0.0921 → `[{"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.83}, {..., "confidence": 0.09}]`; a result with empty `commonNames` → `common_name == ""`.
  - `test_plantnet_detects_png`: PNG magic bytes → mime `image/png`.
  - `test_plantnet_accepts_data_url_and_http_url`: data URL decoded; http URL fetched via (faked) `requests.get`.
  - `test_plantnet_rejects_non_jpeg_png`: bytes without JPEG/PNG magic → raises.
  - `test_plantnet_without_key_raises`, `test_plantnet_http_error_raises` (status 401 → raises).
- [ ] **Step 3:** run → fail (`ImportError: identify_with_plantnet`).
- [ ] **Step 4:** implement; mime by magic bytes (`\x89PNG` → png, `\xff\xd8\xff` → jpeg).
- [ ] **Step 5:** run → pass; full suite still 51 + new.

### Task 2: `identify_species` orchestration

**Files:** modify `backend/services/identification_service.py`, `backend/tests/test_identification_service.py`.

**Interfaces — Consumes:** `identify_with_plantnet`, `openai_client.chat`. **Produces:** `identify_species(images: str | list[str], location: str) -> dict` (shape in Global Constraints; a single string is treated as one image; 0 or >5 images → `ValueError`).

Flow: PlantNet → if ranked list non-empty and not unsure → `source "plantnet"`. If unsure → OpenAI gets all photos + location + PlantNet's top 5 and must choose one by scientific name (JSON `{scientific_name, confidence}`); valid choice → `source "openai_adjudicated"`, names from PlantNet's entry, confidence from OpenAI, candidates = the rest of PlantNet's list with PlantNet scores, `needs_confirmation: true`. Off-list answer or adjudicator error → PlantNet top, `source "plantnet"`, `needs_confirmation: true`. PlantNet error or empty → OpenAI vision on all photos (existing prompt, plural) → `source "openai_fallback"`. Everything fails → `source "none"`. PlantNet failures logged with `logging.warning`, type/status only.

- [ ] **Step 1: failing tests** (patch `identification_service.identify_with_plantnet` and `openai_client.chat`):
  - `test_plantnet_confident_is_used_directly`: `[Zamia integrifolia .92, Zamia furfuracea .03]` → source `plantnet`, conf .92, candidates `[furfuracea .03]`, `needs_confirmation False`, chat never called.
  - `test_plantnet_ambiguous_is_adjudicated`: `[A .45, B .40, C .05]`, chat → `{"scientific_name": "B", "confidence": 0.7}` → source `openai_adjudicated`, scientific/common name of B, conf .7, candidates `[A .45, C .05]`, `needs_confirmation True`; prompt text includes the ZIP and all three names; every photo sent.
  - `test_plantnet_low_confidence_single_result_is_adjudicated`: `[A .6]` → chat called.
  - `test_adjudicator_off_list_answer_keeps_plantnet_top`, `test_adjudicator_error_keeps_plantnet_top` → source `plantnet`, A, `needs_confirmation True`.
  - `test_plantnet_failure_falls_back_to_openai_vision` and `test_plantnet_empty_result_falls_back` → source `openai_fallback`.
  - `test_everything_failing_never_crashes` → `{"scientific_name": "", "common_name": "", "confidence": 0.0, "candidates": [], "source": "none", "needs_confirmation": True}`.
  - `test_needs_confirmation` parametrized on the fallback path `(top, runner_up, expected)`: `(0.92, 0.03, False)`, `(0.80, None, False)`, `(0.79, None, True)`, `(0.85, 0.72, True)`, `(0.85, 0.69, False)`.
  - `test_multiple_images_reach_both_identifiers`: three images → PlantNet gets 3; fallback content has 3 image parts + 1 text part.
  - `test_image_count_outside_1_to_5_raises`: `[]` and 6 images → `ValueError`.
  - `test_plantnet_failure_log_never_contains_key`: PlantNet raises `requests.ConnectionError("...?api-key=test-key")` → `caplog` mentions PlantNet, not `test-key`.
  - Existing `test_identify_species_returns_standard_shape` / `..._survives_missing_fields` expected dicts gain `"source": "openai_fallback"` and `needs_confirmation` (False / True).
- [ ] **Step 2:** run → fail. **Step 3:** implement. **Step 4:** run → pass, full suite green.

### Task 3: pass-through in `identify_plant` and `/identify`

**Files:** modify `backend/services/ai_service.py`, `backend/app.py`, `backend/tests/test_ai_service.py`, `backend/tests/test_app.py`.

**Interfaces — Produces:** `identify_plant(images, location)` result gains `id_source` (= species `source`) and `needs_confirmation`. `/identify` accepts `images` (list of 1–5 non-empty strings) or legacy `image` (string); otherwise 400.

- [ ] **Step 1: failing tests:** `test_identify_plant_exposes_id_source_and_confirmation` (ai_service); app: `test_identify_accepts_multiple_images` (3 images reach `identify_species` as a list), `test_identify_still_accepts_single_image`, `test_identify_rejects_bad_image_counts` (`[]`, 6 images, `[""]` → 400). Existing fakes for `identify_species` gain `source` / `needs_confirmation`.
- [ ] **Step 2:** run → fail. **Step 3:** implement. **Step 4:** run → pass.

### Task 4: docs + verification

- [ ] README: inputs (1–5 photos), "what happens in between" step 1 (PlantNet → OpenAI adjudication / fallback, needs-confirmation flag), outputs (ID source, confirmation flag), `.env` gets `PLANTNET_API_KEY`.
- [ ] `docs/architecture.html`: `s_species` how/what/goal, new external node "PlantNet API" with edge from `s_species`, `s_identify` result step, `/identify` edge detail and route how-steps.
- [ ] `node docs/sync-architecture.mjs` passes; full pytest run shown; `git status` shows no `frontend/` changes. Live PlantNet smoke test only if `PLANTNET_API_KEY` is set (it currently isn't).
