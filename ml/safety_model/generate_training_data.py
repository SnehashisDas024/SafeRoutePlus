"""
Synthetic Training Data Generator for SafeRoute+ Safety ML Model
================================================================

Generates realistic synthetic data for training the route safety scoring model.
Each sample represents one H3 cell at a specific hour with 6 safety-relevant features
and a ground-truth safety score (0.0 = extremely dangerous, 1.0 = perfectly safe).

Safety Factors (6 features):
  1. street_light_coverage  — fraction of road with working streetlights (0.0 – 1.0)
  2. police_station_dist_m  — distance to nearest police station in meters
  3. crowd_density           — normalized pedestrian/crowd density (0.0 – 1.0)
  4. road_quality            — road surface + footpath quality (0.0 – 1.0)
  5. cctv_coverage           — fraction of road under CCTV surveillance (0.0 – 1.0)
  6. historical_incident_rate— past incidents per 1000 sq.m per month (higher = worse)

The ground-truth safety_score is computed from these features with realistic noise,
mimicking a "label" that could come from post-trip reports + incident aggregation.
"""

import os
import csv
import math
import random
from datetime import datetime

import h3

# ─── Kolkata geography ────────────────────────────────────────────────
KOLKATA_BBOX = {
    "min_lat": 22.48, "max_lat": 22.65,
    "min_lon": 88.28, "max_lon": 88.45,
}
H3_RESOLUTION = 9

# Major police stations
POLICE_STATIONS = [
    (22.5600, 88.3600),  # Lalbazar HQ
    (22.5800, 88.3700),  # Park Street PS
    (22.5400, 88.3500),  # Alipore PS
    (22.6000, 88.3800),  # Salt Lake PS
    (22.5200, 88.3300),  # Behala PS
    (22.5700, 88.4200),  # Ruby PS
    (22.6300, 88.4000),  # New Town PS
    (22.5000, 88.3000),  # Maheshtala PS
    (22.5550, 88.3430),  # Tollygunge PS
    (22.5900, 88.3650),  # Shyambazar PS
]

# Known hotspot areas (lat, lon, radius_m, danger_weight)
HOTSPOTS = [
    (22.560, 88.360, 1500, 0.7),   # Central/Esplanade
    (22.570, 88.370, 1000, 0.6),   # Park Street nightlife
    (22.540, 88.350, 800,  0.5),   # Kalighat temple
    (22.520, 88.330, 1200, 0.6),   # Tollygunge
    (22.500, 88.300, 2000, 0.4),   # Behala outskirts
]

# Safe zones (well-maintained, CCTV-heavy, well-lit)
SAFE_ZONES = [
    (22.600, 88.380, 1500, 0.8),   # Salt Lake planned area
    (22.630, 88.400, 2000, 0.9),   # New Town
    (22.575, 88.365, 800,  0.7),   # Rabindra Sadan cultural zone
]

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))


def haversine_m(lat1, lon1, lat2, lon2):
    """Distance in meters between two lat/lon points."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return 6_371_000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def nearest_police_dist(lat, lon):
    return min(haversine_m(lat, lon, ps[0], ps[1]) for ps in POLICE_STATIONS)


def hotspot_danger(lat, lon):
    """Return 0–1 danger contribution from nearby hotspots."""
    total = 0.0
    for hs_lat, hs_lon, radius, weight in HOTSPOTS:
        d = haversine_m(lat, lon, hs_lat, hs_lon)
        if d < radius:
            total += weight * (1 - d / radius)
    return min(total, 1.0)


def safe_zone_bonus(lat, lon):
    """Return 0–1 safety bonus from nearby safe zones."""
    total = 0.0
    for sz_lat, sz_lon, radius, weight in SAFE_ZONES:
        d = haversine_m(lat, lon, sz_lat, sz_lon)
        if d < radius:
            total += weight * (1 - d / radius)
    return min(total, 1.0)


def time_risk_factor(hour):
    """
    Returns a multiplier (0.0–1.0) indicating how risky a given hour is.
    Late night (23–04) is most dangerous; midday is safest.
    """
    if 23 <= hour or hour <= 4:
        return 0.85 + random.uniform(0, 0.12)
    elif 5 <= hour <= 6:
        return 0.45 + random.uniform(0, 0.10)
    elif 7 <= hour <= 9:
        return 0.15 + random.uniform(0, 0.08)
    elif 10 <= hour <= 16:
        return 0.10 + random.uniform(0, 0.08)
    elif 17 <= hour <= 19:
        return 0.20 + random.uniform(0, 0.08)
    else:  # 20–22
        return 0.50 + random.uniform(0, 0.15)


def generate_features_for_cell(lat, lon, hour):
    """Generate realistic feature vector for a cell at a given hour."""
    danger = hotspot_danger(lat, lon)
    safe = safe_zone_bonus(lat, lon)
    time_risk = time_risk_factor(hour)
    police_d = nearest_police_dist(lat, lon)

    # Night indicator: 1.0 late night, 0.5 twilight/dawn, 0.0 daytime
    if 21 <= hour or hour <= 4:
        is_night = 1.0
    elif (18 <= hour <= 20) or (5 <= hour <= 6):
        is_night = 0.5
    else:
        is_night = 0.0

    # 1. Street light coverage:
    # In daylight, ambient light is natural; at night streetlights matter critically.
    # Outskirts or high danger spots suffer more broken/missing lights at night.
    base_light = 0.75 - danger * 0.35 + safe * 0.25
    if is_night > 0:
        base_light -= 0.18 * (1.0 - safe * 0.5)  # Outskirts get darker at night
    street_light = max(0.05, min(1.0, base_light + random.gauss(0, 0.06)))

    # 2. Police distance
    police_dist_m = police_d + random.gauss(0, 150)
    police_dist_m = max(50.0, police_dist_m)

    # 3. Crowd density — heavily varies by time
    if 8 <= hour <= 10 or 17 <= hour <= 20:
        base_crowd = 0.75 + safe * 0.1 + danger * 0.05
    elif 11 <= hour <= 16:
        base_crowd = 0.55 + safe * 0.1
    elif 22 <= hour or hour <= 4:
        base_crowd = 0.08 + danger * 0.04
    elif 5 <= hour <= 7:
        base_crowd = 0.25 + safe * 0.05
    else:  # 21-22
        base_crowd = 0.35
    crowd_density = max(0.02, min(0.98, base_crowd + random.gauss(0, 0.06)))

    # 4. Road quality
    base_road = 0.6 + safe * 0.3 - danger * 0.15
    road_quality = max(0.1, min(1.0, base_road + random.gauss(0, 0.06)))

    # 5. CCTV coverage
    base_cctv = 0.3 + safe * 0.5 - danger * 0.1
    if police_d < 500:
        base_cctv += 0.20
    cctv_coverage = max(0.05, min(1.0, base_cctv + random.gauss(0, 0.05)))

    # 6. Historical incident rate (per 1000 sq.m per month)
    # Incidents increase dramatically at night in danger spots
    base_incident = 0.4 + danger * 3.2 - safe * 0.35
    base_incident = max(0.1, base_incident) * (0.4 + 1.3 * time_risk)
    incident_rate = max(0.0, base_incident + random.gauss(0, 0.25))

    return {
        "street_light_coverage": round(street_light, 4),
        "police_station_dist_m": round(police_dist_m, 1),
        "crowd_density": round(crowd_density, 4),
        "road_quality": round(road_quality, 4),
        "cctv_coverage": round(cctv_coverage, 4),
        "historical_incident_rate": round(incident_rate, 4),
        "hour": hour,
        "is_night": is_night,
        "time_risk_score": round(time_risk, 4),
    }


def compute_safety_score(features, hour):
    """
    Ground-truth safety score from features and time parameters.
    Models strong time dependencies:
      - Midday: baseline safety boost due to daytime visibility and activity.
      - Late night: baseline penalty + compounded hazard on unlit/isolated streets.
      - Well-lit, CCTV-monitored, police-proximate avenues hold high safety even at night.
    """
    sl = features["street_light_coverage"]
    pd = min(features["police_station_dist_m"] / 5000.0, 1.0)
    cd = features["crowd_density"]
    rq = features["road_quality"]
    cc = features["cctv_coverage"]
    ir = min(features["historical_incident_rate"] / 4.0, 1.0)
    time_risk = features["time_risk_score"]
    is_night = features["is_night"]

    # Base infrastructure safety
    base_infra = (
        0.20 * sl +
        0.15 * (1.0 - pd) +
        0.12 * cd +
        0.10 * rq +
        0.15 * cc +
        0.15 * (1.0 - ir)
    )

    # Time effect:
    # Daytime (low risk) gives up to +0.08 bonus; Late night gives up to -0.18 penalty
    time_delta = 0.12 * (0.35 - time_risk)

    # Darkness penalty: Poor lighting at night severely amplifies risk
    if is_night > 0.2 and sl < 0.60:
        dark_penalty = -0.16 * is_night * (1.0 - sl)
    else:
        dark_penalty = 0.0

    # Isolation penalty: Empty streets at night far from police
    if is_night > 0.2 and cd < 0.25:
        isolation_penalty = -0.12 * is_night * (1.0 - cd) * pd
    else:
        isolation_penalty = 0.0

    # Safe sanctuary bonus: High CCTV + close police sustains high safety even at night
    if cc > 0.65 and pd < 0.25:
        safe_haven_bonus = 0.08 * is_night
    else:
        safe_haven_bonus = 0.0

    raw = base_infra + time_delta + dark_penalty + isolation_penalty + safe_haven_bonus
    noisy = raw + random.gauss(0, 0.02)
    return round(max(0.05, min(0.98, noisy)), 4)


def generate_dataset(num_cells=600, hours_per_cell=12):
    """
    Generate the full training CSV.
    num_cells * hours_per_cell = total samples  (default 600×12 = 7200)
    """
    random.seed(42)

    # Sample H3 cells across Kolkata
    cells = []
    attempts = 0
    while len(cells) < num_cells and attempts < num_cells * 20:
        lat = random.uniform(KOLKATA_BBOX["min_lat"], KOLKATA_BBOX["max_lat"])
        lon = random.uniform(KOLKATA_BBOX["min_lon"], KOLKATA_BBOX["max_lon"])
        cell = h3.latlng_to_cell(lat, lon, H3_RESOLUTION)
        if cell not in cells:
            cells.append(cell)
        attempts += 1

    print(f"Sampled {len(cells)} unique H3 cells for training data.")

    rows = []
    for cell in cells:
        clat, clon = h3.cell_to_latlng(cell)
        # Pick a random subset of hours covering day, evening, and night
        sampled_hours = sorted(random.sample(range(24), hours_per_cell))
        for hour in sampled_hours:
            dow = random.randint(0, 6)
            feats = generate_features_for_cell(clat, clon, hour)
            safety = compute_safety_score(feats, hour)

            rows.append({
                "h3_index": cell,
                "hour": hour,
                "dow": dow,
                "lat": round(clat, 6),
                "lon": round(clon, 6),
                **feats,
                "safety_score": safety,
            })

    # Shuffle rows
    random.shuffle(rows)

    # Write CSV
    out_path = os.path.join(OUTPUT_DIR, "training_data.csv")
    fieldnames = [
        "h3_index", "hour", "dow", "lat", "lon",
        "street_light_coverage", "police_station_dist_m",
        "crowd_density", "road_quality", "cctv_coverage",
        "historical_incident_rate", "is_night", "time_risk_score",
        "safety_score",
    ]
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Training data written to {out_path}")
    print(f"Total samples: {len(rows)}")
    print(f"Features: {fieldnames[5:-1]}")
    print(f"Label: safety_score (0=dangerous, 1=safe)")
    return out_path


if __name__ == "__main__":
    generate_dataset()
