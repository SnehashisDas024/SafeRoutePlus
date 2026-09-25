import { useEffect, useState, type ReactNode } from 'react'
import { getVoiceConfig, setVoiceConfig } from '../services/api'
import { hashPhrase, testMicrophone, isVoiceSupported, speak } from '../services/voice'
import { EmptyState } from '../components/ui'
import { IconMic, IconVolume, IconVolumeOff, IconLock, IconSave, IconCheck, IconAlert, IconSiren, IconShield } from '../components/Icons'

const INK = '#1E4E6E'

export default function VoiceSetupScreen() {
  const [safeWord, setSafeWord] = useState('')
  const [duressWord, setDuressWord] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<ReactNode>('')
  const [testing, setTesting] = useState<'safe' | 'duress' | null>(null)

  useEffect(() => {
    getVoiceConfig().then(cfg => {
      setEnabled(cfg.enabled)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  if (loaded && !isVoiceSupported()) {
    return <EmptyState icon={<IconMic size={30} color="var(--ink-faint)" />} text="Speech recognition is not supported in this browser. Try Chrome or Edge (HTTPS required)." />
  }
  if (!loaded) return null

  const save = async () => {
    setSaving(true); setMessage('')
    try {
      await setVoiceConfig({
        safe_word_hash: safeWord ? await hashPhrase(safeWord) : '',
        duress_word_hash: duressWord ? await hashPhrase(duressWord) : '',
        enabled,
      })
      setMessage(<span className="row" style={{ gap: 8, justifyContent: 'center' }}><IconCheck size={16} color="#2F7FBC" /> Saved — only SHA-256 hashes are stored, never your actual words.</span>)
    } catch (e) {
      setMessage('Failed: ' + (e instanceof Error ? e.message : 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  const runMicTest = async (which: 'safe' | 'duress') => {
    setTesting(which); setMessage('')
    const target = which === 'safe' ? safeWord : duressWord
    if (!target) { setMessage('Enter the word first, then test.'); setTesting(null); return }
    const res = await testMicrophone(target)
    setTesting(null)
    setMessage(res.match
      ? <span className="row" style={{ gap: 8 }}><IconCheck size={16} color="#2F7FBC" /> Mic test matched "{res.transcript || target}"</span>
      : <span className="row" style={{ gap: 8 }}><IconAlert size={16} color="#A83830" /> Heard "{res.transcript || 'nothing'}" — didn't match. Try speaking clearly.</span>)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="clay card">
        <h3 className="h-ico"><span className="h-ico-tile"><IconCheck size={17} color={INK} /></span>Safe word — de-escalates to L0</h3>
        <p className="muted" style={{ fontSize: 13.5 }}>Say this during a check-in to confirm you're okay.</p>
        <input className="clay-input mt-1" value={safeWord} onChange={e => setSafeWord(e.target.value)} placeholder="e.g. sunshine" />
        <div className="row mt-1">
          <button className="clay-btn ghost" onClick={() => runMicTest('safe')} disabled={testing !== null}>
            {testing === 'safe' ? <><IconVolume size={16} /> Listening...</> : <><IconMic size={16} /> Test microphone</>}
          </button>
          <button className="clay-btn ghost" onClick={() => speak('Say your safe word to confirm you are okay')}>
            <IconVolume size={16} /> Preview TTS
          </button>
        </div>
      </div>

      <div className="clay card mt-2">
        <h3 className="h-ico"><span className="h-ico-tile rose"><IconSiren size={17} color="#A83830" /></span>Duress word — silent L3 alert</h3>
        <p className="muted" style={{ fontSize: 13.5 }}>
          Saying this escalates immediately and <strong>the screen will not change</strong> — discreet protection.
        </p>
        <input className="clay-input mt-1" value={duressWord} onChange={e => setDuressWord(e.target.value)} placeholder="e.g. pineapple" />
        <button className="clay-btn ghost mt-1" onClick={() => runMicTest('duress')} disabled={testing !== null}>
          {testing === 'duress' ? <><IconVolume size={16} /> Listening...</> : <><IconMic size={16} /> Test microphone</>}
        </button>
      </div>

      <div className="clay card mt-2 row-between">
        <div>
          <h3 style={{ marginBottom: 2 }}>Voice assistant</h3>
          <p className="muted" style={{ fontSize: 13.5 }}>Listen continuously during active trips (on-device only).</p>
        </div>
        <button className={`chip${enabled ? ' active' : ''}`} onClick={() => setEnabled(!enabled)}>
          {enabled ? <><IconVolume size={16} /> Enabled</> : <><IconVolumeOff size={16} /> Disabled</>}
        </button>
      </div>

      <div className="clay-inset row mt-2" style={{ padding: 14, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', gap: 10, alignItems: 'flex-start' }}>
        <IconLock size={18} color="var(--ink-soft)" />
        <span>
          Words are hashed with SHA-256 on your device. The backend receives hashes and confidence scores only — never audio or transcripts.
          Low-confidence safe words are ignored; low-confidence duress words still escalate (safety first).
        </span>
      </div>

      {message && <div className="clay-inset mt-2" style={{ padding: 14, fontWeight: 800 }}>{message}</div>}

      <button className="clay-btn mt-2" style={{ width: '100%', padding: 15 }} disabled={saving} onClick={save}>
        {saving ? 'Saving...' : <><IconSave size={17} /> Save voice configuration</>}
      </button>
    </div>
  )
}
