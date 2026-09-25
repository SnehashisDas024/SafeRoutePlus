import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import { useTrip } from '../hooks/useTrip'
import { useShake } from '../hooks/useShake'
import { useVoice } from '../hooks/useVoice'
import { useNotifications } from '../hooks/useNotifications'
import { ESCALATION_COLORS, ESCALATION_LABELS } from '../services/config'
import { triggerSOS } from '../services/api'

function ActiveTripScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { 
    trip, 
    escalation, 
    connected, 
    fetchEscalation, 
    handleCheckin, 
    handleSOS, 
    handleVoiceEvent, 
    sendPing 
  } = useTrip(id || null)
  
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([])
  const [showCheckin, setShowCheckin] = useState(false)
  const [countdown, setCountdown] = useState(0)
  
  const { setHandler } = useVoice()
  const { notify } = useNotifications()
  
  const { active: shakeActive, start: startShake, stop: stopShake } = useShake(() => handleSOS(), true)

  // Load route coordinates from localStorage (stored during trip start)
  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem(`trip_${id}_route`)
      if (saved) {
        try {
          setRouteCoordinates(JSON.parse(saved))
        } catch (e) {
          console.error('Failed to parse route coordinates:', e)
        }
      }
    }
  }, [id])

  // Shake to SOS
  useEffect(() => {
    startShake()
    return () => stopShake()
  }, [])

  // Check-in countdown
  useEffect(() => {
    if (escalation?.level === 'L2_Checkin' && escalation.checkin_deadline) {
      setShowCheckin(true)
      const update = () => {
        const remaining = Math.max(0, Math.ceil((escalation.checkin_deadline! - Date.now()) / 1000))
        setCountdown(remaining)
        if (remaining <= 0) {
          // Auto-escalate handled by backend
        }
      }
      update()
      const interval = setInterval(update, 1000)
      return () => clearInterval(interval)
    } else {
      setShowCheckin(false)
    }
  }, [escalation])

  // Voice handler
  useEffect(() => {
    setHandler(async (event) => {
      if (event.kind === 'checkin_spoken') {
        await handleCheckin('voice')
      } else {
        await handleVoiceEvent(event.kind as 'duress_word' | 'safe_word' | 'checkin_spoken', event.confidence)
      }
    })
  }, [setHandler, handleCheckin, handleVoiceEvent])

  const isDuress = escalation?.level === 'L3_Alert' && (escalation as { trigger_source?: string }).trigger_source === 'voice_duress'
  const displayLevel = isDuress ? 'L0_Normal' : (escalation?.level || 'L0_Normal')
  const displayColor = ESCALATION_COLORS[displayLevel as keyof typeof ESCALATION_COLORS] || '#2e7d32'

  // Demo simulation functions
  const simulateDeviation = useCallback(async () => {
    if (!id) return
    const baseLat = 22.57
    const baseLon = 88.36
    // Send 3 off-route pings (deviation > 50m)
    for (let i = 0; i < 3; i++) {
      await sendPing({
        lat: baseLat + 0.002 * (i + 1), // ~200m off route
        lon: baseLon + 0.002 * (i + 1),
        speed: 3,
        accuracy: 10,
        timestamp: Date.now() + i * 1000
      })
      await new Promise(r => setTimeout(r, 1000))
    }
    notify({ title: 'Deviation Simulated', body: 'Sent 3 off-route pings. L1→L2 check-in should trigger.' })
  }, [id, sendPing, notify])

  const simulateStop = useCallback(async () => {
    if (!id) return
    const baseLat = 22.57
    const baseLon = 88.36
    // Send 5 stationary pings over 60 seconds
    for (let i = 0; i < 5; i++) {
      await sendPing({
        lat: baseLat,
        lon: baseLon,
        speed: 0,
        accuracy: 5,
        timestamp: Date.now() + i * 15000
      })
      await new Promise(r => setTimeout(r, 500))
    }
    notify({ title: 'Stop Simulated', body: 'Sent stationary pings. Prolonged stop detection triggered.' })
  }, [id, sendPing, notify])

  const endTrip = useCallback(async () => {
    if (!id) return
    try {
      await triggerSOS(id) // This ends the trip on backend
    } catch (e) {
      console.error('End trip error:', e)
    }
    localStorage.removeItem(`trip_${id}_route`)
    localStorage.removeItem('activeTripId')
    navigate('/report', { state: { tripId: id } })
  }, [id, navigate])

  return (
    <div style={styles.container}>
      {displayLevel !== 'L0_Normal' && displayLevel !== 'L1_Watch' && !isDuress && (
        <div style={{ ...styles.banner, background: displayColor }}>
          <span>{ESCALATION_LABELS[displayLevel as keyof typeof ESCALATION_LABELS]}</span>
          {countdown > 0 && <span style={{ marginLeft: '12px' }}>{countdown}s</span>}
        </div>
      )}
      
      <div style={styles.mapContainer}>
        <MapContainer center={position || [22.57, 88.36]} zoom={15} style={{ flex: 1, width: '100%', minHeight: '200px' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
          
          {routeCoordinates.length > 0 && (
            <Polyline positions={routeCoordinates.map(([lat, lon]) => [lat, lon])} color="#1976d2" weight={3} />
          )}
          
          {position && (
            <Marker position={position}>
              <div style={{ background: '#1976d2', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                Current Position
              </div>
            </Marker>
          )}
        </MapContainer>
      </div>
      
      <div style={styles.controls}>
        <div style={styles.demoControls}>
          <button onClick={simulateDeviation} style={styles.demoBtn}>📍 Simulate Deviation</button>
          <button onClick={simulateStop} style={styles.demoBtn}>⏸️ Simulate Stop</button>
          <button onClick={endTrip} style={{ ...styles.demoBtn, background: '#2e7d32' }}>✅ End Trip & Feedback</button>
        </div>
        <button onClick={handleSOS} style={styles.sosBtn}>🚨 SOS</button>
      </div>
      
      {showCheckin && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Are you okay?</h3>
            <p>{countdown}s remaining</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => handleCheckin('tap')} style={styles.checkinBtn}>I'm Okay</button>
              <button onClick={() => handleCheckin('voice')} style={styles.checkinBtn}>Speak "I'm Fine"</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { flex: 1, display: 'flex', flexDirection: 'column' as const, minHeight: 0 },
  banner: { padding: '12px', textAlign: 'center', color: '#fff', fontWeight: 'bold' },
  mapContainer: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const },
  controls: { padding: '16px', background: '#fff', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column' as const, gap: '12px' },
  demoControls: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  demoBtn: { padding: '10px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500' },
  sosBtn: { width: '100%', padding: '16px', background: '#c62828', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  modal: { background: '#fff', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '400px', textAlign: 'center' },
  checkinBtn: { padding: '12px 24px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '500' },
}

export default ActiveTripScreen