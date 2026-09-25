import { useState, useEffect } from 'react'
import { triggerSOS, getEscalation } from '../services/api'
import { useShake } from '../hooks/useShake'
import { useVoice } from '../hooks/useVoice'
import { useNotifications } from '../hooks/useNotifications'
import { useLocation } from '../hooks/useLocation'

function SOSScreen() {
  const [escalationLevel, setEscalationLevel] = useState<'L0' | 'L1' | 'L2' | 'L3' | 'L4'>('L0')
  const [countdown, setCountdown] = useState(0)
  const [sosActive, setSosActive] = useState(false)
  const [shakeTriggered, setShakeTriggered] = useState(false)

  const { speak } = useVoice()
  const { notify } = useNotifications()
  const { start: startLocation } = useLocation()
  const { active: shakeActive, start: startShake, stop: stopShake } = useShake(() => handleShakeSOS(), true)

  // Demo trip ID
  const tripId = 'demo-trip-id'

  useEffect(() => {
    startLocation()
    startShake()
    return () => stopShake()
  }, [])

  const handleShakeSOS = async () => {
    setShakeTriggered(true)
    await triggerSOS(tripId)
    setSosActive(true)
    setEscalationLevel('L3')
    notify({ title: 'SOS Activated', body: 'Emergency alert sent to contacts', requireInteraction: true })
  }

  const handleManualSOS = async () => {
    await triggerSOS(tripId)
    setSosActive(true)
    setEscalationLevel('L3')
    notify({ title: 'SOS Activated', body: 'Emergency alert sent to contacts', requireInteraction: true })
  }

  const handleCancel = async () => {
    setSosActive(false)
    setEscalationLevel('L0')
    setShakeTriggered(false)
  }

  const ESCALATION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    L0: { bg: '#e8f5e9', text: '#2e7d32', label: 'NORMAL' },
    L1: { bg: '#fff8e1', text: '#f57f17', label: 'WATCH' },
    L2: { bg: '#fff3e0', text: '#f57f17', label: 'CHECK-IN' },
    L3: { bg: '#fdeaea', text: '#c62828', label: 'ALERT' },
    L4: { bg: '#fce4ec', text: '#b71c1c', label: 'SUSTAINED' },
  }

  const currentStyle = ESCALATION_STYLES[escalationLevel]

  return (
    <div style={styles.container}>
      <div style={styles.statusCard}>
        <div style={{ ...styles.statusBadge, background: currentStyle.bg, color: currentStyle.text }}>
          {currentStyle.label}
        </div>
        <h1 style={styles.title}>SafeRoute+ SOS</h1>
        <p style={styles.subtitle}>
          {sosActive ? 'Emergency alert has been sent to your trusted contacts' : 'Hold the SOS button or shake your phone to activate emergency alert'}
        </p>
      </div>

      <div style={styles.sosButtonContainer}>
        <button 
          style={styles.sosButton}
          onClick={handleManualSOS}
          disabled={sosActive}
        >
          {sosActive ? 'SOS SENT' : 'ACTIVATE SOS'}
        </button>
        
        {shakeTriggered && (
          <div style={styles.shakeIndicator}>
            📳 Shake detected - SOS activated
          </div>
        )}
      </div>

      <div style={styles.infoCard}>
        <h3>What happens when you activate SOS:</h3>
        <ul>
          <li>Immediate L3 Alert sent to all trusted contacts</li>
          <li>Live location sharing link sent via SMS</li>
          <li>Contacts can track your location in real-time</li>
          <li>If no response in 5 minutes → L4 (police notified)</li>
        </ul>
      </div>

      <div style={styles.infoCard}>
        <h3>Alternative activation methods:</h3>
        <ul>
          <li>📳 <strong>Shake phone</strong> vigorously 3 times</li>
          <li>🎤 <strong>Voice duress word</strong> (configure in Voice Setup)</li>
          <li>🔘 <strong>Volume buttons</strong> (Android: 3x volume down)</li>
        </ul>
      </div>

      {!sosActive && (
        <button style={styles.testBtn} onClick={handleManualSOS}>
          TEST SOS (Demo)
        </button>
      )}

      {sosActive && (
        <button style={styles.cancelBtn} onClick={handleCancel}>
          CANCEL SOS (Demo)
        </button>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '20px', maxWidth: '600px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' as const, gap: '20px' },
  statusCard: { 
    padding: '24px', 
    borderRadius: '16px', 
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  statusBadge: { 
    display: 'inline-block', 
    padding: '8px 24px', 
    borderRadius: '9999px', 
    fontWeight: 'bold', 
    fontSize: '14px',
    marginBottom: '12px',
  },
  title: { margin: '12px 0 8px', fontSize: '24px', fontWeight: 'bold' },
  subtitle: { color: '#666', margin: 0, lineHeight: 1.5 },
  sosButtonContainer: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '16px' },
  sosButton: { 
    width: '200px', 
    height: '200px', 
    borderRadius: '50%', 
    background: '#c62828', 
    color: '#fff', 
    border: 'none', 
    fontSize: '20px', 
    fontWeight: 'bold',
    boxShadow: '0 8px 30px rgba(198, 40, 40, 0.4)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  shakeIndicator: { 
    background: '#fff3e0', 
    color: '#e65100', 
    padding: '12px 24px', 
    borderRadius: '8px', 
    fontWeight: '600',
    animation: 'pulse 1s infinite',
  },
  infoCard: { 
    background: '#fff', 
    border: '1px solid #eee', 
    borderRadius: '12px', 
    padding: '20px',
  },
  testBtn: { 
    width: '100%', 
    padding: '16px', 
    background: '#1976d2', 
    color: '#fff', 
    border: 'none', 
    borderRadius: '8px', 
    fontSize: '18px', 
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  cancelBtn: { 
    width: '100%', 
    padding: '16px', 
    background: '#f5f5f5', 
    color: '#666', 
    border: '1px solid #ddd', 
    borderRadius: '8px', 
    fontSize: '18px', 
    fontWeight: 'bold',
    cursor: 'pointer',
  },
}

export default SOSScreen