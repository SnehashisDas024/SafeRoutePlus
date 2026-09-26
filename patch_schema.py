import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\models\schema.py'
with codecs.open(path, 'r', 'utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if line.startswith('class Geometry(TypeDecorator):'):
        skip = True
        new_lines.append('from geoalchemy2 import Geometry\n')
        continue
    
    if skip:
        if line.startswith('from app.models.database import Base'):
            skip = False
            new_lines.append(line)
        continue
        
    if not skip:
        new_lines.append(line)

with codecs.open(path, 'w', 'utf-8') as f:
    f.writelines(new_lines)
print("Updated schema.py to use geoalchemy2.Geometry")
