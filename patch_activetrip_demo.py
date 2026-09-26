import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Add import
if "DemoController" not in content:
    content = content.replace("import { EscalationBanner } from '../components/ui'", "import { EscalationBanner } from '../components/ui'\nimport DemoController from '../components/DemoController'")

# We need to extract setMockLocation from useLocation
content = content.replace("const { location, start } = useLocation()", "const { location, start, setMockLocation } = useLocation()")

# Add DemoController UI
demo_ui = """
      {/* Demo Panel Overlay */}
      {setMockLocation && (
        <DemoController 
          activePath={activePath} 
          setMockLocation={setMockLocation}
          onVoiceEvent={(kind, conf) => voiceEvent(kind, conf)}
        />
      )}
"""
if "DemoController" not in content.split("return (")[2]:
    content = content.replace("<EscalationBanner", demo_ui + "\n      <EscalationBanner")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Added DemoController to ActiveTripScreen")
