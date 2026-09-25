import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\main.py'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("from app.api import safe_routes", "from app.api import safe_routes\nfrom app.api import users")
content = content.replace("app.include_router(auth.router)", "app.include_router(auth.router)\napp.include_router(users.router)")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Included users.router in main.py")
