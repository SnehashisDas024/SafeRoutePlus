import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, useMap, Polyline } from 'react-leaflet'

// Helper component to fix Leaflet map tile rendering issues on resize
function MapController({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 150)
    const container = map.getContainer()
    const resizeObserver = new window.ResizeObserver(() => {
      map.invalidateSize()
    })
    resizeObserver.observe(container)
    return () => {
      clearTimeout(timer)
      resizeObserver.disconnect()
    }
  }, [map])

  // Pan map to current position
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom() > 14 ? map.getZoom() : 16, { animate: false })
    }
  }, [map, position])
  
  return null
}

import { useTrip } from '../hooks/useTrip'
import { useLocation } from '../hooks/useLocation'
import { getVoiceConfig, safePlanRoute, uploadAudioChunk, triggerSOS } from '../services/api'
import { startListening, stopListening, speak, isVoiceSupported } from '../services/voice'
import CommunityReportModal from '../components/CommunityReportModal'
import { BASE_URL } from '../services/api'
import { Marker, Tooltip, useMapEvents } from 'react-leaflet'
import { EscalationBanner } from '../components/ui'
import DemoController from '../components/DemoController'
import { IconCompass, IconPin, IconClock, IconCheck, IconSiren, IconPencil, IconLock, IconSignal, IconMap } from '../components/Icons'
import { MAP_DEFAULTS } from '../services/config'
import type { EscalationLevel } from '../types'



const MapEventsWrapper = ({ onLongPress }: { onLongPress: (latlng: any) => void }) => {
  useMapEvents({
    contextmenu(e) {
      onLongPress(e.latlng)
    }
  })
  return null
}

const MapInvalidator = () => {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 400)
    return () => clearTimeout(timer)
  }, [map])
  return null
}

export default function ActiveTripScreen() {
  const params = useParams<{ tripId?: string }>()
  const navigate = useNavigate()
  const tripId = params.tripId || localStorage.getItem('activeTripId')

  const { escalation, wsStatus, checkin, sos, voiceEvent, sendPing } = useTrip(tripId)
  const { location, start, setMockLocation } = useLocation()
  
  const [reportModal, setReportModal] = useState<{lat: number, lon: number} | null>(null)
  const [communityReports, setCommunityReports] = useState<any[]>([])
  const [pendingSos, setPendingSos] = useState(false)
  const [sosCountdown, setSosCountdown] = useState(5)

  useEffect(() => {
    let timer: any
    if (pendingSos && sosCountdown > 0) {
      timer = setTimeout(() => setSosCountdown(c => c - 1), 1000)
    } else if (pendingSos && sosCountdown === 0) {
      setPendingSos(false)
      if (tripId) triggerSOS(tripId).catch(console.error)
    }
    return () => clearTimeout(timer)
  }, [pendingSos, sosCountdown, tripId])

  useEffect(() => {
    if (!tripId) return
    let mediaRecorder: MediaRecorder | null = null
    let audioChunks: BlobPart[] = []
    let cancelled = false
    let recordTimer: any

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      if (cancelled) return
      mediaRecorder = new MediaRecorder(stream)
      
      mediaRecorder.ondataavailable = e => {
        audioChunks.push(e.data)
      }
      
      mediaRecorder.onstop = async () => {
        if (cancelled) return
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
          audioChunks = []
          try {
            const res = await uploadAudioChunk(tripId, audioBlob)
            if (res.action === 'trigger_sos') {
              if (navigator.vibrate) navigator.vibrate([500, 250, 500])
              setPendingSos(true)
              setSosCountdown(5)
            }
          } catch (e) {
            console.error(e)
          }
        }
        if (!cancelled && mediaRecorder && mediaRecorder.state === 'inactive') {
          mediaRecorder.start()
          recordTimer = setTimeout(() => mediaRecorder?.stop(), 5000)
        }
      }
      
      mediaRecorder.start()
      recordTimer = setTimeout(() => mediaRecorder?.stop(), 5000)
    }).catch(console.error)

    return () => {
      cancelled = true
      clearTimeout(recordTimer)
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      }
    }
  }, [tripId])


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

  const [checkinDeadline, setCheckinDeadline] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(0)
  const spokenRef = useRef<EscalationLevel | null>(null)

  useEffect(() => { start() }, [start])

  useEffect(() => {
    if (!location || !tripId) return
    sendPing({
      lat: location.lat, lon: location.lon,
      speed: location.speed, accuracy: location.accuracy,
      timestamp: location.timestamp,
    })
  }, [location, tripId, sendPing])

  useEffect(() => {
    if (escalation?.level === 'L2_Checkin' && !checkinDeadline) setCheckinDeadline(Date.now() + 45000)
    if (escalation?.level !== 'L2_Checkin') setCheckinDeadline(null)
  }, [escalation?.level, checkinDeadline])

  useEffect(() => {
    if (!checkinDeadline) return
    const t = setInterval(() => setCountdown(Math.max(0, Math.round((checkinDeadline - Date.now()) / 1000))), 500)
    return () => clearInterval(t)
  }, [checkinDeadline])

  useEffect(() => {
    let cancelled = false
    if (!tripId) return
    ;(async () => {
      try {
        const cfg = await getVoiceConfig()
        if (cancelled || !cfg.enabled || !isVoiceSupported()) return
        startListening(
          { safeWordHash: cfg.safe_word_hash, duressWordHash: cfg.duress_word_hash, enabled: cfg.enabled },
          (ev) => {
            void voiceEvent(ev.kind, ev.confidence)
            if (ev.kind === 'checkin_spoken') checkin().catch(() => undefined)
          },
        )
      } catch { }
    })()
    return () => { cancelled = true; stopListening() }
  }, [tripId, voiceEvent, checkin])

  useEffect(() => {
    const lvl = escalation?.level
    if (!lvl || spokenRef.current === lvl) return
    spokenRef.current = lvl
    if (lvl === 'L2_Checkin') speak('Are you okay? Say your safe word or tap I am okay.')
    if (lvl === 'L3_Alert' && escalation?.reason !== 'voice_duress') speak('Alert triggered. Contacts are being notified.')
  }, [escalation])

  if (!tripId) {
    return (
      <div className="center-page">
        <div className="h-ico-tile" style={{ width: 62, height: 62, borderRadius: 20 }}>
          <IconCompass size={32} color="#1E4E6E" />
        </div>
        <h2 style={{ fontWeight: 900, marginTop: 14 }}>No active trip</h2>
        <p className="muted">Plan a route and start it to enable live monitoring.</p>
        <Link to="/plan" className="clay-btn" style={{ marginTop: 12 }}><IconPin size={17} /> Plan a route</Link>
      </div>
    )
  }

  const level = escalation?.level ?? 'L0_Normal'
  const duressSilent = level === 'L3_Alert' && escalation?.reason === 'voice_duress'
  const position: [number, number] | null = location ? [location.lat, location.lon] : null

  const destinationStr = localStorage.getItem('activeDestination')
  const destination: [number, number] | null = destinationStr ? JSON.parse(destinationStr) : null

  const [activePath, setActivePath] = useState<[number, number][] | null>(() => {
    const pathStr = localStorage.getItem('activePath')
    return pathStr ? JSON.parse(pathStr) : null
  })
  const [reroutingMsg, setReroutingMsg] = useState('')

  // LIVE REROUTING: Every 60 seconds, query for the safest route from current position
  const posRef = useRef(position)
  useEffect(() => { posRef.current = position }, [position])

  useEffect(() => {
    if (!destination) return
    const mode = (localStorage.getItem('activeMode') as 'walk' | 'drive' | 'any') || 'walk'
    
    const interval = setInterval(async () => {
      const currentPos = posRef.current
      if (!currentPos) return
      
      try {
        const routes = await safePlanRoute({
          origin: [currentPos[1], currentPos[0]], // [lon, lat]
          destination,
          mode,
          depart_at: new Date().toISOString()
        })
        if (routes && routes.length > 0) {
          // Pick safest:
          const safest = routes.reduce((best, curr) => curr.safety_score > best.safety_score ? curr : best, routes[0])
          const newCoords = safest.geometry.coordinates // [lon, lat][]
          setActivePath(newCoords)
          localStorage.setItem('activePath', JSON.stringify(newCoords))
          
          setReroutingMsg('Route updated to safer alternative!')
          setTimeout(() => setReroutingMsg(''), 4000)
        }
      } catch (err) {
        console.error('Failed to reroute', err)
      }
    }, 60000) // 1 minute
    
    return () => clearInterval(interval)
  }, [destination])

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3
    const p1 = lat1 * Math.PI/180
    const p2 = lat2 * Math.PI/180
    const dp = (lat2-lat1) * Math.PI/180
    const dl = (lon2-lon1) * Math.PI/180
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }

  let distanceToDest = Infinity
  if (position && destination) {
    distanceToDest = getDistance(position[0], position[1], destination[1], destination[0])
  }

  return (
    <>
      
      {/* Demo Panel Overlay */}
      {setMockLocation && (
        <DemoController 
          activePath={activePath} 
          setMockLocation={setMockLocation}
          onVoiceEvent={(kind, conf) => voiceEvent(kind, conf)}
        />
      )}

      <EscalationBanner level={level} reason={escalation?.reason} />

      {pendingSos && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <IconSiren size={80} color="#fff" />
          <h1 style={{ fontSize: 40, marginTop: 20 }}>SOS TRIGGERED</h1>
          <p style={{ fontSize: 20 }}>Audio analysis detected distress.</p>
          <div style={{ fontSize: 80, fontWeight: 900 }}>{sosCountdown}</div>
          <button className="clay-btn" style={{ background: '#fff', color: '#F44336', padding: '15px 40px', fontSize: 20, marginTop: 30 }} onClick={() => setPendingSos(false)}>CANCEL</button>
        </div>
      )}

      {reroutingMsg && (
        <div className="clay-inset mt-1" style={{ padding: 12, fontSize: 12.5, fontWeight: 700, color: '#10B981', borderLeft: '4px solid #10B981' }}>
          {reroutingMsg}
        </div>
      )}
      {duressSilent && (
        <div className="clay-inset mt-1" style={{ padding: 12, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)' }}>
          Screen kept normal by design — silent alert is active.
        </div>
      )}

      <div className="row mt-2 mb-2" style={{ flexWrap: 'wrap' }}>
        <span className={'badge ' + (wsStatus === 'connected' ? 'safe' : 'warn')}>
          ● {wsStatus === 'connected' ? 'Live connected' : wsStatus}
        </span>
        <span className={'badge ' + (wsStatus === 'connected' ? 'safe' : 'warn')}>Trip {tripId.slice(0, 8)}…</span>
        {position && <span className={'badge ' + (wsStatus === 'connected' ? 'safe' : 'warn')}><IconSignal size={13} /> {position[0].toFixed(4)}, {position[1].toFixed(4)}</span>}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 1fr)' }}>
        <div className="clay card map-box" style={{ padding: 0, minHeight: 360, position: 'relative' }}>
          <MapContainer center={MAP_DEFAULTS.center} zoom={MAP_DEFAULTS.zoom} style={{ height: '100%', width: '100%' }}>
            <MapController position={position} />
            <MapInvalidator />

            <MapEventsWrapper onLongPress={(ll) => setReportModal({ lat: ll.lat, lon: ll.lng })} />
            {communityReports.map(r => (
              <Marker key={r.id} position={[r.lat, r.lon]}>
                <Tooltip direction="top">
                  <b>{r.rating} {r.rating === '🔴' ? 'UNSAFE' : r.rating === '🟢' ? 'SAFE' : 'OKAY'}</b><br/>
                  {r.tags && r.tags.length > 0 && <span style={{fontSize: 11, color: '#666'}}>{r.tags.join(', ')}<br/></span>}
                  {r.note && <span style={{fontSize: 12}}>"{r.note}"<br/></span>}
                  <span style={{fontSize: 10, color: '#aaa'}}>{new Date(r.ts).toLocaleString()}</span>
                </Tooltip>
              </Marker>
            ))}

            <TileLayer url={MAP_DEFAULTS.tileUrl} attribution={MAP_DEFAULTS.attribution} />
            {activePath && (
              <Polyline 
                positions={activePath.map(p => [p[1], p[0]] as [number, number])} 
                pathOptions={{ color: '#4E9FDB', weight: 5, opacity: 0.8 }} 
              />
            )}
            {position && (
              <CircleMarker center={position} radius={10} pathOptions={{ color: '#2F7FBC', fillColor: '#6FB6E8', fillOpacity: 1, weight: 3 }} />
            )}
          
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
              🚩 Report Area
            </button>
          </div>

        </div>

        <div>
          {level === 'L2_Checkin' && (
            <div className="clay card mb-2">
              <h3 className="h-ico"><span className="h-ico-tile"><IconClock size={17} color="#1E4E6E" /></span>Check-in requested</h3>
              <p className="muted" style={{ fontSize: 14 }}>The system noticed something unusual. Are you okay?</p>
              <div className="clay-inset mt-1" style={{ padding: 14, textAlign: 'center' }}>
                <div className="tiny">BACKEND WINDOW (approx)</div>
                <div style={{ fontSize: 30, fontWeight: 900 }}>{countdown}s</div>
              </div>
              <button className="clay-btn mt-2" style={{ width: '100%', padding: 15 }} onClick={() => checkin().catch(() => undefined)}>
                <IconCheck size={17} /> I'm okay
              </button>
            </div>
          )}

          <div className="clay card">
            <h3 className="h-ico"><span className="h-ico-tile"><IconSiren size={17} color="#1E4E6E" /></span>Trip controls</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="clay-btn danger" style={{ padding: 15 }} onClick={() => sos().catch(() => undefined)}>
                <IconSiren size={17} /> Trigger SOS (L3)
              </button>
              
              {(!destination || distanceToDest <= 100) ? (
                <button className="clay-btn ghost" onClick={() => navigate('/report')}>
                  <IconPencil size={16} /> Finish & report trip
                </button>
              ) : (
                <div className="clay-inset" style={{ padding: 12, textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)' }}>
                  <IconMap size={16} style={{ display: 'block', margin: '0 auto 4px', color: 'var(--ink-faint)' }} />
                  <strong>Finish trip</strong> will appear when you are within 100m of the destination. <br />
                  <span style={{ fontSize: 11, opacity: 0.7 }}>({Math.round(distanceToDest)}m away)</span>
                  <div style={{ marginTop: 8 }}>
                    <button className="clay-btn ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => navigate('/report')}>
                      Force End Early
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="clay-inset row mt-2" style={{ padding: 14, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', gap: 9, alignItems: 'flex-start' }}>
              <IconLock size={17} color="var(--ink-soft)" />
              <span>Escalation timers run server-side — even if your phone dies, help still escalates.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
