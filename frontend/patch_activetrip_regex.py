import os
import codecs
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = re.sub(r'function MapController\(\) \{.*?(return null\s*)\}', """function MapController({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 150)
    const container = map.getContainer()
    const resizeObserver = new window.ResizeObserver(() => {
      map.invalidateSize()
    })
    resizeObserver.observe(container)
    return () => {
      clearTimeout(timer)
      resizeObserver.disconnect()
    }
  }, [map])

  // Pan map to current position
  useEffect(() => {
    if (position) {
      map.flyTo(position, 16, { duration: 1 })
    }
  }, [map, position])
  
  return null
}""", content, flags=re.DOTALL)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated MapController definition")
