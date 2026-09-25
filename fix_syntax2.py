import os
import re

at_path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'

with open(at_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'className={ adge \\}' in line or 'className={ adge ' in line or 'adge' in line:
        print(f"Found bad line at {i}: {repr(line)}")
        lines[i] = '        <span className={`badge ${wsStatus === \'connected\' ? \'safe\' : \'warn\'}`}>\n'
    elif '? {wsStatus ===' in line or '\u25cf {wsStatus ===' in line or '\ufffd {wsStatus' in line or (('{wsStatus ===' in line) and ('Live connected' in line) and ('span' not in line)):
        print(f"Found bad bullet line at {i}: {repr(line)}")
        lines[i] = '          ● {wsStatus === \'connected\' ? \'Live connected\' : wsStatus}\n'
    elif 'Trip {tripId.slice(0, 8)}' in line:
        print(f"Found bad trip line at {i}: {repr(line)}")
        lines[i] = '        <span className="badge neutral">Trip {tripId.slice(0, 8)}...</span>\n'

with open(at_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Rewrite complete')
