import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ReportScreen.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("navigate('/', { state: { reported: true } })", "navigate('/dashboard', { state: { reported: true } })")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Fixed ReportScreen navigate")
