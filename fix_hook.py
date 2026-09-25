import os

at_path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with open(at_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_hook = """  // LIVE REROUTING: Every 60 seconds, query for the safest route from current position
  useEffect(() => {
    if (!position || !destination) return
    const mode = localStorage.getItem('activeMode') || 'walk'
    const interval = setInterval(async () => {
      try {
        const routes = await safePlanRoute({
          origin: [position[1], position[0]], // [lon, lat]
          destination,
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
  }, [position, destination])"""

new_hook = """  // LIVE REROUTING: Every 60 seconds, query for the safest route from current position
  const posRef = useRef(position)
  useEffect(() => { posRef.current = position }, [position])

  useEffect(() => {
    if (!destination) return
    const mode = localStorage.getItem('activeMode') || 'walk'
    
    const interval = setInterval(async () => {
      const currentPos = posRef.current
      if (!currentPos) return
      
      try {
        const routes = await safePlanRoute({
          origin: [currentPos[1], currentPos[0]], // [lon, lat]
          destination,
          mode,
          depart_at: new Date().toISOString()
        })
        if (routes && routes.length > 0) {
          // Pick safest:
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
    }, 60000) // 1 minute
    
    return () => clearInterval(interval)
  }, [destination])"""

if old_hook in content:
    with open(at_path, 'w', encoding='utf-8') as f:
        f.write(content.replace(old_hook, new_hook))
    print("Fixed live rerouting hook with useRef")
else:
    print("Could not find old hook!")
