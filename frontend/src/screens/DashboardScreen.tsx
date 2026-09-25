import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTrips, getAlerts, getContacts, getVoiceConfig, BASE_URL } from '../services/api'
import { Stat, EmptyState, Spinner } from '../components/ui'
import {
  IconCompass, IconRoute, IconSiren, IconShield, IconSpark, IconUsers, IconMic,
  IconCheck, IconBell, IconClock, IconStar, IconPerson, IconReport, HeroSafetyArt,
} from '../components/Icons'
import type { Trip, Alert, Contact, EscalationLevel } from '../types'
import { ESCALATION_COLORS, ESCALATION_LABELS } from '../types'

const LADDER: EscalationLevel[] = ['L0_Normal', 'L1_Watch', 'L2_Checkin', 'L3_Alert', 'L4_Sustained']
const INK = '#1E4E6E'

export default function DashboardScreen() {
  const [trips, setTrips] = useState<Trip[] | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [voiceEnabled, setVoiceEnabled] = useState<boolean | null>(null)
  const [backendUp, setBackendUp] = useState<boolean | null>(null)

  useEffect(() => {
    Promise.allSettled([getTrips(), getAlerts(), getContacts(), getVoiceConfig()]).then(([t, a, c, v]) => {
      setBackendUp(t.status === 'fulfilled')
      setTrips(t.status === 'fulfilled' ? t.value : [])
      setAlerts(a.status === 'fulfilled' ? a.value : [])
      setContacts(c.status === 'fulfilled' ? c.value : [])
      setVoiceEnabled(v.status === 'fulfilled' ? v.value.enabled : null)
    })
  }, [])

  if (trips === null) return <Spinner />

  const activeTrips = trips.filter(t => t.status === 'active')
  const l3Alerts = alerts.filter(a => a.level === 'L3_Alert' || a.level === 'L4_Sustained').length
  const activeTrip = activeTrips[0] ?? null
  const levelCounts = LADDER.map(lvl => alerts.filter(a => a.level === lvl).length)
  const safetyPct = alerts.length === 0 ? 100 : Math.max(0, Math.round(100 - (l3Alerts / alerts.length) * 100))

  const checklist = [
    { done: contacts.length > 0, Icon: IconUsers, text: 'Add at least one trusted contact', to: '/contacts' },
    { done: voiceEnabled === true, Icon: IconMic, text: 'Set your voice safe & duress words', to: '/voice' },
    { done: trips.length > 0, Icon: IconCompass, text: 'Complete your first trip', to: '/plan' },
  ]
  const doneCount = checklist.filter(c => c.done).length

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return m + 'm ago'
    const h = Math.floor(m / 60)
    if (h < 24) return h + 'h ago'
    return d.toLocaleDateString()
  }

  return (
    <>
      {/* Hero - guardian shield with journey path and heart pin */}
      {activeTrip ? (
        <div className="clay-hero card mb-2">
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div className="grow" style={{ minWidth: 260 }}>
              <span className="mini-pill"><IconCompass size={13} /> Live journey in progress</span>
              <div style={{ fontSize: 27, fontWeight: 900, margin: '12px 0 6px' }}>
                You are travelling <span style={{ color: 'var(--yellow-600)' }}>protected</span> right now
              </div>
              <p className="muted" style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 16 }}>
                {activeTrip.mode === 'drive' ? 'Driving' : 'Walking'} - trip {activeTrip.id.slice(0, 8)}... - started {fmtTime(activeTrip.started_at)}
              </p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <Link to="/trip" className="clay-btn"><IconCompass size={17} /> Open live trip</Link>
                <Link to="/report" className="clay-btn ghost"><IconReport size={17} /> Finish up</Link>
              </div>
              <div className="row" style={{ gap: 34, marginTop: 22, flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: 22, fontWeight: 900 }}>{activeTrips.length}</div><div className="tiny">active trips</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 900 }}>{contacts.length}</div><div className="tiny">contacts armed</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 900 }}>{alerts.length}</div><div className="tiny">alerts logged</div></div>
              </div>
            </div>
            <div className="hero-art"><HeroSafetyArt size={190} /></div>
          </div>
        </div>
      ) : (
        <div className="clay-hero card mb-2">
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div className="grow" style={{ minWidth: 260 }}>
              <span className="mini-pill" style={{ gap: 6 }}><IconSpark size={13} /> Every journey, safer</span>
              <div style={{ fontSize: 27, fontWeight: 900, margin: '12px 0 6px' }}>
                Safety that moves <span style={{ color: 'var(--yellow-600)' }}>with you</span>
              </div>
              <p className="muted" style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 16 }}>
                You are all set{contacts.length > 0 ? ' with ' + contacts.length + ' trusted contact' + (contacts.length > 1 ? 's' : '') : ''}. Plan a safety-ranked route before you head out.
              </p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <Link to="/plan" className="clay-btn"><IconRoute size={17} /> Plan My Safe Route</Link>
                <Link to="/sos" className="clay-btn ghost"><IconSiren size={17} /> Emergency SOS</Link>
              </div>
              <div className="row" style={{ gap: 34, marginTop: 22, flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: 22, fontWeight: 900 }}>{trips.length}</div><div className="tiny">total trips</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 900 }}>{contacts.length}</div><div className="tiny">trusted contacts</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 900 }}>{safetyPct}%</div><div className="tiny">safety score</div></div>
              </div>
            </div>
            <div className="hero-art"><HeroSafetyArt size={190} /></div>
          </div>
        </div>
      )}

      {backendUp === false && (
        <div className="error-note">
          Cannot reach the backend at <code>{BASE_URL}</code> - start it with <code>uvicorn app.main:app --workers 1</code>
        </div>
      )}

      <div className="grid grid-4 mb-2">
        <Stat icon={<IconCompass size={24} color={INK} />} tone="gold" value={activeTrips.length} label="Active trips" pill={activeTrips.length > 0 ? 'live now' : undefined} />
        <Stat icon={<IconRoute size={24} color={INK} />} tone="gold" value={trips.length} label="Total trips" />
        <Stat icon={<IconSiren size={24} color="#A83830" />} tone="rose" value={l3Alerts} label="L3+ alerts" />
        <Stat icon={<IconShield size={24} color={INK} />} tone="gold" value={safetyPct + '%'} label="Safety score" />
      </div>

      <div className="grid grid-2">
        <div className="clay card">
          <h3 className="h-ico"><span className="h-ico-tile"><IconSpark size={17} color={INK} /></span>Quick actions</h3>
          <div className="grid grid-2 mt-1">
            <Link to="/plan" className="clay-btn" style={{ textDecoration: 'none' }}><IconRoute size={17} /> Plan Route</Link>
            <Link to="/sos" className="clay-btn danger" style={{ textDecoration: 'none' }}><IconSiren size={17} /> Emergency</Link>
            <Link to="/trip" className="clay-btn ghost" style={{ textDecoration: 'none' }}><IconCompass size={17} /> Active Trip</Link>
            <Link to="/report" className="clay-btn ghost" style={{ textDecoration: 'none' }}><IconReport size={17} /> Report Trip</Link>
          </div>
          <div className="clay-inset mt-2" style={{ padding: 14, fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
            Routes are ranked by the <em>worst</em> segment risk at your predicted arrival time - the safest path wins, not just the fastest.
          </div>
        </div>

        <div className="clay card">
          <h3 className="h-ico"><span className="h-ico-tile"><IconShield size={17} color={INK} /></span>Escalation ladder</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LADDER.map((lvl, i) => {
              const count = levelCounts[i]
              return (
                <div key={lvl} className="row-between clay-inset" style={{ padding: '9px 14px' }}>
                  <span className="row" style={{ fontSize: 13, fontWeight: 800 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: ESCALATION_COLORS[lvl] }} />
                    {ESCALATION_LABELS[lvl]}
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <div style={{ width: 70 + count * 6, height: 8, borderRadius: 999, background: count > 0 ? ESCALATION_COLORS[lvl] : 'var(--yellow-100)', boxShadow: count > 0 ? 'var(--clay-in)' : 'none' }} />
                    <span className="tiny" style={{ width: 22, textAlign: 'right' }}>{count}</span>
                  </span>
                </div>
              )
            })}
          </div>
          <div className="tiny mt-1">Historical alert counts per level - the tiered response in action.</div>
        </div>

        <div className="clay card">
          <h3 className="h-ico"><span className="h-ico-tile rose"><IconSiren size={17} color="#A83830" /></span>Recent alerts</h3>
          {alerts.length === 0 ? (
            <EmptyState icon={<IconBell size={30} color="var(--ink-faint)" />} text="No alerts - all journeys calm." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alerts.slice(0, 5).map(a => (
                <div key={a.id} className="clay-inset row-between" style={{ padding: '10px 14px' }}>
                  <div className="row">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: ESCALATION_COLORS[a.level as EscalationLevel] ?? 'var(--warn)' }} />
                    <strong style={{ fontSize: 13 }}>{a.level.replace('_', ' . ')}</strong>
                    <span className="tiny">{a.type.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="tiny">{fmtTime(a.triggered_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="clay card">
          <div className="row-between mb-2">
            <h3 style={{ margin: 0 }} className="h-ico"><span className="h-ico-tile"><IconUsers size={17} color={INK} /></span>Trusted contacts</h3>
            <Link to="/contacts" className="clay-btn ghost" style={{ padding: '6px 14px', fontSize: 13 }}>Manage</Link>
          </div>
          {contacts.length === 0 ? (
            <EmptyState icon={<IconUsers size={30} color="var(--ink-faint)" />} text="No contacts yet - alerts need someone to reach." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contacts.slice(0, 4).map(c => (
                <div key={c.id} className="clay-inset row-between" style={{ padding: '9px 14px' }}>
                  <span className="row" style={{ fontWeight: 800, fontSize: 13.5 }}>
                    <span className="row" style={{ width: 22, justifyContent: 'center' }}>
                      {c.tier === 'primary' ? <IconStar size={16} color="#2F7FBC" /> : <IconPerson size={16} color="var(--ink-soft)" />}
                    </span>
                    {c.name}
                  </span>
                  <span className={`badge ${c.tier === 'primary' ? 'safe' : 'neutral'}`}>{c.tier}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="clay card">
          <div className="row-between mb-2">
            <h3 style={{ margin: 0 }} className="h-ico"><span className="h-ico-tile"><IconCheck size={17} color={INK} /></span>Safety setup</h3>
            <span className={`badge ${doneCount === checklist.length ? 'safe' : 'warn'}`}>{doneCount}/{checklist.length} done</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checklist.map((c, i) => (
              <Link key={i} to={c.to} className="clay-inset row-between" style={{ padding: '10px 14px', textDecoration: 'none', color: 'inherit' }}>
                <span className="row" style={{ fontWeight: 700, fontSize: 13.5 }}>
                  <span className={`check-dot ${c.done ? 'done' : ''}`}>{c.done && <IconCheck size={12} color={INK} />}</span> {c.text}
                </span>
                <span className="tiny">{c.done ? 'Done' : 'Set up'}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="clay card">
          <h3 className="h-ico"><span className="h-ico-tile"><IconMic size={17} color={INK} /></span>Protection status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="clay-inset row-between" style={{ padding: '10px 14px' }}>
              <span className="row" style={{ fontWeight: 800, fontSize: 13.5 }}>Voice assistant</span>
              <span className={`badge ${voiceEnabled ? 'safe' : 'neutral'}`}>{voiceEnabled ? 'Armed' : 'Not set up'}</span>
            </div>
            <div className="clay-inset row-between" style={{ padding: '10px 14px' }}>
              <span className="row" style={{ fontWeight: 800, fontSize: 13.5 }}>Backend</span>
              <span className={`badge ${backendUp ? 'safe' : 'danger'}`}>{backendUp ? 'Connected' : 'Offline'}</span>
            </div>
            <div className="clay-inset row-between" style={{ padding: '10px 14px' }}>
              <span className="row" style={{ fontWeight: 800, fontSize: 13.5 }}>Escalation engine</span>
              <span className={`badge ${backendUp ? 'safe' : 'neutral'}`}>{backendUp ? 'Monitoring' : 'Idle'}</span>
            </div>
          </div>
          <div className="clay-inset mt-2" style={{ padding: 12, fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
            Voice and audio never leave your device - only SHA-256 hashes are shared with the server.
          </div>
        </div>
      </div>

      <div className="clay card mt-2">
        <h3 className="h-ico"><span className="h-ico-tile"><IconClock size={17} color={INK} /></span>Trip history</h3>
        {trips.length === 0 ? (
          <EmptyState icon={<IconCompass size={30} color="var(--ink-faint)" />} text="No trips yet - plan your first safe route!" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {trips.slice(0, 8).map(t => (
              <div key={t.id} className="clay-inset row-between" style={{ padding: '12px 16px' }}>
                <div className="row">
                  <span className="h-ico-tile"><IconRoute size={17} color="var(--ink-soft)" /></span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13.5 }}>{t.id.slice(0, 8)}...</div>
                    <div className="tiny">{new Date(t.started_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="row">
                  {t.status === 'active' && <span className="badge warn">live</span>}
                  <span className={`badge ${t.status === 'active' ? 'safe' : 'neutral'}`}>{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
