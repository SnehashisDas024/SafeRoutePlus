import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\App.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

imports = "import LoginScreen from './screens/LoginScreen'\nimport SignupScreen from './screens/SignupScreen'\n"
if "LoginScreen" not in content:
    content = content.replace("import DashboardScreen", imports + "import DashboardScreen")
    
    routes = """      <Route path="/login" element={<LoginScreen />} />
      <Route path="/signup" element={<SignupScreen />} />
"""
    content = content.replace('<Route path="/" element={<LandingPage />} />', '<Route path="/" element={<LandingPage />} />\n' + routes)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
