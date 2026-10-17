def _name_hash(name):
    h = 0
    for ch in name:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return (h % 1000) / 1000.0


def _plant_score(status, support, name):
    t = _name_hash(name)
    if status == "native":
        if support == "high":
            lo, hi = 88, 95
        elif support == "medium":
            lo, hi = 70, 80
        else:
            lo, hi = 50, 62
    elif status == "invasive":
        lo, hi = 0, 12
    else:  # non-native
        lo, hi = 25, 35
    return lo + t * (hi - lo)


def _action_boost(index):
    t = _name_hash(f"action_{index}")
    return round(5 + t * 3)  # 5–8 per action, 15–24 total for 3 actions


def calculate_biodiversity_score(plants):
    if not plants:
        return {
            "score": 0, "projected_score": 0,
            "breakdown": {"native": [], "non_native": [], "invasive": [], "unknown": []},
            "insight": "No plants scanned.",
            "bonuses_applied": [],
            "plant_count": 0,
        }

    native, non_native, invasive, unidentified = [], [], [], []
    scores = []
    native_names = set()
    invasive_count = 0
    unknown_count = 0

    for plant in plants:
        raw_status = plant.get("status", "").lower().strip()
        support    = plant.get("wildlife_support", "low").lower().strip()
        name       = plant.get("name", plant.get("plant_name", "Unknown plant"))

        if raw_status not in ("native", "non-native", "invasive"):
            raw_status = "unknown"
        if support not in ("high", "medium", "low"):
            support = "low"

        if raw_status == "unknown":
            scores.append(15)
            unknown_count += 1
            unidentified.append(name)
            continue

        s = _plant_score(raw_status, support, name)
        scores.append(s)

        if raw_status == "native":
            native_names.add(name)
            native.append(name)
        elif raw_status == "invasive":
            invasive_count += 1
            invasive.append(name)
        else:
            non_native.append(name)

    n = len(plants)
    native_count = sum(
        1 for p in plants
        if p.get("status", "").lower().strip() == "native"
    )
    native_ratio = native_count / n

    base_score = sum(scores) / n

    # ── Bonuses / penalties ──────────────────────────────────────────────────
    bonus = 0.0
    bonuses_applied = []

    if native_ratio > 0.60:
        bonus += 5
        bonuses_applied.append("Native ratio bonus: +5 pts")

    if len(native_names) >= 5:
        bonus += 3
        bonuses_applied.append("Native diversity bonus: +3 pts")

    if invasive_count > 0:
        penalty = invasive_count * 3
        bonus -= penalty
        label = "invasive plant" if invasive_count == 1 else "invasive plants"
        bonuses_applied.append(f"{invasive_count} {label}: -{penalty} pts")

    if unknown_count > 0:
        bonus -= unknown_count
        label = "unknown plant" if unknown_count == 1 else "unknown plants"
        bonuses_applied.append(f"{unknown_count} {label}: -{unknown_count} pts")

    score = max(0, min(100, round(base_score + bonus)))

    # ── Projected score ───────────────────────────────────────────────────────
    # Each of the 3 recommended actions adds 10–14 pts, seeded by index
    projected_score = min(100, score + sum(_action_boost(i) for i in range(3)))

    # ── Insight ──────────────────────────────────────────────────────────────
    if score >= 80:
        insight = "Outstanding — your schoolyard is a genuine ecosystem asset."
    elif score >= 65:
        insight = "Good biodiversity. A few targeted native plantings could make it exceptional."
    elif score >= 45:
        if invasive_count > 0:
            insight = "Moderate biodiversity. Removing invasive species and replacing with natives would help significantly."
        else:
            insight = "Moderate biodiversity. Adding more native species would boost your score and support local wildlife."
    elif score >= 25:
        if invasive_count > 0:
            insight = "Low biodiversity. Prioritise removing invasive plants and replanting with natives."
        else:
            insight = "Low biodiversity. Focus on adding high-impact native species to your schoolyard."
    else:
        if invasive_count > 0:
            insight = "Critical — invasive species are dominating. Targeted removal and replanting is urgent."
        else:
            insight = "Critical low biodiversity. Introduce native plants urgently to restore habitat value."

    return {
        "score":           score,
        "projected_score": projected_score,
        "breakdown":       {"native": native, "non_native": non_native, "invasive": invasive, "unknown": unidentified},
        "insight":         insight,
        "bonuses_applied": bonuses_applied,
        "plant_count":     n,
    }
