import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\api\auth.py'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("from passlib.context import CryptContext", "import bcrypt")
content = content.replace('pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")', "")
content = content.replace("hashed_password = pwd_context.hash(req.password)", "hashed_password = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')")
content = content.replace("if not pwd_context.verify(req.password, user.password_hash):", "if not bcrypt.checkpw(req.password.encode('utf-8'), user.password_hash.encode('utf-8')):")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated auth.py to use bcrypt directly instead of passlib")
