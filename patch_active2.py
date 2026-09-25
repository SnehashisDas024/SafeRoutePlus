import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

invalidator = """
const MapInvalidator = () => {
  const map = useMap()
  React.useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 400)
    return () => clearTimeout(timer)
  }, [map])
  return null
}
"""
content = content.replace("export default function ActiveTripScreen() {", invalidator + "\nexport default function ActiveTripScreen() {")

# Insert <MapInvalidator /> into MapContainer
content = content.replace("<TileLayer", "<MapInvalidator />\n            <TileLayer")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched ActiveTripScreen.tsx with MapInvalidator")
