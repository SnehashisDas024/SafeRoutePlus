import { useEffect, useRef, useState } from 'react'
import { useShake } from '../services/shake'
import { triggerSOS } from '../services/api'
import { speak } from '../services/voice'
import { IconSiren, IconAlert, IconShield } from '../components/Icons'

export default function SOSScreen() {
  const [tripId, setTripId] = useState<string | null>(null)
  const [fired, setFired] = useState(false)
  const [error, setError] = useState('')
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setTripId(localStorage.getItem('activeTripId')) }, [])

  const fire = async () => {
    setError('')
    speak('Emergency alert activated')
    try {
      if (tripId) {
        await triggerSOS(tripId)
        setFired(true)
      } else {
        setError('No active trip. Start a trip first so SOS can escalate on the server.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SOS failed — check the backend connection')
    }
  }

  const shake = useShake(() => { void fire() })
  useEffect(() => { shake.start(); return () => shake.stop() }, [shake])

  // 3-second hold-to-confirm
  const onHoldStart = () => {
    holdTimer.current = setTimeout(() => { void fire() }, 1500)
  }
  const onHoldEnd = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
  }

  return (
    <div className="center-page">
      <div className="h-ico-tile" style={{ width: 62, height: 62, borderRadius: 20 }}>
        <IconSiren size={32} color="#A83830" />
      </div>
      <h2 style={{ fontWeight: 900, fontSize: 26, marginTop: 14 }}>Emergency SOS</h2>
      <p className="muted" style={{ maxWidth: 420 }}>
        Hold the button for 1.5s to alert all trusted contacts immediately (level L3).
        You can also <strong>shake your phone</strong> to trigger it.
      </p>

      <button className="sos-circle" onMouseDown={onHoldStart} onMouseUp={onHoldEnd}
        onTouchStart={onHoldStart} onTouchEnd={onHoldEnd} onClick={() => { /* hold or click fires via hold; click fallback */ void fire() }}>
        SOS
      </button>

      {fired && (
        <div className="clay card" style={{ background: 'var(--danger-bg)', maxWidth: 420 }}>
          <h3 className="h-ico" style={{ color: 'var(--danger)' }}>
            <span className="h-ico-tile rose"><IconAlert size={17} color="#A83830" /></span>
            Alert sent — Level L3
          </h3>
          <p className="muted" style={{ fontSize: 14 }}>
            All your trusted contacts have been notified with your live location.
            Use the Active Trip screen to check in when you're safe.
          </p>
        </div>
      )}

      {error && <div className="error-note" style={{ maxWidth: 420 }}>{error}</div>}

      <div className="clay-inset row" style={{ padding: 14, maxWidth: 420, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', gap: 8 }}>
        {tripId
          ? <><IconShield size={15} color="var(--ink-soft)" /> Active trip: <code>{tripId.slice(0, 12)}…</code></>
          : <><IconAlert size={15} color="var(--ink-soft)" /> No active trip in this browser — SOS needs a trip to escalate against.</>}
      </div>
    </div>
  )
}
