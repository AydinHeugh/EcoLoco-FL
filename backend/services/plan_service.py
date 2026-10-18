"""Prioritize sourced planting options without applying unselected changes."""
import json
from functools import cache
from pathlib import Path

from services.fl_plants_service import get_status
from services.location_service import plantings_checked
from services.score_service import calculate_biodiversity_score
from services.summary_service import from_metrics

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MAX_ADDS = 5
EFFORT_ORDER = {"easy": 0, "medium": 1, "big": 2}
GENERIC_SAFETY = {"text": "Ask school grounds staff and a qualified local adviser to review identification and safe management before any removal.", "source": None}
GAP_WORDS = {
    "important_wildlife_plant": "a native plant group in the regional NWF list",
    "caterpillar_food": "a documented caterpillar food plant",
    "fruit": "a documented source of fruit for wildlife",
    "bloom_months": "documented flowering in additional months",
}
RANKING_BASIS = "Planning order considers suggested replacements, relationships not yet documented in the verified inventory, effort, and a mix of plant sizes. It is not a measured wildlife-benefit score."


@cache
def _nwf_document():
    return json.loads((DATA_DIR / "nwf_keystone_fl.json").read_text(encoding="utf-8"))


def _nwf():
    return {item["genus"]: item for item in _nwf_document()["genera"]}


def _nwf_fact(name):
    genus = name.split()[0] if name else ""
    item = _nwf().get(genus)
    if not item:
        return None
    return {**item, "source": _nwf_document()["source"],
            "scope": "Counts cover the whole plant genus in NWF Ecoregion 15, not one species or this campus; do not add these counts together."}


def _gaps(audit, location):
    # Missing documentation is not evidence that a relationship is absent on campus.
    records = [get_status(plant["scientific_name"], location) for plant in audit["species"]
               if plant["invasive_status"] == "native"]
    genera = {record.get("scientific_name", "").split()[0] for record in records if record.get("scientific_name")}
    offers = {offer for record in records for offer in record.get("offers", [])}
    gaps = set()
    if not genera & _nwf().keys():
        gaps.add("important_wildlife_plant")
    if "caterpillar food" not in offers and not genera & _nwf().keys():
        gaps.add("caterpillar_food")
    if "fruit" not in offers:
        gaps.add("fruit")
    bloom_known = [record["bloom_months"] for record in records if record.get("bloom_months")]
    missing = set(range(1, 13)) - {month for months in bloom_known for month in months}
    if bloom_known and missing:
        gaps.add("bloom_months")
    return gaps, missing


def _fills(rec, gaps, missing):
    genus = rec["scientific_name"].split()[0]
    checks = {
        "important_wildlife_plant": genus in _nwf(),
        "caterpillar_food": genus in _nwf() or "caterpillar food" in rec.get("offers", []),
        "fruit": "fruit" in rec.get("offers", []),
        "bloom_months": bool(missing & set(rec.get("bloom_months", []))),
    }
    return [key for key in sorted(gaps) if checks[key]]


def rank_recommendations(recommendations, audit, location):
    gaps, missing = _gaps(audit, location)
    invasives = {plant["taxon_id"]: plant for plant in audit["species"] if plant["invasive_status"] == "invasive"}
    choices = []
    for rec in recommendations:
        matches = [invasives[status["taxon_id"]] for pair in rec.get("replaces", [])
                   if (status := get_status(pair.get("scientific_name"), location)).get("taxon_id") in invasives]
        fills = _fills(rec, gaps, missing)
        reason = (f"A suggested alternative to {matches[0]['plant_name']}; confirm the same site is suitable."
                  if matches else f"Adds {GAP_WORDS[fills[0]]}, not yet documented in this inventory."
                  if fills else "Another sourced native option for the recorded site conditions.")
        card = {**rec, "reason": reason, "ranking_basis": RANKING_BASIS,
                "common_name": rec["plant_name"], "fills_documentation_gaps": fills}
        if fact := _nwf_fact(rec["scientific_name"]):
            card["nwf"] = fact
        priority = (-len(matches), -len(fills), EFFORT_ORDER.get(rec.get("effort"), 3), rec["plant_name"].casefold())
        choices.append((priority, card))
    ranked = [card for _, card in sorted(choices, key=lambda pair: pair[0])]
    # A short first view can include varied plant forms while retaining all options.
    first = []
    while ranked and len(first) < 3:
        candidate = next((rec for rec in ranked if not (rec.get("plant_type") == "tree" and any(item.get("plant_type") == "tree" for item in first))
                          and not (len(first) == 2 and not any(item.get("effort") == "easy" for item in first)
                                   and any(item.get("effort") == "easy" for item in ranked) and rec.get("effort") != "easy")), ranked[0])
        first.append(candidate)
        ranked.remove(candidate)
    return first + ranked


def build_plan(plants, location="33431", *, site=None, additions=None, removals=None):
    from services.ai_service import get_plant_recommendations

    choices = get_plant_recommendations(location, plants=plants, site=site)
    available = {item["taxon_id"] for item in get_plant_recommendations(location, site=site)}
    for name in additions or []:
        if get_status(name, location).get("taxon_id") not in available:
            raise ValueError(f"{name} is not a verified native planting option for the supplied site conditions.")
    metrics = calculate_biodiversity_score(plants, location, additions=additions, removals=removals)
    management = []
    for plant in metrics["species"]:
        if plant["invasive_status"] != "invasive":
            continue
        status = get_status(plant["scientific_name"], location)
        management.append({**plant, "why": status.get("why"), "removal_safety": status.get("removal_safety") or GENERIC_SAFETY,
                           "action": "Request a management review; this plan does not authorize removal.",
                           "selected": plant["taxon_id"] in {item["taxon_id"] for item in metrics["projected"]["removed_species"]}})
    gaps, _ = _gaps(metrics, location)
    return {"remove": management, "management_review": management, "add": choices[:MAX_ADDS],
            "selected_additions": metrics["projected"]["added_species"], "selected_removals": metrics["projected"]["removed_species"],
            "gaps": sorted(gaps), "gap_note": "Relationships not yet documented in this verified inventory; not measured absences on campus.",
            "summary": from_metrics(metrics), "plantings_checked": plantings_checked(location), "ranking_basis": RANKING_BASIS}
