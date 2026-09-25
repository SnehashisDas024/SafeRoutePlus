import os

fp = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

old_modes = """              <div className="row" style={{ gap: 8 }}>
                {(['walk', 'drive'] as const).map((m) => ("""
                
new_modes = """              <div className="row" style={{ gap: 8 }}>
                {(['walk', 'drive', 'any'] as const).map((m) => ("""

old_mode_icons = """                  >
                    {m === 'walk' ? (
                      <>
                        <IconWalk size={17} /> Walk
                      </>
                    ) : (
                      <>
                        <IconCar size={17} /> Drive
                      </>
                    )}
                  </button>"""
                  
new_mode_icons = """                  >
                    {m === 'walk' ? (
                      <><IconWalk size={17} /> Walk</>
                    ) : m === 'drive' ? (
                      <><IconCar size={17} /> Drive</>
                    ) : (
                      <><IconSpark size={17} /> Any (Best)</>
                    )}
                  </button>"""

content = content.replace(old_modes, new_modes)
content = content.replace(old_mode_icons, new_mode_icons)

# also set default mode to any instead of walk? Or leave as walk.
content = content.replace("useState<string>('walk')", "useState<string>('any')")

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched PlanScreen.tsx")
