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
    # zip_code is unused until there are regional lists; both lists cover South Florida.
    if not scientific_name or not str(scientific_name).strip():
        return _unknown()
    key = _normalize(scientific_name)
    if entry := _find("fisc_list.json", key):
        return {"native": False, "invasive": True, "source": "FISC", "why": entry["why"]}
    if entry := _find("fl_natives.json", key):
        return {"native": True, "invasive": False, "source": "fl_natives", "why": entry["why"]}
    return _unknown()
