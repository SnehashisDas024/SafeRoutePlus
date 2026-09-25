import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_fetch = """      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?alternatives=3&overview=full&geometries=geojson&steps=false`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            prefetched = data.routes.map((r: any, idx: number) => ({
              name: `Route Alternative ${idx + 1}`,
              geometry: r.geometry,
              distance: r.distance,
              duration: mode === 'walk' ? r.duration * 5 : r.duration
            }));
          }
        }
      } catch (e) {
        console.error("OSRM prefetched failed", e);
      }"""
      
new_fetch = """      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?alternatives=3&overview=full&geometries=geojson&steps=false`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to fetch map data");
        }
        if (data.routes && data.routes.length > 0) {
          prefetched = data.routes.map((r: any, idx: number) => ({
            name: `Route Alternative ${idx + 1}`,
            geometry: r.geometry,
            distance: r.distance,
            duration: mode === 'walk' ? r.duration * 5 : r.duration
          }));
        } else {
          throw new Error("No routable roads found between these locations.");
        }
      } catch (e: any) {
        setError(`Map Error: ${e.message}`);
        setLoading(false);
        return;
      }"""

content = content.replace(old_fetch, new_fetch)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added explicit error handling to OSRM fetch in frontend")
