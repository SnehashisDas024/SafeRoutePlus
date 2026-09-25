import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("style={{ padding: 0, minHeight: 360 }}", "style={{ padding: 0, minHeight: 360, position: 'relative' }}")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Fixed CSS positioning for FAB")
