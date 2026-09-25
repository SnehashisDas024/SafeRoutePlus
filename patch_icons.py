import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\components\Icons.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

new_icon = """
export const IconUser = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
  </svg>
)
"""

if "IconUser =" not in content:
    content = content + "\n" + new_icon

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Added IconUser")
