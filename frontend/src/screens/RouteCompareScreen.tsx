import { useMemo, useState, useEffect } from 'react'
import { useLocation as useRouterLocation, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { startTrip } from '../services/api'
import { EmptyState } from '../components/ui'
import { IconStar, IconPlay, IconShield, IconMap } from '../components/Icons'
import { MAP_DEFAULTS } from '../services/config'
import type { ScoredRoute, PlanNavState } from '../types'

const INK = '#1E4E6E'

// Distinct color palette for up to 5 routes
// Safest route is Emerald Green, others have high-contrast distinct colors
export const ROUTE_PALETTE = [
  { main: '#10B981', muted: 'rgba(16,185,129,0.45)', glow: 'rgba(16,185,129,0.30)', name: 'Emerald (Safest)' },
  { main: '#3B82F6', muted: 'rgba(59,130,246,0.45)', glow: 'rgba(59,130,246,0.25)', name: 'Royal Blue' },
  { main: '#8B5CF6', muted: 'rgba(139,92,246,0.45)', glow: 'rgba(139,92,246,0.25)', name: 'Violet' },
  { main: '#F59E0B', muted: 'rgba(245,158,11,0.45)', glow: 'rgba(245,158,11,0.25)', name: 'Amber' },
  { main: '#EC4899', muted: 'rgba(236,72,153,0.45)', glow: 'rgba(236,72,153,0.25)', name: 'Hot Pink' },
]

export const SAFEST_COLOR = '#10B981' // Vibrant Emerald Green for safest route

function segColor(score: number): string {
  if (score >= 0.7)  return '#10B981'   // Emerald — safe
  if (score >= 0.5)  return '#84CC16'   // Lime — moderate
  if (score >= 0.35) return '#F59E0B'   // Amber — risky
  if (score >= 0.2)  return '#F97316'   // Orange — dangerous
  return '#EF4444'                       // Red — very dangerous
}

// Custom map pins for origin and destination
const createPinIcon = (color: string, letter: string) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="position: relative; width: 30px; height: 38px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
        <svg viewBox="0 0 32 42" width="30" height="38" fill="none">
          <path d="M16 0C7.16 0 0 7.16 0 16c0 11.5 14.5 24.8 15.1 25.4.5.5 1.3.5 1.8 0C17.5 40.8 32 27.5 32 16 32 7.16 24.84 0 16 0z" fill="${color}"/>
          <circle cx="16" cy="15" r="9" fill="#FFFFFF"/>
        </svg>
        <span style="position: absolute; top: 5px; left: 0; right: 0; text-align: center; font-size: 12px; font-weight: 900; color: ${color}; line-height: 18px;">${letter}</span>
      </div>
    `,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
  })
}

const originPin = createPinIcon('#10B981', 'A')
const destPin = createPinIcon('#EF4444', 'B')

// Floating badge on route midpoint
const createRouteBadgeIcon = (
  routeNum: number,
  scorePct: number,
  color: string,
  isSafest: boolean,
  isSelected: boolean
) => {
  return L.divIcon({
    className: 'custom-route-badge',
    html: `
      <div style="
        display: flex;
        align-items: center;
        gap: 5px;
        padding: ${isSelected ? '4px 9px' : '3px 7px'};
        border-radius: 12px;
        background: ${isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.94)'};
        border: ${isSelected ? `2.5px solid ${color}` : `1.5px solid ${color}`};
        box-shadow: ${isSelected ? `0 4px 12px ${color}55` : '0 2px 6px rgba(0,0,0,0.2)'};
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
        transform-origin: center;
        transition: transform 0.2s ease;
      ">
        <span style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${color};
          box-shadow: 0 0 5px ${color};
          flex-shrink: 0;
        "></span>
        <span style="font-size: 11px; font-weight: ${isSafest ? '900' : '700'}; color: ${INK};">
          ${isSafest ? '★ ' : ''}R${routeNum} <b style="color: ${scorePct >= 60 ? '#10B981' : scorePct >= 40 ? '#D97706' : '#EF4444'};">${scorePct}%</b>
        </span>
      </div>
    `,
    iconSize: [64, 24],
    iconAnchor: [32, 12],
  })
}

function MapFitter({ routes, selected }: { routes: ScoredRoute[], selected: number }) {
  const map = useMap()

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150)
    return () => clearTimeout(timer)
  }, [map])

  useEffect(() => {
    if (!routes.length) return
    // Fit bounds of all routes collectively on first load or when routes change
    const allCoords: [number, number][] = []
    routes.forEach(r => {
      if (r?.geometry?.coordinates?.length) {
        r.geometry.coordinates.forEach(c => allCoords.push([c[1], c[0]]))
      }
    })
    if (allCoords.length > 0) {
      map.fitBounds(allCoords, { padding: [45, 45], maxZoom: 16 })
    }
  }, [routes, map])

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

export default function RouteCompareScreen() {
  const nav = useRouterLocation()
  const navigate = useNavigate()
  const state = nav.state as PlanNavState | null
  const [selected, setSelected] = useState(0)
  const [showSegmentColors, setShowSegmentColors] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  // Top 5 routes
  const routes: ScoredRoute[] = useMemo(() => {
    return (state?.routes ?? []).slice(0, 5)
  }, [state])

  const safestIdx = useMemo(() => {
    if (!routes.length) return 0
    const idx = routes.findIndex(r => r.is_safest)
    return idx >= 0 ? idx : 0
  }, [routes])

  if (!routes.length) {
    return <EmptyState icon={<IconMap size={30} color="var(--ink-faint)" />} text="No routes to compare — plan a trip first." />
  }

  const route = routes[selected] || routes[0]

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
      localStorage.setItem('activeDestination', JSON.stringify(state!.destination))
      localStorage.setItem('activeMode', state!.mode)
      localStorage.setItem('activePath', JSON.stringify(coordinates))
      navigate('/trip')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start trip')
    } finally {
      setStarting(false)
    }
  }

  // Helper to get color for a route index
  const getRouteColor = (idx: number, isSafest: boolean) => {
    if (isSafest) return SAFEST_COLOR
    const r = routes[idx]
    if (r?.route_color) return r.route_color
    return ROUTE_PALETTE[idx % ROUTE_PALETTE.length].main
  }

  return (
    <>
      {/* Top Header */}
      <div className="row-between mb-2" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: INK, margin: 0 }}>
            Top {routes.length} Route Safety Comparison
          </h2>
          <span className="tiny" style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>
            Showing the safest AI-evaluated route corridors • Click any card or route line to inspect
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge safe" style={{ background: '#DCFCE7', color: '#15803D', fontWeight: 800 }}>
            <IconStar size={13} /> Route {safestIdx + 1} is Safest ({Math.round((routes[safestIdx]?.safety_score ?? 0) * 100)}%)
          </span>
        </div>
      </div>

      {/* Top 5 Route Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(210px, 1fr))`,
          gap: 12,
          marginBottom: 16,
        }}
      >
        {routes.map((r, i) => {
          const isSafest = i === safestIdx
          const isSelected = i === selected
          const safetyPct = Math.round(r.safety_score * 100)
          const routeColor = getRouteColor(i, isSafest)

          return (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className="clay card"
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: 'none',
                padding: '14px 16px',
                position: 'relative',
                transition: 'all 0.2s ease',
                transform: isSelected ? 'scale(1.02)' : 'none',
                outline: isSelected
                  ? `3px solid ${routeColor}`
                  : 'none',
                boxShadow: isSelected
                  ? `0 6px 18px ${routeColor}40`
                  : undefined,
                background: isSafest && isSelected
                  ? 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)'
                  : isSelected
                    ? 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)'
                    : undefined,
              }}
            >
              {/* Card Header */}
              <div className="row-between mb-1" style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: '50%',
                      background: routeColor,
                      border: '2px solid white',
                      boxShadow: `0 0 6px ${routeColor}`,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <strong style={{ fontSize: 15, color: INK }}>Route {i + 1}</strong>
                    {r.route_name && (
                      <div className="tiny" style={{ fontSize: 10, color: 'var(--ink-soft)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.route_name}
                      </div>
                    )}
                  </div>
                </div>

                {isSafest ? (
                  <span
                    className="badge safe"
                    style={{
                      background: '#DCFCE7',
                      color: '#15803D',
                      fontSize: 10.5,
                      fontWeight: 900,
                      padding: '3px 7px',
                    }}
                  >
                    <IconStar size={11} /> SAFEST
                  </span>
                ) : (
                  <span
                    className="tiny"
                    style={{
                      fontWeight: 800,
                      color: routeColor,
                      background: `${routeColor}15`,
                      padding: '2px 6px',
                      borderRadius: 6,
                    }}
                  >
                    #{i + 1}
                  </span>
                )}
              </div>

              {/* Safety Score Highlight */}
              <div style={{ margin: '10px 0 10px' }}>
                <div className="row-between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)' }}>
                    SAFETY SCORE
                  </span>
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: isSafest ? '#10B981' : safetyPct >= 60 ? '#16A34A' : safetyPct >= 40 ? '#D97706' : '#DC2626',
                    }}
                  >
                    {safetyPct}%
                  </span>
                </div>
                {/* Score Bar */}
                <div
                  style={{
                    height: 7,
                    borderRadius: 4,
                    background: '#E2E8F0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${safetyPct}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: isSafest
                        ? 'linear-gradient(90deg, #34D399, #10B981)'
                        : safetyPct >= 60
                          ? 'linear-gradient(90deg, #60A5FA, #3B82F6)'
                          : safetyPct >= 40
                            ? 'linear-gradient(90deg, #FBBF24, #F59E0B)'
                            : 'linear-gradient(90deg, #F87171, #EF4444)',
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
              </div>

              {/* Key Metrics Mini-Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 6,
                  fontSize: 11,
                }}
              >
                <div className="clay-inset" style={{ padding: '6px 8px' }}>
                  <div className="tiny" style={{ fontSize: 9.5 }}>WORST</div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: INK }}>
                    {Math.round(r.worst_segment_score * 100)}%
                  </div>
                </div>
                <div className="clay-inset" style={{ padding: '6px 8px' }}>
                  <div className="tiny" style={{ fontSize: 9.5 }}>AVG</div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: INK }}>
                    {Math.round(r.mean_segment_score * 100)}%
                  </div>
                </div>
                <div className="clay-inset" style={{ padding: '6px 8px' }}>
                  <div className="tiny" style={{ fontSize: 9.5 }}>DIST</div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: INK }}>
                    {fmtDist(r.total_distance_m)}
                  </div>
                </div>
                <div className="clay-inset" style={{ padding: '6px 8px' }}>
                  <div className="tiny" style={{ fontSize: 9.5 }}>ETA</div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: INK }}>
                    {fmtTime(r.total_time_sec)}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Map + Segment Details */}
      <div className="grid mt-2" style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(290px, 1fr)' }}>
        {/* Map Container */}
        <div className="clay card map-box" style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
          <MapContainer
            center={MAP_DEFAULTS.center}
            zoom={MAP_DEFAULTS.zoom}
            style={{ height: '100%', width: '100%', minHeight: 460 }}
          >
            <MapInvalidator />
            <TileLayer url={MAP_DEFAULTS.tileUrl} attribution={MAP_DEFAULTS.attribution} />
            <MapFitter routes={routes} selected={selected} />

            {/* 1. Origin and Destination Pins */}
            {state?.origin && (
              <Marker position={[state.origin[1], state.origin[0]]} icon={originPin} />
            )}
            {state?.destination && (
              <Marker position={[state.destination[1], state.destination[0]]} icon={destPin} />
            )}

            {/* 2. Render Unselected Routes First (Solid distinct colors) */}
            {routes.map((r, routeIdx) => {
              if (routeIdx === selected) return null
              const isSafest = routeIdx === safestIdx
              const routeColor = getRouteColor(routeIdx, isSafest)
              const coords: [number, number][] = r.geometry.coordinates.map(c => [c[1], c[0]])
              const safetyPct = Math.round(r.safety_score * 100)

              return (
                <div key={`unsel-group-${routeIdx}`}>
                  {/* Subtle halo for safest route even when unselected so it always stands out */}
                  {isSafest && (
                    <Polyline
                      positions={coords}
                      pathOptions={{
                        color: 'rgba(16, 185, 129, 0.40)',
                        weight: 11,
                        opacity: 0.9,
                      }}
                      eventHandlers={{ click: () => setSelected(routeIdx) }}
                    />
                  )}
                  {/* Solid route line with distinct route color */}
                  <Polyline
                    positions={coords}
                    pathOptions={{
                      color: routeColor,
                      weight: isSafest ? 6 : 5,
                      opacity: 0.88,
                    }}
                    eventHandlers={{ click: () => setSelected(routeIdx) }}
                  >
                    <Tooltip sticky direction="top">
                      <div style={{ fontWeight: 800 }}>
                        {isSafest ? '★ ' : ''}Route {routeIdx + 1} ({safetyPct}% Safe)
                      </div>
                      <div style={{ fontSize: 11, color: '#4B5563' }}>
                        {r.route_name || `${fmtDist(r.total_distance_m)} • ${fmtTime(r.total_time_sec)}`}
                      </div>
                    </Tooltip>
                  </Polyline>
                </div>
              )
            })}

            {/* 3. Render Selected Route on Top with Glowing Casing */}
            {(() => {
              const r = routes[selected]
              if (!r) return null
              const isSafest = selected === safestIdx
              const routeColor = getRouteColor(selected, isSafest)
              const coords: [number, number][] = r.geometry.coordinates.map(c => [c[1], c[0]])

              return (
                <div key={`sel-group-${selected}`}>
                  {/* Glowing halo / casing */}
                  <Polyline
                    positions={coords}
                    pathOptions={{
                      color: isSafest ? 'rgba(16, 185, 129, 0.45)' : `${routeColor}55`,
                      weight: 13,
                      opacity: 0.95,
                    }}
                  />

                  {/* Heatmap per-segment colors if toggled ON */}
                  {showSegmentColors && r.segments.length > 0 ? (
                    r.segments.map((seg, segIdx) => (
                      <Polyline
                        key={`seg-${selected}-${segIdx}`}
                        positions={[
                          [seg.start[1], seg.start[0]],
                          [seg.end[1], seg.end[0]],
                        ]}
                        pathOptions={{
                          color: segColor(seg.score),
                          weight: 8,
                          opacity: 1,
                        }}
                      />
                    ))
                  ) : (
                    /* Distinct solid vibrant route line */
                    <Polyline
                      positions={coords}
                      pathOptions={{
                        color: routeColor,
                        weight: 8,
                        opacity: 1,
                      }}
                    >
                      <Tooltip sticky permanent={false} direction="top">
                        <div style={{ fontWeight: 800 }}>
                          {isSafest ? '★ ' : ''}Route {selected + 1} ({Math.round(r.safety_score * 100)}% Safe)
                        </div>
                        <div style={{ fontSize: 11, color: '#4B5563' }}>
                          Selected • {fmtDist(r.total_distance_m)} • {fmtTime(r.total_time_sec)}
                        </div>
                      </Tooltip>
                    </Polyline>
                  )}
                </div>
              )
            })()}

            {/* 4. Midpoint Floating Badges for each Route */}
            {routes.map((r, i) => {
              const coords = r.geometry.coordinates
              if (coords.length < 2) return null
              // Pick ~40% along the path for placing the badge
              const midIdx = Math.floor(coords.length * 0.42)
              const midPt = coords[midIdx]
              const isSafest = i === safestIdx
              const isSelected = i === selected
              const routeColor = getRouteColor(i, isSafest)
              const safetyPct = Math.round(r.safety_score * 100)

              return (
                <Marker
                  key={`badge-${i}`}
                  position={[midPt[1], midPt[0]]}
                  icon={createRouteBadgeIcon(i + 1, safetyPct, routeColor, isSafest, isSelected)}
                  eventHandlers={{ click: () => setSelected(i) }}
                />
              )
            })}
          </MapContainer>

          {/* Interactive Top 5 Routes Map Legend */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              zIndex: 1000,
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(8px)',
              padding: '10px 14px',
              borderRadius: 14,
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              fontSize: 11.5,
              fontWeight: 700,
              color: INK,
              maxWidth: 240,
            }}
          >
            <div style={{ marginBottom: 6, fontWeight: 900, fontSize: 11, letterSpacing: '0.04em', color: INK }}>
              TOP 5 ROUTES ON MAP
            </div>
            {routes.map((r, i) => {
              const isSafest = i === safestIdx
              const isSelected = i === selected
              const color = getRouteColor(i, isSafest)
              const safetyPct = Math.round(r.safety_score * 100)

              return (
                <div
                  key={`legend-r-${i}`}
                  onClick={() => setSelected(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '3px 6px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isSelected ? `${color}20` : 'transparent',
                    marginBottom: 2,
                    fontWeight: isSelected ? 900 : 700,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span
                      style={{
                        width: 14,
                        height: 5,
                        borderRadius: 3,
                        background: color,
                        boxShadow: `0 0 4px ${color}`,
                      }}
                    />
                    <span>
                      Route {i + 1} {isSafest && <b style={{ color: '#10B981' }}>★ SAFEST</b>}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: isSafest ? '#10B981' : color,
                    }}
                  >
                    {safetyPct}%
                  </span>
                </div>
              )
            })}

            <div style={{ margin: '8px 0 4px', borderTop: '1px solid #E2E8F0', paddingTop: 6, fontSize: 10, color: 'var(--ink-soft)' }}>
              SAFETY TIERS:
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
              <span style={{ color: '#10B981' }}>● Safe ≥70%</span>
              <span style={{ color: '#84CC16' }}>● Mod 50-70%</span>
              <span style={{ color: '#F59E0B' }}>● Caution 35-50%</span>
              <span style={{ color: '#EF4444' }}>● Danger &lt;20%</span>
            </div>
          </div>

          {/* Map View Controls Toggle */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 1000,
              display: 'flex',
              gap: 6,
            }}
          >
            <button
              className="clay-btn ghost"
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                padding: '7px 13px',
                background: showSegmentColors ? '#DCFCE7' : 'rgba(255,255,255,0.95)',
                color: showSegmentColors ? '#15803D' : INK,
                backdropFilter: 'blur(8px)',
                borderRadius: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}
              onClick={() => setShowSegmentColors(!showSegmentColors)}
            >
              {showSegmentColors ? '🎨 Segment Heatmap: ON' : '🛣️ Distinct Route Colors'}
            </button>
          </div>
        </div>

        {/* Segment Breakdown & Action Panel */}
        <div className="clay card">
          <h3 className="h-ico" style={{ margin: '0 0 12px 0' }}>
            <span className="h-ico-tile" style={{ background: `${getRouteColor(selected, selected === safestIdx)}20` }}>
              <IconShield size={17} color={getRouteColor(selected, selected === safestIdx)} />
            </span>
            <span>Route {selected + 1} Safety Profile</span>
            {selected === safestIdx && (
              <span
                style={{
                  fontSize: 11,
                  background: '#DCFCE7',
                  color: '#15803D',
                  padding: '3px 8px',
                  borderRadius: 12,
                  marginLeft: 8,
                  fontWeight: 900,
                }}
              >
                ★ SAFEST CORRIDOR
              </span>
            )}
          </h3>

          {/* Factor summary for whole route */}
          {route.segments.length > 0 && (() => {
            const avgFactors: Record<string, number> = {}
            const factorLabels: Record<string, string> = {
              street_light_coverage: '💡 Street Lighting',
              police_station_proximity: '🚔 Police Proximity',
              crowd_density: '👥 Crowd Activity',
              road_quality: '🛤️ Road Quality',
              cctv_coverage: '📹 CCTV Coverage',
              incident_safety: '🛡️ Historical Safety',
            }
            for (const key of Object.keys(route.segments[0].factors)) {
              const vals = route.segments.map(s => s.factors[key] ?? 0)
              avgFactors[key] = vals.reduce((a, b) => a + b, 0) / vals.length
            }
            return (
              <div className="clay-inset" style={{ padding: 12, marginBottom: 12, borderRadius: 12 }}>
                <div className="tiny" style={{ marginBottom: 8, fontWeight: 900, color: INK }}>
                  AI SAFETY FACTOR BREAKDOWN
                </div>
                {Object.entries(avgFactors).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 6 }}>
                    <div className="row-between" style={{ fontSize: 11.5, fontWeight: 700 }}>
                      <span>{factorLabels[key] || key}</span>
                      <span style={{ fontWeight: 800 }}>{Math.round(val * 100)}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: '#E2E8F0', overflow: 'hidden', marginTop: 2 }}>
                      <div
                        style={{
                          width: `${val * 100}%`,
                          height: '100%',
                          borderRadius: 3,
                          background: val >= 0.6 ? '#10B981' : val >= 0.4 ? '#F59E0B' : '#EF4444',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Per-segment list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {route.segments.map((s, i) => (
              <div key={i} className="clay-inset row-between" style={{ padding: '7px 10px' }}>
                <span className="row" style={{ fontSize: 11.5, fontWeight: 700, gap: 6 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: segColor(s.score),
                      boxShadow: `0 0 4px ${segColor(s.score)}`,
                    }}
                  />
                  Segment {i + 1} · {Math.round(s.score * 100)}% Safe
                </span>
                <span
                  className="tiny"
                  style={{
                    color: s.confidence === 'high' ? '#10B981' : '#CA8A04',
                    fontWeight: 700,
                  }}
                >
                  {s.confidence} confidence
                </span>
              </div>
            ))}
          </div>

          {error && <div className="error-note" style={{ marginTop: 10 }}>{error}</div>}

          {/* Start Route Button */}
          <button
            className="clay-btn mt-2"
            style={{
              width: '100%',
              padding: 14,
              fontSize: 15,
              fontWeight: 900,
              background: selected === safestIdx
                ? 'linear-gradient(135deg, #10B981, #059669)'
                : `linear-gradient(135deg, ${getRouteColor(selected, false)}, #1E4E6E)`,
              color: 'white',
              boxShadow: selected === safestIdx ? '0 6px 18px rgba(16,185,129,0.35)' : undefined,
            }}
            disabled={starting}
            onClick={startThisRoute}
          >
            {starting ? 'Starting Trip...' : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <IconPlay size={16} />
                Start Route {selected + 1} {selected === safestIdx ? '(Safest Route)' : ''}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
