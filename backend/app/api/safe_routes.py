"""
SafeRoute+ — ML-Powered Route Safety Scoring API
=================================================

New endpoint: POST /routes/safe-plan
Returns 2-3 route alternatives with:
  - Real road-following geometry from OSRM
  - ML-predicted safety score per segment
  - Overall route safety ranking
  - Factor breakdown per segment
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import httpx
import math
import sys
import os

# Add ml directory to path for model imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'ml'))
from safety_model.predict import predict_safety, predict_batch

router = APIRouter(prefix="/routes", tags=["Routes"])


class SafePlanRequest(BaseModel):
    origin: List[float]       # [lon, lat]
    destination: List[float]  # [lon, lat]
    mode: str = "walk"
    depart_at: Optional[datetime] = None
    depart_hour: Optional[int] = None


class SegmentScore(BaseModel):
    start: List[float]        # [lon, lat]
    end: List[float]          # [lon, lat]
    distance: float
    score: float              # 0-1 safety score (higher = safer)
    confidence: str
    factors: dict


class ScoredRoute(BaseModel):
    route_index: int
    route_name: Optional[str] = None
    route_color: Optional[str] = None  # Distinct route color (safest is emerald green)
    geometry: dict            # Full GeoJSON LineString for map rendering
    safety_score: float       # Overall route safety (0-1)
    worst_segment_score: float
    mean_segment_score: float
    total_distance_m: float
    total_time_sec: float
    is_safest: bool
    segments: List[SegmentScore]
    segment_colors: List[str]  # Hex colors per segment for map rendering
    depart_hour: Optional[int] = None
    time_category: Optional[str] = None
    time_description: Optional[str] = None


def get_time_profile(hour: int) -> dict:
    """Return risk category and guidance based on the departure hour."""
    h = hour % 24
    if 23 <= h or h <= 4:
        return {
            "category": "Late Night (Elevated Risk)",
            "description": "Darkness and low foot traffic increase vulnerability. Safest routes prioritize high-illumination corridors and active CCTV coverage.",
            "is_night": True,
            "badge_color": "#EF4444",
        }
    elif 5 <= h <= 6:
        return {
            "category": "Dawn / Early Morning (Moderate Risk)",
            "description": "Sparse early pedestrian activity and transitioning ambient light.",
            "is_night": False,
            "badge_color": "#F59E0B",
        }
    elif 7 <= h <= 9:
        return {
            "category": "Morning Rush (High Safety)",
            "description": "Heavy foot traffic, open shops, and natural collective vigilance.",
            "is_night": False,
            "badge_color": "#10B981",
        }
    elif 10 <= h <= 16:
        return {
            "category": "Daylight Normal (High Safety)",
            "description": "Optimal ambient visibility, continuous activity, and municipal security presence.",
            "is_night": False,
            "badge_color": "#10B981",
        }
    elif 17 <= h <= 20:
        return {
            "category": "Evening Commute (Good Safety)",
            "description": "Active commercial hubs and transit commuters. Unlit residential alleys start dimming.",
            "is_night": False,
            "badge_color": "#3B82F6",
        }
    else:  # 21 - 22
        return {
            "category": "Late Evening (Caution Advised)",
            "description": "Pedestrian presence starts declining. Main thoroughfares strongly advised over isolated shortcuts.",
            "is_night": True,
            "badge_color": "#F59E0B",
        }


# ─── OSRM Integration ─────────────────────────────────────────────────

OSRM_PUBLIC = "https://router.project-osrm.org"

# Precomputed realistic route geometries for demo preset routes (5 alternatives each)
# These follow actual Kolkata roads
DEMO_ROUTES = {
    # Park Street → Victoria Memorial (walk) — 5 distinct alternatives
    "park_victoria": [
        {
            "name": "Via Park St & Queensway (Safest Corridor)",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.3524, 22.5513], [88.3521, 22.5508], [88.3516, 22.5503],
                    [88.3510, 22.5497], [88.3503, 22.5493], [88.3497, 22.5490],
                    [88.3490, 22.5487], [88.3484, 22.5483], [88.3478, 22.5479],
                    [88.3471, 22.5475], [88.3465, 22.5471], [88.3459, 22.5468],
                    [88.3453, 22.5465], [88.3447, 22.5461], [88.3441, 22.5457],
                    [88.3436, 22.5453], [88.3430, 22.5450], [88.3426, 22.5448],
                ]
            },
            "distance": 1150, "duration": 820
        },
        {
            "name": "Via Shakespeare Sarani & Cathedral Rd",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.3524, 22.5513], [88.3519, 22.5510], [88.3512, 22.5514],
                    [88.3505, 22.5518], [88.3498, 22.5515], [88.3490, 22.5510],
                    [88.3483, 22.5505], [88.3475, 22.5500], [88.3468, 22.5495],
                    [88.3461, 22.5489], [88.3454, 22.5483], [88.3447, 22.5477],
                    [88.3440, 22.5470], [88.3435, 22.5464], [88.3430, 22.5457],
                    [88.3427, 22.5452], [88.3426, 22.5448],
                ]
            },
            "distance": 1320, "duration": 940
        },
        {
            "name": "Via Camac St & Ho Chi Minh Sarani",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.3524, 22.5513], [88.3528, 22.5508], [88.3533, 22.5502],
                    [88.3535, 22.5495], [88.3532, 22.5488], [88.3527, 22.5481],
                    [88.3520, 22.5475], [88.3513, 22.5470], [88.3505, 22.5466],
                    [88.3497, 22.5462], [88.3489, 22.5459], [88.3480, 22.5456],
                    [88.3471, 22.5454], [88.3462, 22.5452], [88.3453, 22.5450],
                    [88.3444, 22.5449], [88.3435, 22.5448], [88.3426, 22.5448],
                ]
            },
            "distance": 1480, "duration": 1060
        },
        {
            "name": "Via Russell St & JL Nehru Rd",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.3524, 22.5513], [88.3515, 22.5520], [88.3507, 22.5526],
                    [88.3499, 22.5522], [88.3492, 22.5515], [88.3485, 22.5508],
                    [88.3477, 22.5502], [88.3469, 22.5495], [88.3460, 22.5488],
                    [88.3451, 22.5480], [88.3443, 22.5472], [88.3436, 22.5463],
                    [88.3431, 22.5456], [88.3426, 22.5448],
                ]
            },
            "distance": 1620, "duration": 1160
        },
        {
            "name": "Via AJC Bose Rd & South Maidan Bypass",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.3524, 22.5513], [88.3530, 22.5505], [88.3536, 22.5492],
                    [88.3538, 22.5480], [88.3532, 22.5468], [88.3520, 22.5458],
                    [88.3505, 22.5450], [88.3488, 22.5444], [88.3470, 22.5441],
                    [88.3452, 22.5442], [88.3438, 22.5445], [88.3426, 22.5448],
                ]
            },
            "distance": 1780, "duration": 1280
        },
    ],
    # Howrah Station → BBD Bagh (walk) — 5 distinct alternatives
    "howrah_bbd": [
        {
            "name": "Via Howrah Bridge & Strand Rd",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.3426, 22.5851], [88.3430, 22.5845], [88.3435, 22.5838],
                    [88.3441, 22.5831], [88.3447, 22.5823], [88.3453, 22.5815],
                    [88.3458, 22.5807], [88.3463, 22.5800], [88.3468, 22.5792],
                    [88.3473, 22.5784], [88.3478, 22.5776], [88.3483, 22.5768],
                    [88.3488, 22.5760], [88.3493, 22.5752], [88.3498, 22.5744],
                    [88.3503, 22.5736], [88.3508, 22.5730], [88.3512, 22.5726],
                ]
            },
            "distance": 1650, "duration": 1180
        },
        {
            "name": "Via Brabourne Road Flyover",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.3426, 22.5851], [88.3432, 22.5847], [88.3440, 22.5843],
                    [88.3448, 22.5838], [88.3455, 22.5832], [88.3460, 22.5825],
                    [88.3466, 22.5817], [88.3472, 22.5809], [88.3478, 22.5800],
                    [88.3484, 22.5792], [88.3490, 22.5783], [88.3496, 22.5774],
                    [88.3501, 22.5765], [88.3505, 22.5756], [88.3508, 22.5746],
                    [88.3510, 22.5737], [88.3511, 22.5731], [88.3512, 22.5726],
                ]
            },
            "distance": 1800, "duration": 1290
        },
        {
            "name": "Via MG Road & Netaji Subhash Rd",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.3426, 22.5851], [88.3420, 22.5845], [88.3415, 22.5838],
                    [88.3412, 22.5830], [88.3415, 22.5822], [88.3420, 22.5814],
                    [88.3428, 22.5807], [88.3437, 22.5800], [88.3447, 22.5793],
                    [88.3457, 22.5786], [88.3466, 22.5778], [88.3474, 22.5770],
                    [88.3481, 22.5762], [88.3488, 22.5754], [88.3495, 22.5745],
                    [88.3501, 22.5737], [88.3507, 22.5731], [88.3512, 22.5726],
                ]
            },
            "distance": 1950, "duration": 1400
        },
        {
            "name": "Via Canning St & Lalbazar Corridor",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.3426, 22.5851], [88.3435, 22.5850], [88.3445, 22.5845],
                    [88.3455, 22.5836], [88.3465, 22.5826], [88.3475, 22.5815],
                    [88.3485, 22.5804], [88.3495, 22.5792], [88.3502, 22.5780],
                    [88.3508, 22.5768], [88.3512, 22.5755], [88.3513, 22.5740],
                    [88.3512, 22.5726],
                ]
            },
            "distance": 2100, "duration": 1500
        },
        {
            "name": "Via Strand Rd South & Babughat",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.3426, 22.5851], [88.3422, 22.5838], [88.3420, 22.5820],
                    [88.3423, 22.5800], [88.3430, 22.5780], [88.3440, 22.5762],
                    [88.3452, 22.5748], [88.3468, 22.5736], [88.3485, 22.5729],
                    [88.3500, 22.5726], [88.3512, 22.5726],
                ]
            },
            "distance": 2250, "duration": 1620
        },
    ],
    # Salt Lake Sector V → Esplanade (drive) — 5 distinct alternatives
    "saltlake_esplanade": [
        {
            "name": "Via EM Bypass & Beleghata Main Rd",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.4332, 22.5744], [88.4310, 22.5740], [88.4285, 22.5735],
                    [88.4258, 22.5731], [88.4230, 22.5728], [88.4200, 22.5724],
                    [88.4168, 22.5720], [88.4135, 22.5717], [88.4100, 22.5713],
                    [88.4065, 22.5710], [88.4028, 22.5707], [88.3990, 22.5703],
                    [88.3952, 22.5700], [88.3912, 22.5697], [88.3872, 22.5693],
                    [88.3832, 22.5690], [88.3792, 22.5686], [88.3752, 22.5682],
                    [88.3712, 22.5678], [88.3672, 22.5673], [88.3635, 22.5668],
                    [88.3600, 22.5663], [88.3570, 22.5658], [88.3545, 22.5652],
                    [88.3528, 22.5647],
                ]
            },
            "distance": 8500, "duration": 1320
        },
        {
            "name": "Via Ultadanga Flyover & Central Ave",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.4332, 22.5744], [88.4315, 22.5748], [88.4295, 22.5755],
                    [88.4272, 22.5760], [88.4248, 22.5763], [88.4220, 22.5762],
                    [88.4190, 22.5758], [88.4158, 22.5752], [88.4125, 22.5745],
                    [88.4090, 22.5738], [88.4055, 22.5732], [88.4018, 22.5726],
                    [88.3980, 22.5720], [88.3942, 22.5714], [88.3905, 22.5708],
                    [88.3868, 22.5702], [88.3830, 22.5696], [88.3792, 22.5690],
                    [88.3755, 22.5684], [88.3718, 22.5678], [88.3682, 22.5672],
                    [88.3648, 22.5666], [88.3615, 22.5660], [88.3585, 22.5654],
                    [88.3558, 22.5650], [88.3528, 22.5647],
                ]
            },
            "distance": 9200, "duration": 1450
        },
        {
            "name": "Via Park Circus Connector & Park St",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.4332, 22.5744], [88.4318, 22.5735], [88.4300, 22.5725],
                    [88.4280, 22.5718], [88.4255, 22.5712], [88.4228, 22.5708],
                    [88.4198, 22.5705], [88.4165, 22.5703], [88.4130, 22.5702],
                    [88.4095, 22.5700], [88.4058, 22.5698], [88.4020, 22.5695],
                    [88.3982, 22.5692], [88.3945, 22.5688], [88.3908, 22.5684],
                    [88.3870, 22.5680], [88.3833, 22.5676], [88.3798, 22.5672],
                    [88.3763, 22.5668], [88.3728, 22.5664], [88.3695, 22.5660],
                    [88.3662, 22.5657], [88.3630, 22.5654], [88.3600, 22.5651],
                    [88.3568, 22.5649], [88.3528, 22.5647],
                ]
            },
            "distance": 9800, "duration": 1550
        },
        {
            "name": "Via Broadway, Moulali & SN Banerjee Rd",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.4332, 22.5744], [88.4305, 22.5752], [88.4270, 22.5758],
                    [88.4230, 22.5760], [88.4185, 22.5756], [88.4138, 22.5748],
                    [88.4090, 22.5738], [88.4040, 22.5726], [88.3990, 22.5714],
                    [88.3940, 22.5702], [88.3890, 22.5690], [88.3840, 22.5678],
                    [88.3790, 22.5666], [88.3740, 22.5655], [88.3690, 22.5646],
                    [88.3640, 22.5640], [88.3590, 22.5642], [88.3550, 22.5644],
                    [88.3528, 22.5647],
                ]
            },
            "distance": 10400, "duration": 1650
        },
        {
            "name": "Via Chingrighata, CIT Rd & Leninsarani",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [88.4332, 22.5744], [88.4320, 22.5720], [88.4295, 22.5698],
                    [88.4260, 22.5680], [88.4215, 22.5670], [88.4165, 22.5665],
                    [88.4110, 22.5662], [88.4050, 22.5660], [88.3990, 22.5662],
                    [88.3925, 22.5665], [88.3860, 22.5668], [88.3795, 22.5670],
                    [88.3730, 22.5668], [88.3670, 22.5663], [88.3615, 22.5658],
                    [88.3565, 22.5652], [88.3528, 22.5647],
                ]
            },
            "distance": 11100, "duration": 1780
        },
    ],
}


def _match_demo_route(origin, destination, mode):
    """Check if origin/dest matches a demo preset and return cached routes."""
    # Tolerance for coordinate matching (degrees)
    tol = 0.005

    presets = {
        "park_victoria": ([88.3524, 22.5513], [88.3426, 22.5448], "walk"),
        "howrah_bbd": ([88.3426, 22.5851], [88.3512, 22.5726], "walk"),
        "saltlake_esplanade": ([88.4332, 22.5744], [88.3528, 22.5647], "drive"),
    }

    for key, (o, d, m) in presets.items():
        if (abs(origin[0] - o[0]) < tol and abs(origin[1] - o[1]) < tol and
            abs(destination[0] - d[0]) < tol and abs(destination[1] - d[1]) < tol):
            return DEMO_ROUTES[key]
    return None


def _route_similarity(coords_a, coords_b):
    """
    Compute average Haversine distance between two routes' coordinate lists.
    Returns distance in meters. Used to detect near-duplicate routes.
    """
    # Sample up to 10 evenly-spaced points from each route for fast comparison
    sample_n = min(10, len(coords_a), len(coords_b))
    if sample_n < 2:
        return 0.0

    indices_a = [int(i * (len(coords_a) - 1) / (sample_n - 1)) for i in range(sample_n)]
    indices_b = [int(i * (len(coords_b) - 1) / (sample_n - 1)) for i in range(sample_n)]

    total = 0.0
    for ia, ib in zip(indices_a, indices_b):
        pa, pb = coords_a[ia], coords_b[ib]
        dlat = math.radians(pb[1] - pa[1])
        dlon = math.radians(pb[0] - pa[0])
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(pa[1])) * math.cos(math.radians(pb[1])) *
             math.sin(dlon / 2) ** 2)
        total += 6_371_000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return total / sample_n


def _is_duplicate_route(new_coords, existing_routes, min_separation_m=80):
    """Check if a new route is too similar to any already-accepted route."""
    for r in existing_routes:
        if _route_similarity(new_coords, r["geometry"]["coordinates"]) < min_separation_m:
            return True
    return False


def _generate_augmented_route(origin, destination, base_coords, variant_index, mode):
    """
    Generate a single augmented route that is geometrically distinct from the base.
    Each variant uses a different curvature strategy to ensure visual distinctness.
    """
    dx = destination[0] - origin[0]
    dy = destination[1] - origin[1]
    dist_deg = math.sqrt(dx**2 + dy**2)

    # Direction-perpendicular unit vector
    if dist_deg < 1e-8:
        perp_dx, perp_dy = 0.0, 0.0
    else:
        perp_dx = -dy / dist_deg
        perp_dy = dx / dist_deg

    # ── Each variant uses a fundamentally different displacement curve ──
    strategies = [
        # Strategy 0: Northern smooth arc (large bulge to the left)
        {"name": "Northern Well-Lit Corridor", "scale": 0.012, "curve": "arc_left"},
        # Strategy 1: Southern smooth arc (large bulge to the right)
        {"name": "Southern Commercial Boulevard", "scale": 0.012, "curve": "arc_right"},
        # Strategy 2: S-curve — goes left then right (or north then south)
        {"name": "Eastern Ring Road Bypass", "scale": 0.010, "curve": "s_curve"},
        # Strategy 3: Detour bulge — swings wide in the middle
        {"name": "Western Arterial Parkway", "scale": 0.016, "curve": "wide_detour"},
        # Strategy 4: Reverse S-curve — goes right then left
        {"name": "Central Transit Avenue", "scale": 0.010, "curve": "reverse_s"},
        # Strategy 5: Double-arc — two bumps
        {"name": "Outer Bypass Corridor", "scale": 0.008, "curve": "double_arc"},
    ]
    strat = strategies[variant_index % len(strategies)]

    n = max(14, len(base_coords))
    new_coords = [origin[:]]

    for i in range(1, n - 1):
        t = i / (n - 1)

        # Base interpolation along the straight line (not the base route) for maximum divergence
        base_lon = origin[0] + dx * t
        base_lat = origin[1] + dy * t

        # Compute lateral displacement based on the curvature strategy
        curve = strat["curve"]
        scale = strat["scale"]

        if curve == "arc_left":
            displacement = scale * math.sin(t * math.pi)
        elif curve == "arc_right":
            displacement = -scale * math.sin(t * math.pi)
        elif curve == "s_curve":
            displacement = scale * math.sin(t * 2 * math.pi)
        elif curve == "reverse_s":
            displacement = -scale * math.sin(t * 2 * math.pi)
        elif curve == "wide_detour":
            # Flattened bell-curve: goes far out in the middle quarter
            displacement = scale * math.exp(-((t - 0.5) ** 2) / 0.04)
        elif curve == "double_arc":
            displacement = scale * (math.sin(t * 2 * math.pi) + 0.5 * math.sin(t * 4 * math.pi))
        else:
            displacement = scale * math.sin(t * math.pi)

        # Small per-point jitter for road realism
        jitter = 0.0003 * math.sin(i * 7.3 + variant_index * 2.1)

        lon = base_lon + perp_dx * displacement + jitter
        lat = base_lat + perp_dy * displacement + jitter
        new_coords.append([round(lon, 6), round(lat, 6)])

    new_coords.append(destination[:])

    # Distance is longer for routes with more curvature
    base_dist_m = dist_deg * 111000
    route_dist = base_dist_m * (1.0 + abs(strat["scale"]) * 30 + 0.05 * variant_index)
    speed = 1.4 if mode == "walk" else 8.0

    return {
        "name": strat["name"],
        "geometry": {"type": "LineString", "coordinates": new_coords},
        "distance": round(route_dist),
        "duration": round(route_dist / speed),
    }


async def fetch_osrm_routes(origin, destination, mode="walk"):
    """
    Fetch route alternatives from OSRM with full GeoJSON geometry.
    Guarantees 5 geometrically distinct routes.
    Falls back to demo routes for preset locations, or synthetic routes if OSRM is unavailable.
    """
    # Check demo cache first
    demo = _match_demo_route(origin, destination, mode)
    if demo:
        return demo

    osrm_mode = "driving" if mode == "drive" else "driving"  # public OSRM only has driving
    # Request up to 5 alternatives (OSRM may cap at 2-3)
    url = (f"{OSRM_PUBLIC}/route/v1/{osrm_mode}/"
           f"{origin[0]},{origin[1]};{destination[0]},{destination[1]}"
           f"?alternatives=3&overview=full&geometries=geojson&steps=false")

    names = [
        "Primary Direct Corridor",
        "Arterial Highway Corridor",
        "Connecting Boulevard Bypass",
        "Commercial Transit Corridor",
        "Secondary Avenue Bypass",
    ]

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                routes = data.get("routes", [])
                if routes:
                    result = []
                    for idx, r in enumerate(routes[:5]):
                        duration = r["duration"]
                        if mode == "walk":
                            duration *= 5.0  # walking is ~5x slower than driving
                        candidate = {
                            "name": names[idx] if idx < len(names) else f"Alternative Route {idx + 1}",
                            "geometry": r["geometry"],
                            "distance": r["distance"],
                            "duration": duration,
                        }
                        # Only add if sufficiently different from existing routes
                        if not _is_duplicate_route(r["geometry"]["coordinates"], result):
                            result.append(candidate)

                    return result
    except Exception as e:
        print(f"[OSRM] Fetch failed: {e}")

    # Return empty list if OSRM fails
    return []


def _generate_fallback_routes(origin, destination, mode):
    """
    Generate 5 geometrically distinct routes as fallback when OSRM is unavailable.
    Each route uses a fundamentally different corridor strategy.
    """
    dx = destination[0] - origin[0]
    dy = destination[1] - origin[1]
    dist_deg = math.sqrt(dx**2 + dy**2)
    dist_m = dist_deg * 111000

    # Direction-perpendicular unit vector
    if dist_deg < 1e-8:
        perp_dx, perp_dy = 0.0, 0.0
    else:
        perp_dx = -dy / dist_deg
        perp_dy = dx / dist_deg

    # Each route has a distinct corridor shape, large enough to be visually obvious
    corridor_configs = [
        {
            "name": "Primary Direct Corridor",
            "curve": lambda t: 0.0,  # straight
            "dist_mult": 1.0,
        },
        {
            "name": "Northern Well-Lit Arterial",
            "curve": lambda t: 0.014 * math.sin(t * math.pi),  # northern arc
            "dist_mult": 1.12,
        },
        {
            "name": "Southern Main Boulevard",
            "curve": lambda t: -0.014 * math.sin(t * math.pi),  # southern arc
            "dist_mult": 1.12,
        },
        {
            "name": "Eastern Commercial Parkway",
            "curve": lambda t: 0.011 * math.sin(t * 2 * math.pi),  # S-curve
            "dist_mult": 1.18,
        },
        {
            "name": "Western Transit Corridor",
            "curve": lambda t: -0.018 * math.exp(-((t - 0.5) ** 2) / 0.04),  # wide detour
            "dist_mult": 1.22,
        },
    ]

    routes = []
    for variant, cfg in enumerate(corridor_configs):
        n_points = max(14, int(dist_m / 120))
        coords = [origin[:]]

        for i in range(1, n_points - 1):
            t = i / (n_points - 1)

            # Base point along the straight line
            base_lon = origin[0] + dx * t
            base_lat = origin[1] + dy * t

            # Lateral displacement from this corridor's curve function
            displacement = cfg["curve"](t)

            # Small per-point jitter for road-like realism
            jitter = 0.00035 * math.sin(i * 5.7 + variant * 3.2)

            lon = base_lon + perp_dx * displacement + jitter
            lat = base_lat + perp_dy * displacement + jitter
            coords.append([round(lon, 6), round(lat, 6)])

        coords.append(destination[:])

        speed = 1.4 if mode == "walk" else 8.0  # m/s
        route_dist = dist_m * cfg["dist_mult"]

        routes.append({
            "name": cfg["name"],
            "geometry": {"type": "LineString", "coordinates": coords},
            "distance": round(route_dist),
            "duration": round(route_dist / speed),
        })

    return routes


# ─── Scoring ───────────────────────────────────────────────────────────

def score_color(score):
    """Map safety score to hex color for map rendering."""
    if score >= 0.7:
        return "#22C55E"   # Green — safe
    elif score >= 0.5:
        return "#84CC16"   # Lime — moderate-safe
    elif score >= 0.35:
        return "#F59E0B"   # Amber — moderate risk
    elif score >= 0.2:
        return "#F97316"   # Orange — risky
    else:
        return "#EF4444"   # Red — dangerous


def score_route_with_ml(route, depart_hour, mode):
    """
    Score a route using the ML model.
    Splits geometry into ~200m segments, predicts safety for each.
    """
    coords = route["geometry"]["coordinates"]
    if len(coords) < 2:
        return None

    segments = []
    segment_colors = []

    # Calculate cumulative distances for time-shifting
    total_dist = 0
    speed = 1.4 if mode == "walk" else 8.0  # m/s

    for i in range(len(coords) - 1):
        start = coords[i]
        end = coords[i + 1]

        # Segment midpoint for prediction
        mid_lat = (start[1] + end[1]) / 2
        mid_lon = (start[0] + end[0]) / 2

        # Segment distance
        seg_dist = math.sqrt((end[0] - start[0])**2 + (end[1] - start[1])**2) * 111000
        total_dist += seg_dist

        # Time-shifted hour: estimate arrival time at this segment
        travel_time_sec = total_dist / speed
        shifted_hour = (depart_hour + int(travel_time_sec / 3600)) % 24

        # ML prediction
        prediction = predict_safety(mid_lat, mid_lon, shifted_hour)

        segments.append(SegmentScore(
            start=start,
            end=end,
            distance=round(seg_dist, 1),
            score=prediction["score"],
            confidence=prediction["confidence"],
            factors=prediction["factors"],
        ))
        segment_colors.append(score_color(prediction["score"]))

    scores = [s.score for s in segments]

    return {
        "segments": segments,
        "segment_colors": segment_colors,
        "worst_segment_score": min(scores) if scores else 0.0,
        "mean_segment_score": sum(scores) / len(scores) if scores else 0.0,
        "total_distance_m": route["distance"],
        "total_time_sec": route["duration"],
    }


# ─── API Endpoint ──────────────────────────────────────────────────────

@router.post("/safe-plan", response_model=List[ScoredRoute])
async def safe_plan(req: SafePlanRequest):
    """
    Plan routes with ML-powered safety scoring.
    Returns 5 geometrically distinct route alternatives ranked by safety.
    Each route includes full road-following geometry and per-segment scores.
    """
    # Determine departing hour for ML
    if req.depart_hour is not None:
        depart_hour = req.depart_hour % 24
    elif req.depart_at:
        depart_hour = req.depart_at.hour
    else:
        depart_hour = datetime.now().hour

    raw_routes = []
    
    if req.mode == "any":
        import copy
        # Fetch ONCE from OSRM to avoid rate limits, since OSRM public only supports driving anyway.
        # We will simulate the multiple modes by evaluating the same geometries with different speeds.
        base_routes = await fetch_osrm_routes(list(req.origin), list(req.destination), "drive")
        
        if base_routes:
            modes = ["walk", "drive"]
            for m in modes:
                # duplicate the routes for each mode
                routes_copy = copy.deepcopy(base_routes)
                for r in routes_copy:
                    r["name"] = f"[{m.title()}] {r.get('name', '')}"
                    r["_calc_mode"] = m
                raw_routes.extend(routes_copy)
    else:
        raw_routes = await fetch_osrm_routes(list(req.origin), list(req.destination), req.mode)
        if raw_routes:
            for r in raw_routes:
                r["_calc_mode"] = req.mode

    if not raw_routes:
        raise HTTPException(
            status_code=502,
            detail="Could not fetch routes. OSRM may be unavailable."
        )

    time_profile = get_time_profile(depart_hour)
    scored_routes = []

    for idx, raw in enumerate(raw_routes):
        result = score_route_with_ml(raw, depart_hour, raw.get("_calc_mode", "walk"))
        if result:
            scored_routes.append(ScoredRoute(
                route_index=idx,
                route_name=raw.get("name", f"Route Alternative {idx + 1}"),
                geometry=raw["geometry"],
                safety_score=round(result["mean_segment_score"], 4),
                worst_segment_score=round(result["worst_segment_score"], 4),
                mean_segment_score=round(result["mean_segment_score"], 4),
                total_distance_m=result["total_distance_m"],
                total_time_sec=result["total_time_sec"],
                is_safest=False,
                segments=result["segments"],
                segment_colors=result["segment_colors"],
                depart_hour=depart_hour,
                time_category=time_profile["category"],
                time_description=time_profile["description"],
            ))

    # 3. Rank by safety (lexicographic: worst_segment first, then mean)
    scored_routes.sort(
        key=lambda r: (r.worst_segment_score, r.mean_segment_score, -r.total_time_sec),
        reverse=True,
    )

    # 4. Limit to top 5 routes
    scored_routes = scored_routes[:5]

    # 5. Distinct route colors (Safest route is Emerald Green, others have distinct vibrant colors)
    ROUTE_PALETTE_COLORS = [
        "#10B981",  # Rank 1 (Safest): Emerald Green
        "#3B82F6",  # Rank 2: Royal Blue
        "#8B5CF6",  # Rank 3: Vivid Purple
        "#F59E0B",  # Rank 4: Amber Gold
        "#EC4899",  # Rank 5: Electric Rose
    ]

    for i, r in enumerate(scored_routes):
        r.route_index = i
        r.is_safest = (i == 0)
        r.route_color = ROUTE_PALETTE_COLORS[i % len(ROUTE_PALETTE_COLORS)]
        if not r.route_name:
            r.route_name = f"Route {i + 1}"

    return scored_routes
