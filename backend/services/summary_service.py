from concurrent.futures import ThreadPoolExecutor

from services.fl_plants_service import plant_option

COUNT_KEYS = {"native": "native", "non-native": "non_native", "invasive": "invasive", "unknown": "unknown"}
KIND_KEYS = ("native", "non_native", "invasive")
LISTED_KEYS = ("plant_name", "scientific_name", "status", "status_label", "why", "source_label")


def _percent(part, whole):
    return round(100 * part / whole) if whole else None


def _lookup(plant):
    return plant_option(plant.get("scientific_name") or "", plant.get("plant_name") or "", 0.0, "")


def _kind_counts(kinds):
    counts = dict.fromkeys(KIND_KEYS, 0)
    for status in kinds.values():
        counts[status] += 1
    return counts


def with_plan(summary, added_natives=0, replaced_invasives=None, added_kinds=None, removed_kinds=None):
    counts = summary["counts"]
    replaced = counts["invasive"] if replaced_invasives is None else replaced_invasives
    natives_after = counts["native"] + replaced + added_natives

    kinds = summary["kind_status"]
    if removed_kinds is None:
        removed_kinds = [name for name, status in kinds.items() if status == "invasive"]
    if added_kinds is None:
        added_kinds = [f"new native {i}" for i in range(len(removed_kinds) + added_natives)]
    kinds_after = {name: status for name, status in kinds.items() if name not in set(removed_kinds)}
    kinds_after.update(dict.fromkeys(added_kinds, "native"))
    kinds_with_plan = _kind_counts(kinds_after)

    return {
        **summary,
        "percent_native_with_plan": _percent(natives_after, summary["known"] + added_natives),
        "counts_with_plan": {**counts, "native": natives_after, "invasive": counts["invasive"] - replaced},
        "kinds_with_plan": kinds_with_plan,
        "percent_native_kinds_with_plan": _percent(kinds_with_plan["native"], len(kinds_after)),
    }


def summarize(plants, added_natives=0, replaced_invasives=None):
    with ThreadPoolExecutor(max_workers=8) as pool:
        options = list(pool.map(_lookup, plants))
    counts = dict.fromkeys(COUNT_KEYS.values(), 0)
    kind_status = {}
    for option in options:
        key = COUNT_KEYS[option["status"]]
        counts[key] += 1
        if key != "unknown":
            kind_status[option["scientific_name"]] = key
    known = counts["native"] + counts["non_native"] + counts["invasive"]
    kinds = _kind_counts(kind_status)
    base = {
        "counts": counts,
        "known": known,
        "plant_count": len(plants),
        "percent_native": _percent(counts["native"], known),
        "kind_status": kind_status,
        "kinds": kinds,
        "percent_native_kinds": _percent(kinds["native"], len(kind_status)),
        "plants": [{key: option[key] for key in LISTED_KEYS} for option in options],
    }
    return with_plan(base, added_natives, replaced_invasives)
