import os
import re

rc_path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\RouteCompareScreen.tsx'

with open(rc_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = "localStorage.setItem('activeDestination', JSON.stringify(state!.destination))"
replacement = target + "\n      localStorage.setItem('activeMode', state!.mode)"

if target in content and 'activeMode' not in content:
    with open(rc_path, 'w', encoding='utf-8') as f:
        f.write(content.replace(target, replacement))
        print("Patched RouteCompareScreen with activeMode")
