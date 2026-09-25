import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './LiveSharePage.module.css';

const API_BASE = 'http://localhost:8000';

const liveLocationIcon = new Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <circle cx="12" cy="12" r="8" fill="#1976d2"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const startIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const destIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface LiveTripData {
  id: string;
  status: string;
  origin: [number, number];
  destination: [number, number];
  planned_route_geom?: { coordinates: [number, number][] };
  position?: [number, number];
}

export default function LiveSharePage() {
  const { token } = useParams();
  const [trip, setTrip] = useState<LiveTripData | null>(null);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchTrip = async () => {
      try {
        const res = await fetch(`${API_BASE}/share/${token}`);
        if (!res.ok) throw new Error('Trip not found or expired');
        const data = await res.json();
        setTrip(data);
        
        if (data.position) setPosition(data.position);
        
        if (data.status !== 'active') {
          setError('Trip ended');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();

    // WebSocket for live updates
    const ws = new WebSocket(`ws://10.0.2.2:8000/trips/${token}/stream`);
    
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.lat && data.lon) {
          setPosition([data.lat, data.lon]);
        }
        if (data.status) {
          setTrip(prev => prev ? { ...prev, status: data.status } : null);
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      if (trip?.status === 'active') {
        // Reconnect
        setTimeout(() => fetchTrip(), 3000);
      }
    };

    return () => { ws.close(); };
  }, [token]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div style={{ textAlign: 'center' }}>
          <div className={styles.spinner} />
          <p>Loading live location...</p>
        </div>
      </div>
    );
  }

  if (error || !trip || trip.status !== 'active') {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>📍</div>
          <h1 className={styles.errorTitle}>Trip Ended</h1>
          <p className={styles.errorText}>
            This trip is no longer active. The live location sharing has expired.
          </p>
        </div>
      </div>
    );
  }

  const routeCoords = trip.planned_route_geom?.coordinates || [];
  const center = position || trip.origin;

  return (
    <div className={styles.liveShareContainer}>
      <MapContainer 
        center={center} 
        zoom={14} 
        className={styles.mapContainer}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Planned Route */}
        {routeCoords.length > 1 && (
          <Polyline
            positions={routeCoords.map(([lon, lat]) => [lat, lon] as [number, number])}
            color="#1976d2"
            weight={3}
            opacity={0.8}
            dashArray="5, 10"
          />
        )}

        {/* Current Position */}
        {position && (
          <Marker position={position} icon={liveLocationIcon}>
            <div style={{ background: 'rgba(0,0,0,0.8)', color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', whiteSpace: 'nowrap' }}>
              Live Location
            </div>
          </Marker>
        )}

        {/* Origin/Destination Markers */}
        {trip.origin && (
          <Marker position={[trip.origin[1], trip.origin[0]]} icon={startIcon}>
            <div style={{ background: 'rgba(0,0,0,0.8)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '11px' }}>Start</div>
          </Marker>
        )}
        {trip.destination && (
          <Marker position={[trip.destination[1], trip.destination[0]]} icon={destIcon}>
            <div style={{ background: 'rgba(0,0,0,0.8)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '11px' }}>Destination</div>
          </Marker>
        )}
      </MapContainer>

      {/* Status Bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusCard}>
          <div className={styles.statusTitle}>Live Location Sharing</div>
          <div className={styles.statusSubtitle}>
            Trip: {trip.id.slice(0, 8)}... • Mode: Active
          </div>
        </div>
        <div className={styles.liveIndicator}>
          <span className={`${styles.pulseDot} ${trip.status === 'active' ? styles.pulseDotActive : styles.pulseDotInactive}`} />
          <span className={styles.statusText}>
            {trip.status}
          </span>
        </div>
      </div>
    </div>
  );
}