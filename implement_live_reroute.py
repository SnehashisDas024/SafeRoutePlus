import os
import re

at_path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with open(at_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
content = content.replace("import { getVoiceConfig }", "import { getVoiceConfig, safePlanRoute }")

# 2. Update activePath to state
old_path_str = """  const pathStr = localStorage.getItem('activePath')
  const activePath: [number, number][] | null = pathStr ? JSON.parse(pathStr) : null"""

new_path_str = """  const [activePath, setActivePath] = useState<[number, number][] | null>(() => {
    const pathStr = localStorage.getItem('activePath')
    return pathStr ? JSON.parse(pathStr) : null
  })
  const [reroutingMsg, setReroutingMsg] = useState('')"""

content = content.replace(old_path_str, new_path_str)

# 3. Insert live rerouting hook right before getDistance function
old_get_dist = "  function getDistance("
new_rerouting = """  // LIVE REROUTING: Every 60 seconds, query for the safest route from current position
  useEffect(() => {
    if (!position || !destination) return
    const mode = localStorage.getItem('activeMode') || 'walk'
    const interval = setInterval(async () => {
      try {
        const routes = await safePlanRoute({
          origin: [position[1], position[0]], // [lon, lat]
          destination: [destination[1], destination[0]],
          mode,
          depart_at: new Date().toISOString()
        })
        if (routes && routes.length > 0) {
          // safePlanRoute returns 5 routes. Pick safest:
          const safest = routes.reduce((best, curr) => curr.safety_score > best.safety_score ? curr : best, routes[0])
          const newCoords = safest.geometry.coordinates // [lon, lat][]
          setActivePath(newCoords)
          localStorage.setItem('activePath', JSON.stringify(newCoords))
          
          setReroutingMsg('Route updated to safer alternative!')
          setTimeout(() => setReroutingMsg(''), 4000)
        }
      } catch (err) {
        console.error('Failed to reroute', err)
      }
    }, 60000)
    
    return () => clearInterval(interval)
  }, [position, destination])

  function getDistance("""

content = content.replace(old_get_dist, new_rerouting)

# 4. Show rerouting message in UI
old_banner = "{duressSilent && ("
new_banner = """{reroutingMsg && (
        <div className="clay-inset mt-1" style={{ padding: 12, fontSize: 12.5, fontWeight: 700, color: '#10B981', borderLeft: '4px solid #10B981' }}>
          {reroutingMsg}
        </div>
      )}
      {duressSilent && ("""

content = content.replace(old_banner, new_banner)

with open(at_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("ActiveTripScreen updated with Live Rerouting!")
