import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\api\safe_routes.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_class = """class SafePlanRequest(BaseModel):
    origin: List[float]       # [lon, lat]
    destination: List[float]  # [lon, lat]
    mode: str = "walk"
    depart_at: Optional[datetime] = None
    depart_hour: Optional[int] = None"""

new_class = """class SafePlanRequest(BaseModel):
    origin: List[float]       # [lon, lat]
    destination: List[float]  # [lon, lat]
    mode: str = "walk"
    depart_at: Optional[datetime] = None
    depart_hour: Optional[int] = None
    prefetched_routes: Optional[List[dict]] = None"""

content = content.replace(old_class, new_class)

old_logic = """    if req.mode == "any":
        import copy
        # Fetch ONCE from OSRM to avoid rate limits, since OSRM public only supports driving anyway.
        # We will simulate the multiple modes by evaluating the same geometries with different speeds.
        base_routes = await fetch_osrm_routes(list(req.origin), list(req.destination), "drive")"""

new_logic = """    if req.prefetched_routes:
        # Frontend successfully bypassed DNS block and provided routes
        raw_routes = req.prefetched_routes
        # duplicate if any
        if req.mode == "any":
            import copy
            expanded = []
            for m in ["walk", "drive"]:
                r_copy = copy.deepcopy(raw_routes)
                for r in r_copy:
                    r["name"] = f"[{m.title()}] {r.get('name', '')}"
                    r["_calc_mode"] = m
                expanded.extend(r_copy)
            raw_routes = expanded
        else:
            for r in raw_routes:
                r["_calc_mode"] = req.mode
    elif req.mode == "any":
        import copy
        # Fetch ONCE from OSRM to avoid rate limits, since OSRM public only supports driving anyway.
        # We will simulate the multiple modes by evaluating the same geometries with different speeds.
        base_routes = await fetch_osrm_routes(list(req.origin), list(req.destination), "drive")"""
content = content.replace(old_logic, new_logic)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched SafePlanRequest with prefetched_routes")
