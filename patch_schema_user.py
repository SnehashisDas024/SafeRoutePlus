import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\models\schema.py'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("phone = Column(String, unique=True, index=True)", "phone = Column(String, unique=True, index=True)\n    email = Column(String, unique=True)\n    password_hash = Column(String)")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated schema.py")
