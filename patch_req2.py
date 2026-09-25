import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\types\index.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_req = """export interface RoutePlanRequest {
  origin: [number, number]
  destination: [number, number]
  origin_name?: string
  destination_name?: string
  mode: 'walk' | 'drive' | 'any'
  depart_at: string
  depart_hour?: number
}"""

new_req = """export interface RoutePlanRequest {
  origin: [number, number]
  destination: [number, number]
  origin_name?: string
  destination_name?: string
  mode: 'walk' | 'drive' | 'any'
  depart_at: string
  depart_hour?: number
  prefetched_routes?: any[]
}"""

content = content.replace(old_req, new_req)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched types/index.ts")
