import os
import re

base_dir = r'C:\Users\sneha\Desktop\SafeRoutePlus'
at_path = os.path.join(base_dir, 'frontend', 'src', 'screens', 'ActiveTripScreen.tsx')

with open(at_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken line
content = re.sub(r'<span className=\{ adge \\\}>', '        <span className={`badge ${wsStatus === \'connected\' ? \'safe\' : \'warn\'}`}>', content)
content = re.sub(r'\? \{wsStatus === \'connected\' \? \'Live connected\' : wsStatus\}', '          ● {wsStatus === \'connected\' ? \'Live connected\' : wsStatus}', content)

# I can just rewrite the exact block
bad_block = """      <div className="row mt-2 mb-2" style={{ flexWrap: 'wrap' }}>
        <span className={ adge \\}>
          ? {wsStatus === 'connected' ? 'Live connected' : wsStatus}
        </span>
        <span className="badge neutral">Trip {tripId.slice(0, 8)}.</span>"""

good_block = """      <div className="row mt-2 mb-2" style={{ flexWrap: 'wrap' }}>
        <span className={`badge ${wsStatus === 'connected' ? 'safe' : 'warn'}`}>
          ● {wsStatus === 'connected' ? 'Live connected' : wsStatus}
        </span>
        <span className="badge neutral">Trip {tripId.slice(0, 8)}…</span>"""

content = content.replace(bad_block, good_block)

with open(at_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed ActiveTripScreen syntax errors.')
