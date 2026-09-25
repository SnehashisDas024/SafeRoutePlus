import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\services\api.ts'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("Authorization: AUTH_TOKEN,", "Authorization: `Bearer ${localStorage.getItem('authToken') || AUTH_TOKEN}`,")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Fixed AUTH_TOKEN in fetchApi")
