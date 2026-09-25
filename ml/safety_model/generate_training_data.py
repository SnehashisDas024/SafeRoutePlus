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
        return 0.85 + random.uniform(0, 0.15)
    elif 5 <= hour <= 6:
        return 0.45 + random.uniform(0, 0.15)
    elif 7 <= hour <= 9:
        return 0.15 + random.uniform(0, 0.10)
    elif 10 <= hour <= 16:
        return 0.10 + random.uniform(0, 0.10)
    elif 17 <= hour <= 19:
        return 0.20 + random.uniform(0, 0.10)
    else:  # 20–22
        return 0.50 + random.uniform(0, 0.20)


def generate_features_for_cell(lat, lon, hour):
    """Generate realistic 6-feature vector for a cell at a given hour."""
    danger = hotspot_danger(lat, lon)
    safe = safe_zone_bonus(lat, lon)
    time_risk = time_risk_factor(hour)
    police_d = nearest_police_dist(lat, lon)

    # 1. Street light coverage — lower at night edges of city, higher in centre
    base_light = 0.75 - danger * 0.3 + safe * 0.2
    if 18 <= hour or hour <= 5:
        base_light -= 0.1  # some lights out at night
    street_light = max(0, min(1, base_light + random.gauss(0, 0.08)))

    # 2. Police distance (already computed)
    police_dist_m = police_d + random.gauss(0, 200)
    police_dist_m = max(50, police_dist_m)

    # 3. Crowd density — varies by time
    if 8 <= hour <= 10 or 17 <= hour <= 20:
        base_crowd = 0.7 + safe * 0.1 + danger * 0.1
    elif 11 <= hour <= 16:
        base_crowd = 0.5 + safe * 0.1
    elif 22 <= hour or hour <= 5:
        base_crowd = 0.1 + danger * 0.05
    else:
        base_crowd = 0.3
    crowd_density = max(0, min(1, base_crowd + random.gauss(0, 0.1)))

    # 4. Road quality
    base_road = 0.6 + safe * 0.3 - danger * 0.15
    road_quality = max(0, min(1, base_road + random.gauss(0, 0.08)))

    # 5. CCTV coverage
    base_cctv = 0.3 + safe * 0.5 - danger * 0.1
    if police_d < 500:
        base_cctv += 0.15
    cctv_coverage = max(0, min(1, base_cctv + random.gauss(0, 0.07)))

    # 6. Historical incident rate (per 1000 sq.m per month)
    base_incident = 0.5 + danger * 3.0 - safe * 0.3
    base_incident *= (0.5 + time_risk)
    incident_rate = max(0, base_incident + random.gauss(0, 0.3))

    return {
        "street_light_coverage": round(street_light, 4),
        "police_station_dist_m": round(police_dist_m, 1),
        "crowd_density": round(crowd_density, 4),
        "road_quality": round(road_quality, 4),
        "cctv_coverage": round(cctv_coverage, 4),
        "historical_incident_rate": round(incident_rate, 4),
    }


def compute_safety_score(features, hour):
    """
    Ground-truth safety score from features.

    Formula (weights reflect domain intuition):
      safety = 0.25 * street_light
             + 0.15 * (1 - clamp(police_dist / 5000, 0, 1))
             + 0.15 * crowd_density
             + 0.10 * road_quality
             + 0.15 * cctv_coverage
             + 0.20 * (1 - clamp(incident_rate / 4.0, 0, 1))

    Then add small gaussian noise to simulate labelling imprecision.
    """
    sl = features["street_light_coverage"]
    pd = min(features["police_station_dist_m"] / 5000.0, 1.0)
    cd = features["crowd_density"]
    rq = features["road_quality"]
    cc = features["cctv_coverage"]
    ir = min(features["historical_incident_rate"] / 4.0, 1.0)

    raw = (
        0.25 * sl +
        0.15 * (1 - pd) +
        0.15 * cd +
        0.10 * rq +
        0.15 * cc +
        0.20 * (1 - ir)
    )
    noisy = raw + random.gauss(0, 0.03)
    return round(max(0.0, min(1.0, noisy)), 4)


def generate_dataset(num_cells=600, hours_per_cell=8):
    """
    Generate the full training CSV.
    num_cells * hours_per_cell = total samples  (default 600×8 = 4800)
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
        # Pick a random subset of hours to keep data diverse
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
        "historical_incident_rate", "safety_score",
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
