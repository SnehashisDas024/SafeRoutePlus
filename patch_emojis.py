import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\components\CommunityReportModal.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("'??' | '??' | '??'", "'\U0001F7E2' | '\U0001F7E1' | '\U0001F534'")
content = content.replace("{ value: '??', label: 'Safe', tone: '#4CAF50', icon: '??' }", "{ value: '\U0001F7E2', label: 'Safe', tone: '#4CAF50', icon: '\U0001F7E2' }")
content = content.replace("{ value: '??', label: 'Okay', tone: '#FF9800', icon: '??' }", "{ value: '\U0001F7E1', label: 'Okay', tone: '#FF9800', icon: '\U0001F7E1' }")
content = content.replace("{ value: '??', label: 'Unsafe', tone: '#F44336', icon: '??' }", "{ value: '\U0001F534', label: 'Unsafe', tone: '#F44336', icon: '\U0001F534' }")
content = content.replace("useState<Rating>('??')", "useState<Rating>('\U0001F7E2')")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Patched emojis in CommunityReportModal")

path2 = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with codecs.open(path2, 'r', 'utf-8') as f:
    content2 = f.read()

content2 = content2.replace("{r.rating === 'unsafe' ? '??' : r.rating === 'safe' ? '??' : '??'} {r.rating.toUpperCase()}", "{r.rating} {r.rating === '\U0001F534' ? 'UNSAFE' : r.rating === '\U0001F7E2' ? 'SAFE' : 'OKAY'}")
content2 = content2.replace("?? Report Area", "\U0001F6A9 Report Area")

with codecs.open(path2, 'w', 'utf-8') as f:
    f.write(content2)
print("Patched emojis in PlanScreen")

