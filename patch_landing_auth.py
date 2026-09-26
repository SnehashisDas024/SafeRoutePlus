import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\landing\LandingPage.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace('to="/plan">Get Started', 'to="/signup">Get Started')
content = content.replace('to="/plan"><LandingIcon name="route" size={20} />Plan My Safe Route', 'to="/signup"><LandingIcon name="route" size={20} />Plan My Safe Route')

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
