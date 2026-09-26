import { useEffect, useState } from 'react'
import { fetchUserProfile, fetchTripHistory } from '../services/api'
import { IconUser, IconCompass, IconWalk, IconCar, IconShield, IconCheck, IconSiren } from '../components/Icons'

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchUserProfile(), fetchTripHistory()])
      .then(([profData, histData]) => {
        setProfile(profData)
        setHistory(histData)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 20 }}>Loading profile...</div>
  if (!profile) return <div style={{ padding: 20 }}>Failed to load profile.</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header Card */}
      <div className="clay card" style={{ textAlign: 'center', padding: '30px 20px', marginBottom: 20 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 40, background: '#1E4E6E', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 'bold', marginBottom: 15
        }}>
          {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <h2 style={{ margin: '0 0 5px 0', color: '#1E4E6E' }}>{profile.name}</h2>
        <div className="muted">{profile.email}</div>
        
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e0eaf5', padding: '5px 12px', borderRadius: 20, marginTop: 15, fontSize: 13, color: '#1E4E6E', fontWeight: 'bold' }}>
          <IconShield size={16} /> Trust Score: {profile.trust_score.toFixed(1)}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 15, marginBottom: 25 }}>
        <div className="clay card" style={{ flex: 1, textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1E4E6E' }}>{profile.total_trips}</div>
          <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Total Trips</div>
        </div>
        <div className="clay card" style={{ flex: 1, textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#2B7A78' }}>
            {history.filter(h => h.status === 'completed').length}
          </div>
          <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Safe Arrivals</div>
        </div>
      </div>

      {/* History List */}
      <h3 style={{ margin: '0 0 15px 5px', color: '#1E4E6E' }}>Journey History</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {history.length === 0 ? (
          <div className="clay card muted" style={{ textAlign: 'center', padding: 30 }}>
            No trips recorded yet.
          </div>
        ) : (
          history.map(trip => (
            <div key={trip.id} className="clay card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 15 }}>
              <div style={{ 
                width: 46, height: 46, borderRadius: 23, 
                background: trip.status === 'active' ? '#e0f7fa' : trip.status === 'sos' ? '#ffebee' : '#f5f5f5',
                color: trip.status === 'sos' ? '#D32F2F' : '#1E4E6E',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {trip.mode === 'walk' ? <IconWalk /> : trip.mode === 'drive' ? <IconCar /> : <IconCompass />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: 15, color: '#333' }}>
                  {new Date(trip.started_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {new Date(trip.started_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div>
                {trip.status === 'completed' && <span style={{ color: '#4CAF50', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 'bold' }}><IconCheck size={14} /> Completed</span>}
                {trip.status === 'sos' && <span style={{ color: '#F44336', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 'bold' }}><IconSiren size={14} /> SOS</span>}
                {trip.status === 'active' && <span style={{ color: '#2196F3', fontSize: 12, fontWeight: 'bold' }}>Active</span>}
                {trip.status === 'cancelled' && <span className="muted" style={{ fontSize: 12, fontWeight: 'bold' }}>Cancelled</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
