import os
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\test_community_reports.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('mid_idx = len(best_route_1["geometry"]["coordinates"]) // 2', 'mid_idx = len(best_route_1["segments"]) // 2')
content = content.replace('mid_lon, mid_lat = best_route_1["geometry"]["coordinates"][mid_idx]', 'mid_lon, mid_lat = best_route_1["segments"][mid_idx]["mid"]')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated test script to extract mid_lon, mid_lat from segments")
