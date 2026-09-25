import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet'
import { planRoute } from '../services/api'
import { useLocation } from '../hooks/useLocation'
import { MAP_DEFAULTS, KOLKATA_PRESETS } from '../services/config'
import { IconPin, IconSatellite, IconWalk, IconCar, IconSpark, IconShield } from '../components/Icons'
import type { LeafletMouseEvent } from 'leaflet'
import type { RouteCandidate, PlanNavState } from '../types'

const INK = '#1E4E6E'

function ClickCatcher({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick })
  return null
}

export default function PlanScreen() {
  const navigate = useNavigate()
  const [origin, setOrigin] = useState<[number, number] | null>(null)
  const [destination, setDestination] = useState<[number, number] | null>(null)
  const [mode, setMode] = useState<'walk' | 'drive'>('walk')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { location: currentLoc, start } = useLocation()
  const pickTarget = useRef<'origin' | 'destination'>('origin')

  const handleMapClick = (e: LeafletMouseEvent) => {
    const c: [number, number] = [e.latlng.lng, e.latlng.lat]
    if (pickTarget.current === 'origin') {
      setOrigin(c)
      pickTarget.current = 'destination'
    } else {
      setDestination(c)
    }
  }

  const handlePlan = async () => {
    if (!origin || !destination) {
      setError('Pick both an origin and a destination (tap the map or use a preset).')
      return
    }
    setLoading(true)
    setError('')
    try {
      const routes: RouteCandidate[] = await planRoute({
        origin, destination, mode, depart_at: new Date().toISOString(),
      })
      navigate('/compare', { state: { routes, origin, destination, mode } as PlanNavState })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to plan route')
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = (p: typeof KOLKATA_PRESETS[0]) => {
    setOrigin(p.origin)
    setDestination(p.destination)
    setMode(p.mode)
    pickTarget.current = 'origin'
  }

  const clearAll = () => { setOrigin(null); setDestination(null); pickTarget.current = 'origin' }

  const toLL = (c: [number, number] | null) => (c ? ([c[1], c[0]] as [number, number]) : null)

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gridAutoColumns: '1fr' }}>
        <div className="clay card map-box" style={{ padding: 0 }}>
          <MapContainer center={MAP_DEFAULTS.center} zoom={MAP_DEFAULTS.zoom} style={{ height: '100%', width: '100%' }}>
            <TileLayer url={MAP_DEFAULTS.tileUrl} attribution={MAP_DEFAULTS.attribution} />
            <ClickCatcher onClick={handleMapClick} />
            {toLL(origin) && <Marker position={toLL(origin)!} />}
            {toLL(destination) && <Marker position={toLL(destination)!} />}
            {toLL(origin) && toLL(destination) && (
              <Polyline positions={[toLL(origin)!, toLL(destination)!]} pathOptions={{ color: '#4E9FDB', dashArray: '6 8', weight: 3 }} />
            )}
            {currentLoc && <Marker position={[currentLoc.lat, currentLoc.lon]} />}
          </MapContainer>
        </div>

        <div>
          <div className="clay card">
            <h3 className="h-ico"><span className="h-ico-tile"><IconPin size={17} color={INK} /></span>Pick points</h3>
            <div className="row-between clay-inset" style={{ padding: '10px 14px', marginBottom: 8 }}>
              <span className="tiny">ORIGIN</span>
              <span style={{ fontSize: 13, fontWeight: 800 }}>
                {origin ? `${origin[1].toFixed(4)}, ${origin[0].toFixed(4)}` : 'tap map / preset'}
              </span>
            </div>
            <div className="row-between clay-inset" style={{ padding: '10px 14px' }}>
              <span className="tiny">DESTINATION</span>
              <span style={{ fontSize: 13, fontWeight: 800 }}>
                {destination ? `${destination[1].toFixed(4)}, ${destination[0].toFixed(4)}` : 'tap map / preset'}
              </span>
            </div>
            <p className="tiny mt-1">Next tap sets: <strong>{pickTarget.current}</strong></p>
            <div className="row mt-1">
              <button className="clay-btn ghost" style={{ flex: 1 }} onClick={() => {
                if (currentLoc) {
                  const c: [number, number] = [currentLoc.lon, currentLoc.lat]
                  setOrigin(c); pickTarget.current = 'destination'
                } else start()
              }}>
                <IconSatellite size={17} /> My location
              </button>
              <button className="clay-btn ghost" onClick={clearAll}>Clear</button>
            </div>
          </div>

          <div className="clay card mt-2">
            <h3>Travel mode</h3>
            <div className="row">
              {(['walk', 'drive'] as const).map(m => (
                <button key={m} className={`chip${mode === m ? ' active' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMode(m)}>
                  {m === 'walk' ? <><IconWalk size={17} /> Walk</> : <><IconCar size={17} /> Drive</>}
                </button>
              ))}
            </div>
          </div>

          <div className="clay card mt-2">
            <h3 className="h-ico"><span className="h-ico-tile"><IconSpark size={17} color={INK} /></span>Quick presets</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {KOLKATA_PRESETS.map(p => (
                <button key={p.name} className="clay-btn ghost" style={{ justifyContent: 'flex-start', fontSize: 13.5 }} onClick={() => applyPreset(p)}>
                  {p.mode === 'drive' ? <IconCar size={16} /> : <IconWalk size={16} />} {p.name}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="error-note">{error}</div>}
          <button className="clay-btn mt-2" style={{ width: '100%', padding: 16 }} disabled={loading} onClick={handlePlan}>
            {loading ? 'Finding safest routes...' : <><IconShield size={17} /> Find Safe Routes</>}
          </button>
        </div>
      </div>
    </>
  )
}

