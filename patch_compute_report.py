import os
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\core\risk_aggregator.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure datetime, math, UserTrust are imported
imports_to_add = """from datetime import datetime
import math
from app.models.schema import UserTrust
"""
if "import math" not in content:
    content = content.replace("import h3", "import h3\n" + imports_to_add)

old_compute_report_risk = """def compute_report_risk(db: Session) -> Dict[Tuple[str, int, int], float]:
    \"\"\"Compute average risk per (h3, hour, dow) from user reports.\"\"\"
    reports = db.query(Report).all()
    report_data = defaultdict(list)
    
    for rep in reports:
        h3_idx = rep.h3_index
        hour = rep.ts.hour
        dow = rep.ts.weekday()
        
        base_risk = RATING_RISK.get(rep.rating, 0.5)
        tag_risk = sum(TAG_RISK.get(tag, 0) for tag in (rep.tags or []))
        total_risk = min(1.0, base_risk + tag_risk)
        
        report_data[(h3_idx, hour, dow)].append(total_risk)
    
    return {k: sum(v) / len(v) for k, v in report_data.items()}"""

new_compute_report_risk = """def compute_report_risk(db: Session) -> Dict[Tuple[str, int, int], Dict[str, Any]]:
    \"\"\"Compute average risk per (h3, hour, dow) from user reports with trust and decay.\"\"\"
    reports = db.query(Report).all()
    
    # Pre-fetch user trust scores
    user_trusts = {ut.user_id: ut.trust_score for ut in db.query(UserTrust).all()}
    
    # We will accumulate weighted risks and track unique users per cell
    # report_data[(h3, hour, dow)] = {"weighted_sum": 0, "weight_sum": 0, "users": set()}
    report_data = defaultdict(lambda: {"weighted_sum": 0.0, "weight_sum": 0.0, "users": set(), "count": 0})
    
    now = datetime.utcnow()
    
    for rep in reports:
        h3_idx = rep.h3_index
        hour = rep.ts.hour
        dow = rep.ts.weekday()
        
        base_risk = RATING_RISK.get(rep.rating, 0.5)
        tag_risk = sum(TAG_RISK.get(tag, 0) for tag in (rep.tags or []))
        total_risk = min(1.0, base_risk + tag_risk)
        
        # Calculate weight
        trust_score = user_trusts.get(rep.user_id, 1.0) if rep.user_id else 1.0
        
        # Recency decay (half-life ~ 30 days)
        age_days = (now - rep.ts).total_seconds() / (24 * 3600)
        decay = math.exp(-0.693 * age_days / 30.0)
        
        weight = 1.0 * trust_score * decay
        
        # If community report, apply heavily damped weight until corroborated
        # We will handle the damping at the aggregation level per cell if users < 2
        # For now just accumulate
        report_data[(h3_idx, hour, dow)]["weighted_sum"] += total_risk * weight
        report_data[(h3_idx, hour, dow)]["weight_sum"] += weight
        if rep.user_id:
            report_data[(h3_idx, hour, dow)]["users"].add(rep.user_id)
        report_data[(h3_idx, hour, dow)]["count"] += 1

    # Finalize scores
    final_data = {}
    for key, data in report_data.items():
        if data["weight_sum"] > 0:
            avg_risk = data["weighted_sum"] / data["weight_sum"]
        else:
            avg_risk = 0.5
            
        # Damping: if < 2 independent users, damp the shift toward 0.5 (neutral)
        num_users = len(data["users"])
        if num_users < 2:
            # Shift back 70% toward 0.5
            avg_risk = 0.5 + 0.3 * (avg_risk - 0.5)
            
        final_data[key] = {
            "risk": avg_risk,
            "num_users": num_users,
            "count": data["count"]
        }
        
    return final_data"""

content = content.replace(old_compute_report_risk, new_compute_report_risk)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched compute_report_risk")
