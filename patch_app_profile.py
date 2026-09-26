import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\App.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

if "import ProfileScreen" not in content:
    content = content.replace("import SettingsScreen", "import SettingsScreen\nimport ProfileScreen from './screens/ProfileScreen'")
    
    routes = """        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />"""
    content = content.replace('<Route path="/settings" element={<SettingsScreen />} />', routes)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated App.tsx with Profile route")
