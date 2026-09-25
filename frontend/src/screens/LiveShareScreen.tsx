import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker } from 'react-leaflet'
import { getShareData, type ShareData } from '../services/api'
import { Spinner } from '../components/ui'
import { IconShield, IconCar, IconWalk, IconFlag, IconPin, IconRefresh, IconSignal } from '../components/Icons'
import { MAP_DEFAULTS } from '../services/config'

const INK = '#1E4E6E'

export default function LiveShareScreen() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ShareData | null>(null)
  const [error, setError] = useState('')
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    if (!token) return
    let stop = false
    const tick = async () => {
      try {
        const d = await getShareData(token)
        if (!stop) { setData(d); setError('') }
      } catch (e) {
        if (stop) return
        if (e instanceof Error && e.message.includes('ended')) setEnded(true)
        else setError(e instanceof Error ? e.message : 'Could not load live trip')
      }
    }
    tick()
    const iv = setInterval(tick, 5000)
    return () => { stop = true; clearInterval(iv) }
  }, [token])

  return (
    <div style={{ minHeight: '100vh', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div className="brand row" style={{ marginBottom: 20 }}>
        <div className="brand-logo"><IconShield size={24} color={INK} /></div>
        <div>
          <div className="brand-name">SafeRoute+ Live Share</div>
          <div className="brand-sub">Journey of someone you trust</div>
        </div>
      </div>

      {ended ? (
        <div className="clay card center-page" style={{ padding: 48 }}>
          <div className="h-ico-tile" style={{ width: 58, height: 58, borderRadius: 18 }}>
            <IconFlag size={28} color={INK} />
          </div>
          <h2 style={{ fontWeight: 900, marginTop: 14 }}>This trip has ended</h2>
          <p className="muted">Live sharing stops automatically when the journey completes.</p>
        </div>
      ) : error && !data ? (
        <div className="error-note">{error}</div>
      ) : !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-3 mb-2">
            <div className="clay stat">
              <div className="stat-ico">{data.mode === 'drive' ? <IconCar size={22} color={INK} /> : <IconWalk size={22} color={INK} />}</div>
              <div>
                <div className="stat-value" style={{ fontSize: 18, textTransform: 'capitalize' }}>{data.mode}</div>
                <div className="stat-label">Travel mode</div>
              </div>
            </div>
            <div className="clay stat">
              <div className="stat-ico"><IconShield size={22} color={INK} /></div>
              <div>
                <div className="stat-value" style={{ fontSize: 18, textTransform: 'capitalize' }}>{data.status}</div>
                <div className="stat-label">Trip status</div>
              </div>
            </div>
            <div className="clay stat">
              <div className="stat-ico"><IconSignal size={22} color={INK} /></div>
              <div>
                <div className="stat-value" style={{ fontSize: 18 }}>
                  {data.position ? `${data.position[0].toFixed(3)}, ${data.position[1].toFixed(3)}` : '—'}
                </div>
                <div className="stat-label">Live position</div>
              </div>
            </div>
          </div>

          <div className="clay card map-box" style={{ padding: 0, height: 440 }}>
            <MapContainer
              center={data.position ?? MAP_DEFAULTS.center}
              zoom={MAP_DEFAULTS.zoom}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url={MAP_DEFAULTS.tileUrl} attribution={MAP_DEFAULTS.attribution} />
              <Marker position={[data.origin[1], data.origin[0]]} />
              <Marker position={[data.destination[1], data.destination[0]]} />
              {data.planned_route_geom?.coordinates && (
                <Polyline
                  positions={data.planned_route_geom.coordinates.map(c => [c[1], c[0]] as [number, number])}
                  pathOptions={{ color: '#4E9FDB', weight: 4, opacity: 0.8 }}
                />
              )}
              {data.position && (
                <CircleMarker
                  center={[data.position[1], data.position[0]]}
                  radius={11}
                  pathOptions={{ color: '#2F7FBC', fillColor: '#6FB6E8', fillOpacity: 1, weight: 3 }}
                />
              )}
            </MapContainer>
          </div>

          <div className="clay-inset mt-2 row" style={{ padding: 14, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', justifyContent: 'center', gap: 8 }}>
            <IconRefresh size={15} /> Refreshes every 5 seconds · Sharing stops the moment the trip ends
          </div>
        </>
      )}
    </div>
  )
}

