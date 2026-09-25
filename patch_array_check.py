import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("setCommunityReports(res)", "setCommunityReports(Array.isArray(res) ? res : [])")
content = content.replace("then(setCommunityReports)", "then(r => setCommunityReports(Array.isArray(r) ? r : []))")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Added Array check for setCommunityReports")
