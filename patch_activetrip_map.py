import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

old_controller = """function MapController() {
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
  return null
}"""

new_controller = """function MapController({ position }: { position: [number, number] | null }) {
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
}"""

content = content.replace(old_controller, new_controller)
content = content.replace("<MapController />", "<MapController position={position} />")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Added Map pan to current location in ActiveTripScreen")
