import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\components\DemoController.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("const [lat, lon] = activePath[Math.floor(activePath.length / 2)]", "const [lon, lat] = activePath[Math.floor(activePath.length / 2)]")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Fixed coordinate parsing in simulateDeviation")
