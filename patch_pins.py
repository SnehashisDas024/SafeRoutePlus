import os
import re

files_to_patch = [
    r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx',
    r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\RouteCompareScreen.tsx'
]

for file_path in files_to_patch:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove the double translations
    content = re.sub(r'transform: translate\(-15px, -38px\);\s*', '', content)
    content = re.sub(r'transform: translate\(-16px, -42px\);\s*', '', content)
    content = re.sub(r'transform: translate\(-10px, -10px\);\s*', '', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Patched {file_path}")
