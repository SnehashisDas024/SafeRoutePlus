import os
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

imports = "import CommunityReportModal from '../components/CommunityReportModal'\nimport { fetchApi } from '../services/api'\n"
if "import CommunityReportModal" not in content:
    content = content.replace("import PlaceAutocomplete", imports + "import PlaceAutocomplete")

# State
state_code = """
  const [reportModal, setReportModal] = useState<{lat: number, lon: number} | null>(null)
  const [communityReports, setCommunityReports] = useState<any[]>([])

  useEffect(() => {
    // Fetch nearby community reports occasionally or on mount
    const fetchReports = async () => {
      try {
        const center = MAP_DEFAULTS.center;
        const res = await fetchApi(`/reports/community/nearby?lat=${center[0]}&lon=${center[1]}`)
        setCommunityReports(res)
      } catch (e) {}
    }
    fetchReports()
  }, [])
"""
if "const [reportModal" not in content:
    content = content.replace("const [mode, setMode]", state_code + "\n  const [mode, setMode]")

# Map Events for long press
map_events = """
const MapEventsWrapper = ({ onLongPress }: { onLongPress: (latlng: any) => void }) => {
  useMapEvents({
    contextmenu(e) {
      onLongPress(e.latlng)
    }
  })
  return null
}
"""
if "MapEventsWrapper" not in content:
    content = content.replace("const MapInvalidator", map_events + "\nconst MapInvalidator")

# Add MapEventsWrapper to MapContainer and render community pins
render_pins = """
            <MapEventsWrapper onLongPress={(ll) => setReportModal({ lat: ll.lat, lon: ll.lng })} />
            {communityReports.map(r => (
              <Marker key={r.id} position={[r.lat, r.lon]}>
                <Tooltip direction="top">
                  <b>{r.rating === 'unsafe' ? '??' : r.rating === 'safe' ? '??' : '??'} {r.rating.toUpperCase()}</b><br/>
                  {r.tags && r.tags.length > 0 && <span style={{fontSize: 11, color: '#666'}}>{r.tags.join(', ')}<br/></span>}
                  {r.note && <span style={{fontSize: 12}}>"{r.note}"<br/></span>}
                  <span style={{fontSize: 10, color: '#aaa'}}>{new Date(r.ts).toLocaleString()}</span>
                </Tooltip>
              </Marker>
            ))}
"""
content = content.replace("<MapInvalidator />", "<MapInvalidator />" + render_pins)

# Floating FAB
fab = """
          <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 1000 }}>
            <button 
              className="clay-btn" 
              style={{ background: '#fff', color: '#1E4E6E', padding: '10px 15px', borderRadius: 20, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              onClick={() => setReportModal({ lat: MAP_DEFAULTS.center[0], lon: MAP_DEFAULTS.center[1] })}
            >
              ?? Report Area
            </button>
          </div>
"""
content = content.replace("</MapContainer>", "</MapContainer>\n" + fab)

# Render modal
modal_render = """
        {reportModal && (
          <CommunityReportModal 
            lat={reportModal.lat} 
            lon={reportModal.lon} 
            onClose={() => setReportModal(null)} 
            onSuccess={() => {
              setReportModal(null)
              // Refresh pins
              fetchApi(`/reports/community/nearby?lat=${MAP_DEFAULTS.center[0]}&lon=${MAP_DEFAULTS.center[1]}`).then(setCommunityReports).catch(()=>{})
            }} 
          />
        )}
"""
content = content.replace("</MapContainer>", "</MapContainer>\n" + modal_render)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched PlanScreen.tsx with Community Reporting flow")
