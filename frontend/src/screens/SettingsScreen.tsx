import { useEffect, useState, type ReactNode } from 'react'
import { BASE_URL, WS_BASE_URL, APP_NAME } from '../services/config'
import { getVoiceConfig } from '../services/api'
import { IconSatellite, IconPlug, IconTag, IconMic, IconLock, IconSignal, IconGear, IconLadder } from '../components/Icons'

const INK = '#1E4E6E'

export default function SettingsScreen() {
  const [voiceEnabled, setVoiceEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    getVoiceConfig().then(c => setVoiceEnabled(c.enabled)).catch(() => setVoiceEnabled(null))
  }, [])

  const rows: { icon: ReactNode; label: string; value: string }[] = [
    { icon: <IconSatellite size={18} color={INK} />, label: 'Backend API', value: BASE_URL },
    { icon: <IconPlug size={18} color={INK} />, label: 'WebSocket', value: WS_BASE_URL },
    { icon: <IconTag size={18} color={INK} />, label: 'App name', value: APP_NAME },
    { icon: <IconMic size={18} color={INK} />, label: 'Voice assistant', value: voiceEnabled === null ? 'Unknown' : voiceEnabled ? 'Enabled' : 'Disabled' },
    { icon: <IconLock size={18} color={INK} />, label: 'Auth mode', value: 'Mock token (MVP)' },
    { icon: <IconSignal size={18} color={INK} />, label: 'Offline mode', value: 'PWA cache + installable' },
  ]

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="clay card">
        <h3 className="h-ico"><span className="h-ico-tile"><IconGear size={17} color={INK} /></span>System</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => (
            <div key={r.label} className="clay-inset row-between" style={{ padding: '12px 16px' }}>
              <span className="row" style={{ fontWeight: 800, fontSize: 14 }}>
                <span className="row" style={{ width: 22, justifyContent: 'center' }}>{r.icon}</span> {r.label}
              </span>
              <span className="tiny" style={{ maxWidth: '55%', textAlign: 'right', wordBreak: 'break-all' }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="clay card mt-2">
        <h3 className="h-ico"><span className="h-ico-tile"><IconLadder size={17} color={INK} /></span>How escalation works</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['L0 · Normal', 'Everything is fine.', 'safe'],
            ['L1 · Watch', 'One unconfirmed signal — logged silently.', 'neutral'],
            ['L2 · Check-in', 'Primary contact gets a soft heads-up; you get a spoken prompt.', 'warn'],
            ['L3 · Alert', 'All contacts notified by SMS with your live location.', 'danger'],
            ['L4 · Sustained', 'L3 unresolved after 5 min — re-notify + nearest police station.', 'danger'],
          ].map(([lvl, desc, cls]) => (
            <div key={lvl} className="clay-inset" style={{ padding: '10px 14px' }}>
              <span className={`badge ${cls}`}>{lvl}</span>
              <div className="muted mt-1" style={{ fontSize: 13, fontWeight: 700 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
