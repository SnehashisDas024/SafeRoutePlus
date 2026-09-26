import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\components\Layout.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Add IconUser to import
content = content.replace("IconShield, IconMenu", "IconShield, IconMenu, IconUser")

# Add Profile to NAV_SETTINGS
content = content.replace("{ to: '/contacts', icon: IconUsers, label: 'Contacts' }", "{ to: '/profile', icon: IconUser, label: 'Profile' },\n  { to: '/contacts', icon: IconUsers, label: 'Contacts' }")

# Add PAGE_TITLES entry for /profile
content = content.replace("'/settings': { title: 'Settings', sub: 'Preferences and configurations' },", "'/settings': { title: 'Settings', sub: 'Preferences and configurations' },\n  '/profile': { title: 'User Profile', sub: 'Your journey statistics and history' },")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated Layout.tsx with Profile navigation")
