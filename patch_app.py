import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\App.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Add import
if "LandingPage" not in content:
    content = content.replace("import Layout from './components/Layout'", "import Layout from './components/Layout'\nimport LandingPage from './landing/LandingPage'")

# Add Route
if '<Route path="/" element={<LandingPage />} />' not in content:
    content = content.replace('<Route path="/" element={<DashboardScreen />} />', '<Route path="/dashboard" element={<DashboardScreen />} />')
    content = content.replace('<Route path="/share/:token" element={<LiveShareScreen />} />', '<Route path="/share/:token" element={<LiveShareScreen />} />\n      <Route path="/" element={<LandingPage />} />\n      <Route path="/landing" element={<LandingPage />} />')

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Added LandingPage to App.tsx")
