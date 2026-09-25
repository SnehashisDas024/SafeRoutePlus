"""
GROUP BY (h3_index, hour, dow) -> weighted risk_score, confidence, sample_count

Three data sources:
1. Passive app-location aggregation (anonymized crowd density) - weight 0.3
2. Post-trip one-tap reports (🟢/🟡/🔴 + tags) - weight 0.4
3. SOS/anomaly events (highest trust) - weight 0.3

Cold-start mitigation: H3 neighbour-fill (ring-1 distance-weighted average)
"""
import sys
import os
import random
import math
from collections import defaultdict
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

import h3
from app.models.database import SessionLocal
from app.models.schema import RiskCell, Incident, Report, StaticFeature

H3_RESOLUTION = 9

# Data source weights (must sum to 1.0)
WEIGHT_PASSIVE = 0.3
WEIGHT_REPORTS = 0.4
WEIGHT_INCIDENTS = 0.3

# Rating to risk score mapping
RATING_RISK = {
    "🟢": 0.2,   # Safe
    "🟡": 0.5,   # Okay
    "🔴": 0.8,   # Unsafe
}

# Tag risk modifiers (additional risk per tag)
TAG_RISK = {
    "Poorly lit": 0.15,
    "Empty street": 0.10,
    "Harassment": 0.25,
    "Crowded": -0.05,  # Crowded can be safer
    "No footpath": 0.10,
    "Broken streetlight": 0.15,
    "Suspicious activity": 0.20,
    "Eve teasing": 0.20,
    "Theft": 0.15,
    "Accident prone": 0.10,
}

def build_risk_table():
    print("Building risk table from three data sources...")
    
    db = SessionLocal()
    try:
        # Clear existing risk cells
        db.query(RiskCell).delete()
        
        # 1. Fetch all incidents with trust weights
        print("Fetching incidents...")
        incidents = db.query(Incident).all()
        incident_data = defaultdict(list)  # (h3, hour, dow) -> list of trust_weights
        
        from geoalchemy2.shape import to_shape
        for inc in incidents:
            # Extract h3 from incident geom (WKBElement)
            if inc.geom:
                try:
                    point = to_shape(inc.geom)
                    lat, lon = point.y, point.x
                    h3_idx = h3.latlng_to_cell(lat, lon, H3_RESOLUTION)
                    hour = inc.ts.hour
                    dow = inc.ts.weekday()
                    incident_data[(h3_idx, hour, dow)].append(inc.trust_weight)
                except Exception:
                    pass
        
        print(f"  Processed {len(incidents)} incidents into {len(incident_data)} cell-hours")
        
        # 2. Fetch all reports
        print("Fetching reports...")
        reports = db.query(Report).all()
        report_data = defaultdict(list)  # (h3, hour, dow) -> list of (rating_risk, tag_risk)
        
        for rep in reports:
            h3_idx = rep.h3_index
            hour = rep.ts.hour
            dow = rep.ts.weekday()
            
            base_risk = RATING_RISK.get(rep.rating, 0.5)
            tag_risk = sum(TAG_RISK.get(tag, 0) for tag in (rep.tags or []))
            total_risk = min(1.0, base_risk + tag_risk)
            
            report_data[(h3_idx, hour, dow)].append(total_risk)
        
        print(f"  Processed {len(reports)} reports into {len(report_data)} cell-hours")
        
        # 3. Generate passive crowd density (synthetic)
        print("Generating passive crowd density...")
        # Collect all cells that have incidents or reports
        cells_with_data = set()
        for h3_idx, hour, dow in incident_data.keys():
            cells_with_data.add(h3_idx)
        for h3_idx, hour, dow in report_data.keys():
            cells_with_data.add(h3_idx)
        
        # For cells with data, generate passive for ALL 168 hour/dow combinations
        all_cell_hours = set()
        for cell in cells_with_data:
            for hour in range(24):
                for dow in range(7):
                    all_cell_hours.add((cell, hour, dow))
        
        # Add passive-only cells from static features (sample)
        static_features = db.query(StaticFeature).all()
        for sf in static_features[:1000]:
            for hour in range(24):
                for dow in range(7):
                    all_cell_hours.add((sf.h3_index, hour, dow))
        
        passive_data = defaultdict(float)
        for h3_idx, hour, dow in all_cell_hours:
            # Synthetic crowd density: higher during day, lower at night
            # Weekends different from weekdays
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
            
            # Crowd density inversely relates to risk (more people = safer)
            # But very high density can also be risky (stampede, harassment)
            if density > 0.7:
                risk = 0.3 + (density - 0.7) * 0.5
            else:
                risk = 0.6 - density * 0.4
            
            passive_data[(h3_idx, hour, dow)] = max(0.0, min(1.0, risk))
        
        print(f"  Generated passive data for {len(passive_data)} cell-hours")
        
        # 4. Combine all sources with weights
        print("Combining data sources...")
        combined = defaultdict(lambda: {"score": 0.0, "weight": 0.0, "samples": 0, "confidence": "high"})
        
        # Incidents
        for key, trust_weights in incident_data.items():
            avg_trust = sum(trust_weights) / len(trust_weights)
            # Higher trust weight = higher risk contribution
            risk = avg_trust
            combined[key]["score"] += risk * WEIGHT_INCIDENTS
            combined[key]["weight"] += WEIGHT_INCIDENTS
            combined[key]["samples"] += len(trust_weights)
        
        # Reports
        for key, risks in report_data.items():
            avg_risk = sum(risks) / len(risks)
            combined[key]["score"] += avg_risk * WEIGHT_REPORTS
            combined[key]["weight"] += WEIGHT_REPORTS
            combined[key]["samples"] += len(risks)
        
        # Passive
        for key, risk in passive_data.items():
            combined[key]["score"] += risk * WEIGHT_PASSIVE
            combined[key]["weight"] += WEIGHT_PASSIVE
            combined[key]["samples"] += 1
        
        # Normalize scores by total weight
        for key, data in combined.items():
            if data["weight"] > 0:
                data["score"] = data["score"] / data["weight"]
            else:
                data["score"] = 0.5  # neutral default
            
            # Confidence based on sample count and data source diversity
            # High confidence: at least two data sources (weight >= 0.5) OR 2+ samples
            if data["samples"] >= 2 or data["weight"] >= 0.5:
                data["confidence"] = "high"
            else:
                data["confidence"] = "estimated"
        
        print(f"  Combined {len(combined)} cell-hours")
        
        # 5. Insert into database
        print("Inserting risk cells...")
        batch = []
        for (h3_idx, hour, dow), data in combined.items():
            cell = RiskCell(
                h3_index=h3_idx,
                hour=hour,
                dow=dow,
                risk_score=round(data["score"], 3),
                confidence=data["confidence"],
                sample_count=data["samples"]
            )
            batch.append(cell)
            
            if len(batch) >= 500:
                db.bulk_save_objects(batch)
                db.commit()
                batch = []
        
        if batch:
            db.bulk_save_objects(batch)
            db.commit()
        
        print(f"Risk table built with {len(combined)} cells!")
        
        # 6. H3 neighbour-fill for cold-start cells
        print("Running H3 neighbour-fill for cold-start...")
        neighbour_fill()
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

def neighbour_fill():
    """Fill cells with no data using ring-1 neighbours distance-weighted average."""
    db = SessionLocal()
    try:
        # Get all cells that have data
        existing = db.query(RiskCell.h3_index, RiskCell.hour, RiskCell.dow, 
                           RiskCell.risk_score, RiskCell.confidence).all()
        
        existing_map = {}  # (h3, hour, dow) -> (score, confidence)
        for h3_idx, hour, dow, score, conf in existing:
            existing_map[(h3_idx, hour, dow)] = (score, conf)
        
        print(f"  Existing cells: {len(existing_map)}")
        
        # Get all H3 cells in Kolkata bbox
        from ml.pipelines.build_static_features import get_h3_cells_in_bbox, KOLKATA_BBOX
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
                    neighbours.discard(cell)  # Remove self
                    
                    # Get valid neighbours with data
                    valid_neighbours = []
                    for n in neighbours:
                        n_key = (n, hour, dow)
                        if n_key in existing_map:
                            score, conf = existing_map[n_key]
                            # Distance weight: 1 for ring-0, 1/3 for ring-1 (simplified)
                            dist = h3.grid_distance(cell, n)
                            weight = 1.0 / (dist + 1)
                            valid_neighbours.append((score, weight, conf))
                    
                    if valid_neighbours:
                        # Distance-weighted average
                        total_weight = sum(w for _, w, _ in valid_neighbours)
                        avg_score = sum(s * w for s, w, _ in valid_neighbours) / total_weight
                        
                        # Confidence is estimated for filled cells
                        new_cell = RiskCell(
                            h3_index=cell,
                            hour=hour,
                            dow=dow,
                            risk_score=round(avg_score, 3),
                            confidence="estimated",
                            sample_count=0
                        )
                        db.add(new_cell)
                        filled += 1
        
        db.commit()
        print(f"  Filled {filled} cold-start cells via neighbour-fill")
        
    except Exception as e:
        db.rollback()
        print(f"Neighbour-fill error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    build_risk_table()