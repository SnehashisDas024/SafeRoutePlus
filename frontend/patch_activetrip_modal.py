import os
import codecs
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

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

if "reportModal &&" not in content:
    content = content.replace("</MapContainer>", modal)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Added modal and FAB to ActiveTripScreen")
