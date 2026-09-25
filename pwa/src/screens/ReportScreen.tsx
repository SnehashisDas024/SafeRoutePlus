import { useState, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { sendReport, suggestTags } from '../services/api'
import type { ReportPayload } from '../types'

function ReportScreen() {
  const navigate = useNavigate()
  const { id: paramId } = useParams<{ id: string }>()
  const location = useLocation()
  const locState = location.state as { tripId?: string } | null
  // Priority: route param > navigation state > localStorage > demo fallback
  const tripId = paramId || locState?.tripId || localStorage.getItem('activeTripId') || 'demo-trip-id'

  const [rating, setRating] = useState<ReportPayload['rating']>('🟢')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [suggestions, setSuggestions] = useState<{ tag: string; confidence: number }[]>([])
  const [submitting, setSubmitting] = useState(false)


  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) 
      ? prev.filter(t => t !== tag) 
      : [...prev, tag])
  }, [])

  const handleSuggestionSelect = useCallback((tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag])
    }
    setSuggestions(s => s.filter(s => s.tag !== tag))
  }, [selectedTags])

  // Debounced suggestion fetch
  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 3) {
      setSuggestions([])
      return
    }
    try {
      const res = await suggestTags(text)
      setSuggestions(res.tags.map((t, i) => ({ tag: t, confidence: res.confidence[i] })))
    } catch (e) {
      console.error('Tag suggestion error:', e)
    }
  }, [])

  const debouncedFetch = useRef(
    debounce(fetchSuggestions, 300)
  ).current

  const handleNoteChange = useCallback((text: string) => {
    setNote(text)
    debouncedFetch(text)
  }, [debouncedFetch])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      await sendReport(tripId, { rating, tags: selectedTags, note: note || undefined })
      alert('Report Submitted! Thank you for your feedback!')
      navigate('/plan')
    } catch (e: unknown) {
      alert('Error: ' + (e instanceof Error ? e.message : 'Failed to submit report'))
    } finally {
      setSubmitting(false)
    }
  }, [tripId, rating, selectedTags, note, navigate])

  const RATINGS = ['🟢', '🟡', '🔴'] as const
  const RATING_LABELS = { '🟢': 'Safe', '🟡': 'Okay', '🔴': 'Unsafe' }

  return (
    <div style={styles.container}>
      <h2>How was your trip?</h2>
      <p style={{ color: '#666', marginBottom: '24px' }}>Your feedback helps improve safety for everyone</p>

      <div style={styles.section}>
        <h3>Overall Safety</h3>
        <div style={styles.ratingRow}>
          {['🟢', '🟡', '🔴'].map(r => (
            <button
              key={r}
              style={rating === r ? styles.ratingBtnSelected : styles.ratingBtn}
              onClick={() => setRating(r as '🟢' | '🟡' | '🔴')}
            >
              <span style={styles.ratingEmoji}>{r}</span>
              <span style={styles.ratingLabel}>{RATING_LABELS[r as keyof typeof RATING_LABELS]}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <h3>Tags (optional)</h3>
        <div style={styles.tagsContainer}>
          {['Poorly lit', 'Empty street', 'Harassment', 'Crowded', 'No footpath', 'Broken streetlight', 'Suspicious activity', 'Eve teasing', 'Theft', 'Accident prone'].map(tag => (
            <button
              key={tag}
              style={selectedTags.includes(tag) ? styles.tagBtnSelected : styles.tagBtn}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <h3>Additional Notes (optional)</h3>
        <textarea
          style={styles.textInput}
          rows={4}
          placeholder="Any details you'd like to share..."
          value={note}
          onChange={e => handleNoteChange(e.target.value)}
        />
        {suggestions.length > 0 && (
          <div style={styles.suggestions}>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>Suggested tags:</p>
            <div style={styles.suggestionChips}>
              {suggestions.map(({ tag, confidence }) => (
                <button key={tag} style={styles.suggestionChip} onClick={() => handleSuggestionSelect(tag)}>
                  <span>{tag}</span>
                  <span style={{ fontSize: '11px', color: '#1976d2', marginLeft: '4px' }}>{Math.round(confidence * 100)}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button style={submitting ? styles.submitBtnDisabled : styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Report'}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '20px', maxWidth: '600px', margin: '0 auto' },
  section: { marginBottom: '24px' },
  ratingRow: { display: 'flex', gap: '8px' },
  ratingBtn: { flex: 1, padding: '16px', border: '2px solid #ddd', borderRadius: '12px', background: '#fafafa' },
  ratingBtnSelected: { borderColor: '#2e7d32', background: '#e8f5e9' },
  ratingEmoji: { fontSize: '32px', display: 'block', marginBottom: '8px' },
  ratingLabel: { fontSize: '14px', color: '#444' },
  tagsContainer: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  tagBtn: { padding: '8px 16px', border: '1px solid #ddd', borderRadius: '20px', background: '#fafafa' },
  tagBtnSelected: { borderColor: '#1976d2', background: '#e3f2fd' },
  textInput: { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px' },
  suggestions: { marginTop: '12px' },
  suggestionChips: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  suggestionChip: { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#e3f2fd', borderRadius: '16px', color: '#1976d2' },
  submitBtn: { width: '100%', padding: '14px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600' },
  submitBtnDisabled: { background: '#90caf9' },
}

function debounce(fn: (text: string) => void, ms: number): (text: string) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (text: string) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(text), ms)
  }
}

export default ReportScreen