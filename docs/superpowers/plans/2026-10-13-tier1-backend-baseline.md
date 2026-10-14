# Tier 1 Backend Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Native/invasive status comes from bundled South Florida data instead of GPT, behind two seams (status, identification) that later sources (USDA, PlantNet) plug into without rewrites.

**Architecture:** `fl_plants_service.get_status()` is the status seam over two bundled JSON lists. `identification_service.identify_species()` is the ID seam returning a fixed shape (OpenAI vision inside for now). `ai_service.identify_plant()` composes them: ID → status → one OpenAI "assess" call for wildlife reasoning/actions (and a status guess used only when our data doesn't know the plant). All OpenAI access goes through `openai_client.chat()`, created lazily so tests need no API key.

**Tech Stack:** Python 3.14 (`py` launcher on Windows), Flask 3.1, openai 2.42, pytest. Tests run in `backend/venv` (gitignored).

**Spec:** the user's "Tier 1 backend baseline" request in this session (status seam, identification seam, wiring, cleanups, tests first).

## Global Constraints

- Backend only — do not modify anything under `frontend/`.
- `get_status(scientific_name, zip_code) -> {"native": bool|None, "invasive": bool|None, "source": str, "why": str|None}`; `source` is exactly `"FISC"`, `"fl_natives"` or `"unknown"`; fields are `None` when not found.
- Matching is case-insensitive and trimmed.
- `identify_species(image, location) -> {"scientific_name", "common_name", "confidence", "candidates"}`.
- Database status overrides the model; the model's status is used only when `source == "unknown"`.
- `/identify` and `/recommend` responses include `source` and `why`.
- Data files: `backend/data/fisc_list.json`, `backend/data/fl_natives.json`, ~20 real species each, each entry has `scientific_name`, `common_name`, one-line `why`, plus a comment to verify against official FISC / UF-IFAS lists before the demo.
- Rename `gemini_service.py` → `ai_service.py`; delete the iNaturalist confidence nudge; remove the dead `/get_local_plants_endpoints` route.
- Model stays `gpt-4o-mini`, temperature 0.
- No commits unless the user asks (repo rule); after code changes, update the architecture docs per CLAUDE.md and run `node docs/sync-architecture.mjs`.

## Review Focus

1. GPT returns a synonym or an author/subspecies suffix (`Schinus terebinthifolius`, `Zamia integrifolia L.`) → should still match our data. Test: Task 1 `test_synonyms_match`, `test_author_or_subspecies_suffix_matches`.
2. Model returns messy fields (confidence as a string or > 1, missing candidates, `"Native "` casing) → cleaned to the contract, no crash. Tests: Task 2 `test_identify_species_cleans_messy_reply`, Task 3 `test_messy_model_values_are_cleaned`.
3. GPT recommends a FISC-listed invasive → must never be returned as a recommendation. Test: Task 3 `test_recommendations_drop_invasives_and_add_source_and_why`.
4. `/identify` called without an image → 400, not a 500 crash. Test: Task 4 `test_identify_requires_image`.
5. Services imported with no `OPENAI_API_KEY` (tests, CI, fresh clone) → import must not fail. Test: Task 2 `test_import_needs_no_api_key`.

---

### Task 1: Status seam + bundled data

**Files:**
- Create: `backend/pytest.ini`, `backend/requirements-dev.txt`
- Create: `backend/data/fisc_list.json`, `backend/data/fl_natives.json`
- Create: `backend/services/fl_plants_service.py`
- Test: `backend/tests/test_fl_plants_service.py`

**Interfaces:**
- Produces: `get_status(scientific_name: str | None, zip_code: str) -> dict` with keys `native, invasive, source, why`; `DATA_DIR: pathlib.Path`.

- [ ] **Step 1: Set up the test environment**

```powershell
py -m venv backend/venv
backend/venv/Scripts/python -m pip install Flask==3.1.3 flask-cors==6.0.5 openai==2.42.0 python-dotenv==1.2.2 requests==2.34.2 pytest
```

`backend/pytest.ini`:
```ini
[pytest]
pythonpath = .
testpaths = tests
```

`backend/requirements-dev.txt` (pin pytest to the version pip installed):
```
-r requirements.txt
pytest==<installed version>
```

- [ ] **Step 2: Write the failing tests** — `backend/tests/test_fl_plants_service.py`

```python
import json

import pytest

from services.fl_plants_service import DATA_DIR, get_status

ZIP = "33139"  # Miami Beach
UNKNOWN = {"native": None, "invasive": None, "source": "unknown", "why": None}


def test_brazilian_pepper_is_invasive_from_fisc():
    status = get_status("Schinus terebinthifolia", ZIP)
    assert status["invasive"] is True
    assert status["native"] is False
    assert status["source"] == "FISC"
    assert status["why"]


def test_coontie_is_native_from_fl_natives():
    status = get_status("Zamia integrifolia", ZIP)
    assert status["native"] is True
    assert status["invasive"] is False
    assert status["source"] == "fl_natives"
    assert "Atala" in status["why"]


def test_made_up_name_is_unknown():
    assert get_status("Plantus imaginarius", ZIP) == UNKNOWN


@pytest.mark.parametrize("name", ["  schinus TEREBINTHIFOLIA  ", "Schinus\tterebinthifolia\n"])
def test_match_ignores_case_and_whitespace(name):
    assert get_status(name, ZIP)["source"] == "FISC"


@pytest.mark.parametrize("name, source", [
    ("Schinus terebinthifolius", "FISC"),   # older spelling GPT often uses
    ("Eichhornia crassipes", "FISC"),
    ("Pontederia crassipes", "FISC"),
    ("Zamia pumila", "fl_natives"),
])
def test_synonyms_match(name, source):
    assert get_status(name, ZIP)["source"] == source


@pytest.mark.parametrize("name, source", [
    ("Zamia integrifolia L.", "fl_natives"),
    ("Asclepias tuberosa subsp. rolfsii", "fl_natives"),
    ("Melaleuca quinquenervia (Cav.) S.T. Blake", "FISC"),
])
def test_author_or_subspecies_suffix_matches(name, source):
    assert get_status(name, ZIP)["source"] == source


@pytest.mark.parametrize("name", [None, "", "   "])
def test_empty_name_is_unknown(name):
    assert get_status(name, ZIP) == UNKNOWN


def test_returns_a_fresh_dict_each_time():
    get_status("Plantus imaginarius", ZIP)["source"] = "tampered"
    assert get_status("Plantus imaginarius", ZIP)["source"] == "unknown"


# ── data integrity ──────────────────────────────────────────────────────────
def _species(filename):
    return json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))["species"]


def _all_names(filename):
    return {n.lower() for e in _species(filename) for n in [e["scientific_name"], *e.get("synonyms", [])]}


@pytest.mark.parametrize("filename", ["fisc_list.json", "fl_natives.json"])
def test_data_file_has_20_complete_entries(filename):
    species = _species(filename)
    assert len(species) >= 20
    for entry in species:
        assert entry["scientific_name"].strip()
        assert entry["common_name"].strip()
        assert entry["why"].strip()


def test_no_species_is_on_both_lists():
    assert not _all_names("fisc_list.json") & _all_names("fl_natives.json")


@pytest.mark.parametrize("filename, source", [("fisc_list.json", "FISC"), ("fl_natives.json", "fl_natives")])
def test_every_entry_resolves_to_its_own_list(filename, source):
    for entry in _species(filename):
        assert get_status(entry["scientific_name"], ZIP)["source"] == source, entry["scientific_name"]
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd backend; venv\Scripts\python -m pytest tests/test_fl_plants_service.py -v`
Expected: collection error `ModuleNotFoundError: No module named 'services.fl_plants_service'`.

- [ ] **Step 4: Create the data files**

`backend/data/fisc_list.json` — top-level `_comment`, `source`, `species[]`; each entry `scientific_name, common_name, synonyms[], fisc_category, why`. Species (all FISC Category I): Schinus terebinthifolia (syn. Schinus terebinthifolius), Melaleuca quinquenervia, Casuarina equisetifolia, Dioscorea bulbifera, Lygodium microphyllum, Lygodium japonicum, Eichhornia crassipes (syn. Pontederia crassipes), Pistia stratiotes, Hydrilla verticillata, Imperata cylindrica, Cupaniopsis anacardioides, Bischofia javanica, Colubrina asiatica, Scaevola taccada (syn. Scaevola sericea, Scaevola frutescens), Ardisia elliptica, Psidium cattleyanum (syn. Psidium cattleianum, Psidium littorale), Neyraudia reynaudiana, Triadica sebifera (syn. Sapium sebiferum), Lantana strigocamara (syn. Lantana camara, Lantana x strigocamara, Lantana × strigocamara), Ruellia simplex (syn. Ruellia tweediana, Ruellia brittoniana), Thespesia populnea, Syngonium podophyllum. `why` = one line on the Everglades / flooding / hurricane / fire stake.

`backend/data/fl_natives.json` — same layout, entries `scientific_name, common_name, synonyms[], why`. Species: Zamia integrifolia (syn. Zamia pumila, Zamia floridana; why mentions the Atala butterfly), Hamelia patens, Muhlenbergia capillaris, Asclepias tuberosa, Asclepias incarnata, Serenoa repens, Sabal palmetto, Quercus virginiana, Coccoloba uvifera, Conocarpus erectus, Rhizophora mangle, Psychotria nervosa, Chrysobalanus icaco, Callicarpa americana, Bursera simaruba, Passiflora suberosa, Coreopsis leavenworthii, Spartina bakeri (syn. Sporobolus bakeri), Tripsacum dactyloides, Ilex vomitoria, Myrcianthes fragrans, Salvia coccinea. `why` = one line on the wildlife payoff.

Both `_comment` fields: starter data — verify every entry against the official FISC Invasive Plant List / UF-IFAS (and for natives, the Atlas of Florida Plants) before the demo. Natives note: the non-native *Hamelia patens* var. *glabra* is sold as "firebush" too.

- [ ] **Step 5: Implement** — `backend/services/fl_plants_service.py`

```python
"""STATUS SEAM: is a plant native or invasive in South Florida, and says who?

Callers only use get_status(). New sources (USDA PLANTS, UF/IFAS, ZIP-specific
lists) plug in here without changing callers.

DATA: backend/data/fisc_list.json and fl_natives.json are a starter set.
Verify every entry against the official FISC Invasive Plant List
(floridainvasives.org/plant-list) and UF/IFAS before the demo.
"""
import json
from functools import cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _unknown():
    return {"native": None, "invasive": None, "source": "unknown", "why": None}


def _normalize(name):
    return " ".join(str(name).split()).lower()


@cache
def _index(filename):
    """normalized scientific name or synonym -> entry"""
    species = json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))["species"]
    return {
        _normalize(name): entry
        for entry in species
        for name in [entry["scientific_name"], *entry.get("synonyms", [])]
    }


def _find(filename, key):
    index = _index(filename)
    # Fall back to the bare binomial so "Zamia integrifolia L." or
    # "Asclepias tuberosa subsp. rolfsii" still match.
    return index.get(key) or index.get(" ".join(key.split()[:2]))


def get_status(scientific_name, zip_code):
    """-> {"native": bool|None, "invasive": bool|None, "source": str, "why": str|None}

    zip_code is accepted for future regional lists; today both lists cover South Florida.
    """
    if not scientific_name or not str(scientific_name).strip():
        return _unknown()
    key = _normalize(scientific_name)
    if entry := _find("fisc_list.json", key):
        return {"native": False, "invasive": True, "source": "FISC", "why": entry["why"]}
    if entry := _find("fl_natives.json", key):
        return {"native": True, "invasive": False, "source": "fl_natives", "why": entry["why"]}
    return _unknown()
```

- [ ] **Step 6: Run to verify they pass**

Run: `cd backend; venv\Scripts\python -m pytest tests/test_fl_plants_service.py -v`
Expected: all PASS.

---

### Task 2: OpenAI client + identification seam

**Files:**
- Create: `backend/services/openai_client.py`
- Create: `backend/services/identification_service.py`
- Test: `backend/tests/test_openai_client.py`, `backend/tests/test_identification_service.py`

**Interfaces:**
- Produces: `openai_client.chat(content: str | list, json_reply: bool = False) -> str | dict | list` (callers must call it as `openai_client.chat(...)` so tests can monkeypatch one place); `identify_species(image: str, location: str) -> {"scientific_name": str, "common_name": str, "confidence": float, "candidates": [{"scientific_name", "common_name", "confidence"}]}`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_openai_client.py`:
```python
import importlib
from types import SimpleNamespace

from services import openai_client


def _fake_client(reply):
    create = lambda **kwargs: SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=reply))])
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_chat_returns_trimmed_text(monkeypatch):
    monkeypatch.setattr(openai_client, "_client", lambda: _fake_client("  Hello.  \n"))
    assert openai_client.chat("hi") == "Hello."


def test_chat_parses_json_inside_code_fences(monkeypatch):
    monkeypatch.setattr(openai_client, "_client", lambda: _fake_client('```json\n{"a": [1, 2]}\n```'))
    assert openai_client.chat("hi", json_reply=True) == {"a": [1, 2]}


def test_chat_parses_bare_json(monkeypatch):
    monkeypatch.setattr(openai_client, "_client", lambda: _fake_client('[{"a": 1}]'))
    assert openai_client.chat("hi", json_reply=True) == [{"a": 1}]


def test_import_needs_no_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    importlib.reload(openai_client)  # must not raise
```

`backend/tests/test_identification_service.py`:
```python
import pytest

from services import identification_service, openai_client
from services.identification_service import identify_species


@pytest.fixture
def model_reply(monkeypatch):
    """Make the model return whatever the test puts in reply['value']; record what was sent."""
    reply = {"value": {}, "sent": None}

    def fake_chat(content, json_reply=False):
        reply["sent"] = content
        return reply["value"]

    monkeypatch.setattr(openai_client, "chat", fake_chat)
    return reply


def test_identify_species_returns_standard_shape(model_reply):
    model_reply["value"] = {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.87,
        "candidates": [{"scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.1}],
    }
    assert identify_species("abc123", "33139") == {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.87,
        "candidates": [{"scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.1}],
    }


def test_identify_species_cleans_messy_reply(model_reply):
    model_reply["value"] = {"scientific_name": "  Zamia integrifolia ", "common_name": "Coontie",
                            "confidence": "0.871", "candidates": ["junk", {"common_name": "Other"}]}
    result = identify_species("abc123", "33139")
    assert result["scientific_name"] == "Zamia integrifolia"
    assert result["confidence"] == 0.87
    assert result["candidates"] == [{"scientific_name": "", "common_name": "Other", "confidence": 0.0}]


def test_identify_species_survives_missing_fields(model_reply):
    model_reply["value"] = {"common_name": "Mystery plant"}
    assert identify_species("abc123", "33139") == {
        "scientific_name": "", "common_name": "Mystery plant", "confidence": 0.0, "candidates": []}


@pytest.mark.parametrize("value, expected", [(1.7, 1.0), (-0.2, 0.0), ("abc", 0.0), (None, 0.0)])
def test_confidence_is_clamped(model_reply, value, expected):
    model_reply["value"] = {"scientific_name": "X y", "common_name": "X", "confidence": value}
    assert identify_species("abc123", "33139")["confidence"] == expected


@pytest.mark.parametrize("image, url", [
    ("abc123", "data:image/jpeg;base64,abc123"),
    ("data:image/png;base64,xyz", "data:image/png;base64,xyz"),
    ("https://example.com/p.jpg", "https://example.com/p.jpg"),
])
def test_image_is_sent_as_url(model_reply, image, url):
    identify_species(image, "33139")
    assert model_reply["sent"][0]["image_url"]["url"] == url
    assert "33139" in model_reply["sent"][1]["text"]
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend; venv\Scripts\python -m pytest tests/test_openai_client.py tests/test_identification_service.py -v`
Expected: `ModuleNotFoundError` for both modules.

- [ ] **Step 3: Implement** — `backend/services/openai_client.py`

```python
"""The one place that talks to OpenAI. Services call openai_client.chat(...)."""
import json
import os
import re
from functools import cache

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

MODEL = "gpt-4o-mini"
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$")


@cache
def _client():
    # Created on first use, so importing services (tests, CI) needs no API key.
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def chat(content, json_reply=False):
    """Send one user message (text, or a list of text/image parts).

    Returns the reply text, or the parsed JSON when json_reply is True.
    """
    response = _client().chat.completions.create(
        model=MODEL,
        temperature=0,
        messages=[{"role": "user", "content": content}],
    )
    text = response.choices[0].message.content.strip()
    return json.loads(_FENCE.sub("", text)) if json_reply else text
```

`backend/services/identification_service.py`:
```python
"""IDENTIFICATION SEAM: photo -> species.

identify_species() always returns
    {"scientific_name": str, "common_name": str, "confidence": float,
     "candidates": [{"scientific_name", "common_name", "confidence"}, ...]}
so the model behind it (OpenAI today, PlantNet later) can change without touching callers.
"""
from services import openai_client

PROMPT = """Identify the plant in this photo, taken near US ZIP code {location}.

Give confidence as a float between 0.0 and 1.0. Be genuinely calibrated:
- 0.90-0.99 only if the plant is clearly visible, unambiguous, and you are highly certain
- 0.70-0.89 if the image is clear but it could plausibly be one of a few similar plants
- 0.50-0.69 if the image is partly obscured, low quality, or hard to tell from similar species
- 0.30-0.49 if you are mostly guessing from limited visual information
- below 0.30 if you cannot reliably identify the plant
Do NOT default to round numbers like 0.9; use two decimals (e.g. 0.83, 0.61, 0.47).

Also list up to 3 other species it could plausibly be, most likely first.

Respond only in JSON:
{{"scientific_name": "...", "common_name": "...", "confidence": 0.00,
  "candidates": [{{"scientific_name": "...", "common_name": "...", "confidence": 0.00}}]}}"""


def _image_url(image):
    if image.startswith(("http://", "https://", "data:image")):
        return image
    return f"data:image/jpeg;base64,{image}"


def _confidence(value):
    try:
        return round(min(1.0, max(0.0, float(value))), 2)
    except (TypeError, ValueError):
        return 0.0


def _species(raw):
    return {
        "scientific_name": str(raw.get("scientific_name") or "").strip(),
        "common_name": str(raw.get("common_name") or "").strip(),
        "confidence": _confidence(raw.get("confidence")),
    }


def identify_species(image, location):
    raw = openai_client.chat([
        {"type": "image_url", "image_url": {"url": _image_url(image)}},
        {"type": "text", "text": PROMPT.format(location=location)},
    ], json_reply=True)
    result = _species(raw)
    result["candidates"] = [_species(c) for c in raw.get("candidates") or [] if isinstance(c, dict)]
    return result
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd backend; venv\Scripts\python -m pytest tests/test_openai_client.py tests/test_identification_service.py -v`
Expected: all PASS.

---

### Task 3: ai_service — rename, wire the seams, clean up

**Files:**
- Rename: `backend/services/gemini_service.py` → `backend/services/ai_service.py` (`git mv`)
- Rewrite: `backend/services/ai_service.py`
- Test: `backend/tests/test_ai_service.py`

**Interfaces:**
- Consumes: `get_status` (Task 1), `identify_species`, `openai_client.chat` (Task 2).
- Produces: `identify_plant(image, location) -> dict` with keys `plant_name, scientific_name, is_native, invasive_status, endangered_status, wildlife_support, wildlife_support_reason, confidence, candidates, source, why, actions`; `assess_plant(species, status, location) -> dict`; `get_plant_recommendations(location) -> list[dict]` (each item gains `source`, `why`; FISC invasives removed); `generate_letter(plant_names, score, zip_code) -> str` (unchanged behaviour). `inat_note` is no longer returned (the frontend only shows it when present).

- [ ] **Step 1: Write the failing tests** — `backend/tests/test_ai_service.py`

```python
import pytest

from services import ai_service, openai_client

ZIP = "33139"


@pytest.fixture
def model(monkeypatch):
    """Stub both AI calls. Tests set what the model 'says' in model['species'] / model['assessment']."""
    state = {
        "species": {"scientific_name": "", "common_name": "", "confidence": 0.9, "candidates": []},
        "assessment": {
            "wildlife_support": "medium", "wildlife_support_reason": "Feeds some birds.",
            "endangered_status": "not_threatened", "is_native": True, "invasive_status": "native",
            "actions": [{"action": "Plant firebush nearby", "impact": "Feeds hummingbirds."}],
        },
        "assess_calls": [],
    }
    monkeypatch.setattr(ai_service, "identify_species", lambda image, location: state["species"])

    def fake_assess(species, status, location):
        state["assess_calls"].append(status)
        return state["assessment"]

    monkeypatch.setattr(ai_service, "assess_plant", fake_assess)
    return state


def _says(model, scientific_name, common_name, **assessment):
    model["species"].update(scientific_name=scientific_name, common_name=common_name)
    model["assessment"].update(assessment)


def test_database_overrides_model_for_invasive(model):
    _says(model, "Schinus terebinthifolia", "Brazilian pepper", is_native=True, invasive_status="native")
    result = ai_service.identify_plant("img", ZIP)
    assert result["invasive_status"] == "invasive"
    assert result["is_native"] is False
    assert result["source"] == "FISC"
    assert result["why"]
    assert result["actions"][0]["action"] == "Do not plant or propagate this species"


def test_database_overrides_model_for_native(model):
    _says(model, "Zamia integrifolia", "Coontie", is_native=False, invasive_status="invasive")
    result = ai_service.identify_plant("img", ZIP)
    assert result["invasive_status"] == "native"
    assert result["is_native"] is True
    assert result["source"] == "fl_natives"
    assert "Atala" in result["why"]
    assert result["actions"] == model["assessment"]["actions"]


def test_unknown_plant_falls_back_to_model(model):
    _says(model, "Plantus imaginarius", "Made-up plant", is_native=False, invasive_status="non-native")
    result = ai_service.identify_plant("img", ZIP)
    assert result["invasive_status"] == "non-native"
    assert result["is_native"] is False
    assert result["source"] == "unknown"
    assert result["why"] is None


def test_unknown_plant_model_says_invasive_gets_removal_actions(model):
    _says(model, "Plantus imaginarius", "Made-up plant", is_native=False, invasive_status="invasive")
    result = ai_service.identify_plant("img", ZIP)
    assert result["invasive_status"] == "invasive"
    assert result["actions"][0]["action"] == "Do not plant or propagate this species"


def test_result_has_full_contract(model):
    _says(model, "Zamia integrifolia", "Coontie")
    result = ai_service.identify_plant("img", ZIP)
    assert {"plant_name", "scientific_name", "invasive_status", "is_native", "source", "why",
            "wildlife_support", "confidence", "actions"} <= result.keys()
    assert result["plant_name"] == "Coontie"
    assert result["confidence"] == 0.9
    assert "inat_note" not in result


def test_assess_is_told_the_database_status(model):
    _says(model, "Schinus terebinthifolia", "Brazilian pepper")
    ai_service.identify_plant("img", ZIP)
    assert model["assess_calls"][0]["source"] == "FISC"


def test_messy_model_values_are_cleaned(model):
    _says(model, "Plantus imaginarius", "Made-up plant", invasive_status=" Native ",
          wildlife_support="HIGH", endangered_status="who knows")
    result = ai_service.identify_plant("img", ZIP)
    assert result["invasive_status"] == "native"
    assert result["wildlife_support"] == "high"
    assert result["endangered_status"] == "unknown"


def test_assess_plant_prompt_includes_known_status(monkeypatch):
    sent = {}
    monkeypatch.setattr(openai_client, "chat", lambda content, json_reply=False: sent.setdefault("prompt", content) and {})
    species = {"scientific_name": "Schinus terebinthifolia", "common_name": "Brazilian pepper"}
    ai_service.assess_plant(species, {"native": False, "invasive": True, "source": "FISC", "why": "x"}, ZIP)
    assert "invasive" in sent["prompt"] and "FISC" in sent["prompt"] and ZIP in sent["prompt"]


def test_recommendations_drop_invasives_and_add_source_and_why(monkeypatch):
    monkeypatch.setattr(openai_client, "chat", lambda content, json_reply=False: [
        {"plant_name": "Coontie", "scientific_name": "Zamia integrifolia", "wildlife_support": "high"},
        {"plant_name": "Brazilian pepper", "scientific_name": "Schinus terebinthifolius", "wildlife_support": "low"},
        {"plant_name": "Made-up plant", "scientific_name": "Plantus imaginarius", "wildlife_support": "medium"},
    ])
    recs = ai_service.get_plant_recommendations(ZIP)
    assert [r["plant_name"] for r in recs] == ["Coontie", "Made-up plant"]
    assert recs[0]["source"] == "fl_natives" and "Atala" in recs[0]["why"]
    assert recs[1]["source"] == "unknown" and recs[1]["why"] is None


def test_generate_letter_still_works(monkeypatch):
    monkeypatch.setattr(openai_client, "chat", lambda content, json_reply=False: "They feed bees.")
    letter = ai_service.generate_letter(["Coontie", "Firebush"], 42, ZIP)
    assert "Coontie and Firebush" in letter
    assert "They feed bees." in letter
    assert "42 out of 100" in letter
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend; venv\Scripts\python -m pytest tests/test_ai_service.py -v`
Expected: `ImportError: cannot import name 'ai_service'`.

- [ ] **Step 3: Rename and implement**

Run: `git mv backend/services/gemini_service.py backend/services/ai_service.py`, then replace its contents with:

```python
"""AI-backed features: the identification pipeline, recommendations and letter text.

Native / invasive status comes from fl_plants_service (bundled FISC / FL-natives
data). OpenAI is used for species ID (via identification_service), wildlife
reasoning, recommendation wording and letter text, plus a status *fallback*
only when our data doesn't know the plant (source == "unknown").
"""
from services import openai_client
from services.fl_plants_service import get_status
from services.identification_service import identify_species

STATUSES = ("native", "non-native", "invasive")
SUPPORT_LEVELS = ("high", "medium", "low")
ENDANGERED = ("not_threatened", "threatened", "endangered", "critically_endangered", "unknown")

ASSESS_PROMPT = """The plant {common_name} ({scientific_name}) was found near US ZIP code {location}.
{status_line}
Determine:
1. wildlife support level: "high", "medium" or "low"
   - high: supports many pollinators, birds or beneficial insects; provides food/habitat
   - medium: supports some wildlife but is not a keystone species
   - low: minimal wildlife value, ornamental only, or actively harmful
2. a one-sentence reason for that wildlife support level
3. conservation status: "not_threatened", "threatened", "endangered", "critically_endangered" or "unknown"
4. whether it is native to the area of ZIP {location} (true/false), and its status there: "native", "non-native" or "invasive"
5. 2 specific, practical actions a person can take involving planting or caring for this or companion plants
   to benefit the local ecosystem. Each names a specific plant or technique and gives the direct
   environmental benefit in one sentence.

Respond only in JSON, no markdown:
{{"wildlife_support": "...", "wildlife_support_reason": "...", "endangered_status": "...",
  "is_native": true, "invasive_status": "...", "actions": [{{"action": "...", "impact": "..."}}]}}"""


def _pick(value, allowed, default):
    value = str(value or "").strip().lower()
    return value if value in allowed else default


def _invasive_actions(location):
    return [
        {
            "action": "Do not plant or propagate this species",
            "impact": "Prevents further spread of invasive species that can harm native ecosystems and reduce biodiversity",
        },
        {
            "action": f"Consider removing this plant and replacing with native alternatives for {location}",
            "impact": "Supports local biodiversity, provides better wildlife habitat, and strengthens ecosystem resilience",
        },
    ]


def assess_plant(species, status, location):
    """Wildlife reasoning + actions from the model, plus its status guess (used only as a fallback)."""
    if status["source"] == "unknown":
        status_line = ""
    else:
        label = "invasive" if status["invasive"] else "native"
        status_line = f"Florida records ({status['source']}) list it as {label} here; treat that as fact.\n"
    return openai_client.chat(ASSESS_PROMPT.format(
        common_name=species["common_name"] or "unknown",
        scientific_name=species["scientific_name"] or "unknown",
        location=location,
        status_line=status_line,
    ), json_reply=True)


def identify_plant(image_data, location):
    species = identify_species(image_data, location)
    status = get_status(species["scientific_name"], location)
    assessment = assess_plant(species, status, location)

    if status["source"] == "unknown":
        # Not in our Florida data: fall back to the model's guess.
        invasive_status = _pick(assessment.get("invasive_status"), STATUSES, "non-native")
        is_native = bool(assessment.get("is_native"))
    else:
        invasive_status = "invasive" if status["invasive"] else "native"
        is_native = status["native"]

    if invasive_status == "invasive":
        actions = _invasive_actions(location)
    else:
        actions = assessment.get("actions") or []

    return {
        "plant_name": species["common_name"],
        "scientific_name": species["scientific_name"],
        "is_native": is_native,
        "invasive_status": invasive_status,
        "endangered_status": _pick(assessment.get("endangered_status"), ENDANGERED, "unknown"),
        "wildlife_support": _pick(assessment.get("wildlife_support"), SUPPORT_LEVELS, "low"),
        "wildlife_support_reason": assessment.get("wildlife_support_reason", ""),
        "confidence": species["confidence"],
        "candidates": species["candidates"],
        "source": status["source"],
        "why": status["why"],
        "actions": actions,
    }


RECOMMEND_PROMPT = """...existing 11-plant recommendation prompt, unchanged, with {location}..."""


def get_plant_recommendations(location: str):
    recommendations = []
    for plant in openai_client.chat(RECOMMEND_PROMPT.format(location=location), json_reply=True):
        status = get_status(plant.get("scientific_name"), location)
        if status["invasive"]:
            continue  # never recommend a FISC-listed invasive
        recommendations.append({**plant, "source": status["source"], "why": status["why"]})
    return recommendations


def generate_letter(plant_names: list, score: int, zip_code: str):
    ...existing body, with the OpenAI call replaced by
    benefit = openai_client.chat("Write 1-2 sentences ... ")
```

(The recommendation prompt text and the letter template are moved over verbatim from `gemini_service.py`; only the OpenAI call changes to `openai_client.chat`. The iNaturalist block, `_haversine_miles`, and the `requests` / `inat_service` imports are deleted.)

- [ ] **Step 4: Run to verify they pass**

Run: `cd backend; venv\Scripts\python -m pytest tests/test_ai_service.py -v`
Expected: all PASS.

---

### Task 4: Flask routes

**Files:**
- Modify: `backend/app.py`
- Test: `backend/tests/test_app.py`

**Interfaces:**
- Consumes: `identify_plant`, `get_plant_recommendations`, `generate_letter` from `services.ai_service`.

- [ ] **Step 1: Write the failing tests** — `backend/tests/test_app.py`

```python
import pytest

import app as app_module
from services import ai_service, openai_client


@pytest.fixture
def client():
    app_module.app.config["TESTING"] = True
    return app_module.app.test_client()


def test_identify_returns_source_and_why(client, monkeypatch):
    monkeypatch.setattr(ai_service, "identify_species", lambda image, location: {
        "scientific_name": "Schinus terebinthifolia", "common_name": "Brazilian pepper",
        "confidence": 0.93, "candidates": []})
    monkeypatch.setattr(ai_service, "assess_plant", lambda species, status, location: {
        "wildlife_support": "low", "wildlife_support_reason": "", "endangered_status": "not_threatened",
        "is_native": True, "invasive_status": "native", "actions": []})
    response = client.post("/identify", json={"image": "abc", "location": "33139"})
    assert response.status_code == 200
    result = response.get_json()["result"]
    assert result["source"] == "FISC"
    assert result["invasive_status"] == "invasive"
    assert result["why"]


def test_recommend_returns_source_and_why(client, monkeypatch):
    monkeypatch.setattr(openai_client, "chat", lambda content, json_reply=False: [
        {"plant_name": "Coontie", "scientific_name": "Zamia integrifolia", "wildlife_support": "high"}])
    response = client.post("/recommend", json={"location": "33139"})
    assert response.status_code == 200
    item = response.get_json()["result"][0]
    assert item["source"] == "fl_natives"
    assert item["why"]


@pytest.mark.parametrize("body", [{"location": "33139"}, {"image": "abc"}, {"image": "", "location": "33139"}])
def test_identify_requires_image_and_location(client, body):
    assert client.post("/identify", json=body).status_code == 400


def test_dead_local_plants_route_is_gone(client):
    assert client.post("/get_local_plants_endpoints", json={"location": "33139"}).status_code == 404
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend; venv\Scripts\python -m pytest tests/test_app.py -v`
Expected: `ModuleNotFoundError: No module named 'services.gemini_service'` on import of `app`.

- [ ] **Step 3: Implement** — in `backend/app.py`:
  - imports become `from services.ai_service import identify_plant, get_plant_recommendations, generate_letter` (drop `inat_service` import);
  - delete the commented-out `/get_local_plants_endpoints` block;
  - in `identify()`: `if not image or not location: return 400`;
  - fix `result = result = ...` in `recommend()`.

- [ ] **Step 4: Run the whole suite**

Run: `cd backend; venv\Scripts\python -m pytest -v`
Expected: all PASS.

---

### Task 5: Docs + verification

**Files:**
- Modify: `docs/architecture.html` (graph-data JSON), regenerate `ARCHITECTURE.md`

- [ ] **Step 1:** Update graph-data: `gemini_service.py` → `ai_service.py` paths; `s_identify` how-steps; new nodes `identify_species()` (identification_service), `assess_plant()`, `get_status()` (now live, replaces planned `lookup()`), data files live as `fisc_list.json` / `fl_natives.json`; OpenAI node → `openai_client.chat()`; remove Nominatim node, `r_local` node and its edge; `get_plant_requests()` → dead (no caller) with goal "repurpose or delete"; `/identify` + `/recommend` edge details mention `source`, `why`.
- [ ] **Step 2:** Run `node docs/sync-architecture.mjs` → must print `updated ARCHITECTURE.md` with no ERROR lines.
- [ ] **Step 3:** Verification (superpowers:verification-before-completion): run `cd backend; venv\Scripts\python -m pytest -v` fresh, `node docs/sync-architecture.mjs --check`, `git status` (confirm nothing under `frontend/` changed), and `grep -r gemini_service backend` returns nothing.
