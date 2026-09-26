import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\components\DemoController.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("'keyword_duress'", "'distress_keyword'")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Fixed type error in DemoController keyword")
