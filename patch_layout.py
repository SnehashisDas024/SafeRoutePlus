import codecs

css_path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\styles\layout.css'
with codecs.open(css_path, 'r', 'utf-8') as f:
    css_content = f.read()

# Add desktop .plan-layout definition right after .grid-4
if '.plan-layout {' not in css_content.split('@media')[0]:
    css_content = css_content.replace(
        '.grid-4 { grid-template-columns: repeat(4, 1fr); }',
        '.grid-4 { grid-template-columns: repeat(4, 1fr); }\n.plan-layout { grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr); }'
    )
    with codecs.open(css_path, 'w', 'utf-8') as f:
        f.write(css_content)

plan_path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with codecs.open(plan_path, 'r', 'utf-8') as f:
    plan_content = f.read()

plan_content = plan_content.replace(
    '''<div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gridAutoColumns: '1fr' }}>''',
    '''<div className="grid plan-layout">'''
)
with codecs.open(plan_path, 'w', 'utf-8') as f:
    f.write(plan_content)


trip_path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with codecs.open(trip_path, 'r', 'utf-8') as f:
    trip_content = f.read()

trip_content = trip_content.replace(
    '''<div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 1fr)' }}>''',
    '''<div className="grid plan-layout">'''
)
with codecs.open(trip_path, 'w', 'utf-8') as f:
    f.write(trip_content)

print("Updated grid layouts for Plan and ActiveTrip")
