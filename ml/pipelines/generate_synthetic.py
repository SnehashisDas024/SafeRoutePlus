"""
Synthetic incidents/crowd/lighting generator for Kolkata
Three data sources feeding risk_cells:
1. Passive app-location aggregation (anonymized crowd density)
2. Post-trip one-tap reports (🟢/🟡/🔴 + tags)
3. SOS/anomaly events (highest trust)
"""
import sys
import os
import random
import math
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

import h3
from app.models.database import SessionLocal
from app.models.schema import Incident, Report

# Kolkata bounding box
KOLKATA_BBOX = {
    "min_lat": 22.45, "max_lat": 22.70,
    "min_lon": 88.20, "max_lon": 88.50,
}

H3_RESOLUTION = 9

# Real-world incident hotspots in Kolkata (approximate)
INCIDENT_HOTSPOTS = [
    # (lat, lon, radius_m, weight)
    (22.56, 88.36, 1500, 3.0),   # Central/Esplanade - high footfall, mixed safety
    (22.57, 88.37, 1000, 2.5),   # Park Street - nightlife area
    (22.54, 88.35, 800, 2.0),    # Kalighat - temple area, crowded
    (22.52, 88.33, 1200, 2.5),   # Tollygunge - metro terminus
    (22.58, 88.37, 1000, 1.5),   # Rabindra Sadan - cultural area
    (22.60, 88.38, 2000, 1.0),   # Salt Lake - planned, generally safer
    (22.53, 88.34, 1500, 2.0),   # Bhowanipore - residential/commercial
    (22.50, 88.30, 2000, 1.5),   # Behala - outer area
]

REPORT_TAGS = [
    "Poorly lit", "Empty street", "Harassment", "Crowded",
    "No footpath", "Broken streetlight", "Suspicious activity",
    "Eve teasing", "Theft", "Accident prone"
]

RATINGS = ["🟢", "🟡", "🔴"]

def get_h3_for_point(lat, lon):
    return h3.latlng_to_cell(lat, lon, H3_RESOLUTION)

def random_point_in_bbox():
    lat = random.uniform(KOLKATA_BBOX["min_lat"], KOLKATA_BBOX["max_lat"])
    lon = random.uniform(KOLKATA_BBOX["min_lon"], KOLKATA_BBOX["max_lon"])
    return lat, lon

def biased_point_near_hotspots():
    """Generate points biased towards known hotspots."""
    if random.random() < 0.7:  # 70% near hotspots
        hotspot = random.choices(INCIDENT_HOTSPOTS, weights=[h[3] for h in INCIDENT_HOTSPOTS])[0]
        lat, lon, radius, _ = hotspot
        # Random point within radius
        angle = random.uniform(0, 2 * math.pi)
        r = random.uniform(0, radius) / 111000  # convert to degrees
        return lat + r * math.cos(angle), lon + r * math.sin(angle)
    else:
        return random_point_in_bbox()

def generate_synthetic_data():
    print("Generating synthetic safety reports and incidents...")
    
    db = SessionLocal()
    try:
        # Clear existing
        db.query(Incident).delete()
        db.query(Report).delete()
        
        # 1. Generate SOS/anomaly events (highest trust) - 100 events over 90 days
        print("Generating SOS/anomaly events...")
        for _ in range(100):
            lat, lon = biased_point_near_hotspots()
            h3_idx = get_h3_for_point(lat, lon)
            
            # Random time in last 90 days, biased towards evening/night
            days_ago = random.randint(0, 90)
# Simple evening/night bias: higher weights for 18-23
            hour_weights = [1]*6 + [2]*6 + [3]*4 + [5]*4 + [4]*4  # 24 weights
            hour = random.choices(range(24), weights=hour_weights)[0]
            
            ts = datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0,23), minutes=random.randint(0,59))
            ts = ts.replace(hour=hour)
            
            incident_type = random.choices(
                ["sos_manual", "sos_duress", "deviation", "prolonged_stop"],
                weights=[10, 15, 30, 45]
            )[0]
            
            incident = Incident(
                id=h3_idx + "_" + str(random.randint(100000, 999999)),
                type=incident_type,
                # Store as WKT POINT
                geom=f"SRID=4326;POINT({lon} {lat})",
                ts=ts,
                source="app_anomaly",
                trust_weight=0.9 if incident_type.startswith("sos") else 0.7
            )
            db.add(incident)
        
        # 2. Generate post-trip one-tap reports - 500 reports
        print("Generating post-trip reports...")
        for _ in range(500):
            lat, lon = biased_point_near_hotspots()
            h3_idx = get_h3_for_point(lat, lon)
            
            days_ago = random.randint(0, 90)
            hour = random.randint(6, 23)
            ts = datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0,23), minutes=random.randint(0,59))
            ts = ts.replace(hour=hour)
            
            # Rating biased by location (hotspots more unsafe)
            is_hotspot = any(
                math.hypot(lat - h[0], lon - h[1]) * 111000 < h[2]
                for h in INCIDENT_HOTSPOTS
            )
            if is_hotspot:
                rating = random.choices(RATINGS, weights=[0.2, 0.3, 0.5])[0]
            else:
                rating = random.choices(RATINGS, weights=[0.5, 0.3, 0.2])[0]
            
            num_tags = random.randint(0, 3)
            tags = random.sample(REPORT_TAGS, num_tags) if num_tags > 0 else []
            
            report = Report(
                id=h3_idx + "_" + str(random.randint(100000, 999999)),
                trip_id="synthetic_trip_" + str(random.randint(1000, 9999)),
                h3_index=h3_idx,
                rating=rating,
                tags=tags,
                note=f"Synthetic report: {', '.join(tags) if tags else 'No tags'}",
                ts=ts
            )
            db.add(report)
        
        # 3. Generate passive crowd density data (not stored in DB, used directly in risk table)
        print("Generating passive crowd density samples...")
        # This will be used directly in build_risk_table.py
        
        db.commit()
        print("Synthetic data generation complete!")
        print(f"  Incidents: 100")
        print(f"  Reports: 500")
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    generate_synthetic_data()