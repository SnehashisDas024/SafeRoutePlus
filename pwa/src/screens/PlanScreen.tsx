import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import { useLocation } from '../hooks/useLocation'
import { planRoute, getRecentRoutes, getFrequentRoutes } from '../services/api'
import { formatCoords } from '../services/location'
import { MAP_DEFAULTS } from '../services/config'
import type { LeafletMouseEvent, Map as LeafletMap } from 'leaflet'
import type { RouteHistoryItem } from '../types'


// Kolkata demo presets
const KOLKATA_PRESETS = [
  {
    name: 'Park Street → Victoria Memorial',
    mode: 'walk' as const,
    origin: [88.3524, 22.5513] as [number, number],
    destination: [88.3426, 22.5448] as [number, number],
  },
  {
    name: 'Howrah Station → B.B.D. Bagh',
    mode: 'walk' as const,
    origin: [88.3426, 22.5851] as [number, number],
    destination: [88.3512, 22.5726] as [number, number],
  },
  {
    name: 'Salt Lake Sector V → Esplanade',
    mode: 'drive' as const,
    origin: [88.4332, 22.5744] as [number, number],
    destination: [88.3528, 22.5647] as [number, number],
  },
]

function PlanScreen() {
  const navigate = useNavigate()
  const [origin, setOrigin] = useState<[number, number] | null>(null)
  const [destination, setDestination] = useState<[number, number] | null>(null)
  const [originName, setOriginName] = useState<string>('')
  const [destName, setDestName] = useState<string>('')
  const [mode, setMode] = useState<'walk' | 'drive'>('walk')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recentRoutes, setRecentRoutes] = useState<RouteHistoryItem[]>([])
  const [frequentRoutes, setFrequentRoutes] = useState<RouteHistoryItem[]>([])
  const [historyTab, setHistoryTab] = useState<'recent' | 'frequent'>('recent')
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  
  const { start, location: currentLoc } = useLocation()
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchHistory = async () => {
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
        // silent fallback
      }
    }
    fetchHistory()
    return () => {
      mounted = false
    }
  }, [])

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return
    const containerPoint = mapRef.current.containerPointToLayerPoint([e.nativeEvent.offsetX, e.nativeEvent.offsetY])
    const latlng = mapRef.current.layerPointToLatLng(containerPoint)
    const { lat, lng } = latlng
    setSelectedHistoryId(null)
    if (!origin) {
      setOrigin([lng, lat])
      setOriginName(formatCoords(lat, lng))
    } else if (!destination) {
      setDestination([lng, lat])
      setDestName(formatCoords(lat, lng))
    }
  }

  const handlePlan = async () => {
    if (!origin || !destination) {
      setError('Please select both origin and destination on the map')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const routes = await planRoute({
        origin,
        destination,
        origin_name: originName || undefined,
        destination_name: destName || undefined,
        mode,
        depart_at: new Date().toISOString(),
      })
      
      navigate('/compare', { 
        state: { routes, origin, destination, mode } 
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to plan route')
    } finally {
      setLoading(false)
    }
  }

  const useCurrentLocation = () => {
    setSelectedHistoryId(null)
    if (currentLoc) {
      if (!origin) {
        setOrigin([currentLoc.lon, currentLoc.lat])
        setOriginName('Current Location')
      } else if (!destination) {
        setDestination([currentLoc.lon, currentLoc.lat])
        setDestName('Current Location')
      }
    } else {
      start()
    }
  }

  const applyPreset = (preset: typeof KOLKATA_PRESETS[0]) => {
    setOrigin(preset.origin)
    setDestination(preset.destination)
    setOriginName(preset.name.split(' → ')[0])
    setDestName(preset.name.split(' → ')[1])
    setMode(preset.mode)
    setSelectedHistoryId(null)
  }

  const applyHistoryItem = (item: RouteHistoryItem) => {
    setOrigin(item.origin.coordinates)
    setDestination(item.destination.coordinates)
    setOriginName(item.origin.name || formatCoords(item.origin.coordinates[1], item.origin.coordinates[0]))
    setDestName(item.destination.name || formatCoords(item.destination.coordinates[1], item.destination.coordinates[0]))
    setMode(item.mode)
    setSelectedHistoryId(item.id)
  }

  const clearSelection = () => {
    setOrigin(null)
    setDestination(null)
    setOriginName('')
    setDestName('')
    setSelectedHistoryId(null)
  }


  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' as const }}>
      <div style={styles.header}>
        <h1>Plan Your Route</h1>
      </div>
      
      <div style={styles.mapContainer} onClick={handleMapClick}>
        <MapContainer 
          ref={mapRef}
          center={currentLoc ? [currentLoc.lat, currentLoc.lon] : MAP_DEFAULTS.center} 
          zoom={MAP_DEFAULTS.zoom}
          style={styles.map}
        >
          <TileLayer
            attribution={MAP_DEFAULTS.attribution}
            url={MAP_DEFAULTS.tileUrl}
          />
          
          {origin && (
            <Marker position={[origin[1], origin[0]]}>
              <div style={styles.markerLabel}>Origin</div>
            </Marker>
          )}
          
          {destination && (
            <Marker position={[destination[1], destination[0]]}>
              <div style={styles.markerLabel}>Destination</div>
            </Marker>
          )}
        </MapContainer>
        
        <div style={styles.overlay}>
          <div style={styles.info}>
            <div style={styles.coordRow}>
              <span style={styles.label}>Origin:</span>
              <span>{origin ? formatCoords(origin[1], origin[0]) : 'Tap to set'}</span>
            </div>
            <div style={styles.coordRow}>
              <span style={styles.label}>Destination:</span>
              <span>{destination ? formatCoords(destination[1], destination[0]) : 'Tap to set'}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div style={styles.controls}>
        {(recentRoutes.length > 0 || frequentRoutes.length > 0) && (
          <div style={styles.presetsSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Saved Routes</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    background: historyTab === 'recent' ? '#1976d2' : '#f5f5f5',
                    color: historyTab === 'recent' ? '#fff' : '#333',
                    cursor: 'pointer',
                  }}
                  onClick={() => setHistoryTab('recent')}
                >
                  Recent ({recentRoutes.length})
                </button>
                <button
                  type="button"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    background: historyTab === 'frequent' ? '#1976d2' : '#f5f5f5',
                    color: historyTab === 'frequent' ? '#fff' : '#333',
                    cursor: 'pointer',
                  }}
                  onClick={() => setHistoryTab('frequent')}
                >
                  Frequent ({frequentRoutes.length})
                </button>
              </div>
            </div>
            <div style={styles.presetsGrid}>
              {(historyTab === 'recent' ? recentRoutes : frequentRoutes).map((item) => {
                const isSelected = selectedHistoryId === item.id
                const oName = item.origin.name || formatCoords(item.origin.coordinates[1], item.origin.coordinates[0])
                const dName = item.destination.name || formatCoords(item.destination.coordinates[1], item.destination.coordinates[0])
                return (
                  <button
                    key={item.id}
                    onClick={() => applyHistoryItem(item)}
                    style={{
                      ...styles.presetBtn,
                      border: isSelected ? '2px solid #1976d2' : styles.presetBtn.border,
                      background: isSelected ? '#e3f2fd' : styles.presetBtn.background,
                    }}
                    disabled={loading}
                  >
                    <span style={styles.presetIcon}>{item.mode === 'walk' ? '🚶' : '🚗'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {oName} → {dName}
                    </span>
                    {historyTab === 'frequent' && (
                      <span style={{ fontSize: '11px', color: '#666', background: '#eee', padding: '1px 5px', borderRadius: 4 }}>
                        {item.use_count}x
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={styles.presetsSection}>
          <h3>Quick Demos (Kolkata)</h3>
          <div style={styles.presetsGrid}>

            {KOLKATA_PRESETS.map((preset, i) => (
              <button
                key={i}
                onClick={() => applyPreset(preset)}
                style={styles.presetBtn}
                disabled={loading}
              >
                <span style={styles.presetIcon}>{preset.mode === 'walk' ? '🚶' : '🚗'}</span>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div style={styles.modeRow}>
          <button
            style={{ ...styles.modeBtn, ...(mode === 'walk' ? styles.modeBtnActive : {}) }}
            onClick={() => setMode('walk')}
            disabled={loading}
          >
            🚶 Walk
          </button>
          <button
            style={{ ...styles.modeBtn, ...(mode === 'drive' ? styles.modeBtnActive : {}) }}
            onClick={() => setMode('drive')}
            disabled={loading}
          >
            🚗 Drive
          </button>
        </div>
        
        <div style={styles.actionRow}>
          <button 
            style={styles.currentLocBtn}
            onClick={useCurrentLocation}
            disabled={loading}
          >
            📍 Use Current Location
          </button>
          <button 
            style={styles.clearBtn}
            onClick={clearSelection}
            disabled={loading || (!origin && !destination)}
          >
            🗑️ Clear
          </button>
        </div>
        
        {error && <div style={styles.error}>{error}</div>}
        
        <button 
          style={styles.submitBtn}
          onClick={handlePlan}
          disabled={loading || !origin || !destination}
        >
          {loading ? 'Planning...' : 'Find Routes'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    padding: '16px',
    background: '#fff',
    borderBottom: '1px solid #eee',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  info: {
    background: 'rgba(255,255,255,0.95)',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  coordRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '13px',
  },
  label: {
    fontWeight: '600',
    color: '#333',
  },
  markerLabel: {
    background: '#1976d2',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  controls: {
    padding: '16px',
    background: '#fff',
    borderTop: '1px solid #eee',
  },
  presetsSection: {
    marginBottom: '16px',
  },
  presetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '8px',
    marginTop: '8px',
  },
  presetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: '#fafafa',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '13px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  presetIcon: {
    fontSize: '16px',
  },
  modeRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  modeBtn: {
    flex: 1,
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    background: '#fafafa',
    fontSize: '16px',
    fontWeight: '500',
  },
  modeBtnActive: {
    borderColor: '#1976d2',
    background: '#e3f2fd',
    color: '#1976d2',
  },
  actionRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  currentLocBtn: {
    flex: 1,
    padding: '12px',
    background: '#e3f2fd',
    color: '#1976d2',
    border: '1px solid #1976d2',
    borderRadius: '8px',
    fontWeight: '600',
  },
  clearBtn: {
    padding: '12px',
    background: '#f5f5f5',
    color: '#666',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontWeight: '500',
  },
  error: {
    color: '#c62828',
    marginBottom: '12px',
    textAlign: 'center',
    fontSize: '14px',
    padding: '8px',
    background: '#fdeaea',
    borderRadius: '8px',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
  },
  submitBtnDisabled: {
    background: '#90caf9',
  },
}

export default PlanScreen