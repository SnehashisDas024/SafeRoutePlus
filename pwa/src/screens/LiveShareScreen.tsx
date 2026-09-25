import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import * as L from 'leaflet'
import type { LiveTripData } from '../types'

// Create custom icons
const userIcon = L.divIcon({
  className: 'user-marker',
  html: `
    <div style="
      width: 32px; height: 32px; border-radius: 50%; 
      background: #1976d2; border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="width: 12px; height: 12px; border-radius: 50%; background: white;"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const startIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

const destinationIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function LiveShareScreen() {
  const { token } = useParams()
  const [trip, setTrip] = useState<LiveTripData | null>(null)
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  useEffect(() => {
    if (!token) return

    const fetchTrip = async () => {
      try {
        const res = await fetch(`/share/${token}`)
        if (!res.ok) throw new Error('Trip not found or expired')
        const data = await res.json()
        setTrip(data)
        
        if (data.position) setPosition(data.position)
        
        if (data.status !== 'active') {
          setError('Trip ended')
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load trip')
      } finally {
        setLoading(false)
      }
    }

    fetchTrip()

    // WebSocket for live updates
    const ws = new WebSocket(`ws://localhost:8000/trips/${token}/stream`)
    
    ws.onopen = () => setWsConnected(true)
    
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.lat && data.lon) {
          setPosition([data.lat, data.lon])
        }
        if (data.status) {
          setTrip(prev => prev ? { ...prev, status: data.status } : null)
        }
      } catch (err) {
        console.error('WS parse error:', err)
      }
    }

    ws.onclose = () => {
      setWsConnected(false)
      if (trip?.status === 'active') {
        setTimeout(() => fetchTrip(), 3000)
      }
    }

    return () => { ws.close() }
  }, [token])

  if (loading) {
    return (
      <div style={styles.loading}>
        <div className="spinner" style={styles.spinner} />
        <p>Loading live location...</p>
      </div>
    )
  }

  if (error || !trip || trip.status !== 'active') {
    return (
      <div style={styles.error}>
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>📍</div>
          <h1 style={styles.errorTitle}>Trip Ended</h1>
          <p style={styles.errorText}>
            This trip is no longer active. The live location sharing has expired.
          </p>
        </div>
      </div>
    )
  }

  const routeCoords = trip.planned_route_geom?.coordinates || []
  const center = position || trip.origin

  return (
    <div style={styles.container}>
      <MapContainer center={center} zoom={14} style={{ height: '100vh', width: '100%' }} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {routeCoords.length > 1 && (
          <Polyline
            positions={routeCoords.map(([lon, lat]) => [lat, lon] as [number, number])}
            color="#1976d2"
            weight={3}
            opacity={0.8}
            dashArray="5, 10"
          />
        )}

        {position && (
          <Marker position={position} icon={userIcon}>
            <div style={{ background: 'rgba(0,0,0,0.8)', color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', whiteSpace: 'nowrap' }}>
              Live Location
            </div>
          </Marker>
        )}

        {trip.origin && (
          <Marker position={[trip.origin[1], trip.origin[0]]} icon={startIcon}>
            <div style={{ background: 'rgba(0,0,0,0.8)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '11px' }}>Start</div>
          </Marker>
        )}
        {trip.destination && (
          <Marker position={[trip.destination[1], trip.destination[0]]} icon={destinationIcon}>
            <div style={{ background: 'rgba(0,0,0,0.8)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '11px' }}>Destination</div>
          </Marker>
        )}
      </MapContainer>

      <div style={styles.statusBar}>
        <div style={styles.statusCard}>
          <div style={styles.statusTitle}>Live Location Sharing</div>
          <div style={styles.statusSubtitle}>
            Trip: {trip.id.slice(0, 8)}... • Mode: Active
          </div>
        </div>
        <div style={styles.liveIndicator}>
          <span style={{ 
            width: '10px', height: '10px', borderRadius: '50%', 
            background: trip.status === 'active' ? '#2e7d32' : '#c62828',
            animation: trip.status === 'active' ? 'pulse 2s infinite' : 'none',
            display: 'inline-block',
            marginRight: '8px'
          }} />
          <span style={{ fontSize: '13px', fontWeight: '500', textTransform: 'capitalize' }}>
            {trip.status}
          </span>
          <span style={{ marginLeft: '12px', color: wsConnected ? '#2e7d32' : '#f57f17', fontSize: '12px' }}>
            {wsConnected ? '● Live' : '○ Reconnecting...'}
          </span>
        </div>
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: '100vh', width: '100vw', position: 'relative' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' },
  spinner: { border: '3px solid #1976d2', borderTopColor: 'transparent', borderRadius: '50%', width: '40px', height: '40px', margin: '0 auto 16px', animation: 'spin 1s linear infinite' },
  error: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', background: '#f5f5f5' },
  errorCard: { textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: '400px' },
  errorIcon: { fontSize: '48px', marginBottom: '16px' },
  errorTitle: { margin: '0 0 12px', color: '#1a1a1a' },
  errorText: { color: '#666', lineHeight: '1.6', margin: 0 },
  statusBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 16px',
  },
  statusCard: {
    background: 'rgba(255,255,255,0.95)',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    backdropFilter: 'blur(8px)',
  },
  statusTitle: { fontWeight: '600', color: '#1a1a1a' },
  statusSubtitle: { fontSize: '12px', color: '#666', marginTop: 2 },
  liveIndicator: {
    background: 'rgba(255,255,255,0.95)',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
}

export default LiveShareScreen