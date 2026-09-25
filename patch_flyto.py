import os
import codecs
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("map.flyTo(position, 16, { duration: 1 })", "map.setView(position, map.getZoom() > 14 ? map.getZoom() : 16, { animate: false })")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Replaced map.flyTo with map.setView")
