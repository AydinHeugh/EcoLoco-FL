"""Resolve explicit catalog names without collapsing consequential taxonomy."""

from functools import cache

from services.fl_plants_service import CATALOGS, DATA_DIR, _normalize, _species


def _entries():
    # Classification precedence matches fl_plants_service; recommendation facts
    # cannot promote a previously unsupported or reclassified taxon.
    entries = {}
    for filename in CATALOGS:
        for entry in _species(filename):
            entries.setdefault(entry["scientific_name"], entry)
    return list(entries.values())


@cache
def _index():
    index, ambiguous = {}, set()
    for entry in _entries():
        canonical = entry["scientific_name"]
        scientific = [canonical, *entry.get("synonyms", [])]
        common = [entry.get("common_name"), *entry.get("common_names", [])]
        for name in filter(None, scientific + common):
            key = _normalize(name)
            if index.get(key, canonical) != canonical:
                ambiguous.add(key)
            index[key] = canonical
    for key in ambiguous:
        del index[key]
    # The unqualified species and common name must still request a variety
    # check; resolving them straight to var. patens would hide that ambiguity.
    if "hamelia patens" in index:
        index["hamelia patens"] = "Hamelia patens"
        index["firebush"] = "Hamelia patens"
    return index


@cache
def _common_names():
    names = {entry["scientific_name"]: entry["common_name"] for entry in _entries() if entry.get("common_name")}
    names["Hamelia patens"] = "Firebush"
    return names


def resolve(name):
    if not isinstance(name, str) or not name.strip():
        return None
    return _index().get(_normalize(name))


def common_name(scientific_name):
    canonical = resolve(scientific_name)
    return _common_names().get(canonical) if canonical else None
