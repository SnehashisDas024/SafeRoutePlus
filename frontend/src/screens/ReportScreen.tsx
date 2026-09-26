import { useCallback, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation as useRouterLocation } from 'react-router-dom'
import { sendReport, suggestTags } from '../services/api'
import { EmptyState } from '../components/ui'
import { IconShield, IconSpark, IconTag, IconPencil, IconSend, IconAlert, IconCheck, IconFlag } from '../components/Icons'
import { PREDEFINED_TAGS, type Rating } from '../types'

const INK = '#1E4E6E'

// NOTE: the backend keys risk by the literal emoji strings (RATING_RISK in
// backend/app/core/risk_constants.py), so `value` MUST stay 🟢/🟡/🔴 — only the
// icon we *render* is a drawn SVG.
const RATINGS: { value: Rating; label: string; tone: string }[] = [
  { value: '🟢', label: 'Safe', tone: 'var(--yellow-400)' },
  { value: '🟡', label: 'Okay', tone: 'var(--warn)' },
  { value: '🔴', label: 'Unsafe', tone: 'var(--danger)' },
]

function debounce<T extends (text: string) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout>
  return ((text: string) => {
    clearTimeout(t)
    t = setTimeout(() => fn(text), ms)
  }) as T
}

export default function ReportScreen() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const routerLoc = useRouterLocation()
  const locState = routerLoc.state as { tripId?: string } | null
  const tripId = params.id || locState?.tripId || localStorage.getItem('activeTripId')

  const [rating, setRating] = useState<Rating>('🟢')
  const [selected, setSelected] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [suggestions, setSuggestions] = useState<{ tag: string; confidence: number }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 3) { setSuggestions([]); return }
    try {
      const res = await suggestTags(text)
      setSuggestions(res.tags.map((t, i) => ({ tag: t, confidence: res.confidence[i] })))
    } catch { /* suggestions optional */ }
  }, [])

  const debounced = useRef(debounce(fetchSuggestions, 300)).current

  const toggleTag = (tag: string) =>
    setSelected(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const addSuggestion = (tag: string) => {
    if (!selected.includes(tag)) setSelected(prev => [...prev, tag])
    setSuggestions(s => s.filter(x => x.tag !== tag))
  }

  const submit = async () => {
    if (!tripId) { setError('No trip to report on.'); return }
    setSubmitting(true)
    setError('')
    try {
      await sendReport(tripId, { rating, tags: selected, note: note || undefined })
      localStorage.removeItem('activeTripId')
      navigate('/dashboard', { state: { reported: true } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  if (!tripId) return <EmptyState icon={<IconPencil size={30} color="var(--ink-faint)" />} text="No trip to report — plan and start a trip first." />

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="clay card">
        <h3 className="h-ico"><span className="h-ico-tile"><IconShield size={17} color={INK} /></span>How was your journey?</h3>
        <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
          Your feedback trains the risk model and helps other women travel safer.
        </p>
        <div className="grid grid-3">
          {RATINGS.map(r => (
            <button key={r.value} onClick={() => setRating(r.value)} className="clay-btn"
              style={{
                flexDirection: 'column', padding: '18px 8px', gap: 8,
                background: rating === r.value ? 'linear-gradient(145deg, var(--yellow-100), var(--yellow-300))' : 'var(--cream-2)',
                color: 'var(--ink)',
              }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: r.tone, boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.8), 0 4px 8px rgba(80,150,210,0.25)' }} />
              <span style={{ fontSize: 13 }}>{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="clay card mt-2">
        <h3 className="h-ico"><span className="h-ico-tile"><IconTag size={17} color={INK} /></span>Tags (optional)</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PREDEFINED_TAGS.map(tag => (
            <button key={tag} className={`chip${selected.includes(tag) ? ' active' : ''}`} onClick={() => toggleTag(tag)}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="clay card mt-2">
        <h3 className="h-ico"><span className="h-ico-tile"><IconPencil size={17} color={INK} /></span>Notes (optional)</h3>
        <textarea
          className="clay-textarea"
          rows={4}
          placeholder="Anything you'd like to share about this route…"
          value={note}
          onChange={e => { setNote(e.target.value); debounced(e.target.value) }}
        />
        {suggestions.length > 0 && (
          <div className="mt-2">
            <div className="tiny mb-2 row" style={{ gap: 6 }}><IconSpark size={13} /> AI-SUGGESTED TAGS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map(({ tag, confidence }) => (
                <button key={tag} className="chip" onClick={() => addSuggestion(tag)}>
                  + {tag} <span style={{ opacity: 0.6 }}>{Math.round(confidence * 100)}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-note">{error}</div>}
      <button className="clay-btn mt-2" style={{ width: '100%', padding: 16 }} disabled={submitting} onClick={submit}>
        {submitting ? 'Submitting...' : <><IconSend size={17} /> Submit report</>}
      </button>
    </div>
  )
}
