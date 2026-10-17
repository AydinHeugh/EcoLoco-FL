from services.fl_plants_service import plant_option

COUNT_KEYS = {"native": "native", "non-native": "non_native", "invasive": "invasive", "unknown": "unknown"}


def _percent(part, whole):
    return round(100 * part / whole) if whole else None


def summarize(plants, added_natives=0):
    listed = []
    counts = dict.fromkeys(COUNT_KEYS.values(), 0)
    for plant in plants:
        option = plant_option(plant.get("scientific_name") or "", plant.get("plant_name") or "", 0.0, "")
        counts[COUNT_KEYS[option["status"]]] += 1
        listed.append({key: option[key] for key in ("plant_name", "scientific_name", "status", "status_label", "why", "source_label")})

    known = counts["native"] + counts["non_native"] + counts["invasive"]
    with_plan = counts["native"] + counts["invasive"] + added_natives
    return {
        "counts": counts,
        "known": known,
        "plant_count": len(plants),
        "percent_native": _percent(counts["native"], known),
        "percent_native_with_plan": _percent(with_plan, known + added_natives),
        "counts_with_plan": {**counts, "native": with_plan, "invasive": 0},
        "plants": listed,
    }
