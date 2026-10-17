# Phase 2: Honest Verdicts and Real Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every verdict EcoLoco shows is correct or honestly marked unknown, the made-up score is replaced by counts and percent native, and every recommendation, fact and letter line comes from our sourced Florida data.

**Architecture:** The backend decides everything a student sees: species resolution, status, identification state, plan, letter. The frontend only renders those fields, so logic is covered by pytest. OpenAI is reduced to two optional jobs: a tiebreaker suggestion in the "which one is it?" picker, and rephrasing one letter paragraph behind a name guard.

**Tech Stack:** Flask + pytest (backend/venv, Python 3.14), Expo 54 / React Native 0.81 / react-native-web, Playwright for browser checks.

**Spec:** [docs/ux-review.md](../../ux-review.md), plus the owner's Phase 2 brief (steps 1–9) and priority list from 2026-10-17. The constraints below quote those.

## Global Constraints

- Work in priority order 1 → 7, and commit after each priority with `venv\Scripts\python -m pytest -v` passing. Priority 7 only if time allows.
- Before each priority's commit:
  - update README.md (small, plain wording, no function or variable names);
  - update the `graph-data` JSON in docs/architecture.html (new pieces added, PLANNED nodes and goals current);
  - run `node docs/sync-architecture.mjs` and get a pass.
- No explanatory or changelog-style code comments. Only genuinely non-obvious logic gets a comment.
- API keys stay server-side and `.env` is never read, printed or committed.
- Never log raw PlantNet errors, because the URL carries the key.
- The AI never sets native / non-native / invasive. "OpenAI may only rephrase our data; it never adds plants or facts."
- Bundled data: "Every fact gets a source field. Leave a field out rather than guessing."
- Plain language, about 7th-grade reading level. Swaps:
  - pruning → trimming
  - host plant → "caterpillars eat its leaves"
  - keystone → "one of the most important plants for wildlife here"
  - Lepidoptera → butterflies and moths
  - cultivar → "a different version sold in stores"
  - established → "after its first year"
  - FISC Category I → "officially listed as invasive in Florida"
- Scientific names appear only in the "Buying it" line, and in the picker where two options share a common name.
- Status labels, exactly, on every screen:
  - `Native`
  - `Non-native`
  - `Invasive`
  - `Unknown: not on Florida lists`

  Non-native plants are never counted as harmful.
- Unidentified message, exactly: `Couldn't identify this. Try a close-up of one leaf, or a flower`.
- AI-down banner, exactly: `Extra descriptions are offline. Plant names and Florida status still work.`
- Never add caterpillar counts across plants. Always describe a genus count as the group ("oaks"), never as one species.
- Frontend: AGENTS.md says to read the Expo docs first. The project is on Expo 54, so read https://docs.expo.dev/versions/v54.0.0/ for any Expo API used (expo-image-picker, expo-location).
- Browser checks: put test photos in the repo's `.playwright-mcp/` folder and delete the folder when done.
- Styling (owner addition): Kian is redesigning the look. Change content and layout only, and keep styling minimal. All colors and fonts live in one file, `frontend/theme.js` (created in Task 1.6). Every screen and component touched imports from it instead of defining its own color or font constants.
- No-data line (owner addition): a plant with no helps/why facts in our data shows exactly `We don't have wildlife info for this plant yet` on Identify (Task 1.6, extended in 4.1).
- Plant list (owner addition): `fl_recommendations.json` gets about 30 entries:
  - **coverage:** trees, shrubs, groundcovers and vines; easy and big-effort picks; sun and shade; caterpillar food, nectar and berries;
  - **replacements:** at least one native replacement for each FISC invasive common in Palm Beach County;
  - **sources:** a source link per fact;
  - **verification:** every entry has `"verified": false`. A teammate checks each one in the USF Atlas and flips it to true, and only `verified: true` entries are recommended.

## Decisions for the owner's OK

1. **Thresholds.** PlantNet raw top scores from the review photos, after merging names of the same species:

   | Photo | Raw top | Right answer? |
   |---|---|---|
   | Car (not a plant) | 0.01 | no |
   | Blurred coontie | 0.04 | no |
   | Coontie | 0.29 (merged coontie 0.25) | genus right, species unsure |
   | Peppercorns in a bowl | 0.38 | no |
   | Ixora | 0.44 | yes |
   | Brazilian pepper | 0.73 | yes |
   | Cardboard palm | 0.96 | yes |
   | Welwitschia | 0.99 | yes |

   - **No match:** PlantNet's top score under **0.20** shows the "Couldn't identify" message. That catches the car (0.01) and the blur (0.04), and keeps the coontie (0.29).
   - **Confirm:** from 0.20 up to the existing confirm rule (top under **0.80**, or a gap to the runner-up of **0.15 or less**), show the picker.
   - **Why the picker matters:** the bowl (0.38) is a wrong answer above the floor. Only the picker's "None of these" catches it, so the picker always offers it.
   - **Which number counts:** thresholds use PlantNet's own score, never the AI tiebreaker's.
   - **When PlantNet returns 404** ("species not found"), the app shows the "Couldn't identify" message and doesn't fall back to the AI.
2. **The AI no longer rates wildlife value or conservation status per plant.** Those are AI-made facts; the review found coontie rated Medium, High and Unknown. The wildlife pill is removed everywhere (Priority 3). Per-plant facts come only from our data.
3. **The tiebreaker is kept, but it only suggests.** It pre-selects one option in the picker. The confidence shown is always PlantNet's.
4. **Percent native = native ÷ plants with a known status.** Unknown and unconfirmed plants are listed and counted separately as "not counted".
5. **Renames.** The plant field `invasive_status` becomes `status`, and `/score` becomes `/summary`. Every consumer changes anyway.
6. **Non-Florida ZIP codes.** Outside the Florida range 32004–34997, the app shows "EcoLoco's plant lists cover Florida only. Enter a Florida ZIP code."
7. **Letter.** The AI rephrases only the opening paragraph. Everything with plant, animal or number facts is our template text.

## Review Focus

- **Same species twice in PlantNet's top 5.** If merging *Z. integrifolia* 0.13 and *Z. pumila* 0.12 ever pushes the sum over 1.0, the score must be capped at 1.0. Test in Task 1.3.
- **A Florida-list lookup fails for a picked option** (for example, USDA down): it must show `Unknown: not on Florida lists`, never "Non-native". Test in Task 1.2.
- **An audit with only unknown plants:** percent native is `None`, and the screen says "Not enough identified plants yet", not "0%" or "NaN". Test in Task 2.1, browser check in Task 2.3.
- **Brazilian pepper scanned twice:** one Remove card and one replacement, not two of each. Test in Task 3.2.
- **ZIP codes like "00000" or "10001":** a plain inline error on Recommend and EcoScan, never silent. Tests in Task 3.4, browser check in Task 3.6.

## Shared shapes (defined in Priority 1, extended later)

**Plant option** (Task 1.2):

```json
{"plant_name": "Coontie", "scientific_name": "Zamia integrifolia", "confidence": 0.25,
 "status": "native", "status_label": "Native", "source": "fl_natives",
 "source_label": "EcoLoco South Florida native list", "why": "…"}
```

**`/identify` result** (Task 1.4). This is the top option's fields, plus:

```json
{"state": "identified|confirm|unidentified", "options": [<plant option>, …], "suggested": 0,
 "message": null, "id_source": "plantnet|openai_adjudicated|openai_fallback|none", "ai_unavailable": false}
```

- `options[0]` is the top option.
- `state == "unidentified"` means `options == []` and `message` is the unidentified text.

**Source labels:**
- `FISC` → `Florida Invasive Species Council 2026 list`
- `fl_natives` → `EcoLoco South Florida native list`
- `USDA` → `USDA PLANTS database`
- `unknown` → `None`

---

## Priority 1: The verdict is correct and honest (#2, #3, #7, #8)

### Task 1.1: One name → one species

**Files:**
- Create: `backend/services/species_service.py`, `backend/tests/test_species_service.py`
- Modify: `backend/services/fl_plants_service.py` (use the resolver; drop `_index` / `_find`), `backend/data/fl_natives.json` (coontie gets `"common_names": ["Coontie", "Florida arrowroot"]`)

**Interfaces:**
- Produces:
  - `resolve(name: str) -> str | None`: the canonical scientific name for a scientific name, synonym, or common name. Case and spacing are ignored, and author names are dropped by falling back to the two-word name. Returns `None` when unknown or ambiguous.
  - `common_name(scientific_name: str) -> str | None`.
- The index is built from `fisc_list.json` and `fl_natives.json`, using `scientific_name`, `synonyms`, `common_name` and `common_names`. Task 3.1 adds `fl_recommendations.json` to this list.
- A key that maps to two different species is dropped from the index.
- `get_status(name, zip_code)` resolves first, then looks the canonical name up in the lists, then USDA. Names that don't resolve go to USDA unchanged.

- [ ] **Step 1: Write the failing tests**

```python
COONTIE_LABELS = ["Coontie", "coontie", "Zamia integrifolia", "Florida Arrowroot", "Zamia pumila", "Zamia integrifolia L."]

@pytest.mark.parametrize("label", COONTIE_LABELS)
def test_every_coontie_label_resolves_to_one_species(label):
    assert resolve(label) == "Zamia integrifolia"

def test_all_coontie_labels_get_the_same_status():
    statuses = {json.dumps(get_status(label, "33496"), sort_keys=True) for label in COONTIE_LABELS}
    assert len(statuses) == 1
    assert get_status("Florida Arrowroot", "33496")["source"] == "fl_natives"

def test_brazilian_pepper_spellings_resolve():
    assert resolve("Schinus terebinthifolius") == resolve("Brazilian pepper") == "Schinus terebinthifolia"

def test_ambiguous_common_name_resolves_to_none(monkeypatch):
    # two species sharing a common name in a patched index → resolve returns None

def test_unknown_name_resolves_to_none():
    assert resolve("Welwitschia mirabilis") is None
```

- [ ] **Step 2: Run** `venv\Scripts\python -m pytest tests/test_species_service.py -v`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `species_service.py` and switch `get_status` to use it. Keep the existing 16 tests in `test_fl_plants_service.py` passing.
- [ ] **Step 4: Run the full suite.** Expected: all pass.

### Task 1.2: Status comes only from our lists and USDA

**Files:**
- Modify: `backend/services/fl_plants_service.py`, `backend/services/ai_service.py`
- Test: `backend/tests/test_fl_plants_service.py`, `backend/tests/test_ai_service.py`

**Interfaces:**
- Produces in `fl_plants_service`:
  - `STATUS_LABELS = {"native": "Native", "non-native": "Non-native", "invasive": "Invasive", "unknown": "Unknown: not on Florida lists"}`
  - `SOURCE_LABELS` as in Shared shapes
  - `plant_option(scientific_name: str, common_name: str, confidence: float, zip_code: str) -> dict`: returns a Plant option.
- In `plant_option`:
  - `status` is derived from `get_status` alone: invasive, then native, then non-native; source `unknown` means `"unknown"`.
  - `plant_name` falls back to `common_name(resolved)`, then to the scientific name when no common name is known. The review saw blank names.
  - For a USDA non-native with no `why`, use `why = "Not from Florida, and not on Florida's invasive list."`.
- `ASSESS_PROMPT` loses items 4 (native / invasive status). `identify_plant` stops reading `invasive_status` and `is_native` from the AI.

- [ ] **Step 1: Write the failing tests**

```python
def test_ai_cannot_set_status_for_unlisted_plant(monkeypatch):
    # species Welwitschia mirabilis, USDA returns None, AI assessment says invasive_status "native"
    result = identify_plant(["img"], "33496")
    assert result["status"] == "unknown"
    assert result["status_label"] == "Unknown: not on Florida lists"

def test_usda_failure_on_option_is_unknown_not_non_native(monkeypatch):
    # usda_service.florida_status raises
    assert plant_option("Ixora coccinea", "", 0.44, "33496")["status"] == "unknown"

def test_option_name_falls_back_when_common_name_blank():
    assert plant_option("Zamia pumila", "", 0.12, "33496")["plant_name"] == "Coontie"
    assert plant_option("Zamia loddigesii", "", 0.29, "33496")["plant_name"] == "Zamia loddigesii"

def test_non_native_gets_plain_why(monkeypatch):
    # USDA says introduced
    assert plant_option("Ixora coccinea", "Ixora", 0.44, "33496")["why"] == "Not from Florida, and not on Florida's invasive list."
```

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Update existing tests that assert `invasive_status` / `is_native` to assert `status`.
- [ ] **Step 4: Run the full suite.** Expected: all pass.

### Task 1.3: Identification states, thresholds and merged names

**Files:**
- Modify: `backend/services/identification_service.py`
- Test: `backend/tests/test_identification_service.py`, `backend/tests/test_plantnet.py`

**Interfaces:**
- Consumes: `resolve` (Task 1.1).
- Constants:
  - `NO_MATCH_BELOW = 0.20`
  - keep `CONFIDENT = 0.80` and `CLOSE_CALL = 0.15`
- `identify_species(images, location) -> dict` returns
  `{"state", "ranked": [{"scientific_name","common_name","confidence"}], "suggested": int, "source"}`.
  This replaces `scientific_name` / `candidates` / `needs_confirmation`.
- `identify_with_plantnet` returns `[]` on HTTP 404. `identify_species` treats `[]` from a successful PlantNet call as `unidentified`, and only falls back to OpenAI vision when PlantNet raised.
- `_merge_same_species(ranked) -> list`:
  - groups by `resolve(name) or name`;
  - sums confidence, rounded to 2 places and capped at 1.0;
  - keeps the canonical name and the first non-empty common name;
  - re-sorts by confidence.
- The tiebreaker (`_adjudicate`) runs only when the state is `confirm`, and only sets `suggested`. Confidences and order are unchanged.
- In the OpenAI fallback path, the same thresholds apply to OpenAI's confidence.

- [ ] **Step 1: Write the failing tests**

```python
def test_merges_names_of_same_species():
    ranked = _merge_same_species([
        {"scientific_name": "Zamia loddigesii", "common_name": "", "confidence": 0.29},
        {"scientific_name": "Zamia integrifolia", "common_name": "Florida Arrowroot", "confidence": 0.13},
        {"scientific_name": "Zamia pumila", "common_name": "Coontie", "confidence": 0.12},
    ])
    assert [(r["scientific_name"], r["confidence"]) for r in ranked] == [("Zamia loddigesii", 0.29), ("Zamia integrifolia", 0.25)]

def test_merged_confidence_caps_at_one(): ...  # 0.70 + 0.45 → 1.0

@pytest.mark.parametrize("top,state", [(0.01, "unidentified"), (0.19, "unidentified"), (0.20, "confirm"), (0.79, "confirm"), (0.96, "identified")])
def test_state_from_plantnet_score(monkeypatch, top, state): ...

def test_close_call_is_confirm(monkeypatch): ...  # 0.85 vs 0.70

def test_plantnet_404_is_unidentified_without_openai(monkeypatch):
    # PlantNet raises HTTPError 404 → state "unidentified", openai_client.chat never called

def test_adjudication_only_suggests(monkeypatch):
    # AI picks option 2 with confidence 0.95 → suggested == 1, ranked confidences unchanged
```

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Update existing identification tests to the new return shape.
- [ ] **Step 4: Run the full suite.** Expected: all pass.

### Task 1.4: `/identify` returns state, options and message

**Files:**
- Modify: `backend/services/ai_service.py` (`identify_plant`), `backend/app.py`
- Test: `backend/tests/test_ai_service.py`, `backend/tests/test_app.py`

**Interfaces:**
- Consumes: `plant_option` (1.2) and `identify_species` (1.3).
- `identify_plant(images, location) -> dict`, with the result shape from Shared shapes. Options are built with a `ThreadPoolExecutor`, as recommendations already are.
- `unidentified`:
  - no status lookups and no AI calls;
  - `message = "Couldn't identify this. Try a close-up of one leaf, or a flower"`.
- `wildlife_support`, `wildlife_support_reason`, `endangered_status` and `actions` stay for now (removed in Task 3.3).

- [ ] **Step 1: Write the failing tests**

```python
def test_unidentified_returns_message_and_no_options(monkeypatch):
    assert result["state"] == "unidentified"
    assert result["options"] == []
    assert result["message"] == "Couldn't identify this. Try a close-up of one leaf, or a flower"

def test_confirm_returns_options_with_status(monkeypatch):
    # loddigesii 0.29 + coontie 0.25
    assert [o["plant_name"] for o in result["options"]] == ["Zamia loddigesii", "Coontie"]
    assert result["options"][1]["status_label"] == "Native"
```

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the full suite.** Expected: all pass.

### Task 1.5: Three buckets in the audit breakdown

**Files:**
- Modify: `backend/services/score_service.py` (temporary until Priority 2)
- Test: `backend/tests/test_score_service.py` (new)

**Interfaces:**
- `breakdown` becomes `{"native": [...], "non_native": [...], "invasive": [...], "unknown": [...]}`.
- The input plant uses `status`.

- [ ] **Step 1: Test** that Ixora and Cardboard cycad land in `non_native`, and that nothing but Brazilian pepper lands in `invasive`.
- [ ] **Step 2: Run it** (fails), **implement**, then run again (passes).

### Task 1.6: Frontend: shared status badge, picker, unidentified state

**Files:**
- Create:
  - `frontend/components/StatusBadge.js`: the 4 labels, using the backend's `status_label`, colors by `status`.
  - `frontend/components/CandidatePicker.js`: the "Which one is it?" list of options (name, status badge, PlantNet % as "PlantNet: 25% match"), with the suggested one marked "Best guess" and a "None of these" button.
- Modify:
  - `frontend/screens/IdentificationScreen.js` (drop `NativeBadge`)
  - `frontend/screens/AuditScreen.js` (drop `StatusBadge`, `SupportPill` stays until Task 3.6)
  - `frontend/screens/AuditResultsScreen.js` (4 buckets; "Hurting" lists invasives only)
  - `frontend/services/geminiService.js` (no shape change yet)

**Behavior:**
- **`confirm`:** the picker shows in place of the result, and choosing an option shows that option's fields.
- **"None of these":** shows the unidentified message.
- **`unidentified`:** shows the message and no name, status or actions.
- **EcoScan:**
  - confirm and unidentified cards stay in the list with ✕;
  - a confirm card shows the picker inline;
  - "Finish Audit" sends only confirmed plants with their name, and sends unconfirmed ones as `{"scientific_name": ""}` (counted as unknown).

- [ ] **Step 1: Read** the Expo 54 docs for any Expo API touched.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Browser check.** Web build and backend running, ZIP 33496, photos from Wikimedia Commons (same files as the review, plus `2019_Toyota_Corolla_Icon_Tech_VVT-i_Hybrid_1.8.jpg`). Expected:
  - coontie: picker with "Coontie" + `Native` among the options;
  - blurred coontie: unidentified message;
  - car: unidentified message;
  - bowl: picker, and "None of these" shows the message;
  - ixora: `Non-native`, and the results list puts it under Non-native, not Hurting;
  - Welwitschia: `Unknown: not on Florida lists` on Identify and EcoScan.
- [ ] **Step 4: Docs.** README "What you get back" + architecture nodes (`species_service`, `CandidatePicker`, `StatusBadge`), and mark the multi-photo planned node goal current. Run `node docs/sync-architecture.mjs`; expect a pass.
- [ ] **Step 5: Commit Priority 1**

```bash
cd backend && venv\Scripts\python -m pytest -v && cd ..
git add backend frontend README.md docs/architecture.html ARCHITECTURE.md docs/ux-review.md
git commit -m "Make plant verdicts honest: merged names, no AI status, confirm picker, three buckets"
```

---

## Priority 2: Replace the score (#1)

### Task 2.1: `summarize` counts statuses, never names

**Files:**
- Create: `backend/services/summary_service.py`, `backend/tests/test_summary_service.py`
- Delete: `backend/services/score_service.py`, `backend/tests/test_score_service.py`
- Modify: `backend/app.py` (`/score` → `/summary`)

**Interfaces:**
- `summarize(plants: list[dict], added_natives: int = 0) -> dict`. Each plant's status comes from `get_status(plant["scientific_name"])`; an empty name is unknown. Returns:

  ```json
  {"counts": {"native": 2, "non_native": 1, "invasive": 1, "unknown": 2},
   "known": 4, "plant_count": 6,
   "percent_native": 50, "percent_native_with_plan": 75,
   "plants": [{"plant_name", "scientific_name", "status", "status_label", "why", "source_label"}]}
  ```

- `percent_native = round(100 * native / known)`, and `None` when `known == 0`.
- `percent_native_with_plan = round(100 * (native + invasive + added_natives) / (known + added_natives))`.
- `POST /summary {"plants": [...]}` returns `{"result": summary}`. An empty list gets a 400 with `"plants list is required"`.

- [ ] **Step 1: Write the failing tests**

```python
def test_spellings_of_same_species_give_identical_summary():
    results = [summarize([{"scientific_name": label}, {"scientific_name": "Brazilian pepper"}])
               for label in ["Coontie", "coontie", "Zamia integrifolia", "Florida Arrowroot"]]
    assert all(r["counts"] == results[0]["counts"] and r["percent_native"] == results[0]["percent_native"] for r in results)
    assert results[0]["counts"] == {"native": 1, "non_native": 0, "invasive": 1, "unknown": 0}

def test_percent_native_and_projection():
    # 2 native, 1 non-native, 1 invasive, 1 unknown
    assert s["percent_native"] == 50 and s["percent_native_with_plan"] == 75

def test_only_unknown_plants_gives_none():
    assert summarize([{"scientific_name": ""}])["percent_native"] is None

def test_unknown_plants_stay_listed():
    assert any(p["status"] == "unknown" for p in s["plants"])
```

- [ ] **Step 2: Run them** (fails), **implement**, then run again (passes). Run the full suite (passes).

### Task 2.2: The letter uses percent native

**Files:**
- Modify: `backend/services/ai_service.py` (`generate_letter`, `generate_letter_without_ai`, `_letter`), `backend/app.py` (`/letter` takes `summary` instead of `score`)
- Test: `backend/tests/test_ai_service.py`, `backend/tests/test_app.py`

**Template sentence:** "Right now, {percent_native}% of the plants we checked are native to Florida. With these changes, it would be {percent_native_with_plan}%." When `percent_native` is `None`, the sentence is "We couldn't identify enough plants to give a percentage yet." "score" and "out of 100" disappear from the letter.

- [ ] **Step 1: Test:** the letter contains "50%" and "75%", and doesn't contain "out of 100".
- [ ] **Step 2: Run it** (fails), **implement**, then run again (passes).

### Task 2.3: AuditResults shows percent native

**Files:**
- Create: `frontend/components/PercentRing.js` (one ring with two arcs: now and with the plan; labels "Now 50% native" / "With the plan 75%"; no target marker)
- Modify:
  - `frontend/screens/AuditResultsScreen.js`: remove `ScoreRing`, `scoreColor`, `scoreLabel`, `BeforeAfterPill`, hold-to-preview, `boost` / "+N pts" and the projected-score maths;
  - `frontend/services/geminiService.js`: `getSummary(plants)` replaces `getScore`, and `generateLetter(plantNames, summary, zipCode)`.

**Behavior:**
- Show counts by status with the four badge colors.
- Show the plant lists grouped by status, with unknowns included.
- When `percent_native` is `None`, show "Not enough identified plants yet".

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Browser check.**
  - The review audit (coontie confirmed, cardboard palm, pepper, ixora, Welwitschia) shows the right counts and percentages.
  - An audit of only Welwitschia shows "Not enough identified plants yet".
  - No "/100", "pts" or "Hold" text appears anywhere: run `document.body.innerText` checks.
- [ ] **Step 3: Docs.** README "After you scan a whole campus" + "What happens in between: Scoring"; architecture (replace the score nodes, delete the `ui_jump` planned node). Run the sync; expect a pass.
- [ ] **Step 4: Commit Priority 2:** "Replace the biodiversity score with counts and percent native".

---

## Priority 3: Recommendations from our data only (#4, #5, #10)

### Task 3.1: Sourced Florida data files

**Files:**
- Create:
  - `backend/data/fl_recommendations.json`
  - `backend/data/nwf_keystone_fl.json`
  - `backend/data/nature_terms.json`
  - `backend/tests/test_data_files.py`
- Modify:
  - `backend/data/fisc_list.json`: Brazilian pepper gets `removal_safety`;
  - `backend/scripts/build_fisc_list.py`: `merge` carries `removal_safety` over, like `why`;
  - `backend/services/species_service.py`: also indexes `fl_recommendations.json`;
  - `backend/tests/test_build_fisc_list.py`.

**`fl_recommendations.json` entry shape.** Each fact is `{"text", "source": {"name", "url"}}`. Growing facts share `growing_source`.

```json
{"scientific_name": "Hamelia patens var. patens", "common_name": "Firebush", "genus": "Hamelia",
 "plant_type": "shrub", "effort": "easy", "sun": "Full sun to part shade", "mature_size": "6 to 10 feet tall",
 "growing_source": {"name": "UF/IFAS", "url": "…"},
 "atlas": {"palm_beach_county": true, "url": "…"},
 "helps": {"animals": ["hummingbirds", "zebra longwing butterflies"], "text": "…", "source": {…}},
 "offers": ["nectar", "fruit"], "bloom_months": [1, 2, …],
 "buying": {"ask_for": "Hamelia patens var. patens", "avoid": "Plants labeled 'Dwarf', 'Compacta' or 'Firefly' are non-native look-alikes.", "source": {…}},
 "watch_out": [{"text": "…", "source": {…}}],
 "look_into": ["…?"],
 "replaces": ["Schinus terebinthifolia"]}
```

- **Entries:** the 5 examples (coontie, firebush, live oak, beautyberry, sunshine mimosa).
- **Atlas check:** each one is checked in a browser with Playwright on florida.plantatlas.usf.edu (the county list loads with JavaScript). Record the species page URL, and replace any plant that isn't native to Palm Beach County.
- **Sourcing:** fill only fields with a fetched source (UF/IFAS Gardening Solutions, IRC Natives for Your Neighborhood, NWF, ASPCA). Leave the rest out.
- **Brazilian pepper replacements:** firebush and beautyberry get `replaces: ["Schinus terebinthifolia"]` (similar size shrubs).

**`nwf_keystone_fl.json`:**
- Source: https://www.nwf.org/-/media/Documents/PDFs/Garden-for-Wildlife/Keystone-Plants/NWF-GFW-keystone-plant-list-ecoregion-15-tropical-wet-forests.pdf (the `secure.` host in the brief doesn't respond).
- Transcribe the "Top 30 Keystone Plant Genera for Butterfly and Moth Caterpillars" table as `{"genus": "Quercus", "group": "oaks", "caterpillar_species": 395}`.

**Brazilian pepper `removal_safety`:** `{"text": "Brazilian pepper is in the poison ivy family, so wear gloves and long sleeves, and an adult or the grounds crew should do the cutting.", "source": {UF/IFAS page found and fetched}}`.

**`nature_terms.json`:** about 40 lowercase roots for animals and plants used by the letter guard, for example "bird", "butterfl", "moth", "bee", "caterpillar", "pollinat", "hummingbird", "deer", "bear", "frog", "tree", "oak", "palm", "pine", "flower", "shrub", "grass", "fern", "vine", "milkweed".

- [ ] **Step 1: Write the failing data tests**

```python
def test_every_fact_has_a_source(): ...          # helps, buying, watch_out[*], removal_safety, growing_source
def test_limits():                                # watch_out ≤ 2, look_into ≤ 2, effort in {easy, medium, big}
def test_every_entry_has_verified_flag(): ...     # "verified" is a bool; build_plan ignores entries where it isn't True
def test_no_null_fields(): ...                    # a missing fact is left out, never null
def test_nwf_values_match_pdf():
    assert by_genus["Quercus"]["caterpillar_species"] == 395 and by_genus["Prunus"]["caterpillar_species"] == 247
def test_merge_keeps_removal_safety(): ...
def test_recommendations_resolve(): ...           # resolve(common_name) == scientific_name for every entry
```

- [ ] **Step 2: Run them** (fail). **Research and write the data.** Run again (pass).

### Task 3.2: `build_plan` picks from our data

**Files:**
- Create: `backend/services/plan_service.py`, `backend/tests/test_plan_service.py`

**Interfaces:**
- `build_plan(plants: list[dict]) -> dict` returns `{"remove": [RemoveCard], "add": [AddCard], "gaps": [str], "summary": summary}`.
- **RemoveCard:**
  - shape: `{"plant_name", "scientific_name", "why", "source_label", "removal_safety", "effect", "replacement": scientific_name}`;
  - `removal_safety` falls back to `{"text": "Ask your grounds crew how to remove it safely.", "source": null}` when missing;
  - `effect` example: "Replacing it takes you from 50% to 75% native."
- **AddCard:** the recommendation entry plus `"reason": "replaces Brazilian pepper" | "fills a gap: …"`, `"effect"`, and `"where": f"{sun}. Grows {mature_size}."`.
- **Gaps from the audit:**
  - `"important_wildlife_plant"`: no scanned genus is in the NWF list;
  - `"caterpillar_food"`: no scanned plant offers it, and no NWF genus;
  - `"fruit"`;
  - `"bloom_months"`: months no scanned recommendation-listed plant blooms in. Skipped when no scanned plant has bloom data.
- **Ranking:** `gaps filled + 2 × replaces a found invasive + 0.5 if genus in NWF`. Ties are broken by `effort` (easy first), then common name.
- **Picks:**
  - one replacement per distinct invasive found;
  - then gap-fillers up to 5 add cards in total;
  - at most 1 `plant_type == "tree"` in the first 3;
  - at least 1 `effort == "easy"` in the first 3.
- **Effect for NWF genera:** `f"{group.capitalize()} feed {n} kinds of caterpillars here."` (for example "Oaks feed 395 kinds of caterpillars here."). It's on that card only, and numbers are never summed.

- [ ] **Step 1: Write the failing tests**

```python
def test_invasive_gets_remove_card_and_replacement():
    plan = build_plan([{"scientific_name": "Schinus terebinthifolius"}, {"scientific_name": "Ixora coccinea"}])
    assert [c["plant_name"] for c in plan["remove"]] == ["Brazilian pepper"]
    assert "poison ivy" in plan["remove"][0]["removal_safety"]["text"]
    assert plan["add"][0]["reason"] == "replaces Brazilian pepper"

def test_non_native_is_never_removed(): ...       # ixora + cardboard palm → remove == []
def test_duplicate_invasive_one_card(): ...       # pepper twice → 1 remove card, 1 replacement
def test_adds_only_from_our_data(): ...           # every add scientific_name is in fl_recommendations.json
def test_mix_rules_on_empty_audit(): ...          # top 3: ≤ 1 tree, ≥ 1 easy
def test_oak_effect_is_group_count():
    assert "Oaks feed 395 kinds of caterpillars here." in effects
    # no effect string contains a number that isn't one genus's own count or a percentage
def test_effect_shows_percent_change(): ...       # "from 50% to 75% native"
```

- [ ] **Step 2: Run them** (fail), **implement**, then run again (pass).

### Task 3.3: No AI facts per plant

**Files:**
- Modify: `backend/services/ai_service.py` (delete `ASSESS_PROMPT`, `assess_plant`, `_invasive_actions`, `SUPPORT_LEVELS`, `ENDANGERED`; `identify_plant` drops `wildlife_support*`, `endangered_status`, `actions`)
- Test: `backend/tests/test_ai_service.py`

**Interfaces:**
- The Plant option gains these, when the species is in our data:
  - `helps` (from `fl_recommendations`);
  - `watch_out`;
  - `removal_safety` (invasives).
- `ai_unavailable` on `/identify` is true only when the tiebreaker failed.

- [ ] **Step 1: Test** that `identify_plant` never calls `openai_client.chat` for an `identified` result, and that the result has no `actions` or `wildlife_support` keys.
- [ ] **Step 2: Run it** (fails), **implement**, then run again (passes).

### Task 3.4: Routes: `/plan`, `/recommend`, Florida ZIPs

**Files:**
- Modify:
  - `backend/app.py`
  - `backend/services/ai_service.py`: delete `RECOMMEND_PROMPT`, `get_plant_recommendations`, `fallback_recommendations`
- Test: `backend/tests/test_app.py`

**Interfaces:**
- `POST /plan {"plants", "location"}` returns `{"result": plan}`.
- `POST /recommend {"location"}` returns `{"result": build_plan([])["add"]}`.
- `is_florida_zip(zip_code: str) -> bool`: true for 5 digits in 32004–34997.
- A non-Florida ZIP on `/plan`, `/recommend` or `/identify` gets a 400 with `{"error": "EcoLoco's plant lists cover Florida only. Enter a Florida ZIP code."}`.

- [ ] **Step 1: Write the tests:** "10001" and "00000" get a 400 with that exact message; "33496" gets a 200; `/recommend` never calls OpenAI.
- [ ] **Step 2: Run them** (fail), **implement**, then run again (pass).

### Task 3.5: The letter is built from the plan

**Files:**
- Modify: `backend/services/ai_service.py` (`generate_letter(plan, zip_code) -> tuple[str, bool]`; delete `generate_letter_without_ai`, `GENERIC_BENEFIT`, `_plant_list` if unused), `backend/app.py` (`/letter {"plan", "zip_code"}`)
- Create: `backend/services/name_guard.py`
- Test: `backend/tests/test_ai_service.py`, `backend/tests/test_name_guard.py`

**Interfaces:**
- `mentions_new_names(text: str, allowed: str) -> bool`: true when `text` contains any of these that don't also appear in `allowed` (lowercased substring match):
  - a `nature_terms.json` root;
  - any common or scientific name from our data files.
- The letter template carries:
  - percent native now and with the plan;
  - each Remove card: name, `why`, `removal_safety` text;
  - each Add card: common name, "Buying it: ask for {ask_for}. {avoid}";
  - a "Sources" list of every source name + URL used.
- **AI rephrasing:**
  - the AI rewrites only the opening paragraph, given that paragraph's text;
  - the system prompt includes the plain-language rules;
  - when `mentions_new_names(reply, opening)` is true, or the AI is unavailable, the template opening is kept;
  - the second return value is `ai_unavailable`.

- [ ] **Step 1: Write the failing tests**

```python
def test_letter_includes_pepper_removal_and_buying():
    letter, _ = generate_letter(build_plan([{"scientific_name": "Schinus terebinthifolius"}]), "33496")
    assert "Brazilian pepper" in letter and "poison ivy" in letter and "Buying it: ask for" in letter and "Sources" in letter

def test_letter_rejects_ai_text_with_new_names(monkeypatch):
    # AI reply: "Our campus could host the Northern mockingbird and saw palmetto."
    letter, _ = generate_letter(plan, "33496")
    assert "mockingbird" not in letter.lower() and "saw palmetto" not in letter.lower()

def test_letter_contains_no_names_beyond_its_input(monkeypatch):
    # with a well-behaved mocked rephrase: no name in the letter that isn't in the facts passed in
    assert not mentions_new_names(letter, facts_text(plan))

def test_letter_works_without_ai(monkeypatch): ...   # AIUnavailable → template letter, ai_unavailable True
```

- [ ] **Step 2: Run them** (fail), **implement**, then run again (pass).

### Task 3.6: Frontend: plan cards, Recommend tab, errors inline

**Files:**
- Create: `frontend/components/PlanCard.js`: Remove / Add variants with rows Helps / Where / Buying it / Watch out / Look into, each fact followed by its source in small text, 2 lines shown and "More" for the rest.
- Modify:
  - `frontend/screens/AuditResultsScreen.js`: order is the plan (Remove cards, Add cards, a "Find a native nursery" link to https://plantrealflorida.org), then "What your campus supports now" (each plant with its one sourced line), then the percent ring, then the letter. Delete `ActionCard`, `HighlightedText`, `SUPPORT_STYLES`, and the AI recs list.
  - `frontend/screens/RecommendationScreen.js`: Add cards from `/recommend`; delete `SupportPill`, `HighlightedText`, the "PROBLEM" / "ranked by impact" labels and the popup errors (inline text instead).
  - `frontend/screens/AuditScreen.js`: drop `SupportPill`.
  - `frontend/services/geminiService.js`: `getPlan(plants, location)`, `generateLetter(plan, zipCode)`.
- The letter's plant checkboxes go away: the letter covers the whole plan.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Browser check.**
  - The review audit shows a Brazilian pepper Remove card with the gloves warning and a replacement Add card.
  - Ixora isn't removed.
  - The letter names Brazilian pepper and the buying line.
  - ZIP 10001 on Recommend and EcoScan shows the Florida-only message inline.
  - No "PROBLEM", "Wildlife" pill or "milkweed" text appears.
- [ ] **Step 3: Docs.** README "What happens in between" steps 3 and 5, plus a new data-files line; architecture (new data nodes, `plan_service`, `name_guard`; remove the AI recommend nodes). Run the sync; expect a pass.
- [ ] **Step 4: Commit Priority 3:** "Build plans and letters from sourced Florida data only".

---

## Priority 4: Show our data on Identify (#6)

### Task 4.1: Why line, source and "Why this matters"

**Files:**
- Create: `backend/data/why_this_matters.json`: 4 lines from the brief, each `{"text", "source": {"name", "url"}}`, with every source fetched and checked:
  - NWF on caterpillars and chicks;
  - UF/IFAS on fertilizer and runoff;
  - SFWMD on canals;
  - Narango et al. 2018.
- Modify:
  - `backend/app.py`: `/plan` result includes `why_this_matters`;
  - `backend/tests/test_data_files.py`;
  - `frontend/screens/IdentificationScreen.js`: under the name, the `why` line, with "Source: {source_label}" in small text underneath, plus Helps / Watch out / removal safety when present;
  - `frontend/screens/AuditResultsScreen.js`: the "Why this matters" section, max 4 lines, each with its source.

- [ ] **Step 1: Test** that there are at most 4 lines and each has a source URL. Run it (fails), write the data, run again (passes).
- [ ] **Step 2: Browser check.** Brazilian pepper on Identify shows its why line and "Source: Florida Invasive Species Council 2026 list".
- [ ] **Step 3: Docs + sync, then commit Priority 4:** "Show sources and why-it-matters lines in the app".

## Priority 5: AI-down state (#9)

### Task 5.1: One banner

**Files:**
- Create: `frontend/components/OfflineNotice.js`, with the exact banner text from Global Constraints.
- Modify: Identify, EcoScan, AuditResults screens. Show the banner when any response this session had `ai_unavailable: true`, and clear it on the next response that is false.
- Test: `backend/tests/test_app.py`. With the AI down:
  - `/identify` (confirm case) and `/letter` return `ai_unavailable: true`;
  - `/plan` and `/recommend` don't have the key.
- Test: `backend/tests/test_frontend_text.py`. Assert that no file in `frontend/` contains "PROBLEM", "Unknown Wildlife" or "Unknown wildlife".

- [ ] **Step 1: Write the tests.** Run them (fail), implement, run again (pass).
- [ ] **Step 2: Browser check.** Restart the backend with `OPENAI_API_KEY=sk-invalid` set in the process environment (never edit `.env`). Expected: the banner shows once, and the coontie picker still works.
- [ ] **Step 3: Docs.** The `ui_ai_unknown` planned node goes live. Run the sync, then commit Priority 5: "Show one notice when AI descriptions are offline".

## Priority 6: Polish (#11–#17)

### Task 6.1: Plain language everywhere

**Files:**
- Modify: `backend/tests/test_frontend_text.py` (extend), plus every file it flags:
  - `frontend/screens/*.js`
  - `backend/data/*.json` (user-facing fields)
  - `backend/services/ai_service.py` (letter template and system prompt)
  - `frontend/screens/HomeScreen.js`

**The test.** Banned, case-insensitive:
- "pruning"
- "host plant"
- "keystone"
- "lepidoptera"
- "cultivar"
- "established"
- "category i"
- "propagate"
- "biodiversity score"
- "botanist"
- "prioritise"
- "personalise"
- "ecological benefit"

**Home copy:**
- cards that match what the app does;
- an EcoScan link;
- the oak line becomes "Oaks feed 395 kinds of caterpillars in South Florida" with "Source: National Wildlife Federation";
- each card at most 2 short sentences.

- [ ] **Step 1: Write the test.** Run it (fails), fix the text, run again (passes).

### Task 6.2: Phone width, progress text, multi-photo

**Files:**
- Modify: `frontend/screens/IdentificationScreen.js`, `frontend/screens/AuditScreen.js`, `frontend/screens/AuditResultsScreen.js`

**Behavior:**
- **Narrow screens:** below 420 px wide, the photo stacks above the text on result and EcoScan cards. The AuditResults title is smaller, and the Back link sits on its own row.
- **Progress text:** "Identifying…" for the first 2 s, then "Checking Florida lists…", in place of "Analyzing your plant…".
- **Multi-photo:** Identify and EcoScan uploads allow 1–5 photos of one plant (`allowsMultipleSelection`, `selectionLimit: 5`, from the Expo 54 image-picker docs), sent as `images`.
- **Retake tip:** when the state is `confirm`, the screen says "For a surer match, add a photo of a leaf up close or a flower."

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Browser check at 400 × 860.**
  - No word breaks mid-word on cards.
  - The title fits.
  - Uploading 3 coontie photos sends `images` with 3 items (check the request in Playwright's network list).
- [ ] **Step 3: Docs.** The multi-photo planned node goes live. Run the sync, then commit Priority 6: "Plain language, phone layout, progress text, multi-photo".

## Priority 7 (only if time allows)

### Task 7.1: Location button and "Seen near you"

**Files:**
- Delete: `backend/services/inat_service.py`
- Create: `backend/services/location_service.py`, `backend/tests/test_location_service.py`, `frontend/components/LocationPicker.js`

**Interfaces:**
- `round_coords(lat, lon) -> tuple[float, float]` rounds to 2 decimals.
- `geocode(query: str) -> tuple[float, float] | None` uses Nominatim:
  - User-Agent `"EcoLoco-FL (https://github.com/AydinHeugh/EcoLoco-FL)"`;
  - at most 1 request per second, enforced by a module lock and timestamp.
- `seen_near(lat, lon) -> list[dict]` queries iNaturalist `/v1/observations/species_counts` with `lat`, `lng`, `radius=5`, `quality_grade=research` and `iconic_taxa=Plantae`. It returns the top 5 `{"plant_name", "scientific_name", "count"}`, and nothing about location is stored or logged.
- `POST /nearby {"lat", "lon"}` rounds again server-side.
- Frontend: a "Use my location" button (expo-location, ask permission once per audit, round before sending), plus typed address/ZIP sent to `/geocode`.

**Tests:**
- rounding;
- the second geocode call within 1 s waits (patched clock);
- the User-Agent has no email address;
- `seen_near` passes `radius=5` and `quality_grade=research`.

- [ ] **Step 1: Write the tests.** Run them (fail), implement, run again (pass).
- [ ] **Step 2: Browser check** with a typed ZIP.
- [ ] **Step 3: Docs + sync, then commit.**

### Task 7.2: Charts (a) and (b)

**Files:**
- Create: `frontend/components/StatusBars.js`, `frontend/components/CaterpillarBars.js`. Plain Views, white background, the three status colors, labels, no gradients.

**Content:**
- **(a) Status bars:** "Now" vs "With plan" stacked bars (native / non-native / invasive), from `summary.counts` and the plan's projected counts.
- **(b) Caterpillar bars:** one bar per plant with an NWF genus, labeled "add" or "remove", with the value being that genus's count. Bars are never summed.

- [ ] **Step 1: Implement.** Browser check with the review audit.
- [ ] **Step 2: Docs + sync, then commit.**

Charts (c) and (d) are dropped.
