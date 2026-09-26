import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\main.py'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

if "from app.api import auth" not in content:
    content = content.replace("from app.api import routes_plan, safe_routes, trips, sos, voice, ws_stream, contacts, reports, tags", "from app.api import routes_plan, safe_routes, trips, sos, voice, ws_stream, contacts, reports, tags, auth")
    content = content.replace("app.include_router(tags.router)", "app.include_router(tags.router)\napp.include_router(auth.router)")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Included auth.router in main.py")
