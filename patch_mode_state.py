import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "const [mode, setMode] = useState<'walk' | 'drive'>('walk')",
    "const [mode, setMode] = useState<'walk' | 'drive' | 'any'>('any')"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched PlanScreen.tsx mode state type")
