import json
import re
from collections import Counter
from functools import cache

from services.species_service import DATA_DIR, resolve
from services.summary_service import summarize, with_plan

MAX_ADDS = 5
EFFORT_ORDER = {"easy": 0, "medium": 1, "big": 2}
GENERIC_SAFETY = {"text": "Ask your grounds crew how to remove it safely.", "source": None}
GAP_WORDS = {
    "important_wildlife_plant": "none of the most important plants for wildlife here",
    "caterpillar_food": "no plants caterpillars eat yet",
    "fruit": "no plants with fruit for birds yet",
    "bloom_months": "months with nothing blooming",
}


def _load(name):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def _recommendations():
    return _load("fl_recommendations.json")["species"]


def _all_entries():
    return _load("fl_recommendations.json")["species"]


@cache
def _fisc_by_name():
    return {e["scientific_name"]: e for e in _load("fisc_list.json")["species"]}


@cache
def _nwf():
    return {g["genus"]: g for g in _load("nwf_keystone_fl.json")["genera"]}


SITE_OPTIONS = {
    "light": ("full", "part", "shade"),
    "moisture": ("dry", "average", "wet"),
    "space": ("small", "medium", "large"),
    "care": ("low", "moderate"),
}
SPACE_ORDER = {"small": 0, "medium": 1, "large": 2}


def light_of(rec):
    sun = rec["sun"].lower()
    light = []
    if "full sun" in sun:
        light.append("full")
    if any(word in sun for word in ("light shade", "part shade", "part sun", "light to moderate shade")):
        light.append("part")
    if any(word in sun for word in ("moderate shade", "full shade", "deep shade")):
        light.append("shade")
    return light


def space_of(rec):
    if rec["plant_type"] == "tree":
        return "large"
    sizes = re.findall(r"(\d+)\s*(?:to\s*(\d+)\s*)?(feet|foot|inches)", rec["mature_size"])
    tallest = max((int(high or low) / (12 if unit == "inches" else 1) for low, high, unit in sizes), default=None)
    if tallest is None:
        return None
    return "small" if tallest <= 3 else "medium"


def checked_value(rec, field):
    entry = rec.get(field)
    return entry["value"] if isinstance(entry, dict) and entry.get("verified") is True else None


def clean_site(site):
    site = site if isinstance(site, dict) else {}
    return {key: site.get(key) if site.get(key) in options else "unknown" for key, options in SITE_OPTIONS.items()}


def fits_site(rec, site):
    if site["light"] != "unknown" and light_of(rec) and site["light"] not in light_of(rec):
        return False
    space = space_of(rec)
    if site["space"] != "unknown" and space and SPACE_ORDER[space] > SPACE_ORDER[site["space"]]:
        return False
    moisture = checked_value(rec, "moisture")
    if site["moisture"] != "unknown" and moisture and site["moisture"] not in moisture:
        return False
    care = checked_value(rec, "care")
    if site["care"] == "low" and care and care != "low":
        return False
    return True


def _percent(part, whole):
    return round(100 * part / whole) if whole else None


def _gaps(scanned):
    nwf = _nwf()
    genera = {s["scientific_name"].split()[0] for s in scanned if s["scientific_name"]}
    offers = {o for s in scanned for o in s.get("offers", [])}
    gaps = set()
    if not genera & nwf.keys():
        gaps.add("important_wildlife_plant")
        if "caterpillar food" not in offers:
            gaps.add("caterpillar_food")
    if "fruit" not in offers:
        gaps.add("fruit")
    bloom_known = [s["bloom_months"] for s in scanned if s.get("bloom_months")]
    missing = set(range(1, 13)) - {m for months in bloom_known for m in months}
    if bloom_known and missing:
        gaps.add("bloom_months")
    return gaps, missing


def _fills(rec, gaps, missing):
    in_nwf = rec["genus"] in _nwf()
    checks = {
        "important_wildlife_plant": in_nwf,
        "caterpillar_food": in_nwf or "caterpillar food" in rec.get("offers", []),
        "fruit": "fruit" in rec.get("offers", []),
        "bloom_months": bool(missing & set(rec.get("bloom_months", []))),
    }
    return [g for g in sorted(gaps) if checks[g]]


def _rank_key(rec, gaps, missing, invasives):
    replaces = any(resolve(r["scientific_name"]) in invasives for r in rec.get("replaces", []))
    score = len(_fills(rec, gaps, missing)) + 2 * replaces + 0.5 * (rec["genus"] in _nwf())
    return (-score, EFFORT_ORDER[rec["effort"]], rec["common_name"])


def _allowed(rec, chosen):
    first = chosen[:3]
    if len(chosen) < 3 and rec["plant_type"] == "tree" and any(c["plant_type"] == "tree" for c in first):
        return False
    if len(chosen) == 2 and rec["effort"] != "easy" and not any(c["effort"] == "easy" for c in first):
        return False
    return True


def _nwf_count(scientific_name):
    group = _nwf().get(scientific_name.split()[0]) if scientific_name else None
    return {"group": group["group"], "caterpillar_species": group["caterpillar_species"]} if group else None


def _nwf_effect(rec):
    group = _nwf().get(rec["genus"])
    if group:
        return f"{group['group'][0].upper()}{group['group'][1:]} feed {group['caterpillar_species']} kinds of caterpillars here."
    return None


def build_plan(plants, plantings_checked=True, skip=(), site=None, show_all=False, letter_extras=()):
    skip = set(skip)
    site = clean_site(site)
    base = summarize(plants)
    by_name = {rec["scientific_name"]: rec for rec in _all_entries()}
    scanned = [dict(by_name.get(p["scientific_name"], {}), scientific_name=p["scientific_name"])
               for p in base["plants"] if p["status"] != "invasive"]
    gaps, missing = _gaps(scanned)

    invasives, scans = {}, Counter()
    for p in base["plants"]:
        if p["status"] == "invasive":
            invasives.setdefault(p["scientific_name"], p)
            scans[p["scientific_name"]] += 1

    verified = [rec for rec in _recommendations() if rec.get("verified") is True] if plantings_checked else []
    recs = [rec for rec in verified if fits_site(rec, site)]
    ranked = sorted(recs, key=lambda r: _rank_key(r, gaps, missing, invasives.keys()))
    known, native = base["known"], base["counts"]["native"]

    chosen, remove, replaced, removed_kinds = [], [], 0, []
    for name, invasive in invasives.items():
        used = {c["scientific_name"] for c in chosen}
        matches = [r for r in ranked if r["scientific_name"] not in used
                   and any(resolve(x["scientific_name"]) == name for x in r.get("replaces", []))]
        pick = next((r for r in matches if _allowed(r, chosen)), matches[0] if matches else None)
        if pick is None:
            pick = next((r for r in ranked if r["scientific_name"] not in used and _allowed(r, chosen)), None)
        if pick is not None:
            chosen.append(dict(pick, reason=f"replaces {invasive['plant_name']}", effect=_nwf_effect(pick)))
        remove.append({
            "plant_name": invasive["plant_name"],
            "scientific_name": name,
            "why": invasive["why"],
            "source_label": invasive["source_label"],
            "removal_safety": _fisc_by_name().get(name, {}).get("removal_safety", GENERIC_SAFETY),
            "replacement": pick["scientific_name"] if pick else None,
        })
        if pick is not None and pick["scientific_name"] not in skip:
            replaced += scans[name]
            removed_kinds.append(name)
            remove[-1]["effect"] = (f"Replacing it takes you from {_percent(native, known)}% "
                                    f"to {_percent(native + scans[name], known)}% native.")
        if nwf := _nwf_count(name):
            remove[-1]["nwf"] = nwf

    fillers, more = 0, set()
    for rec in ranked + ranked:
        if any(c["scientific_name"] == rec["scientific_name"] for c in chosen) or not _allowed(rec, chosen):
            continue
        extra = len(chosen) >= MAX_ADDS
        if extra and not show_all:
            more.add(rec["scientific_name"])
            continue
        fills = _fills(rec, gaps, missing)
        reason = f"fills a gap: {GAP_WORDS[fills[0]]}" if fills else "another good native for your campus"
        before, after = _percent(native, known), _percent(native + 1, known + 1)
        effect = _nwf_effect(rec) or (f"Adding it takes you from {before}% to {after}% native." if before is not None else None)
        chosen.append(dict(rec, reason=reason, effect=effect, extra=extra))
        if extra and rec["scientific_name"] not in letter_extras:
            skip.add(rec["scientific_name"])
        fillers += rec["scientific_name"] not in skip

    add = []
    added_kinds = [c["scientific_name"] for c in chosen if c["scientific_name"] not in skip]
    for rec in chosen:
        card = dict(rec, where=f"{rec['sun']}. {rec['mature_size']}.", in_letter=rec["scientific_name"] not in skip)
        card.setdefault("extra", False)
        if nwf := _nwf_count(rec["scientific_name"]):
            card["nwf"] = nwf
        if card["effect"] is None:
            del card["effect"]
        add.append(card)

    summary = with_plan(base, fillers, replaced, added_kinds, removed_kinds)
    return {"remove": remove, "add": add, "gaps": sorted(gaps), "summary": summary,
            "why_this_matters": _load("why_this_matters.json")["lines"], "plantings_checked": plantings_checked,
            "site": site, "hidden_by_site": len(verified) - len(recs), "more_available": len(more)}
