import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\test_community_reports.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('new_score = best_route_2_matching["safety_score"]', 'new_score = best_route_2_matching["worst_segment_score"]')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated test script to use worst_segment_score for new_score")
