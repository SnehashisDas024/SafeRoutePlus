import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'

// Helper component to fix Leaflet map tile rendering issues on resize
function MapController() {
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
  return null
}

import { useTrip } from '../hooks/useTrip'
import { useLocation } from '../hooks/useLocation'
import { getVoiceConfig } from '../services/api'
import { startListening, stopListening, speak, isVoiceSupported } from '../services/voice'
import { EscalationBanner } from '../components/ui'
import { IconCompass, IconPin, IconClock, IconCheck, IconSiren, IconPencil, IconLock, IconSignal, IconMap } from '../components/Icons'
import { MAP_DEFAULTS } from '../services/config'
import type { EscalationLevel } from '../types'

export default function ActiveTripScreen() {
  const params = useParams<{ tripId?: string }>()
  const navigate = useNavigate()
  const tripId = params.tripId || localStorage.getItem('activeTripId')

  const { escalation, wsStatus, checkin, sos, voiceEvent, sendPing } = useTrip(tripId)
  const { location, start } = useLocation()
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
      <EscalationBanner level={level} reason={escalation?.reason} />
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
        <div className="clay card map-box" style={{ padding: 0, minHeight: 360 }}>
          <MapContainer center={MAP_DEFAULTS.center} zoom={MAP_DEFAULTS.zoom} style={{ height: '100%', width: '100%' }}>
            <MapController />
            <TileLayer url={MAP_DEFAULTS.tileUrl} attribution={MAP_DEFAULTS.attribution} />
            {position && (
              <CircleMarker center={position} radius={10} pathOptions={{ color: '#2F7FBC', fillColor: '#6FB6E8', fillOpacity: 1, weight: 3 }} />
            )}
          </MapContainer>
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
