import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\components\CommunityReportModal.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("lat: float", "lat: number")
content = content.replace("lon: float", "lon: number")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
