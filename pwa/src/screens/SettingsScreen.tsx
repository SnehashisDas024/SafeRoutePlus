import { useState, useEffect } from 'react'
import { useVoice } from '../hooks/useVoice'
import { useShake } from '../hooks/useShake'
import { useLocation } from '../hooks/useLocation'
import { useNotifications } from '../hooks/useNotifications'

function SettingsScreen() {
  const { config, supported: voiceSupported, setVoiceEnabled: setVoiceEnabledAPI } = useVoice()
  const { supported: shakeSupported, active: shakeActive, start: startShake, stop: stopShake } = useShake(() => {}, true)
  const { permission: locationPermission, start: requestLocationPermission } = useLocation()
  const { permission: notificationPermission, requestPermission } = useNotifications()

  const [shakeSensitivity, setShakeSensitivity] = useState<'low' | 'medium' | 'high'>('medium')
  const [voiceEnabled, setVoiceEnabled] = useState(config?.enabled ?? true)
  const [shakeEnabled, setShakeEnabled] = useState(shakeActive)

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedVoice = localStorage.getItem('voiceEnabled')
    if (savedVoice !== null) {
      setVoiceEnabled(savedVoice === 'true')
    }
    const savedShake = localStorage.getItem('shakeEnabled')
    if (savedShake !== null) {
      setShakeEnabled(savedShake === 'true')
    }
    const savedSensitivity = localStorage.getItem('shakeSensitivity')
    if (savedSensitivity) {
      setShakeSensitivity(savedSensitivity as 'low' | 'medium' | 'high')
    }
  }, [])

  // Persist voice enabled state
  useEffect(() => {
    localStorage.setItem('voiceEnabled', String(voiceEnabled))
    setVoiceEnabledAPI(voiceEnabled)
  }, [voiceEnabled, setVoiceEnabledAPI])

  // Persist shake enabled state
  useEffect(() => {
    localStorage.setItem('shakeEnabled', String(shakeEnabled))
    if (shakeEnabled) {
      startShake()
    } else {
      stopShake()
    }
  }, [shakeEnabled, startShake, stopShake])

  // Persist shake sensitivity
  useEffect(() => {
    localStorage.setItem('shakeSensitivity', shakeSensitivity)
  }, [shakeSensitivity])

  const handleRequestLocation = async () => {
    const granted = await requestLocationPermission()
    // The permission state will update via the hook
    return granted
  }

  const handleRequestMicrophone = async () => {
    if (!('mediaDevices' in navigator) || !('getUserMedia' in navigator.mediaDevices)) {
      alert('Microphone not supported')
      return
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      console.error('Microphone permission denied:', e)
    }
  }

  const handleRequestNotifications = async () => {
    const granted = await requestPermission()
    return granted
  }

  return (
    <div style={styles.container}>
      <h2>Settings</h2>

      <div style={styles.section}>
        <h3>Voice Assistant</h3>
        {!voiceSupported && <p style={styles.warning}>Speech Recognition not supported in this browser</p>}
        <label style={styles.toggleRow}>
          <span>Enabled</span>
          <input 
            type="checkbox" 
            checked={voiceEnabled} 
            onChange={e => setVoiceEnabled(e.target.checked)} 
            disabled={!voiceSupported} 
          />
        </label>
        <button 
          style={styles.permBtn} 
          onClick={handleRequestMicrophone}
          disabled={!voiceSupported}
        >
          🎤 Request Microphone Permission
        </button>
        <p style={styles.helpText}>Listen for safe/duress words during active trips</p>
      </div>

      <div style={styles.section}>
        <h3>Shake SOS</h3>
        {!shakeSupported && <p style={styles.warning}>Motion sensors not supported in this browser</p>}
        <label style={styles.toggleRow}>
          <span>Enabled</span>
          <input 
            type="checkbox" 
            checked={shakeEnabled} 
            onChange={e => setShakeEnabled(e.target.checked)} 
            disabled={!shakeSupported} 
          />
        </label>
        <div style={styles.sensitivityRow}>
          <span>Sensitivity</span>
          <select 
            value={shakeSensitivity} 
            onChange={e => setShakeSensitivity(e.target.value as 'low' | 'medium' | 'high')} 
            disabled={!shakeSupported}
          >
            <option value="low">Low (harder to trigger)</option>
            <option value="medium">Medium (recommended)</option>
            <option value="high">High (easier to trigger)</option>
          </select>
        </div>
        {locationPermission !== 'granted' && <p style={styles.permissionHint}>⚠️ Location permission required for shake SOS to work with trip tracking</p>}
        <button 
          style={styles.permBtn} 
          onClick={handleRequestLocation}
          disabled={locationPermission === 'granted'}
        >
          📍 Request Location Permission
        </button>
      </div>

      <div style={styles.section}>
        <h3>Permissions</h3>
        <div style={styles.permissionRow}>
          <span>Location</span>
          <span style={{ color: locationPermission === 'granted' ? '#2e7d32' : '#c62828' }}>
            {locationPermission === 'granted' ? '✓ Granted' : locationPermission === 'prompt' ? 'Request' : 'Denied'}
          </span>
        </div>
        <div style={styles.permissionRow}>
          <span>Microphone (Voice)</span>
          <span style={{ color: voiceSupported ? '#2e7d32' : '#c62828' }}>
            {voiceSupported ? '✓ Available' : 'Not Supported'}
          </span>
        </div>
        <div style={styles.permissionRow}>
          <span>Motion Sensors (Shake)</span>
          <span style={{ color: shakeSupported ? '#2e7d32' : '#c62828' }}>
            {shakeSupported ? '✓ Available' : 'Not Supported'}
          </span>
        </div>
        <div style={styles.permissionRow}>
          <span>Notifications</span>
          <span style={{ color: notificationPermission === 'granted' ? '#2e7d32' : '#f57f17' }}>
            {notificationPermission === 'granted' ? '✓ Granted' : notificationPermission === 'default' ? 'Request' : 'Denied'}
          </span>
        </div>
        <button 
          style={styles.permBtn} 
          onClick={handleRequestNotifications}
          disabled={notificationPermission === 'granted'}
        >
          🔔 Request Notification Permission
        </button>
      </div>

      <div style={styles.section}>
        <h3>Data & Privacy</h3>
        <button style={styles.dangerBtn} onClick={() => {
          if (confirm('Clear all local data? This cannot be undone.')) {
            localStorage.clear()
            alert('Local data cleared')
          }
        }}>
          Clear Local Data
        </button>
        <button style={styles.dangerBtn} onClick={() => {
          if (confirm('Delete account? This will remove all your data from the server.')) {
            // In a real app, this would call a delete account API
            alert('Account deletion would be triggered here')
          }
        }}>
          Delete Account
        </button>
      </div>

      <div style={styles.section}>
        <h3>About</h3>
        <p style={styles.helpText}>SafeRoute+ v1.0.0</p>
        <p style={styles.helpText}>Women's safety navigation & live monitoring</p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '20px', maxWidth: '600px', margin: '0 auto' },
  section: { marginBottom: '24px' },
  warning: { background: '#fff3e0', color: '#e65100', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' },
  helpText: { color: '#666', fontSize: '13px', marginTop: '4px' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  sensitivityRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' },
  permissionRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' },
  permissionHint: { color: '#f57f17', fontSize: '13px', marginTop: '8px' },
  dangerBtn: { width: '100%', padding: '12px', background: '#fdeaea', color: '#c62828', border: '1px solid #f5c6cb', borderRadius: '8px', marginTop: '8px' },
  permBtn: { 
    width: '100%', 
    padding: '10px', 
    marginTop: '8px', 
    background: '#e3f2fd', 
    color: '#1976d2', 
    border: '1px solid #1976d2', 
    borderRadius: '8px', 
    fontWeight: '500',
    cursor: 'pointer',
  },
}

export default SettingsScreen