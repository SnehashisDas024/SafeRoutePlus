import { useState } from 'react'
import { IconSend, IconFlag } from './Icons'
import { BASE_URL } from '../services/api'

type Rating = '🟢' | '🟡' | '🔴'

const RATINGS: { value: Rating; label: string; tone: string; icon: string }[] = [
  { value: '🟢', label: 'Safe', tone: '#4CAF50', icon: '🟢' },
  { value: '🟡', label: 'Okay', tone: '#FF9800', icon: '🟡' },
  { value: '🔴', label: 'Unsafe', tone: '#F44336', icon: '🔴' },
]

const TAGS = ['Well-lit', 'Poorly lit', 'Crowded', 'Deserted', 'Police present', 'Suspicious activity', 'Harassment', 'Good roads', 'Bad roads']

interface CommunityReportModalProps {
  lat: number
  lon: number
  onClose: () => void
  onSuccess: () => void
}

export default function CommunityReportModal({ lat, lon, onClose, onSuccess }: CommunityReportModalProps) {
  const [rating, setRating] = useState<Rating>('🟢')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const toggleTag = (t: string) => setSelectedTags(s => s.includes(t) ? s.filter(x => x !== t) : [...s, t])

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      await fetch(`${BASE_URL}/reports/community`, {
        method: 'POST',
        body: JSON.stringify({ lat, lon, rating, tags: selectedTags, note })
      })
      onSuccess()
    } catch (e: any) {
      setError(e.message || 'Failed to submit report. You may have already reported here today.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'flex-end'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#fff', width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 20, paddingBottom: 40, maxHeight: '90vh', overflowY: 'auto'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h2 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconFlag size={20} color="#1E4E6E" /> Report this area
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, padding: 0 }}>&times;</button>
        </div>

        {error && <div style={{ color: '#F44336', background: '#ffebee', padding: 10, borderRadius: 8, marginBottom: 15, fontSize: 13 }}>{error}</div>}

        <p style={{ margin: '0 0 10px 0', fontSize: 14, color: '#555' }}>How safe does it feel here?</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {RATINGS.map(r => (
            <button key={r.value} onClick={() => setRating(r.value)} style={{
              flex: 1, padding: '12px 5px', borderRadius: 12, border: `2px solid ${rating === r.value ? r.tone : '#eee'}`,
              background: rating === r.value ? `${r.tone}15` : '#fff',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              cursor: 'pointer', transition: 'all 0.2s'
            }}>
              <span style={{ fontSize: 24 }}>{r.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: rating === r.value ? r.tone : '#777' }}>{r.label}</span>
            </button>
          ))}
        </div>

        <p style={{ margin: '0 0 10px 0', fontSize: 14, color: '#555' }}>Select tags (optional)</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {TAGS.map(t => {
            const active = selectedTags.includes(t)
            return (
              <button key={t} onClick={() => toggleTag(t)} style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 13,
                border: `1px solid ${active ? '#1E4E6E' : '#ddd'}`,
                background: active ? '#1E4E6E' : '#f9f9f9',
                color: active ? '#fff' : '#444',
                cursor: 'pointer'
              }}>
                {t}
              </button>
            )
          })}
        </div>

        <p style={{ margin: '0 0 10px 0', fontSize: 14, color: '#555' }}>Additional Note (optional)</p>
        <textarea 
          placeholder="What's happening?"
          value={note} onChange={e => setNote(e.target.value)}
          style={{
            width: '100%', height: 60, borderRadius: 12, border: '1px solid #ddd', padding: 10,
            fontSize: 14, fontFamily: 'inherit', marginBottom: 20, resize: 'none'
          }}
        />

        <button 
          onClick={submit} disabled={submitting}
          style={{
            width: '100%', padding: 15, borderRadius: 12, border: 'none',
            background: '#1E4E6E', color: '#fff', fontSize: 16, fontWeight: 600,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1
          }}
        >
          {submitting ? 'Submitting...' : <><IconSend size={18} /> Submit Report</>}
        </button>
      </div>
    </div>
  )
}
