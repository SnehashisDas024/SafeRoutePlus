import httpx
from app.config import settings

# Precomputed demo routes for Kolkata (lon, lat format)
# Used when public OSRM fails or for offline demo
ROUTE_CACHE = {
    # Short Walk: Park Street → Victoria Memorial
    ("88.3524,22.5513", "88.3426,22.5448", "walk"): {
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [88.3524, 22.5513],
                [88.3501, 22.5492],
                [88.3478, 22.5471],
                [88.3455, 22.5460],
                [88.3426, 22.5448]
            ]
        },
        "distance": 850,
        "duration": 620
    },
    # Medium Walk: Howrah Station → B.B.D. Bagh
    ("88.3426,22.5851", "88.3512,22.5726", "walk"): {
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [88.3426, 22.5851],
                [88.3442, 22.5823],
                [88.3465, 22.5789],
                [88.3489, 22.5756],
                [88.3512, 22.5726]
            ]
        },
        "distance": 1450,
        "duration": 1050
    },
    # Drive: Salt Lake Sector V → Esplanade
    ("88.4332,22.5744", "88.3528,22.5647", "drive"): {
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [88.4332, 22.5744],
                [88.4125, 22.5712],
                [88.3918, 22.5689],
                [88.3721, 22.5675],
                [88.3528, 22.5647]
            ]
        },
        "distance": 8200,
        "duration": 1200
    },
}

def _make_cache_key(origin: tuple, dest: tuple, mode: str) -> tuple:
    return (f"{origin[0]},{origin[1]}", f"{dest[0]},{dest[1]}", mode)

async def _fetch_from_osrm(origin: tuple, dest: tuple, mode: str):
    """Internal function to fetch from OSRM"""
    url = f"{settings.OSRM_BASE_URL}/route/v1/{mode}/{origin[0]},{origin[1]};{dest[0]},{dest[1]}?alternatives=true&overview=full&geometries=geojson"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                return data.get("routes", [])
            return []
        except Exception:
            return []

async def get_routes(origin: tuple, dest: tuple, mode: str = "driving"):
    """
    Fetch routes from OSRM with cache and fallback.
    For walking mode on public OSRM, falls back to driving geometry with walking speed.
    """
    cache_key = _make_cache_key(origin, dest, mode)
    
    # Check cache first
    if cache_key in ROUTE_CACHE:
        cached = ROUTE_CACHE[cache_key]
        return [{
            "geometry": cached["geometry"],
            "distance": cached["distance"],
            "duration": cached["duration"]
        }]
    
    # Try primary mode
    routes = await _fetch_from_osrm(origin, dest, mode)
    
    # If walking mode fails on public OSRM, fall back to driving geometry
    if mode == "walk" and not routes:
        print(f"[OSRM] Walking mode failed, falling back to driving geometry for {origin} -> {dest}")
        driving_routes = await _fetch_from_osrm(origin, dest, "driving")
        if driving_routes:
            # Convert driving duration to walking duration (~5 km/h = 1.39 m/s vs driving ~13.9 m/s)
            # Roughly 10x slower, but we'll use a factor of 5-6 for urban walking
            for route in driving_routes:
                route["duration"] = route["duration"] * 5.5  # walking speed factor
            return driving_routes
    
    return routes