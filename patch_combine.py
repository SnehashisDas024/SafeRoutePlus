import os
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\core\risk_aggregator.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_combine = """def combine_sources(
    incident_risk: Dict[Tuple[str, int, int], float],
    report_risk: Dict[Tuple[str, int, int], float],
    passive_risk: Dict[Tuple[str, int, int], float],
) -> Dict[Tuple[str, int, int], Dict[str, Any]]:
    \"\"\"Combine three data sources with weights.\"\"\"
    combined = defaultdict(lambda: {"score": 0.0, "weight": 0.0, "samples": 0})
    
    # Incidents
    for key, risk in incident_risk.items():
        combined[key]["score"] += risk * WEIGHT_INCIDENTS
        combined[key]["weight"] += WEIGHT_INCIDENTS
        combined[key]["samples"] += 1
    
    # Reports
    for key, risk in report_risk.items():
        combined[key]["score"] += risk * WEIGHT_REPORTS
        combined[key]["weight"] += WEIGHT_REPORTS
        combined[key]["samples"] += 1"""

new_combine = """def combine_sources(
    incident_risk: Dict[Tuple[str, int, int], float],
    report_risk: Dict[Tuple[str, int, int], Dict[str, Any]],
    passive_risk: Dict[Tuple[str, int, int], float],
) -> Dict[Tuple[str, int, int], Dict[str, Any]]:
    \"\"\"Combine three data sources with weights.\"\"\"
    combined = defaultdict(lambda: {"score": 0.0, "weight": 0.0, "samples": 0, "community_verified": False})
    
    # Incidents
    for key, risk in incident_risk.items():
        combined[key]["score"] += risk * WEIGHT_INCIDENTS
        combined[key]["weight"] += WEIGHT_INCIDENTS
        combined[key]["samples"] += 1
    
    # Reports
    for key, data in report_risk.items():
        combined[key]["score"] += data["risk"] * WEIGHT_REPORTS
        combined[key]["weight"] += WEIGHT_REPORTS
        combined[key]["samples"] += data["count"]
        if data["num_users"] >= 2:
            combined[key]["community_verified"] = True"""

content = content.replace(old_combine, new_combine)

old_normalize = """    # Normalize by total weight
    for key, data in combined.items():
        if data["weight"] > 0:
            data["score"] = data["score"] / data["weight"]
        else:
            data["score"] = 0.5
        
        # Confidence based on sample count and data source diversity
        if data["samples"] >= MIN_SAMPLES_HIGH_CONFIDENCE or data["weight"] >= 0.5:
            data["confidence"] = "high"
        else:
            data["confidence"] = "estimated"
    
    return combined"""

new_normalize = """    # Normalize by total weight
    for key, data in combined.items():
        if data["weight"] > 0:
            data["score"] = data["score"] / data["weight"]
        else:
            data["score"] = 0.5
        
        # Confidence based on sample count and data source diversity
        if data.get("community_verified"):
            data["confidence"] = "community-verified"
        elif data["samples"] >= MIN_SAMPLES_HIGH_CONFIDENCE or data["weight"] >= 0.5:
            data["confidence"] = "high"
        else:
            data["confidence"] = "low"
    
    return combined"""

content = content.replace(old_normalize, new_normalize)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched combine_sources")
