import os

at_path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with open(at_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("destination: [destination[1], destination[0]],", "destination,")

with open(at_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed destination format in rerouting!")
