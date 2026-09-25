import os
import codecs

path2 = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with codecs.open(path2, 'r', 'utf-8') as f:
    content2 = f.read()

import re
content2 = re.sub(r"import \{([^}]*)\} from 'react-leaflet'", r"import {\1, Tooltip} from 'react-leaflet'", content2)

with codecs.open(path2, 'w', 'utf-8') as f:
    f.write(content2)

print("Added Tooltip import")
