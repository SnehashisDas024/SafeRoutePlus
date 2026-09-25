import { useState, useEffect, useRef } from 'react'
import { getVoiceConfig, setVoiceConfig, testMicrophone, isVoiceSupported } from '../services/voice'
import type { VoiceConfig } from '../types'

function VoiceSetupScreen() {
  const [safeWord, setSafeWord] = useState('im fine')
  const [duressWord, setDuressWord] = useState('pineapple')
  const [enabled, setEnabled] = useState(true)
  const [testingSafe, setTestingSafe] = useState(false)
  const [testingDuress, setTestingDuress] = useState(false)
  const [testResult, setTestResult] = useState<{ type: 'safe' | 'duress'; match: boolean; transcript: string; confidence: number } | null>(null)
  const [hashes, setHashes] = useState<{ safeWordHash: string; duressWordHash: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [supported, setSupported] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const transcriptRef = useRef('')

  useEffect(() => {
    setSupported(isVoiceSupported())
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const config = await getVoiceConfig()
      if (config) {
        setEnabled(config.enabled)
      }
    } catch (e) {
      console.warn('Failed to load voice config:', e)
    }
  }

  const hashPhrase = async (phrase: string): Promise<string> => {
    const normalized = phrase.toLowerCase().replace(/[.,!?;:]/g, '').trim()
    const encoder = new TextEncoder()
    const data = encoder.encode(normalized)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const saveConfig = async () => {
    if (!safeWord.trim() || !duressWord.trim()) {
      alert('Both safe word and duress word are required')
      return
    }
    if (safeWord.trim().toLowerCase() === duressWord.trim().toLowerCase()) {
      alert('Safe word and duress word must be different')
      return
    }

    setSaving(true)
    try {
      const safeHash = await hashPhrase(safeWord)
      const duressHash = await hashPhrase(duressWord)
      
      const newConfig: VoiceConfig = {
        safeWordHash: safeHash,
        duressWordHash: duressHash,
        enabled,
      }
      
      await setVoiceConfig(newConfig)
      
      // Also save to localStorage for offline access
      localStorage.setItem('voiceConfig', JSON.stringify(newConfig))
      
      setHashes({ safeWordHash: safeHash, duressWordHash: duressHash })
      alert('Voice configuration saved successfully')
    } catch (e) {
      alert('Error: ' + (e instanceof Error ? e.message : 'Failed to save configuration'))
    } finally {
      setSaving(false)
    }
  }

  const testSafeWord = async () => {
    setTestingSafe(true)
    setTestResult(null)
    setLiveTranscript('🎙️ Listening... Speak your safe word now')
    try {
      const result = await testMicrophone(safeWord)
      setLiveTranscript(`Heard: "${result.transcript}"`)
      setTestResult({ type: 'safe', ...result })
    } catch (e) {
      setLiveTranscript('Error occurred')
      console.error('Test failed:', e)
    } finally {
      setTestingSafe(false)
    }
  }

  const testDuressWord = async () => {
    setTestingDuress(true)
    setTestResult(null)
    setLiveTranscript('🎙️ Listening... Speak your duress word now')
    try {
      const result = await testMicrophone(duressWord)
      setLiveTranscript(`Heard: "${result.transcript}"`)
      setTestResult({ type: 'duress', ...result })
    } catch (e) {
      setLiveTranscript('Error occurred')
      console.error('Test failed:', e)
    } finally {
      setTestingDuress(false)
    }
  }

  return (
    <div style={styles.container}>
      <h2>Voice Assistant Setup</h2>
      <p style={styles.subtitle}>
        Set your safe word (de-escalates) and duress word (silent SOS).<br/>
        Duress word should sound natural but never be used casually.
      </p>

      {!supported && (
        <div style={styles.warning}>
          ⚠️ Speech Recognition not supported in this browser. 
          Use Chrome/Edge on desktop or Chrome/Firefox on Android.
        </div>
      )}

      <div style={styles.section}>
        <h3>Safe Word</h3>
        <p style={styles.helpText}>Say this to cancel an alert. Example: "I'm fine", "All good"</p>
        <input style={styles.input} placeholder="e.g., I'm fine" value={safeWord} onChange={e => setSafeWord(e.target.value)} autoCapitalize="none" />
        <div style={styles.buttonRow}>
          <button style={testingSafe ? styles.testBtnDisabled : styles.testBtn} onClick={testSafeWord} disabled={testingSafe || testingDuress}>
            {testingSafe ? '🎙️ Listening...' : '🎙️ Speak to Test Safe Word'}
          </button>
        </div>
        {testingSafe && <p style={styles.liveTranscript}>{liveTranscript}</p>}
      </div>

      <div style={styles.section}>
        <h3>Duress Word</h3>
        <p style={styles.helpText}>Say this to trigger silent SOS. Should sound normal but never used casually.<br/>Example: "pineapple", "blueberry", "coffee time"</p>
        <input style={styles.input} placeholder="e.g., pineapple" value={duressWord} onChange={e => setDuressWord(e.target.value)} autoCapitalize="none" />
        <div style={styles.buttonRow}>
          <button style={testingDuress ? styles.testBtnDisabled : styles.testBtnDuress} onClick={testDuressWord} disabled={testingSafe || testingDuress}>
            {testingDuress ? '🎙️ Listening...' : '🎙️ Speak to Test Duress Word'}
          </button>
        </div>
        {testingDuress && <p style={styles.liveTranscript}>{liveTranscript}</p>}
      </div>

      <div style={styles.section}>
        <label style={styles.toggleRow}>
          <span>Voice Assistant Enabled</span>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
        </label>
        <p style={styles.helpText}>
          When enabled, the app listens for your words during active trips only.<br/>
          Never runs in background. Runs on-device only — audio never leaves your phone.
        </p>
      </div>

      {testResult && (
        <div style={testResult.match ? styles.resultSuccess : styles.resultError}>
          <h4>{testResult.type === 'safe' ? 'Safe Word' : 'Duress Word'} Test</h4>
          <p style={styles.resultText}>{testResult.match ? '✓ MATCH' : '✗ NO MATCH'}</p>
          <p style={styles.resultDetail}>Heard: "{testResult.transcript}"</p>
        </div>
      )}

      {hashes && (
        <div style={styles.hashInfo}>
          <p style={styles.hashLabel}>Stored Hashes (never plaintext):</p>
          <p style={styles.hashValue}>Safe: {hashes.safeWordHash.slice(0, 16)}...</p>
          <p style={styles.hashValue}>Duress: {hashes.duressWordHash.slice(0, 16)}...</p>
        </div>
      )}

      <button style={styles.saveBtn} onClick={saveConfig} disabled={saving}>
        {saving ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '20px', maxWidth: '600px', margin: '0 auto' },
  subtitle: { color: '#666', marginBottom: '20px', lineHeight: 1.6 },
  warning: { background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: '8px', padding: '12px', marginBottom: '20px', color: '#e65100' },
  section: { marginBottom: '24px' },
  helpText: { color: '#666', fontSize: '13px', marginBottom: '12px', lineHeight: 1.6 },
  input: { width: '100%', padding: '14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', marginBottom: '12px', background: '#fafafa' },
  buttonRow: { display: 'flex', gap: '12px' },
  testBtn: { padding: '12px 24px', borderRadius: '8px', background: '#1976d2', color: '#fff', fontWeight: '600', border: 'none', cursor: 'pointer', flex: 1 },
  testBtnDisabled: { padding: '12px 24px', borderRadius: '8px', background: '#1976d2', color: '#fff', fontWeight: '600', border: 'none', cursor: 'not-allowed', opacity: 0.6, flex: 1 },
  testBtnDuress: { padding: '12px 24px', borderRadius: '8px', background: '#c62828', color: '#fff', fontWeight: '600', border: 'none', cursor: 'pointer', flex: 1 },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  liveTranscript: { marginTop: '8px', padding: '12px', background: '#e3f2fd', borderRadius: '8px', color: '#1565c0', fontSize: '14px', minHeight: '20px' },
  resultSuccess: { background: '#e8f5e9', border: '1px solid #2e7d32', padding: '16px', borderRadius: '8px', marginTop: '16px' },
  resultError: { background: '#fdeaea', border: '1px solid #c62828', padding: '16px', borderRadius: '8px', marginTop: '16px' },
  resultText: { fontSize: '20px', fontWeight: 'bold', margin: '8px 0' },
  resultDetail: { fontSize: '14px', color: '#666' },
  hashInfo: { marginTop: '20px', padding: '12px', background: '#f5f5f5', borderRadius: '8px' },
  hashLabel: { fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: '#666' },
  hashValue: { fontSize: '12px', fontFamily: 'monospace', color: '#444', marginBottom: '2px' },
  saveBtn: { width: '100%', padding: '14px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '16px', cursor: 'pointer' },
}

export default VoiceSetupScreen