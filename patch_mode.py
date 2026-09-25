import os
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Travel mode section
pattern = r"<div className=\"clay card mt-2\">\s*<h3>Travel mode</h3>.*?</div>\s*</div>"
replacement = """<div className="clay card mt-2">
            <h3>Travel mode</h3>
            <div className="row" style={{ gap: 8 }}>
              {(['walk', 'drive', 'any'] as const).map((m) => (
                <button
                  key={m}
                  className={`chip${mode === m ? ' active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setMode(m)}
                >
                  {m === 'walk' ? (
                    <><IconWalk size={17} /> Walk</>
                  ) : m === 'drive' ? (
                    <><IconCar size={17} /> Drive</>
                  ) : (
                    <><IconSpark size={17} /> Any (Best)</>
                  )}
                </button>
              ))}
            </div>
          </div>"""

# Ensure dotall is used so .* matches newlines
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched Travel mode with regex!")
