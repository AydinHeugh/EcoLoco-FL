import json
import logging
from functools import cache

from services import usda_service
from services.species_service import DATA_DIR, resolve, common_name as species_common_name

log = logging.getLogger(__name__)


def _unknown():
    return {"native": None, "invasive": None, "source": "unknown", "why": None}


@cache
def _species(filename):
    return json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))["species"]


@cache
def _by_name(filename):
    return {entry["scientific_name"]: entry for entry in _species(filename)}


def get_status(scientific_name, zip_code):
    # zip_code is unused until there are regional lists; both lists cover South Florida.
    if not scientific_name or not str(scientific_name).strip():
        return _unknown()
    canonical = resolve(scientific_name)
    if entry := _by_name("fisc_list.json").get(canonical):
        return {"native": False, "invasive": True, "source": "FISC", "why": entry["why"]}
    if entry := _by_name("fl_natives.json").get(canonical):
        return {"native": True, "invasive": False, "source": "fl_natives", "why": entry["why"]}
    try:
        florida = usda_service.florida_status(scientific_name)
    except Exception as err:
        log.warning("USDA PLANTS lookup failed (%s)", type(err).__name__)
        return _unknown()
    if florida is None:
        return _unknown()
    return {"native": florida == "native", "invasive": False, "source": "USDA", "why": None}


STATUS_LABELS = {
    "native": "Native",
    "non-native": "Non-native",
    "invasive": "Invasive",
    "unknown": "Unknown: not on Florida lists",
}
SOURCE_LABELS = {
    "FISC": "Florida Invasive Species Council 2026 list",
    "fl_natives": "EcoLoco South Florida native list",
    "USDA": "USDA PLANTS database",
}
NON_NATIVE_WHY = "Not from Florida, and not on Florida's invasive list."


def _status_key(status):
    if status["source"] == "unknown":
        return "unknown"
    if status["invasive"]:
        return "invasive"
    return "native" if status["native"] else "non-native"


def plant_option(scientific_name, common_name, confidence, zip_code):
    canonical = resolve(scientific_name) or scientific_name
    status = get_status(canonical, zip_code)
    key = _status_key(status)
    why = status["why"]
    if key == "non-native" and not why:
        why = NON_NATIVE_WHY
    name = species_common_name(canonical) or common_name or canonical
    option = {
        "plant_name": name[:1].upper() + name[1:],
        "scientific_name": canonical,
        "confidence": confidence,
        "status": key,
        "status_label": STATUS_LABELS[key],
        "source": status["source"],
        "source_label": SOURCE_LABELS.get(status["source"]),
        "why": why,
    }
    facts = _by_name("fl_recommendations.json").get(canonical, {})
    for key in ("helps", "watch_out"):
        if key in facts:
            option[key] = facts[key]
    if safety := _by_name("fisc_list.json").get(canonical, {}).get("removal_safety"):
        option["removal_safety"] = safety
    return option
