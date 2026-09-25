import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\types\index.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("mode: 'walk' | 'drive'", "mode: 'walk' | 'drive' | 'any'")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched types/index.ts")
