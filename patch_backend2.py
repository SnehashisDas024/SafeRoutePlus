import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\api\safe_routes.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove augmented route padding
old_padding = """                    # Fill up to 5 with distinct augmented routes
                    aug_idx = 0
                    max_attempts = 12  # prevent infinite loop
                    while len(result) < 5 and aug_idx < max_attempts:
                        aug_route = _generate_augmented_route(
                            origin, destination,
                            result[0]["geometry"]["coordinates"],
                            aug_idx, mode,
                        )
                        if not _is_duplicate_route(aug_route["geometry"]["coordinates"], result):
                            result.append(aug_route)
                        aug_idx += 1

                    return result[:5]"""

new_padding = """                    return result"""
content = content.replace(old_padding, new_padding)

# 2. Fix the sorting to prioritize lesser time when safety scores are tied
old_sort = """    # Sort by safety score (highest first)
    scored_routes.sort(key=lambda x: x.safety_score, reverse=True)"""
    
new_sort = """    # Sort by safety score (highest first). If tied, pick the one with LESS time.
    # Note: reverse=True, so -x.total_time_sec means a smaller time will be placed first.
    scored_routes.sort(key=lambda x: (x.safety_score, -x.total_time_sec), reverse=True)"""
content = content.replace(old_sort, new_sort)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched backend successfully!")
