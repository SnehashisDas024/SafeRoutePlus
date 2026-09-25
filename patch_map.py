import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\RouteCompareScreen.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add useEffect import if not present
if "useEffect" not in content:
    content = content.replace("import React, { useState", "import React, { useState, useEffect")
else:
    # already has it
    pass

# Add MapInvalidator component above the default export
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
content = content.replace("export default function RouteCompareScreen() {", invalidator + "\nexport default function RouteCompareScreen() {")

# Insert <MapInvalidator /> into MapContainer
content = content.replace("<TileLayer", "<MapInvalidator />\n            <TileLayer")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched RouteCompareScreen.tsx with MapInvalidator")
