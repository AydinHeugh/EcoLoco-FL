from services import openai_client
from services.fl_plants_service import get_status
from services.identification_service import identify_species

STATUSES = ("native", "non-native", "invasive")
SUPPORT_LEVELS = ("high", "medium", "low")
ENDANGERED = ("not_threatened", "threatened", "endangered", "critically_endangered", "unknown")

ASSESS_PROMPT = """The plant {common_name} ({scientific_name}) was found near US ZIP code {location}.
{status_line}
Determine:
1. wildlife support level: "high", "medium" or "low"
   - high: supports many pollinators, birds or beneficial insects; provides food/habitat
   - medium: supports some wildlife but is not a keystone species
   - low: minimal wildlife value, ornamental only, or actively harmful
2. a one-sentence reason for that wildlife support level
3. conservation status: "not_threatened", "threatened", "endangered", "critically_endangered" or "unknown"
4. whether it is native to the area of ZIP {location} (true/false), and its status there: "native", "non-native" or "invasive"
5. 2 specific, practical actions a person can take involving planting or caring for this or companion plants
   to benefit the local ecosystem. Each names a specific plant or technique and gives the direct
   environmental benefit in one sentence.

Respond only in JSON, no markdown:
{{"wildlife_support": "...", "wildlife_support_reason": "...", "endangered_status": "...",
  "is_native": true, "invasive_status": "...", "actions": [{{"action": "...", "impact": "..."}}]}}"""

RECOMMEND_PROMPT = """For ZIP code {location}, return a JSON array of 11 native plants ranked from highest to lowest ecological impact.

wildlife_support values:
- "high": keystone or near-keystone — strong pollinator, bird, or insect support
- "medium": supports some local wildlife but not a primary habitat plant
- "low": modest benefit, mainly soil or water improvement

The FIRST 3 entries are your top recommendations — full detail:
{{
  "plant_name": "common name",
  "scientific_name": "scientific name",
  "wildlife_support": "high/medium/low",
  "problem": "one sentence — the specific local issue this plant addresses",
  "action": "one actionable planting step — mention plant_name explicitly",
  "impact": "direct ecological benefit — mention plant_name explicitly"
}}

Entries 4–11 are additional high-impact natives — compact format:
{{
  "plant_name": "common name",
  "scientific_name": "scientific name",
  "wildlife_support": "high/medium/low",
  "benefit": "one sentence describing the key ecological benefit"
}}

Rank all 11 highest wildlife_support first. No markdown, no backticks, return only the JSON array."""


def _pick(value, allowed, default):
    value = str(value or "").strip().lower()
    return value if value in allowed else default


def _invasive_actions(location):
    return [
        {
            "action": "Do not plant or propagate this species",
            "impact": "Prevents further spread of invasive species that can harm native ecosystems and reduce biodiversity",
        },
        {
            "action": f"Consider removing this plant and replacing with native alternatives for {location}",
            "impact": "Supports local biodiversity, provides better wildlife habitat, and strengthens ecosystem resilience",
        },
    ]


def assess_plant(species, status, location):
    if status["source"] == "unknown":
        status_line = ""
    else:
        label = "invasive" if status["invasive"] else "native"
        status_line = f"Florida records ({status['source']}) list it as {label} here; treat that as fact.\n"
    return openai_client.chat(ASSESS_PROMPT.format(
        common_name=species["common_name"] or "unknown",
        scientific_name=species["scientific_name"] or "unknown",
        location=location,
        status_line=status_line,
    ), json_reply=True)


def identify_plant(image_data, location):
    species = identify_species(image_data, location)
    status = get_status(species["scientific_name"], location)
    assessment = assess_plant(species, status, location)

    if status["source"] == "unknown":
        invasive_status = _pick(assessment.get("invasive_status"), STATUSES, "non-native")
        is_native = bool(assessment.get("is_native"))
    else:
        invasive_status = "invasive" if status["invasive"] else "native"
        is_native = status["native"]

    if invasive_status == "invasive":
        actions = _invasive_actions(location)
    else:
        actions = assessment.get("actions") or []

    return {
        "plant_name": species["common_name"],
        "scientific_name": species["scientific_name"],
        "is_native": is_native,
        "invasive_status": invasive_status,
        "endangered_status": _pick(assessment.get("endangered_status"), ENDANGERED, "unknown"),
        "wildlife_support": _pick(assessment.get("wildlife_support"), SUPPORT_LEVELS, "low"),
        "wildlife_support_reason": assessment.get("wildlife_support_reason", ""),
        "confidence": species["confidence"],
        "candidates": species["candidates"],
        "source": status["source"],
        "why": status["why"],
        "actions": actions,
    }


def get_plant_recommendations(location: str):
    recommendations = []
    for plant in openai_client.chat(RECOMMEND_PROMPT.format(location=location), json_reply=True):
        status = get_status(plant.get("scientific_name"), location)
        if status["invasive"]:
            continue
        recommendations.append({**plant, "source": status["source"], "why": status["why"]})
    return recommendations


def generate_letter(plant_names: list, score: int, zip_code: str):
    # Format plant list naturally
    if len(plant_names) == 1:
        plant_list  = plant_names[0]
        adding_word = "Adding it"
    elif len(plant_names) == 2:
        plant_list  = f"{plant_names[0]} and {plant_names[1]}"
        adding_word = "Adding them"
    else:
        plant_list  = ", ".join(plant_names[:-1]) + f", and {plant_names[-1]}"
        adding_word = "Adding them"

    # GPT generates only the benefit sentence(s)
    benefit = openai_client.chat(
        f"Write 1–2 sentences explaining why the following native plant(s) "
        f"help local wildlife in ZIP code {zip_code}: {plant_list}. "
        "Be specific — mention pollinators, birds, or insects they support. "
        "Return only the sentences, no preamble or trailing text."
    )

    letter = (
        f"Dear [PRINCIPAL_NAME],\n\n"
        f"The [SCHOOL_NAME] eco-club has been studying the plants growing around our campus, "
        f"and we'd like to propose a change that could make a real difference for local wildlife.\n\n"
        f"Right now, much of our schoolyard is planted with species that do very little for the "
        f"insects, birds, and pollinators that depend on this area. We audited our grounds and our "
        f"campus scored {score} out of 100 on biodiversity, a measure of how well our plants "
        f"actually support native wildlife. We think we can do better, and it starts with a few changes.\n\n"
        f"We're requesting permission to add the following native species, well suited to our region "
        f"(ZIP {zip_code}): {plant_list}. {benefit} "
        f"{adding_word} would raise our biodiversity score and create real, living habitat that "
        f"students can watch grow and learn from all year.\n\n"
        f"We researched this using EcoLoco, a tool that identifies plants and ranks them by how much "
        f"they help the local ecosystem. We'd be glad to share our full audit and find a time to talk "
        f"through next steps.\n\n"
        f"Thank you for considering this. A small change to our campus could leave a lasting mark "
        f"on the wildlife around it.\n\n"
        f"Sincerely,\n\n"
        f"[STUDENT_NAME]\n\n"
        f"[SCHOOL_NAME] Eco-Club"
    )

    return letter
