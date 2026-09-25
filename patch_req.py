import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\types\index.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_req = """export interface RoutePlanRequest {
  origin: [number, number]
  destination: [number, number]
  mode: 'walk' | 'drive' | 'any'
  depart_hour?: number
  depart_time_str?: string
}"""

new_req = """export interface RoutePlanRequest {
  origin: [number, number]
  destination: [number, number]
  mode: 'walk' | 'drive' | 'any'
  depart_hour?: number
  depart_time_str?: string
  prefetched_routes?: any[]
}"""

content = content.replace(old_req, new_req)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched types/index.ts")
