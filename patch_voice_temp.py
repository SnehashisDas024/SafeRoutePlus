import os
import codecs
import tempfile

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\api\voice.py'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace('temp_file = f"temp_{uuid.uuid4()}.webm"', 'import tempfile\n        temp_file = os.path.join(tempfile.gettempdir(), f"temp_{uuid.uuid4()}.webm")')

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Fixed tempfile path in voice.py")
