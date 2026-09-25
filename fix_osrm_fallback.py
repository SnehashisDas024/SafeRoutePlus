import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\api\safe_routes.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix alternatives=5 to alternatives=3
content = content.replace("alternatives=5&overview=full", "alternatives=3&overview=full")

# 2. Remove fallback routes
old_fallback = """    except Exception as e:
        print(f"[OSRM] Fetch failed: {e}")

    # Fallback: generate 5 distinct routes
    return _generate_fallback_routes(origin, destination, mode)"""

new_fallback = """    except Exception as e:
        print(f"[OSRM] Fetch failed: {e}")

    # Return empty list if OSRM fails
    return []"""

content = content.replace(old_fallback, new_fallback)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched OSRM alternatives and removed fake fallback!")
