import { useMemo, useState } from 'react'
import { useLocation as useRouterLocation, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline } from 'react-leaflet'
import { startTrip } from '../services/api'
import { ScorePill, EmptyState } from '../components/ui'
import { IconStar, IconPlay, IconShield, IconMap } from '../components/Icons'
import { MAP_DEFAULTS } from '../services/config'
import type { RouteCandidate, PlanNavState } from '../types'

const INK = '#1E4E6E'

function segColor(score: number): string {
  if (score >= 0.6) return '#E05B54'
  if (score >= 0.45) return '#E8A13A'
  return '#6FB6E8'
}

export default function RouteCompareScreen() {
  const nav = useRouterLocation()
  const navigate = useNavigate()
  const state = nav.state as PlanNavState | null
  const [selected, setSelected] = useState(0)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const routes: RouteCandidate[] = state?.routes ?? []
  const best = useMemo(() => {
    if (!routes.length) return null
    return routes.reduce((bestIdx, r, i) =>
      (r.worst_segment_score < routes[bestIdx].worst_segment_score ? i : bestIdx), 0)
  }, [routes])

  if (!routes.length) {
    return <EmptyState icon={<IconMap size={30} color="var(--ink-faint)" />} text="No routes to compare — plan a trip first." />
  }

  const route = routes[selected]
  const fmtTime = (sec: number) => {
    const m = Math.round(sec / 60)
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`
  }

  const startThisRoute = async () => {
    setStarting(true)
    setError('')
    try {
      const coordinates = route.segments.flatMap(s => [s.start, s.end])
      const res = await startTrip({
        origin: state!.origin,
        destination: state!.destination,
        mode: state!.mode,
        planned_route_geom: { type: 'LineString', coordinates },
        planned_segments: route.segments,
      })
      localStorage.setItem('activeTripId', res.trip_id)
      navigate('/trip')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start trip')
    } finally {
      setStarting(false)
    }
  }

  return (
    <>
      <div className="grid grid-3">
        {routes.map((r, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className="clay card"
            style={{
              cursor: 'pointer', textAlign: 'left', border: 'none',
              outline: selected === i ? '3px solid var(--yellow-400)' : 'none',
            }}
          >
            <div className="row-between mb-2">
              <strong style={{ fontSize: 16 }}>Option {i + 1}</strong>
              {i === best && <span className="badge safe"><IconStar size={13} /> Safest</span>}
            </div>
            <ScorePill score={r.worst_segment_score} />
            <div className="grid grid-2 mt-2" style={{ gap: 8 }}>
              <div className="clay-inset" style={{ padding: 10 }}>
                <div className="tiny">WORST SEGMENT</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{(1 - r.worst_segment_score).toFixed(0)}%</div>
              </div>
              <div className="clay-inset" style={{ padding: 10 }}>
                <div className="tiny">AVERAGE</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{(1 - r.mean_segment_score).toFixed(0)}%</div>
              </div>
              <div className="clay-inset" style={{ padding: 10 }}>
                <div className="tiny">ETA</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{fmtTime(r.total_time_sec)}</div>
              </div>
              <div className="clay-inset" style={{ padding: 10 }}>
                <div className="tiny">SEGMENTS</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{r.segments.length}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid mt-2" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)' }}>
        <div className="clay card map-box" style={{ padding: 0 }}>
          <MapContainer
            center={MAP_DEFAULTS.center}
            zoom={MAP_DEFAULTS.zoom}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer url={MAP_DEFAULTS.tileUrl} attribution={MAP_DEFAULTS.attribution} />
            {route.segments.map((s, i) => (
              <Polyline
                key={i}
                positions={[[s.start[1], s.start[0]], [s.end[1], s.end[0]]]}
                pathOptions={{ color: segColor(s.score_data.score), weight: 5, opacity: 0.85 }}
              />
            ))}
          </MapContainer>
        </div>

        <div className="clay card">
          <h3 className="h-ico"><span className="h-ico-tile"><IconShield size={17} color={INK} /></span>Segment safety breakdown — Option {selected + 1}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
            {route.segments.map((s, i) => (
              <div key={i} className="clay-inset row-between" style={{ padding: '8px 12px' }}>
                <span className="row" style={{ fontSize: 12.5, fontWeight: 700 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: segColor(s.score_data.score) }} />
                  Seg {i + 1} · {(1 - s.score_data.score).toFixed(0)}%
                </span>
                <span className="tiny">{s.score_data.confidence}</span>
              </div>
            ))}
          </div>
          {error && <div className="error-note">{error}</div>}
          <button className="clay-btn mt-2" style={{ width: '100%', padding: 15 }} disabled={starting} onClick={startThisRoute}>
            {starting ? 'Starting...' : <><IconPlay size={16} /> Start Option {selected + 1}</>}
          </button>
        </div>
      </div>
    </>
  )
}
