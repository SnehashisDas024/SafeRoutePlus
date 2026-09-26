import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap , Tooltip} from 'react-leaflet'
import L from 'leaflet'
import { planRoute, safePlanRoute, getRecentRoutes, getFrequentRoutes } from '../services/api'
import { useLocation } from '../hooks/useLocation'
import { MAP_DEFAULTS, KOLKATA_PRESETS } from '../services/config'
import { IconPin, IconSatellite, IconWalk, IconCar, IconSpark, IconShield, IconCheck } from '../components/Icons'
import CommunityReportModal from '../components/CommunityReportModal'
import { BASE_URL } from '../services/api'
import PlaceAutocomplete from '../components/PlaceAutocomplete'
import RouteHistoryList from '../components/RouteHistoryList'
import type { LeafletMouseEvent } from 'leaflet'
import type { RouteCandidate, ScoredRoute, PlanNavState, RouteHistoryItem } from '../types'

const INK = '#1E4E6E'

// Custom SVGs for Leaflet divIcons to prevent broken PNG asset issues in bundlers
const createPinIcon = (color: string, letter: string) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="position: relative; width: 32px; height: 42px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
        <svg viewBox="0 0 32 42" width="32" height="42" fill="none">
          <path d="M16 0C7.16 0 0 7.16 0 16c0 11.5 14.5 24.8 15.1 25.4.5.5 1.3.5 1.8 0C17.5 40.8 32 27.5 32 16 32 7.16 24.84 0 16 0z" fill="${color}"/>
          <circle cx="16" cy="15" r="9" fill="#FFFFFF"/>
        </svg>
        <span style="position: absolute; top: 6px; left: 0; right: 0; text-align: center; font-size: 13px; font-weight: 900; color: ${color}; line-height: 18px;">${letter}</span>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  })
}

const originPin = createPinIcon('#27AE60', 'A')
const destPin = createPinIcon('#E74C3C', 'B')
const myLocPin = L.divIcon({
  className: 'custom-loc-pin',
  html: `
    <div style="position: relative; width: 20px; height: 20px; ">
      <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(52, 152, 219, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: absolute; inset: 0; border-radius: 50%; background: #3498DB; border: 3px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

function ClickCatcher({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick })
  return null
}

function MapController({
  origin,
  destination,
}: {
  origin: [number, number] | null
  destination: [number, number] | null
}) {
  const map = useMap()

  // Ensure Leaflet tiles render at full dimensions on load/resize
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

  // Automatically zoom and frame origin and destination pins
  useEffect(() => {
    if (origin && destination) {
      map.fitBounds(
        [
          [origin[1], origin[0]],
          [destination[1], destination[0]],
        ],
        { padding: [50, 50], maxZoom: 16 }
      )
    } else if (origin) {
      map.setView([origin[1], origin[0]], 15, { animate: true })
    } else if (destination) {
      map.setView([destination[1], destination[0]], 15, { animate: true })
    }
  }, [origin, destination, map])

  return null
}



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

export default function PlanScreen() {
  const navigate = useNavigate()
  const [origin, setOrigin] = useState<[number, number] | null>(null)
  const [destination, setDestination] = useState<[number, number] | null>(null)
  const [originName, setOriginName] = useState<string>('')
  const [destName, setDestName] = useState<string>('')
  const [activeTarget, setActiveTarget] = useState<'origin' | 'destination'>('origin')
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [recentRoutes, setRecentRoutes] = useState<RouteHistoryItem[]>([])
  const [frequentRoutes, setFrequentRoutes] = useState<RouteHistoryItem[]>([])

  const recentOrigins = useMemo(() => {
    const unique = new Map<string, [number, number]>()
    recentRoutes.forEach(r => {
      if (r.origin.name && !unique.has(r.origin.name)) {
        unique.set(r.origin.name, r.origin.coordinates)
      }
    })
    return Array.from(unique.entries()).map(([name, coords]) => ({ name, coords })).slice(0, 5)
  }, [recentRoutes])

  const recentDestinations = useMemo(() => {
    const unique = new Map<string, [number, number]>()
    recentRoutes.forEach(r => {
      if (r.destination.name && !unique.has(r.destination.name)) {
        unique.set(r.destination.name, r.destination.coordinates)
      }
    })
    return Array.from(unique.entries()).map(([name, coords]) => ({ name, coords })).slice(0, 5)
  }, [recentRoutes])
  const [historyLoading, setHistoryLoading] = useState(false)
  
  const [reportModal, setReportModal] = useState<{lat: number, lon: number} | null>(null)
  const [communityReports, setCommunityReports] = useState<any[]>([])

  useEffect(() => {
    // Fetch nearby community reports occasionally or on mount
    const fetchReports = async () => {
      try {
        const center = MAP_DEFAULTS.center;
        const r = await fetch(`${BASE_URL}/reports/community/nearby?lat=${center[0]}&lon=${center[1]}`); const res = await r.json()
        setCommunityReports(Array.isArray(res) ? res : [])
      } catch (e) {}
    }
    fetchReports()
  }, [])

  const [mode, setMode] = useState<'walk' | 'drive' | 'any'>('any')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { location: currentLoc, start } = useLocation()

  // Fetch recent and frequent routes on mount
  useEffect(() => {
    let mounted = true
    const fetchHistory = async () => {
      setHistoryLoading(true)
      try {
        const [recent, frequent] = await Promise.all([
          getRecentRoutes(10).catch(() => []),
          getFrequentRoutes(10).catch(() => []),
        ])
        if (mounted) {
          setRecentRoutes(recent)
          setFrequentRoutes(frequent)
        }
      } catch {
        // non-blocking
      } finally {
        if (mounted) setHistoryLoading(false)
      }
    }
    fetchHistory()
    return () => {
      mounted = false
    }
  }, [])

  const handleMapClick = (e: LeafletMouseEvent) => {
    const c: [number, number] = [e.latlng.lng, e.latlng.lat]
    setSelectedPreset(null)
    setSelectedHistoryId(null)
    setError('')
    if (activeTarget === 'origin') {
      setOrigin(c)
      setOriginName(`${c[1].toFixed(4)}, ${c[0].toFixed(4)}`)
      // If destination is not set yet, automatically move focus to destination
      if (!destination) {
        setActiveTarget('destination')
      }
    } else {
      setDestination(c)
      setDestName(`${c[1].toFixed(4)}, ${c[0].toFixed(4)}`)
    }
  }

  const handlePlan = async () => {
    if (!origin || !destination) {
      setError('Please set both an origin and destination (tap on map or select a quick preset).')
      return
    }
    setLoading(true)
    setError('')
    try {
      let prefetched: any[] | undefined = undefined;
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?alternatives=3&overview=full&geometries=geojson&steps=false`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to fetch map data");
        }
        if (data.routes && data.routes.length > 0) {
          prefetched = data.routes.map((r: any, idx: number) => ({
            name: `Route Alternative ${idx + 1}`,
            geometry: r.geometry,
            distance: r.distance,
            duration: mode === 'walk' ? r.duration * 5 : r.duration
          }));
        } else {
          throw new Error("No routable roads found between these locations.");
        }
      } catch (e: any) {
        setError(`Map Error: ${e.message}`);
        setLoading(false);
        return;
      }

      const routes: ScoredRoute[] = await safePlanRoute({
        origin,
        destination,
        prefetched_routes: prefetched,
        origin_name: originName || undefined,
        destination_name: destName || undefined,
        mode,
        depart_at: new Date().toISOString(),
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
    setOriginName(p.originName || p.name.split(' → ')[0])
    setDestName(p.destName || p.name.split(' → ')[1])
    setMode(p.mode)
    setSelectedPreset(p.name)
    setSelectedHistoryId(null)
    setError('')
  }

  const applyHistoryItem = (item: RouteHistoryItem) => {
    setOrigin(item.origin.coordinates)
    setDestination(item.destination.coordinates)
    setOriginName(item.origin.name || `${item.origin.coordinates[1].toFixed(4)}, ${item.origin.coordinates[0].toFixed(4)}`)
    setDestName(item.destination.name || `${item.destination.coordinates[1].toFixed(4)}, ${item.destination.coordinates[0].toFixed(4)}`)
    setMode(item.mode === 'drive' ? 'drive' : 'walk')
    setSelectedHistoryId(item.id)
    setSelectedPreset(null)
    setError('')
  }

  const clearAll = () => {
    setOrigin(null)
    setDestination(null)
    setOriginName('')
    setDestName('')
    setSelectedPreset(null)
    setSelectedHistoryId(null)
    setActiveTarget('origin')
    setError('')
  }


  const toLL = (c: [number, number] | null) => (c ? ([c[1], c[0]] as [number, number]) : null)

  return (
    <>
      <div className="grid plan-layout">
        {/* Leaflet Map Box */}
        <div className="clay card map-box" style={{ padding: 0, minHeight: 460, position: 'relative', overflow: 'hidden' }}>
          <MapContainer
            center={MAP_DEFAULTS.center}
            zoom={MAP_DEFAULTS.zoom}
            style={{ height: '100%', width: '100%', minHeight: 460 }}
          >
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
            <ClickCatcher onClick={handleMapClick} />
            <MapController origin={origin} destination={destination} />

            {toLL(origin) && <Marker position={toLL(origin)!} icon={originPin} />}
            {toLL(destination) && <Marker position={toLL(destination)!} icon={destPin} />}

            {toLL(origin) && toLL(destination) && (
              <Polyline
                positions={[toLL(origin)!, toLL(destination)!]}
                pathOptions={{ color: '#2B7A78', dashArray: '6 8', weight: 4 }}
              />
            )}

            {currentLoc && <Marker position={[currentLoc.lat, currentLoc.lon]} icon={myLocPin} />}
          </MapContainer>

        {reportModal && (
          <CommunityReportModal 
            lat={reportModal.lat} 
            lon={reportModal.lon} 
            onClose={() => setReportModal(null)} 
            onSuccess={() => {
              setReportModal(null)
              // Refresh pins
              fetch(`${BASE_URL}/reports/community/nearby?lat=${MAP_DEFAULTS.center[0]}&lon=${MAP_DEFAULTS.center[1]}`).then(r => r.json()).then(r => setCommunityReports(Array.isArray(r) ? r : [])).catch(()=>{})
            }} 
          />
        )}


          <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 1000 }}>
            <button 
              className="clay-btn" 
              style={{ background: '#fff', color: '#1E4E6E', padding: '10px 15px', borderRadius: 20, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              onClick={() => setReportModal({ lat: MAP_DEFAULTS.center[0], lon: MAP_DEFAULTS.center[1] })}
            >
              🚩 Report Area
            </button>
          </div>


          {/* Quick Map Overlay Indicator */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(8px)',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              color: INK,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: activeTarget === 'origin' ? '#27AE60' : '#E74C3C',
              }}
            />
            Tap map to set: <strong>{activeTarget.toUpperCase()}</strong>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div>
          <div className="clay card">
            <h3 className="h-ico">
              <span className="h-ico-tile">
                <IconPin size={17} color={INK} />
              </span>
              Pick points
            </h3>

            {/* Origin Input with Autocomplete */}
            <div
              onClick={() => setActiveTarget('origin')}
              className={`row-between ${activeTarget === 'origin' ? 'clay' : 'clay-inset'}`}
              style={{
                width: '100%',
                padding: '10px 14px',
                marginBottom: 8,
                textAlign: 'left',
                border: activeTarget === 'origin' ? '2px solid #27AE60' : '2px solid transparent',
                borderRadius: 14,
                background: activeTarget === 'origin' ? '#E8F8F0' : undefined,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <span className="tiny" style={{ color: activeTarget === 'origin' ? '#27AE60' : undefined, fontWeight: 800 }}>
                  ORIGIN (A) {activeTarget === 'origin' ? '• ACTIVE' : ''}
                </span>
                <PlaceAutocomplete
                  value={originName}
                  placeholder="Type a place name or tap map..."
                  isActive={activeTarget === 'origin'}
                  accentColor="#27AE60"
                  onFocus={() => setActiveTarget('origin')}
                  onChange={(name, coords) => {
                    setOriginName(name)
                    setSelectedPreset(null)
                    setError('')
                    if (coords) {
                      setOrigin(coords)
                      if (!destination) setActiveTarget('destination')
                    }
                  }}
                />
              </div>
              {origin && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    setOrigin(null)
                    setOriginName('')
                    setSelectedPreset(null)
                    setActiveTarget('origin')
                  }}
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#999',
                    padding: '2px 8px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  ✕
                </span>
              )}
            </div>

            {/* Destination Input with Autocomplete */}
            <div
              onClick={() => setActiveTarget('destination')}
              className={`row-between ${activeTarget === 'destination' ? 'clay' : 'clay-inset'}`}
              style={{
                width: '100%',
                padding: '10px 14px',
                textAlign: 'left',
                border: activeTarget === 'destination' ? '2px solid #E74C3C' : '2px solid transparent',
                borderRadius: 14,
                background: activeTarget === 'destination' ? '#FDEEEE' : undefined,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <span className="tiny" style={{ color: activeTarget === 'destination' ? '#E74C3C' : undefined, fontWeight: 800 }}>
                  DESTINATION (B) {activeTarget === 'destination' ? '• ACTIVE' : ''}
                </span>
                <PlaceAutocomplete
                  value={destName}
                  placeholder="Type a place name or tap map..."
                  isActive={activeTarget === 'destination'}
                  accentColor="#E74C3C"
                  onFocus={() => setActiveTarget('destination')}
                  onChange={(name, coords) => {
                    setDestName(name)
                    setSelectedPreset(null)
                    setError('')
                    if (coords) {
                      setDestination(coords)
                    }
                  }}
                />
              </div>
              {destination && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    setDestination(null)
                    setDestName('')
                    setSelectedPreset(null)
                    setActiveTarget('destination')
                  }}
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#999',
                    padding: '2px 8px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  ✕
                </span>
              )}
            </div>

            <div className="row mt-2" style={{ gap: 8 }}>
              <button
                className="clay-btn ghost"
                style={{ flex: 1 }}
                onClick={() => {
                  if (currentLoc) {
                    const c: [number, number] = [currentLoc.lon, currentLoc.lat]
                    setOrigin(c)
                    setOriginName('My Current Location')
                    setActiveTarget('destination')
                    setSelectedPreset(null)
                  } else {
                    start()
                  }
                }}
              >
                <IconSatellite size={17} /> My location
              </button>
              <button className="clay-btn ghost" onClick={clearAll}>
                Clear
              </button>
            </div>
          </div>

          <div className="clay card mt-2">
            <h3>Travel mode</h3>
            <div className="row" style={{ gap: 8 }}>
              {(['walk', 'drive', 'any'] as const).map((m) => (
                <button
                  key={m}
                  className={`chip${mode === m ? ' active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setMode(m)}
                >
                  {m === 'walk' ? (
                    <><IconWalk size={17} /> Walk</>
                  ) : m === 'drive' ? (
                    <><IconCar size={17} /> Drive</>
                  ) : (
                    <><IconSpark size={17} /> Any (Best)</>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Saved Routes (Recent and Frequent) */}
          <RouteHistoryList
            recentRoutes={recentRoutes}
            frequentRoutes={frequentRoutes}
            selectedRouteId={selectedHistoryId}
            loading={historyLoading}
            onSelectRoute={applyHistoryItem}
          />

          <div className="clay card mt-2">
            <h3 className="h-ico">
              <span className="h-ico-tile">
                <IconSpark size={17} color={INK} />
              </span>
              Quick presets (Auto-fill)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {KOLKATA_PRESETS.map((p) => {
                const isSelected = selectedPreset === p.name
                return (
                  <button
                    key={p.name}
                    className={`clay-btn ${isSelected ? '' : 'ghost'}`}
                    style={{
                      justifyContent: 'space-between',
                      fontSize: 13.5,
                      padding: '12px 14px',
                      background: isSelected ? '#DEF2F1' : undefined,
                      border: isSelected ? '2px solid #2B7A78' : undefined,
                    }}
                    onClick={() => applyPreset(p)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {p.mode === 'drive' ? <IconCar size={16} /> : <IconWalk size={16} />}
                      {p.name}
                    </span>
                    {isSelected && <IconCheck size={16} color="#2B7A78" />}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <div className="error-note">{error}</div>}
          <button
            className="clay-btn mt-2"
            style={{ width: '100%', padding: 16 }}
            disabled={loading}
            onClick={handlePlan}
          >
            {loading ? (
              'Finding safest routes...'
            ) : (
              <>
                <IconShield size={17} /> Find Safe Routes
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
