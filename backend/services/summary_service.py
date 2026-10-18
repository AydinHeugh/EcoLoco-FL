from concurrent.futures import ThreadPoolExecutor

from services.fl_plants_service import plant_option

COUNT_KEYS = {"native": "native", "non-native": "non_native", "invasive": "invasive", "unknown": "unknown"}
LISTED_KEYS = ("plant_name", "scientific_name", "status", "status_label", "why", "source_label")


def _percent(part, whole):
    return round(100 * part / whole) if whole else None


def _lookup(plant):
    return plant_option(plant.get("scientific_name") or "", plant.get("plant_name") or "", 0.0, "")


def with_plan(summary, added_natives=0, replaced_invasives=None):
    counts = summary["counts"]
    replaced = counts["invasive"] if replaced_invasives is None else replaced_invasives
    natives_after = counts["native"] + replaced + added_natives
    return {
        **summary,
        "percent_native_with_plan": _percent(natives_after, summary["known"] + added_natives),
        "counts_with_plan": {**counts, "native": natives_after, "invasive": counts["invasive"] - replaced},
    }


def summarize(plants, added_natives=0, replaced_invasives=None):
    with ThreadPoolExecutor(max_workers=8) as pool:
        options = list(pool.map(_lookup, plants))
    counts = dict.fromkeys(COUNT_KEYS.values(), 0)
    for option in options:
        counts[COUNT_KEYS[option["status"]]] += 1
    known = counts["native"] + counts["non_native"] + counts["invasive"]
    base = {
        "counts": counts,
        "known": known,
        "plant_count": len(plants),
        "percent_native": _percent(counts["native"], known),
        "plants": [{key: option[key] for key in LISTED_KEYS} for option in options],
    }
    return with_plan(base, added_natives, replaced_invasives)
