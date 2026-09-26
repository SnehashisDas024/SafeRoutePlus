import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { EscalationLevel, ESCALATION_COLORS, ESCALATION_LABELS } from '../types'
import { IconClose } from './Icons'

export function EscalationBanner({ level, reason }: { level: EscalationLevel; reason?: string }) {
  const color = ESCALATION_COLORS[level]
  const bg =
    level === 'L0_Normal' ? 'var(--yellow-100)'
    : level === 'L3_Alert' || level === 'L4_Sustained' ? 'var(--danger-soft)'
    : 'var(--warn-soft)'
  return (
    <div className="esc-banner" style={{ background: bg, color }}>
      <span className="dot" style={{ background: color }} />
      <div>
        <div style={{ letterSpacing: '0.05em', fontSize: 15 }}>
          LEVEL {level.slice(1, 2)} · {ESCALATION_LABELS[level].toUpperCase()}
        </div>
        {reason && <div style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.75 }}>{reason.replace(/_/g, ' ')}</div>}
      </div>
    </div>
  )
}

export function ScorePill({ score }: { score: number }) {
  const risky = score >= 0.6
  const warn = score >= 0.35 && !risky
  const dotColor = risky ? 'var(--danger)' : warn ? 'var(--warn)' : 'var(--yellow-400)'
  return (
    <span className={`badge ${risky ? 'danger' : warn ? 'warn' : 'safe'}`}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
      Safety {Math.round((1 - score) * 100)}%
    </span>
  )
}

export function Stat({ icon, value, label, tone, pill }: {
  icon: ReactNode
  value: string | number
  label: string
  tone?: 'gold' | 'warm' | 'rose'
  pill?: string
}) {
  return (
    <div className="clay stat">
      <div className={`stat-ico ${tone ?? ''}`}>{icon}</div>
      <div className="grow">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      {pill && <span className="mini-pill">{pill}</span>}
    </div>
  )
}

export function Modal({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="clay modal" onClick={e => e.stopPropagation()}>
        <div className="row-between mb-2">
          <h3 style={{ fontSize: 18, fontWeight: 900 }}>{title}</h3>
          <button className="clay-btn ghost" style={{ padding: '6px 12px' }} onClick={onClose} aria-label="Close">
            <IconClose size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

export function Spinner() {
  return <div className="spinner" style={{ marginTop: 40 }} />
}

export function EmptyState({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="clay-inset" style={{ padding: 28, textAlign: 'center', fontWeight: 700, color: 'var(--ink-soft)' }}>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{icon}</div>
      {text}
    </div>
  )
}
