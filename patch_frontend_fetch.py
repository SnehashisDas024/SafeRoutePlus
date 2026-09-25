import os
import codecs

# 1. Patch CommunityReportModal
path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\components\CommunityReportModal.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("import { fetchApi } from '../services/api'", "import { BASE_URL } from '../services/api'")
content = content.replace("await fetchApi('/reports/community', {", "await fetch(`${BASE_URL}/reports/community`, {")
# we must handle the response
fetch_block_old = """await fetch(`${BASE_URL}/reports/community`, {
        method: 'POST',
        body: JSON.stringify({ lat, lon, rating, tags: selectedTags, note })
      })"""
fetch_block_new = """const res = await fetch(`${BASE_URL}/reports/community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon, rating, tags: selectedTags, note })
      })
      if (!res.ok) throw new Error(await res.text())"""
content = content.replace(fetch_block_old, fetch_block_new)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)


# 2. Patch PlanScreen
path2 = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with codecs.open(path2, 'r', 'utf-8') as f:
    content2 = f.read()

content2 = content2.replace("import { fetchApi } from '../services/api'", "import { BASE_URL } from '../services/api'")
content2 = content2.replace("const res = await fetchApi(`/reports/community/nearby?lat=${center[0]}&lon=${center[1]}`)", "const r = await fetch(`${BASE_URL}/reports/community/nearby?lat=${center[0]}&lon=${center[1]}`); const res = await r.json()")
content2 = content2.replace("fetchApi(`/reports/community/nearby?lat=${MAP_DEFAULTS.center[0]}&lon=${MAP_DEFAULTS.center[1]}`).then(setCommunityReports)", "fetch(`${BASE_URL}/reports/community/nearby?lat=${MAP_DEFAULTS.center[0]}&lon=${MAP_DEFAULTS.center[1]}`).then(r => r.json()).then(setCommunityReports)")

# Tooltip
if "Tooltip" not in content2.split("import {")[1].split("}")[0]:
    content2 = content2.replace("import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet'", "import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents, Tooltip } from 'react-leaflet'")

with codecs.open(path2, 'w', 'utf-8') as f:
    f.write(content2)

print("Patched frontend imports and fetch logic")
