import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\hooks\useLocation.ts'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Add mockLocation state
if "mockLocation" not in content:
    content = content.replace("const [watching, setWatching] = useState(false)", "const [watching, setWatching] = useState(false)\n  const [mockLocation, setMockLocation] = useState<LocState | null>(null)")

# Return mockLocation if set
if "const effectiveLocation" not in content:
    content = content.replace("return { location, error, watching, start, stop }", """const effectiveLocation = mockLocation || location
  return { location: effectiveLocation, error, watching, start, stop, setMockLocation }""")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated useLocation hook with mockLocation support")
