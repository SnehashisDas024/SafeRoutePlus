"""
SafeRoute+ — ML Model Inference Module
=======================================

Loads the trained model and predicts safety scores for route segments.
Used by the backend route scoring pipeline.
"""

import os
import math
import random
import numpy as np

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "safety_model.joblib")

FEATURE_COLUMNS = [
    "street_light_coverage",
    "police_station_dist_m",
    "crowd_density",
    "road_quality",
    "cctv_coverage",
    "historical_incident_rate",
]

# Police stations in Kolkata (same as training data)
POLICE_STATIONS = [
    (22.5600, 88.3600), (22.5800, 88.3700), (22.5400, 88.3500),
    (22.6000, 88.3800), (22.5200, 88.3300), (22.5700, 88.4200),
    (22.6300, 88.4000), (22.5000, 88.3000), (22.5550, 88.3430),
    (22.5900, 88.3650),
]

HOTSPOTS = [
    (22.560, 88.360, 1500, 0.7),
    (22.570, 88.370, 1000, 0.6),
    (22.540, 88.350, 800,  0.5),
    (22.520, 88.330, 1200, 0.6),
    (22.500, 88.300, 2000, 0.4),
]

SAFE_ZONES = [
    (22.600, 88.380, 1500, 0.8),
    (22.630, 88.400, 2000, 0.9),
    (22.575, 88.365, 800,  0.7),
]

_model_cache = None


def _haversine_m(lat1, lon1, lat2, lon2):
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return 6_371_000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def load_model():
    """Load the trained model from disk (cached)."""
    global _model_cache
    if _model_cache is not None:
        return _model_cache

    if not os.path.exists(MODEL_PATH):
        print(f"[SafetyModel] WARNING: No trained model at {MODEL_PATH}. Using fallback.")
        return None

    import joblib
    data = joblib.load(MODEL_PATH)
    _model_cache = data["model"]
    print(f"[SafetyModel] Loaded model (R²={data.get('test_r2', '?'):.4f}, "
          f"trained on {data.get('training_samples', '?')} samples)")
    return _model_cache


def estimate_features_for_location(lat, lon, hour):
    """
    Estimate the 6 safety features for a given location and hour.
    In production, these would come from the static_features table + real-time data.
    For demo, we synthesize them deterministically from geography.
    """
    # Use lat/lon as seed for deterministic but varied values
    seed_val = int(abs(lat * 10000 + lon * 10000)) % 100000
    rng = random.Random(seed_val + hour)

    # Police distance
    police_dist = min(_haversine_m(lat, lon, ps[0], ps[1]) for ps in POLICE_STATIONS)

    # Hotspot danger
    danger = 0.0
    for hs_lat, hs_lon, radius, weight in HOTSPOTS:
        d = _haversine_m(lat, lon, hs_lat, hs_lon)
        if d < radius:
            danger += weight * (1 - d / radius)
    danger = min(danger, 1.0)

    # Safe zone bonus
    safe = 0.0
    for sz_lat, sz_lon, radius, weight in SAFE_ZONES:
        d = _haversine_m(lat, lon, sz_lat, sz_lon)
        if d < radius:
            safe += weight * (1 - d / radius)
    safe = min(safe, 1.0)

    # Street lights
    base_light = 0.75 - danger * 0.3 + safe * 0.2
    if 18 <= hour or hour <= 5:
        base_light -= 0.1
    street_light = max(0, min(1, base_light + rng.gauss(0, 0.05)))

    # Crowd density
    if 8 <= hour <= 10 or 17 <= hour <= 20:
        base_crowd = 0.7 + safe * 0.1 + danger * 0.1
    elif 11 <= hour <= 16:
        base_crowd = 0.5 + safe * 0.1
    elif 22 <= hour or hour <= 5:
        base_crowd = 0.1 + danger * 0.05
    else:
        base_crowd = 0.3
    crowd = max(0, min(1, base_crowd + rng.gauss(0, 0.05)))

    # Road quality
    road_q = max(0, min(1, 0.6 + safe * 0.3 - danger * 0.15 + rng.gauss(0, 0.05)))

    # CCTV
    base_cctv = 0.3 + safe * 0.5 - danger * 0.1
    if police_dist < 500:
        base_cctv += 0.15
    cctv = max(0, min(1, base_cctv + rng.gauss(0, 0.05)))

    # Incident rate
    time_risk = 0.5
    if 23 <= hour or hour <= 4:
        time_risk = 0.9
    elif 20 <= hour <= 22:
        time_risk = 0.6
    elif 7 <= hour <= 16:
        time_risk = 0.15
    incident = max(0, 0.5 + danger * 3.0 - safe * 0.3) * (0.5 + time_risk)
    incident += rng.gauss(0, 0.15)
    incident = max(0, incident)

    return {
        "street_light_coverage": round(street_light, 4),
        "police_station_dist_m": round(police_dist, 1),
        "crowd_density": round(crowd, 4),
        "road_quality": round(road_q, 4),
        "cctv_coverage": round(cctv, 4),
        "historical_incident_rate": round(incident, 4),
    }


def predict_safety(lat, lon, hour):
    """
    Predict safety score for a location/time using the trained ML model.

    Returns:
        dict with 'score' (0-1, higher=safer), 'confidence', and 'factors' breakdown
    """
    model = load_model()
    features = estimate_features_for_location(lat, lon, hour)

    if model is not None:
        feature_vec = np.array([[features[col] for col in FEATURE_COLUMNS]])
        raw_score = float(model.predict(feature_vec)[0])
        score = max(0.0, min(1.0, raw_score))
        confidence = "high"
    else:
        # Fallback: weighted sum (same as ground-truth formula)
        sl = features["street_light_coverage"]
        pd = min(features["police_station_dist_m"] / 5000.0, 1.0)
        cd = features["crowd_density"]
        rq = features["road_quality"]
        cc = features["cctv_coverage"]
        ir = min(features["historical_incident_rate"] / 4.0, 1.0)
        score = 0.25 * sl + 0.15 * (1 - pd) + 0.15 * cd + 0.10 * rq + 0.15 * cc + 0.20 * (1 - ir)
        score = max(0.0, min(1.0, score))
        confidence = "estimated"

    return {
        "score": round(score, 4),
        "confidence": confidence,
        "factors": {
            "street_light_coverage": features["street_light_coverage"],
            "police_station_proximity": round(1 - min(features["police_station_dist_m"] / 5000, 1.0), 4),
            "crowd_density": features["crowd_density"],
            "road_quality": features["road_quality"],
            "cctv_coverage": features["cctv_coverage"],
            "incident_safety": round(1 - min(features["historical_incident_rate"] / 4.0, 1.0), 4),
        },
    }


def predict_batch(locations, hour):
    """
    Batch predict safety for multiple (lat, lon) locations.
    More efficient than calling predict_safety in a loop.

    Args:
        locations: list of (lat, lon) tuples
        hour: int (0-23)

    Returns:
        list of prediction dicts
    """
    model = load_model()
    results = []

    if model is not None:
        all_features = []
        all_feature_dicts = []
        for lat, lon in locations:
            feats = estimate_features_for_location(lat, lon, hour)
            all_feature_dicts.append(feats)
            all_features.append([feats[col] for col in FEATURE_COLUMNS])

        X = np.array(all_features)
        predictions = model.predict(X)

        for i, (lat, lon) in enumerate(locations):
            score = max(0.0, min(1.0, float(predictions[i])))
            feats = all_feature_dicts[i]
            results.append({
                "score": round(score, 4),
                "confidence": "high",
                "factors": {
                    "street_light_coverage": feats["street_light_coverage"],
                    "police_station_proximity": round(1 - min(feats["police_station_dist_m"] / 5000, 1.0), 4),
                    "crowd_density": feats["crowd_density"],
                    "road_quality": feats["road_quality"],
                    "cctv_coverage": feats["cctv_coverage"],
                    "incident_safety": round(1 - min(feats["historical_incident_rate"] / 4.0, 1.0), 4),
                },
            })
    else:
        for lat, lon in locations:
            results.append(predict_safety(lat, lon, hour))

    return results
