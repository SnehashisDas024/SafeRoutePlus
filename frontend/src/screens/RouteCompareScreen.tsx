import { useMemo, useState, useEffect } from 'react'
import { useLocation as useRouterLocation, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import { startTrip } from '../services/api'
import { ScorePill, EmptyState } from '../components/ui'
import { IconStar, IconPlay, IconShield, IconMap } from '../components/Icons'
import { MAP_DEFAULTS } from '../services/config'
import type { ScoredRoute, PlanNavState } from '../types'

const INK = '#1E4E6E'

// Muted colors for non-selected routes, vibrant for selected
const ROUTE_PALETTE = [
  { main: '#3B82F6', muted: 'rgba(59,130,246,0.25)' },  // Blue
  { main: '#F59E0B', muted: 'rgba(245,158,11,0.25)' },  // Amber
  { main: '#8B5CF6', muted: 'rgba(139,92,246,0.25)' },   // Purple
]

const SAFEST_COLOR = '#22C55E' // Bright green for safest route

function segColor(score: number): string {
  if (score >= 0.7)  return '#22C55E'   // Green — safe
  if (score >= 0.5)  return '#84CC16'   // Lime — moderate
  if (score >= 0.35) return '#F59E0B'   // Amber — risky
  if (score >= 0.2)  return '#F97316'   // Orange — dangerous
  return '#EF4444'                       // Red — very dangerous
}

function MapFitter({ routes, selected }: { routes: ScoredRoute[], selected: number }) {
  const map = useMap()

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150)
    return () => clearTimeout(timer)
  }, [map])

  useEffect(() => {
    if (!routes.length) return
    const route = routes[selected]
    if (!route?.geometry?.coordinates?.length) return

    const coords = route.geometry.coordinates
    const bounds: [number, number][] = coords.map(c => [c[1], c[0]])
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    }
  }, [routes, selected, map])

  return null
}

export default function RouteCompareScreen() {
  const nav = useRouterLocation()
  const navigate = useNavigate()
  const state = nav.state as PlanNavState | null
  const [selected, setSelected] = useState(0)
  const [showSegmentColors, setShowSegmentColors] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const routes: ScoredRoute[] = state?.routes ?? []
  const safestIdx = useMemo(() => {
    if (!routes.length) return 0
    return routes.findIndex(r => r.is_safest) ?? 0
  }, [routes])

  if (!routes.length) {
    return <EmptyState icon={<IconMap size={30} color="var(--ink-faint)" />} text="No routes to compare — plan a trip first." />
  }

  const route = routes[selected]
  const fmtTime = (sec: number) => {
    const m = Math.round(sec / 60)
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`
  }
  const fmtDist = (m: number) => {
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
  }

  const startThisRoute = async () => {
    setStarting(true)
    setError('')
    try {
      const coordinates = route.geometry.coordinates
      const res = await startTrip({
        origin: state!.origin,
        destination: state!.destination,
        mode: state!.mode,
        planned_route_geom: { type: 'LineString', coordinates },
        planned_segments: route.segments.map(s => ({
          start: s.start,
          end: s.end,
          distance: s.distance,
          h3_index: '',
          duration: 0,
          predicted_arrival: new Date().toISOString(),
          score_data: {
            score: s.score,
            confidence: (s.confidence === 'high' ? 'high' : 'estimated') as 'high' | 'estimated',
            factors: s.factors,
          },
        })),
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
      {/* Route Cards */}
      <div className="grid grid-3">
        {routes.map((r, i) => {
          const isSafest = i === safestIdx
          const safetyPct = Math.round(r.safety_score * 100)
          return (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className="clay card"
              style={{
                cursor: 'pointer', textAlign: 'left', border: 'none',
                outline: selected === i
                  ? `3px solid ${isSafest ? SAFEST_COLOR : ROUTE_PALETTE[i % 3].main}`
                  : 'none',
                background: isSafest && selected === i ? '#F0FFF4' : undefined,
              }}
            >
              <div className="row-between mb-2">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: isSafest ? SAFEST_COLOR : ROUTE_PALETTE[i % 3].main,
                      border: '2px solid white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                  <strong style={{ fontSize: 16 }}>Route {i + 1}</strong>
                </div>
                {isSafest && (
                  <span className="badge safe" style={{ background: '#DCFCE7', color: '#166534' }}>
                    <IconStar size={13} /> ML Safest
                  </span>
                )}
              </div>

              {/* Safety score bar */}
              <div style={{ marginBottom: 12 }}>
                <div className="row-between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>SAFETY SCORE</span>
                  <span style={{
                    fontSize: 20, fontWeight: 900,
                    color: safetyPct >= 60 ? '#16A34A' : safetyPct >= 40 ? '#CA8A04' : '#DC2626',
                  }}>
                    {safetyPct}%
                  </span>
                </div>
                <div style={{
                  height: 8, borderRadius: 4,
                  background: '#E5E7EB', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${safetyPct}%`, height: '100%', borderRadius: 4,
                    background: safetyPct >= 60
                      ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                      : safetyPct >= 40
                        ? 'linear-gradient(90deg, #F59E0B, #CA8A04)'
                        : 'linear-gradient(90deg, #EF4444, #DC2626)',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: 8 }}>
                <div className="clay-inset" style={{ padding: 10 }}>
                  <div className="tiny">WORST SEG</div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {Math.round(r.worst_segment_score * 100)}%
                  </div>
                </div>
                <div className="clay-inset" style={{ padding: 10 }}>
                  <div className="tiny">AVERAGE</div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {Math.round(r.mean_segment_score * 100)}%
                  </div>
                </div>
                <div className="clay-inset" style={{ padding: 10 }}>
                  <div className="tiny">DISTANCE</div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {fmtDist(r.total_distance_m)}
                  </div>
                </div>
                <div className="clay-inset" style={{ padding: 10 }}>
                  <div className="tiny">ETA</div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{fmtTime(r.total_time_sec)}</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Map + Segment Details */}
      <div className="grid mt-2" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)' }}>
        {/* Map showing ALL routes, selected one highlighted */}
        <div className="clay card map-box" style={{ padding: 0, position: 'relative' }}>
          <MapContainer
            center={MAP_DEFAULTS.center}
            zoom={MAP_DEFAULTS.zoom}
            style={{ height: '100%', width: '100%', minHeight: 420 }}
          >
            <TileLayer url={MAP_DEFAULTS.tileUrl} attribution={MAP_DEFAULTS.attribution} />
            <MapFitter routes={routes} selected={selected} />

            {/* Render ALL routes — non-selected as muted, selected as vivid */}
            {routes.map((r, routeIdx) => {
              const isSelected = routeIdx === selected
              const isSafest = routeIdx === safestIdx
              const coords: [number, number][] = r.geometry.coordinates.map(c => [c[1], c[0]])

              if (!isSelected) {
                // Non-selected route: muted background line
                return (
                  <Polyline
                    key={`route-bg-${routeIdx}`}
                    positions={coords}
                    pathOptions={{
                      color: isSafest ? 'rgba(34,197,94,0.35)' : ROUTE_PALETTE[routeIdx % 3].muted,
                      weight: 5,
                      opacity: 0.8,
                      dashArray: '8 6',
                    }}
                    eventHandlers={{ click: () => setSelected(routeIdx) }}
                  />
                )
              }

              // Selected route: show per-segment safety colors if enabled
              if (showSegmentColors && r.segments.length > 0) {
                return r.segments.map((seg, segIdx) => (
                  <Polyline
                    key={`seg-${routeIdx}-${segIdx}`}
                    positions={[
                      [seg.start[1], seg.start[0]],
                      [seg.end[1], seg.end[0]],
                    ]}
                    pathOptions={{
                      color: segColor(seg.score),
                      weight: 7,
                      opacity: 0.95,
                    }}
                  />
                ))
              }

              // Selected route: single vivid polyline
              return (
                <Polyline
                  key={`route-sel-${routeIdx}`}
                  positions={coords}
                  pathOptions={{
                    color: isSafest ? SAFEST_COLOR : ROUTE_PALETTE[routeIdx % 3].main,
                    weight: 7,
                    opacity: 0.95,
                  }}
                />
              )
            })}
          </MapContainer>

          {/* Map Legend */}
          <div style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
            background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)',
            padding: '8px 14px', borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: 11, fontWeight: 700, color: INK,
          }}>
            <div style={{ marginBottom: 4, fontWeight: 800 }}>SAFETY LEGEND</div>
            {[
              { color: '#22C55E', label: 'Safe (≥70%)' },
              { color: '#84CC16', label: 'Moderate (50-70%)' },
              { color: '#F59E0B', label: 'Caution (35-50%)' },
              { color: '#F97316', label: 'Risky (20-35%)' },
              { color: '#EF4444', label: 'Dangerous (<20%)' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ width: 18, height: 4, borderRadius: 2, background: color }} />
                {label}
              </div>
            ))}
          </div>

          {/* Toggle segment colors */}
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 1000,
          }}>
            <button
              className="clay-btn ghost"
              style={{
                fontSize: 11, padding: '6px 12px',
                background: showSegmentColors ? '#DEF7EC' : 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
              }}
              onClick={() => setShowSegmentColors(!showSegmentColors)}
            >
              {showSegmentColors ? '🎨 Segment Colors ON' : '🎨 Segment Colors OFF'}
            </button>
          </div>
        </div>

        {/* Segment Breakdown Panel */}
        <div className="clay card">
          <h3 className="h-ico">
            <span className="h-ico-tile"><IconShield size={17} color={INK} /></span>
            Segment safety — Route {selected + 1}
            {selected === safestIdx && (
              <span style={{ fontSize: 11, color: '#16A34A', marginLeft: 8, fontWeight: 800 }}>
                ★ SAFEST
              </span>
            )}
          </h3>

          {/* Factor summary for whole route */}
          {route.segments.length > 0 && (() => {
            const avgFactors: Record<string, number> = {}
            const factorLabels: Record<string, string> = {
              street_light_coverage: '💡 Street Lights',
              police_station_proximity: '🚔 Police Proximity',
              crowd_density: '👥 Crowd Density',
              road_quality: '🛤️ Road Quality',
              cctv_coverage: '📹 CCTV Coverage',
              incident_safety: '🛡️ Incident Safety',
            }
            for (const key of Object.keys(route.segments[0].factors)) {
              const vals = route.segments.map(s => s.factors[key] ?? 0)
              avgFactors[key] = vals.reduce((a, b) => a + b, 0) / vals.length
            }
            return (
              <div className="clay-inset" style={{ padding: 12, marginBottom: 12, borderRadius: 12 }}>
                <div className="tiny" style={{ marginBottom: 8, fontWeight: 800 }}>SAFETY FACTOR BREAKDOWN</div>
                {Object.entries(avgFactors).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 6 }}>
                    <div className="row-between" style={{ fontSize: 11.5, fontWeight: 700 }}>
                      <span>{factorLabels[key] || key}</span>
                      <span>{Math.round(val * 100)}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
                      <div style={{
                        width: `${val * 100}%`, height: '100%', borderRadius: 3,
                        background: val >= 0.6 ? '#22C55E' : val >= 0.4 ? '#F59E0B' : '#EF4444',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Per-segment list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {route.segments.map((s, i) => (
              <div key={i} className="clay-inset row-between" style={{ padding: '8px 12px' }}>
                <span className="row" style={{ fontSize: 12, fontWeight: 700, gap: 6 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: segColor(s.score),
                    boxShadow: `0 0 4px ${segColor(s.score)}`,
                  }} />
                  Seg {i + 1} · {Math.round(s.score * 100)}%
                </span>
                <span className="tiny" style={{
                  color: s.confidence === 'high' ? '#16A34A' : '#CA8A04',
                }}>
                  {s.confidence}
                </span>
              </div>
            ))}
          </div>

          {error && <div className="error-note">{error}</div>}
          <button
            className="clay-btn mt-2"
            style={{
              width: '100%', padding: 15,
              background: selected === safestIdx ? 'linear-gradient(135deg, #22C55E, #16A34A)' : undefined,
              color: selected === safestIdx ? 'white' : undefined,
            }}
            disabled={starting}
            onClick={startThisRoute}
          >
            {starting ? 'Starting...' : <><IconPlay size={16} /> Start Route {selected + 1}</>}
          </button>
        </div>
      </div>
    </>
  )
}
