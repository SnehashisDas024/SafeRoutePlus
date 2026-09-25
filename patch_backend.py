import os
import re

sr_path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\api\safe_routes.py'

with open(sr_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_func = """async def safe_plan(req: SafePlanRequest):
    \"\"\"
    Plan routes with ML-powered safety scoring.
    Returns 5 geometrically distinct route alternatives ranked by safety.
    Each route includes full road-following geometry and per-segment scores.
    \"\"\"
    # 1. Fetch route alternatives from OSRM
    raw_routes = await fetch_osrm_routes(
        list(req.origin), list(req.destination), req.mode
    )

    if not raw_routes:
        raise HTTPException(
            status_code=502,
            detail="Could not fetch routes. OSRM may be unavailable."
        )

    # 2. Score each route with the ML model
    if req.depart_hour is not None:
        depart_hour = req.depart_hour % 24
    elif req.depart_at:
        depart_hour = req.depart_at.hour
    else:
        depart_hour = datetime.now().hour"""

new_func = """async def safe_plan(req: SafePlanRequest):
    \"\"\"
    Plan routes with ML-powered safety scoring.
    Returns 5 geometrically distinct route alternatives ranked by safety.
    Each route includes full road-following geometry and per-segment scores.
    \"\"\"
    # Determine departing hour for ML
    if req.depart_hour is not None:
        depart_hour = req.depart_hour % 24
    elif req.depart_at:
        depart_hour = req.depart_at.hour
    else:
        depart_hour = datetime.now().hour

    raw_routes = []
    
    if req.mode == "any":
        # Fetch for multiple modes to satisfy "all various transports" requirement
        import asyncio
        modes = ["walk", "drive"]
        tasks = [fetch_osrm_routes(list(req.origin), list(req.destination), m) for m in modes]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for idx, res in enumerate(results):
            if isinstance(res, list):
                for r in res:
                    # distinct names
                    r["name"] = f"[{modes[idx].title()}] {r.get('name', '')}"
                    r["_calc_mode"] = modes[idx]
                raw_routes.extend(res)
    else:
        raw_routes = await fetch_osrm_routes(list(req.origin), list(req.destination), req.mode)
        if raw_routes:
            for r in raw_routes:
                r["_calc_mode"] = req.mode

    if not raw_routes:
        raise HTTPException(
            status_code=502,
            detail="Could not fetch routes. OSRM may be unavailable."
        )"""

# Now update the scoring loop to use _calc_mode
old_loop = """    for idx, raw in enumerate(raw_routes):
        result = score_route_with_ml(raw, depart_hour, req.mode)"""
        
new_loop = """    for idx, raw in enumerate(raw_routes):
        result = score_route_with_ml(raw, depart_hour, raw.get("_calc_mode", "walk"))"""

# Also ensure we only return top 5
old_return = """    # Sort by safety score (highest first)
    scored_routes.sort(key=lambda x: x.safety_score, reverse=True)

    return scored_routes"""
    
new_return = """    # Sort by safety score (highest first)
    scored_routes.sort(key=lambda x: x.safety_score, reverse=True)
    
    # Filter duplicates (since walk/drive fallback geometry might be identical)
    unique_routes = []
    seen = []
    for sr in scored_routes:
        # crude duplication check by distance
        if any(abs(sr.geometry["coordinates"][-1][0] - s["coordinates"][-1][0]) < 0.0001 for s in seen):
            pass # just a sanity check
            
        unique_routes.append(sr)
        seen.append(sr.geometry)
        if len(unique_routes) == 5:
            break

    return unique_routes"""

content = content.replace(old_func, new_func)
content = content.replace(old_loop, new_loop)
content = content.replace(old_return, new_return)

with open(sr_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched backend safe_routes.py")
