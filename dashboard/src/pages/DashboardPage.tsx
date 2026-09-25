import React, { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:8000';

interface Trip {
  id: string;
  user_id: string;
  mode: string;
  started_at: string;
  status: string;
}

interface Alert {
  id: string;
  trip_id: string;
  level: string;
  type: string;
  triggered_at: string;
  payload: { contacts_notified?: string[] };
}

export default function DashboardPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tripsRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE}/trips`, { headers: { Authorization: 'test_user_id' } }),
        fetch(`${API_BASE}/alerts`, { headers: { Authorization: 'test_user_id' } }),
      ]);
      
      if (tripsRes.ok) {
        const data = await tripsRes.json();
        setTrips(data.filter((t: Trip) => t.status === 'active'));
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.sort((a: Alert, b: Alert) => 
          new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
        ));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso: string) => new Date(iso).toLocaleString();
  const formatLevel = (level: string) => {
    const colors: Record<string, string> = {
      L0_Normal: '#2e7d32',
      L1_Watch: '#f57f17',
      L2_Checkin: '#f57f17',
      L3_Alert: '#c62828',
      L4_Sustained: '#b71c1c',
    };
    return colors[level] || '#333';
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
        <h1 style={{ margin: 0, color: '#1a1a1a' }}>SafeRoute+ Dashboard</h1>
        <span style={{ color: '#666', fontSize: '14px' }}>Auto-refresh: 5s</span>
      </header>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '16px' }}>Active Trips ({trips.length})</h2>
        {trips.length === 0 ? (
          <div style={{ padding: '24px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center', color: '#666' }}>
            No active trips
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {trips.map(trip => (
              <div key={trip.id} style={{ padding: '16px', background: 'white', border: '1px solid #eee', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontFamily: 'monospace' }}>{trip.id.slice(0, 8)}...</strong>
                  <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>{trip.status.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  Mode: {trip.mode}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  Started: {formatTime(trip.started_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ marginBottom: '16px' }}>Alert Log (All L0→L4 Transitions)</h2>
        {alerts.length === 0 ? (
          <div style={{ padding: '24px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center', color: '#666' }}>
            No alerts yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={cellStyle}>Time</th>
                  <th style={cellStyle}>Trip ID</th>
                  <th style={cellStyle}>Level</th>
                  <th style={cellStyle}>Reason</th>
                  <th style={cellStyle}>Contacts Notified</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <tr key={alert.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={cellStyle}>{formatTime(alert.triggered_at)}</td>
                    <td style={cellStyle}><code>{alert.trip_id.slice(0, 8)}...</code></td>
                    <td style={cellStyle}>
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
                    <td style={cellStyle}>{alert.type}</td>
                    <td style={cellStyle}>
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
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '12px 8px',
  verticalAlign: 'middle',
};