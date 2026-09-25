import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_url = "const url = `https://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?alternatives=3&overview=full&geometries=geojson&steps=false`;"
new_url = "const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?alternatives=3&overview=full&geometries=geojson&steps=false`;"

content = content.replace(old_url, new_url)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched PlanScreen.tsx OSRM URL coordinates")
