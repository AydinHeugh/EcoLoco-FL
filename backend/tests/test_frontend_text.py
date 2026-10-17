import re
from pathlib import Path

import pytest

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
FILES = sorted(FRONTEND.rglob("*.js"))


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
@pytest.mark.parametrize("phrase", ["PROBLEM", "Unknown Wildlife", "Unknown wildlife", "wildlife support"])
def test_old_ai_labels_are_gone(path, phrase):
    assert phrase not in path.read_text(encoding="utf-8")


def test_offline_banner_text_is_exact():
    text = (FRONTEND / "components" / "OfflineNotice.js").read_text(encoding="utf-8")
    assert "Extra descriptions are offline. Plant names and Florida status still work." in text


BANNED = ["pruning", "host plant", "keystone", "lepidoptera", "cultivar", "established", "category i",
          "propagate", "biodiversity score", "botanist", "prioritise", "personalise", "ecological benefit"]
DATA = Path(__file__).resolve().parents[1] / "data"


def _data_texts():
    import json
    load = lambda name: json.loads((DATA / name).read_text(encoding="utf-8"))
    for name in ("fisc_list.json", "fl_natives.json"):
        for entry in load(name)["species"]:
            yield f"{name}:{entry['scientific_name']}", entry.get("why") or ""
    for line in load("why_this_matters.json")["lines"]:
        yield "why_this_matters", line["text"]


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
def test_frontend_has_no_jargon(path):
    text = re.sub(r"https?://\S+", "", path.read_text(encoding="utf-8")).lower()
    assert [w for w in BANNED if w in text] == []


def test_data_has_no_jargon():
    found = [(where, w) for where, text in _data_texts() for w in BANNED if w in text.lower()]
    assert found == []


def test_letter_template_has_no_jargon():
    from services import ai_service
    empty = {"remove": [], "add": [], "gaps": [], "summary": {"percent_native": 50, "percent_native_with_plan": 75}}
    text = ai_service.letter_facts(empty, "33496").lower()
    assert [w for w in BANNED if w in text] == []


@pytest.mark.parametrize("swap", ["trimming", "caterpillars eat its leaves", "one of the most important plants for wildlife here",
                                  "butterflies and moths", "a different version sold in stores", "after its first year",
                                  "officially listed as invasive in Florida"])
def test_letter_prompt_lists_the_word_swaps(swap):
    from services import ai_service
    assert swap in ai_service.LETTER_SYSTEM
