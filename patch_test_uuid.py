import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\test_community_reports.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
import re
content = re.sub(r'"Bearer test1_.*?"', 'f"Bearer test1_{uuid.uuid4()}"', content)
content = re.sub(r'"Bearer test2_.*?"', 'f"Bearer test2_{uuid.uuid4()}"', content)
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
