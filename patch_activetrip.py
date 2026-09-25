import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Add imports
imports = """import CommunityReportModal from '../components/CommunityReportModal'
import { BASE_URL } from '../services/api'
import { Marker, Tooltip, useMapEvents } from 'react-leaflet'
"""
if "CommunityReportModal" not in content:
    content = content.replace("import { EscalationBanner }", imports + "import { EscalationBanner }")

# Add MapEventsWrapper
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

# Add State and Fetch
state_code = """
  const [reportModal, setReportModal] = useState<{lat: number, lon: number} | null>(null)
  const [communityReports, setCommunityReports] = useState<any[]>([])

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const center = MAP_DEFAULTS.center;
        const r = await fetch(`${BASE_URL}/reports/community/nearby?lat=${center[0]}&lon=${center[1]}`);
        const res = await r.json();
        setCommunityReports(Array.isArray(res) ? res : [])
      } catch (e) {}
    }
    fetchReports()
  }, [])
"""
if "const [reportModal" not in content:
    content = content.replace("const [checkinDeadline, setCheckinDeadline]", state_code + "\n  const [checkinDeadline, setCheckinDeadline]")

# Replace <MapContainer ...> with the updated stuff
if "<MapEventsWrapper" not in content:
    fab = """
            <MapEventsWrapper onLongPress={(ll) => setReportModal({ lat: ll.lat, lon: ll.lng })} />
            {communityReports.map(r => (
              <Marker key={r.id} position={[r.lat, r.lon]}>
                <Tooltip direction="top">
                  <b>{r.rating} {r.rating === '\U0001F534' ? 'UNSAFE' : r.rating === '\U0001F7E2' ? 'SAFE' : 'OKAY'}</b><br/>
                  {r.tags && r.tags.length > 0 && <span style={{fontSize: 11, color: '#666'}}>{r.tags.join(', ')}<br/></span>}
                  {r.note && <span style={{fontSize: 12}}>"{r.note}"<br/></span>}
                  <span style={{fontSize: 10, color: '#aaa'}}>{new Date(r.ts).toLocaleString()}</span>
                </Tooltip>
              </Marker>
            ))}
"""
    content = content.replace("<MapInvalidator />", "<MapInvalidator />\n" + fab)

if "CommunityReportModal " not in content:
    modal = """
          </MapContainer>

          {reportModal && (
            <CommunityReportModal 
              lat={reportModal.lat} 
              lon={reportModal.lon} 
              onClose={() => setReportModal(null)} 
              onSuccess={() => {
                setReportModal(null)
                fetch(`${BASE_URL}/reports/community/nearby?lat=${MAP_DEFAULTS.center[0]}&lon=${MAP_DEFAULTS.center[1]}`).then(r => r.json()).then(r => setCommunityReports(Array.isArray(r) ? r : [])).catch(()=>{})
              }} 
            />
          )}

          <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 1000 }}>
            <button 
              className="clay-btn" 
              style={{ background: '#fff', color: '#1E4E6E', padding: '10px 15px', borderRadius: 20, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              onClick={() => setReportModal({ lat: position ? position[0] : MAP_DEFAULTS.center[0], lon: position ? position[1] : MAP_DEFAULTS.center[1] })}
            >
              \U0001F6A9 Report Area
            </button>
          </div>
"""
    content = content.replace("</MapContainer>", modal)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Added Report Area to ActiveTripScreen")

