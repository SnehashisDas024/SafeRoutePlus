import os
import codecs
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\main.py'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("from app.api import safe_routes", "from app.api import safe_routes\nfrom app.api import auth")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
