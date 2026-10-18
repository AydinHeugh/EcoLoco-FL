"""Join plant identification to source-backed facts and practical campus plans."""

from services import openai_client
from services.fl_plants_service import _normalize, bundled_catalog, bundled_natives, get_status
from services.identification_service import identify_species
from services.location_service import in_south_florida
from services.plan_service import rank_recommendations
from services.score_service import calculate_biodiversity_score

STATUSES = ("native", "non-native", "invasive")
SUPPORT_LEVELS = ("documented", "high", "medium", "low")
ENDANGERED = ("not_threatened", "threatened", "endangered", "critically_endangered", "unknown")
SITE_OPTIONS = {
    "sun": ("full", "part", "shade", "unknown"),
    "moisture": ("dry", "average", "wet", "unknown"),
    "space": ("small", "medium", "large", "unknown"),
    "maintenance": ("low", "moderate", "unknown"),
}
SPACE_ORDER = {"small": 0, "medium": 1, "large": 2}
SCOPE_NOTE = "This pilot uses Florida status records and South Florida planting guidance; a ZIP code alone does not establish suitability at a particular site."
PLANT_FACT_FIELDS = ("atlas_url", "atlas_verified", "atlas_checked_on", "sun_description", "helps", "buying", "watch_out", "growing_source", "mature_size",
                     "plant_type", "effort", "offers", "bloom_months", "replaces", "look_into", "removal_safety")


def _plant_facts(record):
    return {key: record[key] for key in PLANT_FACT_FIELDS if key in record}

ASSESS_PROMPT = """The proposed identification is {common_name} ({scientific_name}) near US ZIP {location}.
{status_line}
Describe one possible wildlife relationship, but do not claim it has been observed at this site.
If the Florida status is not verified, you may suggest native/non-native/invasive status as a
hypothesis only. Do not recommend removal, pesticides, or planting based on that hypothesis.
Return JSON: {{"wildlife_support": "high/medium/low/unknown", "wildlife_support_reason": "...",
"invasive_status": "native/non-native/invasive/unknown"}}"""


def _status_label(status):
    if status.get("invasive") is True:
        return "invasive"
    if status.get("native") is True:
        return "native"
    if status.get("native") is False:
        return "non-native"
    return "unknown"


def _pick(value, allowed, default):
    value = str(value or "").strip().lower()
    return value if value in allowed else default


def _invasive_actions(location, needs_confirmation=False):
    if needs_confirmation:
        return [{
            "action": "Confirm the identification and any relevant variety before deciding how to manage this plant.",
            "impact": "The proposed taxon is listed as invasive, but this photograph alone does not establish a removal target.",
        }]
    return [
        {
            "action": "Do not plant or propagate this species",
            "impact": "The verified taxon is listed by Florida sources as invasive; avoid spreading it while the site is reviewed.",
        },
        {
            "action": "Ask school grounds staff and a qualified local adviser to review identification and management options before any removal.",
            "impact": "A reviewed plan can account for safe handling, disposal, permissions, and suitable native replacements.",
        },
    ]


def assess_plant(species, status, location):
    status_line = (
        f"Florida records ({status['source']}) list this taxon as {_status_label(status)}; this verifies the taxon's status, not the photo identification."
        if status.get("status_verified") else "The Florida status has not been verified."
    )
    assessment = openai_client.chat(ASSESS_PROMPT.format(
        common_name=species.get("common_name") or "unknown",
        scientific_name=species.get("scientific_name") or "unknown",
        location=location,
        status_line=status_line,
    ), json_reply=True)
    if not isinstance(assessment, dict):
        raise openai_client.AIUnavailable("unexpected reply shape")
    return assessment


def _taxon_candidates(status, existing):
    """Append catalog alternatives without replacing or reordering photo matches."""
    existing = [entry for entry in existing if isinstance(entry, dict) and _normalize(entry.get("scientific_name"))] if isinstance(existing, list) else []
    if not status.get("needs_taxon_confirmation"):
        return existing
    base = " ".join(str(status.get("scientific_name") or "").casefold().split()[:2])
    existing_names = {_normalize(entry["scientific_name"]) for entry in existing}
    precise = [
        {
            "scientific_name": entry["scientific_name"],
            "common_name": entry.get("common_name", ""),
            "confidence": None,
            "source": "catalog",
            "status_verified": entry.get("status_verified", False),
            "invasive_status": _status_label(entry),
            "confirmation_note": "A documented taxonomic alternative, not a photo prediction. Select only if the distinguishing features or an expert support it.",
        }
        for entry in bundled_catalog()
        if entry["scientific_name"].casefold().startswith(base + " ")
        and not entry.get("needs_taxon_confirmation")
        and _normalize(entry["scientific_name"]) not in existing_names
    ]
    return existing + precise


def _plant_result(species, status, *, user_confirmed=False, assessment=None, ai_unavailable=False):
    assessment = assessment or {}
    verified = status.get("status_verified") is True
    label = _status_label(status) if verified else "unknown"
    taxon_confirmation = status.get("needs_taxon_confirmation", False)
    needs_confirmation = bool(taxon_confirmation or (species.get("needs_confirmation", True) and not user_confirmed))
    scientific_name = status.get("scientific_name") or species.get("scientific_name") or ""
    original_candidates = species.get("candidates", [])
    candidates = _taxon_candidates(status, original_candidates)
    suggested = 0
    requested = species.get("suggested", 0)
    # Suggestions reference [top, *provider candidates]. Catalog additions and
    # filtering must never move that suggestion onto an unscored alternative.
    if (isinstance(requested, int) and not isinstance(requested, bool)
            and isinstance(original_candidates, list) and 0 < requested <= len(original_candidates)):
        original = original_candidates[requested - 1]
        target = _normalize(original.get("scientific_name")) if isinstance(original, dict) else ""
        if target:
            suggested = next((index for index, candidate in enumerate(candidates, 1)
                              if _normalize(candidate["scientific_name"]) == target), 0)
    support = _pick(status.get("wildlife_support"), SUPPORT_LEVELS, "unknown")
    why = status.get("why") or ""
    support_reason = why if support != "unknown" else ""
    if label == "invasive":
        actions = _invasive_actions(None, needs_confirmation)
    elif needs_confirmation:
        actions = [{
            "action": "Compare the candidate names and diagnostic features, or take a clearer photo before confirming.",
            "impact": "Confirmation records your identification choice; the linked source separately establishes Florida status.",
        }]
    elif label == "native":
        actions = [{
            "action": "Record this plant in the campus survey and check its documented site requirements before planting more.",
            "impact": why or "A verified inventory can support a reviewed planting and maintenance plan.",
        }]
    else:
        actions = [{
            "action": "Keep the observation and review Florida sources or ask a local plant expert if more evidence is needed.",
            "impact": "Nonnative does not by itself mean invasive, and an unverified status is not a reason to remove a plant.",
        }]
    return {
        **_plant_facts(status),
        "plant_name": status.get("common_name") or species.get("common_name") or scientific_name or "Unidentified plant",
        "scientific_name": scientific_name,
        "taxon_id": status.get("taxon_id"),
        "is_native": status.get("native") if verified else None,
        "invasive_status": label,
        "status_verified": verified,
        "status_scope": status.get("status_scope", "Florida"),
        "source": status.get("source", "unknown"),
        "source_url": status.get("source_url"),
        "verified_on": status.get("verified_on"),
        "why": why,
        "why_source_url": status.get("why_source_url"),
        "wildlife_support": support,
        "wildlife_support_reason": support_reason,
        "wildlife_support_basis": status.get("wildlife_support_basis"),
        "wildlife_support_verified": support != "unknown" and bool(status.get("why_source_url")),
        "suggested_status": _pick(assessment.get("invasive_status"), STATUSES, "unknown") if not verified else None,
        "suggested_wildlife_support": _pick(assessment.get("wildlife_support"), SUPPORT_LEVELS, "unknown") if support == "unknown" else None,
        "suggested_wildlife_reason": str(assessment.get("wildlife_support_reason") or "") if support == "unknown" else "",
        "suggestion_note": "Automated suggestions are unverified and are excluded from survey metrics and planting selections." if assessment else None,
        "endangered_status": "unknown",
        "confidence": species.get("confidence"),
        "candidates": candidates,
        "id_source": species.get("source", "manual"),
        "needs_confirmation": needs_confirmation,
        "needs_taxon_confirmation": bool(taxon_confirmation),
        "user_confirmed": user_confirmed,
        "actions": actions,
        "ai_unavailable": ai_unavailable,
        "scope_note": SCOPE_NOTE,
        "taxonomy_notes": status.get("taxonomy_notes"),
        "management_notes": status.get("management_notes"),
        "fisc_category": status.get("fisc_category"),
        "fisc_zones": status.get("known_distribution_zones"),
        "distribution_note": status.get("distribution_note"),
        "state": "unidentified" if not scientific_name else ("confirm" if needs_confirmation else "identified"),
        "suggested": suggested,
    }


def identify_plant(images, location):
    species = identify_species(images, location)
    status = get_status(species.get("scientific_name"), location)
    assessment, ai_unavailable = {}, bool(species.get("ai_unavailable") or species.get("source") == "none")
    # Curated relationships and statuses do not depend on an explanation provider.
    # An unfamiliar taxon may still receive a clearly separated, tentative explanation.
    if species.get("scientific_name") and not status.get("status_verified"):
        try:
            assessment = assess_plant(species, status, location)
        except openai_client.AIUnavailable:
            ai_unavailable = True
    return _plant_result(species, status, assessment=assessment, ai_unavailable=ai_unavailable)


def confirm_plant(scientific_name, location):
    """Recheck evidence for a user-selected taxon without inventing confidence."""
    status = get_status(scientific_name, location)
    species = {
        "scientific_name": scientific_name, "common_name": "", "confidence": None,
        "candidates": [], "source": "manual_confirmation", "needs_confirmation": False,
    }
    return _plant_result(species, status, user_confirmed=True)


def get_catalog(location):
    """Return sourced manual-identification choices, including nonnative taxa."""
    entries = []
    seen = set()
    for entry in bundled_catalog():
        result = confirm_plant(entry["scientific_name"], location)
        key = result.get("taxon_id") or result["scientific_name"].casefold()
        if key in seen or not result["status_verified"]:
            continue
        seen.add(key)
        # Browsing a choice does not yet confirm an observation.
        result["user_confirmed"] = False
        result["id_source"] = "catalog"
        result["synonyms"] = entry.get("synonyms", [])
        entries.append(result)
    return sorted(entries, key=lambda entry: (entry["plant_name"].casefold(), entry["scientific_name"]))


def _site(site):
    site = site or {}
    return {key: _pick(site.get(key), options, "unknown") for key, options in SITE_OPTIONS.items()}


def _site_conflicts(entry, site):
    conflicts = []
    for key in ("sun", "moisture"):
        if site[key] != "unknown" and site[key] not in entry.get(key, []):
            conflicts.append(f"{key}={site[key]}")
    if site["space"] != "unknown" and SPACE_ORDER.get(entry.get("min_space"), 3) > SPACE_ORDER[site["space"]]:
        conflicts.append(f"space={site['space']}")
    if site["maintenance"] == "low" and entry.get("maintenance") != "low":
        conflicts.append("maintenance=low")
    return conflicts


def _recommendation(entry, status, site, audit):
    name = entry["common_name"]
    unknown = [key for key, value in site.items() if value == "unknown"]
    known = [f"{key}: {value}" for key, value in site.items() if value != "unknown"]
    suitability = (
        "Matches the recorded planning filters (" + ", ".join(known) + "). " if known else "No site conditions have been confirmed. "
    )
    if unknown:
        suitability += "Check " + ", ".join(unknown) + " before selecting a planting location. "
    suitability += entry.get("suitability_notes", "Confirm mature dimensions, utilities and school restrictions before planting.")
    if audit["verified_species_count"]:
        problem = "This native taxon is not in the verified survey inventory; adding it would diversify the recorded species mix."
    else:
        problem = "A source-backed native option to consider while building a verified campus plant inventory."
    if audit["invasive_count"]:
        problem += " The survey also records invasive taxa; have grounds staff review those separately."
    benefit = entry["why"]
    return {
        **_plant_facts(entry),
        "plant_name": name,
        "scientific_name": status.get("scientific_name") or entry["scientific_name"],
        "taxon_id": status["taxon_id"],
        "wildlife_support": _pick(entry.get("wildlife_support"), SUPPORT_LEVELS, "unknown"),
        "wildlife_support_basis": entry.get("wildlife_support_basis"),
        "why": benefit,
        "source": status["source"],
        "source_url": status.get("source_url"),
        "why_source_url": entry.get("why_source_url"),
        "requirements_source_url": entry.get("requirements_source_url"),
        "verified_on": status.get("verified_on"),
        "status_verified": True,
        "status_scope": status.get("status_scope", "Florida"),
        "problem": problem,
        "action": f"Ask grounds staff to approve a suitable location and establishment-care plan for {name} before planting.",
        "impact": benefit,
        "benefit": benefit,
        "suitability": suitability,
        "site_needs_confirmation": bool(unknown),
        "site_requirements": {
            "sun": entry.get("sun", []), "moisture": entry.get("moisture", []),
            "min_space": entry.get("min_space"), "maintenance": entry.get("maintenance"),
        },
        "scope_note": SCOPE_NOTE,
        "management_notes": entry.get("management_notes"),
        "taxonomy_notes": entry.get("taxonomy_notes"),
    }


def get_plant_recommendations(location, plants=None, site=None):
    """Filter sourced natives by observed taxa and actual site constraints."""
    if not in_south_florida(location):
        return []
    site = _site(site)
    audit = calculate_biodiversity_score(plants or [], location)
    present = {entry["taxon_id"] for entry in audit["species"]}
    recommendations, seen = [], set()
    for entry in bundled_natives():
        if entry.get("recommendable") is not True:
            continue
        status = get_status(entry["scientific_name"], location)
        key = status.get("taxon_id")
        if (not status.get("status_verified") or status.get("native") is not True
                or status.get("invasive") is True or status.get("needs_taxon_confirmation")
                or not key or key in seen or key in present or _site_conflicts(entry, site)):
            continue
        seen.add(key)
        recommendations.append(_recommendation(entry, status, site, audit))
    return rank_recommendations(recommendations, audit, location)


def fallback_recommendations(location, plants=None, site=None):
    return get_plant_recommendations(location, plants=plants, site=site)


def _field(value, placeholder):
    return str(value).strip() if value is not None and str(value).strip() else placeholder


def generate_proposal(payload):
    """Create an editable, factual proposal from revalidated taxa and observations."""
    location = payload.get("zip_code") or payload.get("location") or "33431"
    plants = payload.get("plants") or []
    site = _site(payload.get("site"))
    names = payload.get("plant_names") or []
    choices = {item["taxon_id"]: item for item in get_plant_recommendations(location, site=site)}
    selected = []
    seen = set()
    for name in names:
        status = get_status(name, location)
        key = status.get("taxon_id")
        if key not in choices or not status.get("status_verified") or status.get("needs_taxon_confirmation"):
            raise ValueError(f"{name} is not a verified native planting option for the supplied site conditions.")
        if key not in seen:
            selected.append(choices[key])
            seen.add(key)
    if not selected:
        raise ValueError("Select at least one verified native taxon for the proposal.")
    audit = calculate_biodiversity_score(plants, location, additions=[plant["scientific_name"] for plant in selected])
    details = payload.get("proposal") or {}
    principal = _field(details.get("principal_name"), "[PRINCIPAL NAME]")
    school = _field(details.get("school_name"), "[SCHOOL NAME]")
    student = _field(details.get("student_name"), "[STUDENT NAME]")
    site_name = _field(payload.get("site_name"), "[SURVEY AREA]")
    survey_date = _field(payload.get("survey_date"), "[SURVEY DATE]")
    lines = [
        f"Dear {principal},", "",
        f"I am requesting permission to develop a reviewed native-plant project at {school} (ZIP {location}).",
        "", "SURVEY RECORD", f"Area: {site_name}", f"Survey date: {survey_date}",
        f"Recorded observations: {audit['observation_count']}", audit["summary"],
        f"Verified invasive taxa: {audit['invasive_count']}. Verified nonnative taxa not listed as invasive: {audit['non_native_count']}.",
        "This is a species-presence sample. It does not measure campus-wide biodiversity, plant abundance, or wildlife population change.",
    ]
    if audit["species"]:
        lines.extend(["", "Verified inventory (identification choice plus Florida status source):"])
        for plant in audit["species"]:
            lines.append(f"- {plant['plant_name']} ({plant['scientific_name']}): {plant['invasive_status']}. {plant['source_url'] or plant['source']}")
    if audit["unresolved"]:
        lines.extend(["", "Observations requiring review:"])
        for plant in audit["unresolved"]:
            lines.append(f"- {plant['plant_name']}: {plant['reason']}")
    lines.extend(["", "PROPOSED PLANTING"])
    for plant in selected:
        lines.extend([
            f"- {plant['plant_name']} ({plant['scientific_name']}): {plant['benefit']}",
            f"  Site review: {plant['suitability']}",
            f"  Florida status source: {plant['source_url']} (record checked {plant['verified_on'] or 'date pending'}).",
            f"  Wildlife relationship: {plant['why_source_url'] or plant['source_url']}",
            f"  Planting requirements: {plant['requirements_source_url'] or plant['source_url']}",
        ])
        buying = plant.get("buying") or {}
        if buying.get("ask_for"):
            lines.append(f"  Nursery label: {buying['ask_for']}.")
        if buying.get("avoid"):
            lines.append(f"  Buying note: {buying['avoid']}")
        for caution in plant.get("watch_out") or []:
            if isinstance(caution, dict) and caution.get("text"):
                source = caution.get("source") or {}
                lines.append(f"  Care note: {caution['text']} {source.get('url', '')}".rstrip())
    projected = audit["projected"]
    if projected["added_species"]:
        lines.extend(["", f"If all selected new taxa are established and retained in this surveyed inventory, its native share would be {projected['native_count']} of {projected['verified_species_count']} verified taxa ({projected['native_share']:g}%). This is a conditional inventory calculation, not a prediction of wildlife outcomes."])
    else:
        lines.extend(["", "The selected taxa are already in the verified inventory. Adding more individuals does not change this unique-taxon percentage."])
    lines.extend([
        "", "PRACTICAL PLAN",
        f"Proposed planting location: {_field(details.get('location'), '[LOCATION TO REVIEW]')}",
        f"Quantity by species: {_field(details.get('quantity'), '[QUANTITIES TO PLAN]')}",
        f"Estimated budget and source of funds: {_field(details.get('budget'), '[BUDGET TO CONFIRM]')}",
        f"Maintenance owner and establishment watering: {_field(details.get('maintenance'), '[RESPONSIBLE PERSON AND CARE SCHEDULE]')}",
        "Site conditions: " + "; ".join(f"{key}={value}" for key, value in site.items()) + ".",
        SCOPE_NOTE,
        "", "PERMISSION AND FOLLOW-UP",
        "Please review the species, mature plant size, planting location, accessibility, utilities, budget, and maintenance responsibilities before approving any work. Any invasive-plant management requires a separate identification and safe-handling review with school grounds staff; this proposal does not authorize removal.",
        "After approval and planting, we propose recording species and quantities planted, the planting date, and survival during scheduled follow-ups. Wildlife sightings can be logged separately with a consistent observation method; no improvement has been measured yet.",
        "", "Thank you for reviewing this proposal.", "", "Sincerely,", student, school,
    ])
    if payload.get("is_sample") is True:
        lines = ["SAMPLE PROPOSAL — demonstration observations, not a real campus survey.", "", *lines]
    return "\n".join(lines)


def generate_letter(plant_names, score=None, zip_code="33431"):
    """Compatibility wrapper; obsolete numeric scores are never evidence."""
    return generate_proposal({"plant_names": plant_names, "zip_code": zip_code})


def generate_letter_without_ai(plant_names, score=None, zip_code="33431"):
    return generate_letter(plant_names, score, zip_code)
