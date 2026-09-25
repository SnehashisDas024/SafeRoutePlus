import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "const mode = localStorage.getItem('activeMode') || 'walk'",
    "const mode = (localStorage.getItem('activeMode') as 'walk' | 'drive' | 'any') || 'walk'"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched ActiveTripScreen.tsx")
