import os
import codecs

for filename in ["SignupScreen.tsx", "LoginScreen.tsx"]:
    path = os.path.join(r"C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens", filename)
    with codecs.open(path, 'r', 'utf-8') as f:
        content = f.read()

    if "import { BASE_URL }" not in content:
        content = content.replace("import { IconShield } from '../components/Icons'", "import { IconShield } from '../components/Icons'\nimport { BASE_URL } from '../services/config'")
        
    content = content.replace("'http://localhost:8000/auth/signup'", "`${BASE_URL}/auth/signup`")
    content = content.replace("'http://localhost:8000/auth/login'", "`${BASE_URL}/auth/login`")

    with codecs.open(path, 'w', 'utf-8') as f:
        f.write(content)
print("Fixed API URLs in Auth Screens")
