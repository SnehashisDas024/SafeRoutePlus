import os

at_path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'

with open(at_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'adge' in line and 'span' in line and '{' in line:
        lines[i] = '        <span className={`badge ${wsStatus === \'connected\' ? \'safe\' : \'warn\'}`}>\n'
    elif '{wsStatus ===' in line and 'Live connected' in line and 'span' not in line:
        lines[i] = '          ● {wsStatus === \'connected\' ? \'Live connected\' : wsStatus}\n'
    elif 'Trip {tripId.slice(0, 8)}' in line:
        lines[i] = '        <span className="badge neutral">Trip {tripId.slice(0, 8)}...</span>\n'

with open(at_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Rewrite complete')
