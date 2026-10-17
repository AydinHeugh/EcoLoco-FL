import json
from functools import cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_FILES = ("fisc_list.json", "fl_natives.json")


def _normalize(name):
    return " ".join(str(name).split()).lower()


def _binomial(key):
    return " ".join(key.split()[:2])


def _entries():
    entries = []
    for filename in DATA_FILES:
        path = DATA_DIR / filename
        if path.exists():
            entries.extend(json.loads(path.read_text(encoding="utf-8"))["species"])
    return entries


@cache
def _index():
    index, ambiguous = {}, set()
    for entry in _entries():
        canonical = entry["scientific_name"]
        names = [canonical, *entry.get("synonyms", []), entry.get("common_name"), *entry.get("common_names", [])]
        for name in filter(None, names):
            key = _normalize(name)
            if index.get(key, canonical) != canonical:
                ambiguous.add(key)
            index[key] = canonical
    for key in ambiguous:
        del index[key]
    return index


@cache
def _common_names():
    names = {}
    for entry in _entries():
        if entry.get("common_name"):
            names.setdefault(entry["scientific_name"], entry["common_name"])
    return names


def resolve(name):
    if not name or not str(name).strip():
        return None
    key = _normalize(name)
    index = _index()
    # Fall back to the bare binomial so "Zamia integrifolia L." or
    # "Asclepias tuberosa subsp. rolfsii" still match.
    return index.get(key) or index.get(_binomial(key))


def common_name(scientific_name):
    canonical = resolve(scientific_name)
    return _common_names().get(canonical) if canonical else None
