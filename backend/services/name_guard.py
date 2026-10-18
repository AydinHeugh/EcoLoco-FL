import json
import re
from functools import cache

from services.species_service import DATA_DIR


def _load(name):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


@cache
def _patterns():
    terms = _load("nature_terms.json")
    names = set()
    for filename in ("fisc_list.json", "fl_natives.json", "fl_non_natives.json", "fl_recommendations.json"):
        for entry in _load(filename)["species"]:
            names.update(n.lower() for n in [entry["scientific_name"], entry.get("common_name"),
                                              *entry.get("common_names", []), *entry.get("synonyms", [])] if n)
            names.update(a.lower() for a in entry.get("helps", {}).get("animals", []))
    names.update(g["group"].lower() for g in _load("nwf_keystone_fl.json")["genera"])
    patterns = [re.compile(r"\b%s(?:s|es)?\b" % re.escape(w)) for w in terms["words"]]
    patterns += [re.compile(r"\b[a-z]+%s\b" % re.escape(e)) for e in terms["endings"]]
    patterns += [re.compile(r"\b%s\b" % re.escape(n)) for n in names]
    return patterns


def mentions_new_names(text, allowed):
    text, allowed = text.lower(), allowed.lower()
    return any(m.group(0) not in allowed for p in _patterns() for m in p.finditer(text))
