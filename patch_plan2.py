import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_handlePlan = """    setLoading(true)
    setError('')
    try {
      const routes: ScoredRoute[] = await safePlanRoute({
        origin,
        destination,"""
        
new_handlePlan = """    setLoading(true)
    setError('')
    try {
      let prefetched: any[] | undefined = undefined;
      try {
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
      }

      const routes: ScoredRoute[] = await safePlanRoute({
        origin,
        destination,
        prefetched_routes: prefetched,"""

content = content.replace(old_handlePlan, new_handlePlan)

# Also fix the missing "any" mode button in UI.
# In PlanScreen.tsx, Travel mode section:
old_mode = """            <div className="clay card mt-2">
              <h3>Travel mode</h3>
              <div className="row" style={{ gap: 8 }}>
                {(['walk', 'drive'] as const).map((m) => ("""

new_mode = """            <div className="clay card mt-2">
              <h3>Travel mode</h3>
              <div className="row" style={{ gap: 8 }}>
                {(['walk', 'drive', 'any'] as const).map((m) => ("""

old_mode_icons = """                  >
                    {m === 'walk' ? (
                      <>
                        <IconWalk size={17} /> Walk
                      </>
                    ) : (
                      <>
                        <IconCar size={17} /> Drive
                      </>
                    )}
                  </button>"""

new_mode_icons = """                  >
                    {m === 'walk' ? (
                      <><IconWalk size={17} /> Walk</>
                    ) : m === 'drive' ? (
                      <><IconCar size={17} /> Drive</>
                    ) : (
                      <><IconSpark size={17} /> Any (Best)</>
                    )}
                  </button>"""

content = content.replace(old_mode, new_mode)
content = content.replace(old_mode_icons, new_mode_icons)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched PlanScreen.tsx with frontend OSRM proxy and restored Any mode")
