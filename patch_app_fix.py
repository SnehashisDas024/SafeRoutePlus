import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\App.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("import SettingsScreen\nimport ProfileScreen from './screens/ProfileScreen' from './screens/SettingsScreen'", "import SettingsScreen from './screens/SettingsScreen'\nimport ProfileScreen from './screens/ProfileScreen'")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Fixed App.tsx imports")
