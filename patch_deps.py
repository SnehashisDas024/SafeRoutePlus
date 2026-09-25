import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\deps.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('return "test_user_id"', 'return authorization.replace("Bearer ", "")')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated deps.py")
