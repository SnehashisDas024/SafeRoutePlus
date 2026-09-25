# Risk aggregation core logic - refactored from ml/pipelines/build_risk_table.py
# Used by both the scheduled aggregator worker and ML pipeline

import h3
from datetime import datetime
import math
from app.models.schema import UserTrust

import random
from collections import defaultdict
from typing import Dict, List, Tuple, Any
from sqlalchemy.orm import Session
from geoalchemy2.shape import to_shape

from app.models.schema import RiskCell, Incident, Report, StaticFeature
from app.core.risk_constants import (
    WEIGHT_PASSIVE, WEIGHT_REPORTS, WEIGHT_INCIDENTS,
    RATING_RISK, TAG_RISK, H3_RESOLUTION, MIN_SAMPLES_HIGH_CONFIDENCE,
    KOLKATA_BBOX, TAG_VOCAB,
)


def get_h3_cells_in_bbox(bbox: tuple, resolution: int) -> List[str]:
    """Get all H3 cells within a bounding box."""
    min_lat, min_lon, max_lat, max_lon = bbox
    polygon = [
        (min_lat, min_lon),
        (min_lat, max_lon),
        (max_lat, max_lon),
        (max_lat, min_lon),
        (min_lat, min_lon),
    ]
    poly = h3.LatLngPoly(polygon)
    cells = h3.h3shape_to_cells(poly, resolution)
    return list(cells)


def compute_incident_risk(db: Session) -> Dict[Tuple[str, int, int], float]:
    """Compute average trust weight per (h3, hour, dow) from incidents."""
    incidents = db.query(Incident).all()
    incident_data = defaultdict(list)
    
    for inc in incidents:
        if not inc.geom:
            continue
        try:
            point = to_shape(inc.geom)
            lat, lon = point.y, point.x
            h3_idx = h3.latlng_to_cell(lat, lon, H3_RESOLUTION)
            hour = inc.ts.hour
            dow = inc.ts.weekday()
            incident_data[(h3_idx, hour, dow)].append(inc.trust_weight)
        except Exception:
            pass
    
    return {k: sum(v) / len(v) for k, v in incident_data.items()}


def compute_report_risk(db: Session) -> Dict[Tuple[str, int, int], Dict[str, Any]]:
    """Compute average risk per (h3, hour, dow) from user reports with trust and decay."""
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
        
    return final_data


def compute_passive_risk(cells_with_data: set) -> Dict[Tuple[str, int, int], float]:
    """Generate synthetic passive crowd density risk for all cell-hours."""
    all_cell_hours = set()
    for cell in cells_with_data:
        for hour in range(24):
            for dow in range(7):
                all_cell_hours.add((cell, hour, dow))
    
    # Also include cells from static features
    from app.models.database import SessionLocal
    db = SessionLocal()
    try:
        static_features = db.query(StaticFeature).all()
        for sf in static_features:
            for hour in range(24):
                for dow in range(7):
                    all_cell_hours.add((sf.h3_index, hour, dow))
    finally:
        db.close()
    
    passive_data = {}
    for h3_idx, hour, dow in all_cell_hours:
        if dow >= 5:  # Weekend
            if 10 <= hour <= 22:
                density = random.uniform(0.4, 0.8)
            else:
                density = random.uniform(0.1, 0.4)
        else:  # Weekday
            if 8 <= hour <= 20:
                density = random.uniform(0.5, 0.9)
            else:
                density = random.uniform(0.1, 0.3)
        
        if density > 0.7:
            risk = 0.3 + (density - 0.7) * 0.5
        else:
            risk = 0.6 - density * 0.4
        
        passive_data[(h3_idx, hour, dow)] = max(0.0, min(1.0, risk))
    
    return passive_data


def combine_sources(
    incident_risk: Dict[Tuple[str, int, int], float],
    report_risk: Dict[Tuple[str, int, int], Dict[str, Any]],
    passive_risk: Dict[Tuple[str, int, int], float],
) -> Dict[Tuple[str, int, int], Dict[str, Any]]:
    """Combine three data sources with weights."""
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
            combined[key]["community_verified"] = True
    
    # Passive
    for key, risk in passive_risk.items():
        combined[key]["score"] += risk * WEIGHT_PASSIVE
        combined[key]["weight"] += WEIGHT_PASSIVE
        combined[key]["samples"] += 1
    
    # Normalize by total weight
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
    
    return combined


def upsert_risk_cells(db: Session, combined: Dict[Tuple[str, int, int], Dict[str, Any]]) -> int:
    """Bulk upsert risk cells into database."""
    batch = []
    for (h3_idx, hour, dow), data in combined.items():
        cell = RiskCell(
            h3_index=h3_idx,
            hour=hour,
            dow=dow,
            risk_score=round(data["score"], 3),
            confidence=data["confidence"],
            sample_count=data["samples"],
        )
        batch.append(cell)
    
    # UPSERT strategy to avoid duplicate key errors in Postgres
    from sqlalchemy.dialects.postgresql import insert
    
    # Execute insert with on_conflict_do_update
    stmt = insert(RiskCell).values([{
        "h3_index": c.h3_index,
        "hour": c.hour,
        "dow": c.dow,
        "risk_score": c.risk_score,
        "confidence": c.confidence,
        "sample_count": c.sample_count
    } for c in batch])
    
    stmt = stmt.on_conflict_do_update(
        index_elements=['h3_index', 'hour', 'dow'],
        set_={
            "risk_score": stmt.excluded.risk_score,
            "confidence": stmt.excluded.confidence,
            "sample_count": stmt.excluded.sample_count
        }
    )
    
    db.execute(stmt)
    db.commit()
    
    return len(batch)


def neighbour_fill(db: Session) -> int:
    """Fill cold-start cells using ring-1 neighbours distance-weighted average."""
    existing = db.query(
        RiskCell.h3_index, RiskCell.hour, RiskCell.dow,
        RiskCell.risk_score, RiskCell.confidence
    ).all()
    
    existing_map = {}
    for h3_idx, hour, dow, score, conf in existing:
        existing_map[(h3_idx, hour, dow)] = (score, conf)
    
    all_cells = get_h3_cells_in_bbox(KOLKATA_BBOX, H3_RESOLUTION)
    
    filled = 0
    for cell in all_cells:
        for hour in range(24):
            for dow in range(7):
                key = (cell, hour, dow)
                if key in existing_map:
                    continue
                
                # Find ring-1 neighbours
                neighbours = set(h3.grid_disk(cell, 1))
                neighbours.discard(cell)
                
                valid_neighbours = []
                for n in neighbours:
                    n_key = (n, hour, dow)
                    if n_key in existing_map:
                        score, conf = existing_map[n_key]
                        dist = h3.grid_distance(cell, n)
                        weight = 1.0 / (dist + 1)
                        valid_neighbours.append((score, weight, conf))
                
                if valid_neighbours:
                    total_weight = sum(w for _, w, _ in valid_neighbours)
                    avg_score = sum(s * w for s, w, _ in valid_neighbours) / total_weight
                    
                    from sqlalchemy.dialects.postgresql import insert
                    stmt = insert(RiskCell).values({
                        "h3_index": cell,
                        "hour": hour,
                        "dow": dow,
                        "risk_score": round(avg_score, 3),
                        "confidence": "estimated",
                        "sample_count": 0
                    }).on_conflict_do_nothing(index_elements=['h3_index', 'hour', 'dow'])
                    db.execute(stmt)
                    filled += 1
    
    db.commit()
    return filled


def run_full_aggregation(db: Session) -> Dict[str, int]:
    """Run the complete aggregation pipeline."""
    # 1. Compute risks from three sources
    incident_risk = compute_incident_risk(db)
    report_risk = compute_report_risk(db)
    cells_with_data = set(incident_risk.keys()) | set(report_risk.keys())
    passive_risk = compute_passive_risk(cells_with_data)
    
    # 2. Combine sources
    combined = combine_sources(incident_risk, report_risk, passive_risk)
    
    # 3. Upsert risk cells
    upserted = upsert_risk_cells(db, combined)
    
    # 4. Neighbour-fill cold-start cells
    filled = neighbour_fill(db)
    
    return {
        "upserted": upserted,
        "filled": filled,
        "incident_cells": len(incident_risk),
        "report_cells": len(report_risk),
    }