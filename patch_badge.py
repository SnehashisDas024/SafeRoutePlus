import os
import re

file_path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\RouteCompareScreen.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'transform: translate\(-50%, -50%\);\s*', '', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Patched route badge transform")
