def species(scientific_name, common_name="", confidence=0.9, state="identified", others=(), source="plantnet"):
    top = {"scientific_name": scientific_name, "common_name": common_name, "confidence": confidence}
    return {"state": state, "ranked": [top, *others], "suggested": 0, "source": source}
