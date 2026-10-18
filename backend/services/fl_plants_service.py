"""Offline Florida status evidence, with taxonomic exceptions kept intact."""

import copy
import json
import re
from functools import cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CATALOGS = ("fl_non_natives.json", "fisc_list.json", "fl_natives.json")
SOURCES = {
    "fl_non_natives.json": "fl_non_natives",
    "fisc_list.json": "FISC",
    "fl_natives.json": "fl_natives",
}
SCOPE = "Florida-wide status evidence. Site suitability and South Florida planting guidance are assessed separately."
EVIDENCE_FIELDS = (
    "wildlife_support", "wildlife_support_basis", "why_source_url", "taxonomy_notes", "taxonomy_source_url",
    "management_notes", "recommendable", "invasion_assessment", "additional_source_url", "fisc_category",
    "known_distribution_zones", "atlas_url", "atlas_verified", "atlas_checked_on", "atlas_status", "atlas_scope",
    "helps", "buying", "watch_out", "growing_source", "mature_size", "plant_type", "effort", "offers",
    "bloom_months", "replaces", "look_into", "sun_description", "removal_safety", "site_rating_basis",
)
STATUS_LABELS = {"native": "Native", "non-native": "Non-native", "invasive": "Invasive", "unknown": "Unverified Florida status"}
SOURCE_LABELS = {"FISC": "Florida Invasive Species Council 2026 list", "fl_natives": "Sourced Florida native catalog", "fl_non_natives": "Sourced Florida nonnative catalog"}
RANKS = {
    "var": "var.", "variety": "var.", "subsp": "subsp.", "ssp": "subsp.",
    "subspecies": "subsp.", "forma": "f.", "f": "f.",
    "subvar": "subvar.", "nothovar": "nothovar.", "nothosubsp": "nothosubsp.",
}
UNDOTTED_AUTHORS = {"aiton", "baker", "bartram", "blake", "don", "haworth", "hooker", "kunth", "lamarck", "linnaeus", "link", "moench", "nuttall", "pursh", "raddi", "small", "swartz", "walter", "willdenow"}
TAXON_WARNINGS = {
    "hamelia patens": (
        "Confirm the firebush variety: native var. patens and nonnative var. glabra "
        "have different Florida status. Choose the precise catalog entry or ask an Extension expert."
    ),
    "ficus microcarpa": (
        "Confirm the fig subspecies before management: FISC excludes subsp. fuyuensis "
        "from its Ficus microcarpa listing. Choose the precise taxon or ask an Extension expert."
    ),
}


def supported_location(location):
    """Accept only a ZIP present in the bundled Florida county map."""
    return (isinstance(location, str) and re.fullmatch(r"[0-9]{5}", location.strip()) is not None
            and location.strip() in _document("fl_zip_counties.json")["zips"])


def _unknown(reason=None):
    return {
        "native": None, "invasive": None, "source": "unknown", "why": reason,
        "scientific_name": None, "common_name": None, "taxon_id": None,
        "source_url": None, "verified_on": None, "status_verified": False,
        "status_scope": SCOPE, "needs_confirmation": True,
        "needs_taxon_confirmation": False,
    }


def _normalize(name):
    """Remove author citations without dropping a variety, hybrid or cultivar.

    Only names actually present in the sourced catalogs can match. An unknown
    infraspecific name must never silently inherit a parent's classification.
    """
    if not isinstance(name, str):
        return ""
    text = " ".join(re.sub(r"<[^>]+>", "", name).replace("×", "x").split())
    text = re.sub(r"\b(var|subsp|ssp)\.(?=[a-z])", r"\1. ", text, flags=re.IGNORECASE)
    text = text.replace("‘", "'").replace("’", "'").replace('“', '"').replace('”', '"')
    words = text.split()
    if len(words) < 2:
        return text.lower()
    base_length = 3 if words[1].lower() == "x" else 2
    base = " ".join(words[:base_length]).lower()
    rest = words[base_length:]
    # A hybrid formula is a different identity, not an author citation.
    if any(word.lower() == "x" for word in rest):
        return text.lower()
    ranks = []
    for index, word in enumerate(rest):
        rank = RANKS.get(word.lower().rstrip("."))
        # 'L. f.' is an author, not a forma without an epithet.
        if rank == "f." and index > 0 and rest[index - 1].endswith("."):
            continue
        if rank and index + 1 == len(rest):
            return text.lower()
        if rank:
            ranks.extend((rank, rest[index + 1].lower().rstrip(".,")))
    cultivars = re.findall(r"['\"]([^'\"]+)['\"]", text)
    if ranks or cultivars:
        return " ".join([base, *ranks, *(f"'{value.lower()}'" for value in cultivars)])
    if any(word.lower().rstrip(".") in {"cv", "cf", "aff", "sp", "spp"} for word in rest):
        return text.lower()
    for word in rest:
        token = word.strip("(),")
        if token.lower() in UNDOTTED_AUTHORS | {"ex", "et", "&"}:
            continue
        if re.fullmatch(r"[A-Za-z.-]+\.", token):
            continue
        # An uppercase unquoted cultivar is not automatically an author.
        return text.lower()
    return base


@cache
def _document(filename):
    return json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))


@cache
def _species(filename):
    return _document(filename)["species"]


@cache
def _index(filename):
    return {
        _normalize(name): entry
        for entry in _species(filename)
        for name in [entry["scientific_name"], *entry.get("synonyms", [])]
    }


def bundled_natives():
    return copy.deepcopy(_species("fl_natives.json"))


def _find(filename, key):
    return _index(filename).get(key)


def _status(entry, filename, query_key):
    is_fisc = filename == "fisc_list.json"
    document = _document(filename)
    warning = TAXON_WARNINGS.get(query_key)
    source_url = entry.get("source_url") or document.get("source_url") or document.get("source")
    native = entry.get("native", filename == "fl_natives.json")
    invasive = entry.get("invasive", is_fisc)
    why = entry.get("why")
    if is_fisc and not why:
        why = f"Listed in FISC Category {entry['fisc_category']} for Florida."
    status = {
        "native": native, "invasive": invasive, "source": SOURCES[filename], "why": why,
        "scientific_name": entry["scientific_name"], "common_name": entry["common_name"],
        "taxon_id": entry.get("taxon_id") or _normalize(entry["scientific_name"]),
        "source_url": source_url,
        "verified_on": entry.get("verified_on") or document.get("verified_on"),
        "status_verified": bool(source_url and isinstance(native, bool) and isinstance(invasive, bool)),
        "status_scope": SCOPE,
        "needs_confirmation": bool(warning), "needs_taxon_confirmation": bool(warning),
    }
    for field in EVIDENCE_FIELDS:
        if field in entry:
            status[field] = copy.deepcopy(entry[field])
    if warning:
        status["taxonomy_notes"] = warning
        # Do not claim that the more precise catalog taxon was identified.
        status["scientific_name"] = " ".join(word.capitalize() if i == 0 else word for i, word in enumerate(query_key.split()))
    if is_fisc:
        status.update({
            "fisc_category": entry["fisc_category"],
            "known_distribution_zones": entry.get("zones"),
        })
    if status.get("fisc_category"):
        status["distribution_note"] = "FISC zones describe known distribution, not potential range. The list is not regulatory."
    return status


def bundled_catalog():
    """A fresh, source-linked selection list; no provider calls are needed."""
    catalog, seen = [], set()
    for filename in CATALOGS:
        for entry in _species(filename):
            key = _normalize(entry["scientific_name"])
            if key in seen:
                continue
            seen.add(key)
            catalog.append({**copy.deepcopy(entry), **_status(entry, filename, key)})
    return sorted(catalog, key=lambda item: (item["common_name"].lower(), item["scientific_name"]))


def _lookup_status(scientific_name):
    key = _normalize(scientific_name)
    if not key:
        return _unknown()
    # Explicit nonnative taxa and FISC exemptions precede general list matches.
    for filename in CATALOGS:
        if entry := _find(filename, key):
            return _status(entry, filename, key)
    # Common names are accepted only when the local catalog resolves them
    # uniquely. The resolver never truncates an unknown variety or cultivar.
    from services.species_service import resolve
    canonical = resolve(scientific_name)
    if canonical and _normalize(canonical) != key:
        for filename in CATALOGS:
            if entry := _find(filename, _normalize(canonical)):
                return _status(entry, filename, _normalize(canonical))
    return _unknown("No Florida-specific status evidence is bundled for this exact taxon. National occurrence does not establish Florida nativity.")


def get_status(scientific_name, zip_code):
    if not supported_location(zip_code):
        return _unknown("Enter a ZIP in the bundled Florida county map. Some postal-only or recently created ZIPs are not represented; no local suitability is inferred.")
    return _lookup_status(scientific_name)


def plant_option(scientific_name, common_name, confidence, zip_code):
    """Compatibility shape for candidate/nearby cards with Florida-scoped facts.

    Empty ZIP is permitted only for this internal display helper. Nearby
    occurrence is never presented as proof of native status or suitability.
    """
    status = _lookup_status(scientific_name) if zip_code == "" else get_status(scientific_name, zip_code)
    key = "unknown"
    if status["status_verified"]:
        key = "invasive" if status["invasive"] else "native" if status["native"] else "non-native"
    name = status.get("common_name") or common_name or scientific_name or "Unidentified plant"
    return {
        **status, "plant_name": name[:1].upper() + name[1:],
        "scientific_name": status.get("scientific_name") or scientific_name,
        "confidence": confidence, "status": key, "status_label": STATUS_LABELS[key],
        "source_label": SOURCE_LABELS.get(status["source"]),
    }
