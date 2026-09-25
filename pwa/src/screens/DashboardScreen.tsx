import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import { getTrips, getAlerts } from '../services/api'
import { ESCALATION_COLORS, ESCALATION_LABELS } from '../services/config'
import type { Trip, Alert } from '../types'

function DashboardScreen() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [tripsRes, alertsRes] = await Promise.all([
        getTrips(),
        getAlerts(),
      ])
      
      if (tripsRes) {
        setTrips(tripsRes.filter((t: Trip) => t.status === 'active'))
      }
      if (alertsRes) {
        setAlerts(alertsRes.sort((a: Alert, b: Alert) => 
          new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
        ))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (iso: string) => new Date(iso).toLocaleString()
  const formatLevel = (level: string) => {
    const colors: Record<string, string> = {
      L0_Normal: '#2e7d32',
      L1_Watch: '#f57f17',
      L2_Checkin: '#f57f17',
      L3_Alert: '#c62828',
      L4_Sustained: '#b71c1c',
    }
    return colors[level] || '#333'
  }

  if (loading) return <div style={styles.loading}>Loading...</div>
  if (error) return <div style={styles.error}>Error: {error}</div>

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>SafeRoute+ Dashboard</h1>
        <span style={{ color: '#666', fontSize: '14px' }}>Auto-refresh: 5s</span>
      </header>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2>Active Trips ({trips.length})</h2>
          {selectedTrip && (
            <button onClick={() => setSelectedTrip(null)} style={styles.clearBtn}>Clear Selection</button>
          )}
        </div>
        
        {trips.length === 0 ? (
          <div style={styles.empty}>No active trips</div>
        ) : (
          <div style={styles.tripsGrid}>
            {trips.map(trip => (
              <div 
                key={trip.id} 
                style={{ 
                  ...styles.tripCard, 
                  ...(selectedTrip?.id === trip.id ? styles.tripCardSelected : {})
                }}
                onClick={() => setSelectedTrip(selectedTrip?.id === trip.id ? null : trip)}
              >
                <div style={styles.tripHeader}>
                  <strong style={styles.tripId}>{trip.id.slice(0, 8)}...</strong>
                  <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>{trip.status.toUpperCase()}</span>
                </div>
                <div style={styles.tripMeta}>Mode: {trip.mode}</div>
                <div style={styles.tripMeta}>Started: {formatTime(trip.started_at)}</div>
                {trip.origin && <div style={styles.tripMeta}>Origin: {trip.origin[1].toFixed(4)}, {trip.origin[0].toFixed(4)}</div>}
                {trip.destination && <div style={styles.tripMeta}>Dest: {trip.destination[1].toFixed(4)}, {trip.destination[0].toFixed(4)}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h2>Alert Log (All L0→L4 Transitions)</h2>
        {alerts.length === 0 ? (
          <div style={styles.empty}>No alerts yet</div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.cell}>Time</th>
                  <th style={styles.cell}>Trip ID</th>
                  <th style={styles.cell}>Level</th>
                  <th style={styles.cell}>Reason</th>
                  <th style={styles.cell}>Contacts Notified</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <tr key={alert.id} style={styles.tableRow}>
                    <td style={styles.cell}>{formatTime(alert.triggered_at)}</td>
                    <td style={styles.cell}><code>{alert.trip_id.slice(0, 8)}...</code></td>
                    <td style={styles.cell}>
                      <span style={{ 
                        color: formatLevel(alert.level), 
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: formatLevel(alert.level) + '15'
                      }}>
                        {alert.level}
                      </span>
                    </td>
                    <td style={styles.cell}>{alert.type}</td>
                    <td style={styles.cell}>
                      {alert.payload?.contacts_notified?.length ? (
                        <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                          {alert.payload.contacts_notified.join(', ')}
                        </span>
                      ) : (
                        <span style={{ color: '#888' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedTrip && (
        <section style={styles.mapSection}>
          <h2>Trip Map: {selectedTrip.id.slice(0, 8)}...</h2>
          <div style={styles.mapContainer}>
            <MapContainer center={selectedTrip.position || selectedTrip.origin || [22.57, 88.36]} zoom={14} style={{ height: '400px', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
              {selectedTrip.planned_route_geom?.coordinates && (
                <Polyline
                  positions={selectedTrip.planned_route_geom.coordinates.map(([lon, lat]) => [lat, lon])}
                  color="#1976d2"
                  weight={3}
                  opacity={0.8}
                  dashArray="5, 10"
                />
              )}
              {selectedTrip.position && (
                <Marker position={selectedTrip.position}>
                  <div>Live Position</div>
                </Marker>
              )}
              {selectedTrip.origin && (
                <Marker position={[selectedTrip.origin[1], selectedTrip.origin[0]]}>Start</Marker>
              )}
              {selectedTrip.destination && (
                <Marker position={[selectedTrip.destination[1], selectedTrip.destination[0]]}>Destination</Marker>
              )}
            </MapContainer>
          </div>
        </section>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '20px', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #eee' },
  section: { marginBottom: '32px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  clearBtn: { padding: '4px 12px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' },
  empty: { padding: '24px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center', color: '#666' },
  tripsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  tripCard: { padding: '16px', background: '#fff', border: '1px solid #eee', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' },
  tripCardSelected: { borderColor: '#1976d2', boxShadow: '0 0 0 2px #1976d2' },
  tripHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  tripId: { fontFamily: 'monospace' },
  tripMeta: { fontSize: '13px', color: '#666', marginBottom: '4px' },
  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  tableHeader: { background: '#f5f5f5', borderBottom: '2px solid #ddd' },
  tableRow: { borderBottom: '1px solid #eee' },
  cell: { padding: '12px 8px', verticalAlign: 'middle' },
  mapSection: { marginTop: '24px' },
  mapContainer: { height: '400px', borderRadius: '8px', overflow: 'hidden' },
  loading: { padding: '20px', textAlign: 'center' },
  error: { padding: '20px', color: 'red', textAlign: 'center' },
}

export default DashboardScreen