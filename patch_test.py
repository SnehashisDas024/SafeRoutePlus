import os
import uuid

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\test_community_reports.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('"Authorization": "Bearer test1"', f'"Authorization": "Bearer test1_{str(uuid.uuid4())}"')
content = content.replace('"Authorization": "Bearer test2"', f'"Authorization": "Bearer test2_{str(uuid.uuid4())}"')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
