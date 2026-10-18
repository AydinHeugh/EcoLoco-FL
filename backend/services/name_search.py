import json
from functools import cache

from services.species_service import DATA_DIR, resolve

OUR_LISTS = ("fisc_list.json", "fl_natives.json", "fl_non_natives.json", "fl_recommendations.json")
MIN_QUERY = 2
MAX_RESULTS = 20


def _normalize(text):
    return " ".join(str(text).replace("×", "").split()).lower()


@cache
def _entries():
    merged = {}

    def add(scientific_name, commons, synonyms):
        key = resolve(scientific_name) or scientific_name
        entry = merged.setdefault(key, {"scientific_name": key, "commons": [], "names": [key]})
        for name in commons:
            if name and name not in entry["commons"]:
                entry["commons"].append(name)
        for name in [scientific_name, *synonyms, *commons]:
            if name and name not in entry["names"]:
                entry["names"].append(name)

    for filename in OUR_LISTS:
        for e in json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))["species"]:
            add(e["scientific_name"], [e.get("common_name"), *e.get("common_names", [])], e.get("synonyms", []))
    for e in json.loads((DATA_DIR / "fl_plant_names.json").read_text(encoding="utf-8"))["plants"]:
        add(e["scientific_name"], [e.get("common_name")], e.get("synonyms", []))
    for entry in merged.values():
        entry["keys"] = [_normalize(n) for n in entry["names"]]
    return list(merged.values())


def _common(entry):
    return entry["commons"][0] if entry["commons"] else ""


def _score(entry, query):
    best = None
    for key in entry["keys"]:
        if key == query:
            rank = 0
        elif key.startswith(query):
            rank = 1
        elif any(word.startswith(query) for word in key.split()):
            rank = 2
        elif query in key:
            rank = 3
        else:
            continue
        best = rank if best is None else min(best, rank)
    return best


def is_known(scientific_name):
    key = resolve(scientific_name) or scientific_name
    return any(entry["scientific_name"] == key for entry in _entries())


def common_name_for(scientific_name):
    key = resolve(scientific_name) or scientific_name
    entry = next((e for e in _entries() if e["scientific_name"] == key), None)
    return _common(entry) if entry else ""


def search(query):
    query = _normalize(query)
    if len(query) < MIN_QUERY:
        return []
    hits = []
    for entry in _entries():
        rank = _score(entry, query)
        if rank is not None:
            hits.append((rank, len(entry["scientific_name"]), entry))
    hits.sort(key=lambda h: (h[0], h[1], h[2]["scientific_name"]))
    return [{"scientific_name": e["scientific_name"], "common_name": _common(e)} for _, _, e in hits[:MAX_RESULTS]]
