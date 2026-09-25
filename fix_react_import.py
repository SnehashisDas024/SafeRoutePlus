import os

files = [
    r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx',
    r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\RouteCompareScreen.tsx',
    r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
]

for path in files:
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace React.useEffect with useEffect in the MapInvalidator block
        content = content.replace("React.useEffect(() => {", "useEffect(() => {")
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {os.path.basename(path)}")
