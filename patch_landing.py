import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\landing\LandingPage.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

target = '<p className="landing-journeys"><span><LandingIcon name="check" size={15} /></span><b>10,000+</b> journeys protected with care</p>'

if target in content:
    content = content.replace(target, '')
    with codecs.open(path, 'w', 'utf-8') as f:
        f.write(content)
    print("Successfully removed the line from LandingPage.tsx")
else:
    print("Could not find the target string in LandingPage.tsx")
