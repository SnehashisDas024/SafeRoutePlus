import os
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\test_community_reports.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('"/routes/safe-plan"', '"/routes/plan"')
content = content.replace('r["route_name"]', 'r.get("route_name") or r.get("id")')
content = content.replace('best_route_1["route_name"]', 'best_route_1.get("route_name") or best_route_1.get("id")')
content = content.replace('best_route_1["safety_score"]', 'best_route_1["worst_segment_score"]')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated test script to hit /routes/plan")
