import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\api\safe_routes.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_any = """    if req.mode == "any":
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
                raw_routes.extend(res)"""

new_any = """    if req.mode == "any":
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
                raw_routes.extend(routes_copy)"""

content = content.replace(old_any, new_any)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched backend mode=any logic to prevent OSRM rate limiting")
