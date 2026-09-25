import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\components\DemoController.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("timerRef = useRef<NodeJS.Timeout | null>(null)", "timerRef = useRef<ReturnType<typeof setInterval> | null>(null)")
content = content.replace("onVoiceEvent: (kind: string, confidence: number) => void", "onVoiceEvent: (kind: 'loud_noise' | 'distress_keyword', confidence: number) => void")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Fixed type errors in DemoController")
