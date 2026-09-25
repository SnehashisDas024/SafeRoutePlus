# Shared constants for risk aggregation (extracted from build_risk_table.py)
# Used by both ML pipeline and runtime aggregator

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

# H3 resolution for Kolkata cells
H3_RESOLUTION = 9

# Predefined tag vocabulary for tag suggester
TAG_VOCAB = list(TAG_RISK.keys())

# Minimum samples for high confidence
MIN_SAMPLES_HIGH_CONFIDENCE = 2

# Aggregator run interval (minutes)
AGGREGATOR_INTERVAL_MINUTES = 60

# Kolkata bounding box (min_lat, min_lon, max_lat, max_lon)
KOLKATA_BBOX = (22.45, 88.25, 22.70, 88.50)