"""Describe a surveyed species mix without treating it as measured biodiversity."""

from services.fl_plants_service import get_status

METRIC_VERSION = "verified-native-share-v1"
LIMITATIONS = [
    "Taxa means species and any separately documented varieties or subspecies whose Florida statuses differ; synonymous names are counted once.",
    "Native share describes verified unique taxa in this sample, not the whole campus's biodiversity, plant abundance, area covered, or wildlife populations.",
    "Repeated photographs and additional individuals of an already recorded taxon do not change this species-presence metric.",
    "Unresolved observations remain outside the denominator. Identification confirmation is separate from the evidence for a taxon's Florida status.",
    "Projected removals mean that taxon is no longer present in the surveyed area; removing only one of several individuals does not remove a species from this metric.",
]


def _label(status):
    if status.get("invasive") is True:
        return "invasive"
    if status.get("native") is True:
        return "native"
    if status.get("native") is False:
        return "non-native"
    return "unknown"


def _verified(status):
    return status.get("status_verified") is True and _label(status) != "unknown"


def _species_record(status, observation=None):
    observation = observation or {}
    scientific_name = status.get("scientific_name") or observation.get("scientific_name") or ""
    return {
        "scientific_name": scientific_name,
        "plant_name": status.get("common_name") or observation.get("plant_name") or scientific_name,
        "taxon_id": status.get("taxon_id") or scientific_name.casefold(),
        "invasive_status": _label(status),
        "source": status.get("source", "unknown"),
        "source_url": status.get("source_url"),
        "verified_on": status.get("verified_on"),
        "status_scope": status.get("status_scope"),
        "observation_count": 0,
    }


def _metrics(species, unresolved, observation_count):
    ordered = sorted(species, key=lambda plant: plant["scientific_name"].casefold())
    counts = {label: sum(plant["invasive_status"] == label for plant in ordered)
              for label in ("native", "non-native", "invasive")}
    count = len(ordered)
    share = round(100 * counts["native"] / count, 1) if count else None
    summary = (
        f"{counts['native']} of {count} verified unique taxa in the sample are native to Florida ({share:g}%)."
        if count else "No observations yet have both a resolved identification and verified Florida status."
    )
    if unresolved:
        summary += f" {len(unresolved)} observation(s) still need identification or status review."
    return {
        "metric_version": METRIC_VERSION,
        "native_count": counts["native"],
        "non_native_count": counts["non-native"],
        "invasive_count": counts["invasive"],
        "verified_species_count": count,
        "unresolved_count": len(unresolved),
        "observation_count": observation_count,
        "native_share": share,
        "species": ordered,
        "unresolved": unresolved,
        "summary": summary,
        "limitations": list(LIMITATIONS),
    }


def calculate_biodiversity_score(plants, location="33431", additions=None, removals=None):
    """Recheck source records, deduplicate canonical taxa, and apply explicit changes.

    The historical callable name is retained for route compatibility; no biodiversity
    score, bonus, or quality rating is produced. Nonnative and invasive counts are
    disjoint categories, and unresolved_count counts observations rather than taxa.
    """
    statuses = {}

    def resolve(name):
        key = str(name or "").strip().casefold()
        if key not in statuses:
            statuses[key] = get_status(name, location)
        return statuses[key]

    unique, unresolved = {}, []
    for index, plant in enumerate(plants):
        name = str(plant.get("scientific_name") or "").strip()
        status = resolve(name)
        reason = None
        if not name:
            reason = "No species has been identified."
        elif status.get("needs_taxon_confirmation"):
            reason = "This taxon includes varieties with different Florida statuses; select the precise variety."
        elif not (plant.get("user_confirmed") is True or plant.get("needs_confirmation") is False):
            reason = "Identification needs confirmation before this observation can enter the species metric."
        elif not _verified(status):
            reason = "Florida status has not yet been verified for this taxon."
        if reason:
            unresolved.append({
                "scientific_name": name,
                "plant_name": plant.get("plant_name") or plant.get("name") or name or "Unidentified plant",
                "reason": reason,
                "observation_index": index,
            })
            continue
        record = _species_record(status, plant)
        existing = unique.setdefault(record["taxon_id"], record)
        existing["observation_count"] += 1

    result = _metrics(list(unique.values()), unresolved, len(plants))
    projected = {key: dict(value) for key, value in unique.items()}
    added, removed = [], []
    removed_ids = set()
    for name in removals or []:
        status = resolve(name)
        record = _species_record(status, {"scientific_name": name})
        key = record["taxon_id"]
        if key not in unique:
            raise ValueError(f"Cannot project removal of {name}: it is not a verified taxon in this survey.")
        if key not in removed_ids:
            removed.append(projected.pop(key))
            removed_ids.add(key)
    for name in additions or []:
        status = resolve(name)
        if not _verified(status) or status.get("native") is not True or status.get("needs_taxon_confirmation"):
            raise ValueError(f"Cannot project {name}: choose a precisely identified, verified Florida native.")
        record = _species_record(status, {"scientific_name": name})
        key = record["taxon_id"]
        if key in removed_ids:
            raise ValueError("The same taxon cannot be both added and removed in a projection.")
        if key not in projected:
            record["observation_count"] = 1
            projected[key] = record
            added.append(record)
    projected_observations = len(plants) - sum(item["observation_count"] for item in removed) + len(added)
    result["projected"] = {
        **_metrics(list(projected.values()), unresolved, projected_observations),
        "added_species": added,
        "removed_species": removed,
        "is_projection": True,
    }
    return result
