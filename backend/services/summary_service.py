"""Plan summaries use the same verified unique-taxon calculation as the audit."""
from services.score_service import calculate_biodiversity_score


def from_metrics(metrics):
    projected = metrics["projected"]

    def counts(value):
        return {"native": value["native_count"], "non_native": value["non_native_count"],
                "invasive": value["invasive_count"], "unknown": value["unresolved_count"]}

    return {
        **metrics,
        "counts": counts(metrics),
        "known": metrics["verified_species_count"],
        "plant_count": metrics["observation_count"],
        "percent_native": metrics["native_share"],
        "percent_native_with_plan": projected["native_share"],
        "counts_with_plan": counts(projected),
        "plants": [{**plant, "status": plant["invasive_status"]} for plant in metrics["species"]],
        "count_basis": "Verified unique taxa; unknown counts are unresolved observations.",
    }


def summarize(plants, location="33431", *, additions=None, removals=None):
    return from_metrics(calculate_biodiversity_score(plants, location, additions=additions, removals=removals))
