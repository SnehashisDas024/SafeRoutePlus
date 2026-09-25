import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\components\Layout.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("{ to: '/', icon: IconHome, label: 'Dashboard' }", "{ to: '/dashboard', icon: IconHome, label: 'Dashboard' }")
content = content.replace("{ to: '/', icon: IconHome, label: 'Home' }", "{ to: '/dashboard', icon: IconHome, label: 'Home' }")
content = content.replace("'/': { title: 'SafeRoute+ Overview'", "'/dashboard': { title: 'SafeRoute+ Overview'")
content = content.replace("end={to === '/'}", "end={to === '/dashboard'}")

# Make brand clickable to Landing Page
content = content.replace('<div className="brand">', '<div className="brand" onClick={() => window.location.href="/"} style={{cursor: "pointer"}}>')

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated Layout.tsx")
