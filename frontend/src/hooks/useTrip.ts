import { useCallback, useEffect, useRef, useState } from 'react'
import { createTripWebSocket, type WSStatus } from '../services/ws'
import { getEscalation, sendCheckin, triggerSOS, sendVoiceEvent } from '../services/api'
import type { EscalationState, GPSPoint } from '../types'

export function useTrip(tripId: string | null) {
  const [escalation, setEscalation] = useState<EscalationState | null>(null)
  const [wsStatus, setWsStatus] = useState<WSStatus>('disconnected')
  const wsRef = useRef<ReturnType<typeof createTripWebSocket> | null>(null)

  const fetchEscalation = useCallback(async () => {
    if (!tripId) return
    try {
      setEscalation(await getEscalation(tripId))
    } catch { /* ignore */ }
  }, [tripId])

  useEffect(() => {
    if (!tripId) {
      setEscalation(null)
      return
    }
    fetchEscalation()
    const ws = createTripWebSocket({
      tripId,
      onMessage: (m) => {
        if (m.type === 'escalation' && m.level) {
          setEscalation(prev => ({ level: m.level!, reason: m.reason ?? prev?.reason ?? '' }))
        } else if (m.type === 'checkin_prompt') {
          setEscalation({ level: 'L2_Checkin', reason: 'checkin_prompt' })
        } else if (m.type === 'status' && m.status) {
          // trip status updates
        }
      },
      onStatusChange: setWsStatus,
    })
    wsRef.current = ws
    ws.connect()
    return () => ws.disconnect()
  }, [tripId, fetchEscalation])

  const checkin = useCallback(async () => {
    if (!tripId) return
    await sendCheckin(tripId)
    fetchEscalation()
  }, [tripId, fetchEscalation])

  const sos = useCallback(async () => {
    if (!tripId) return
    await triggerSOS(tripId)
    fetchEscalation()
  }, [tripId, fetchEscalation])

  const voiceEvent = useCallback(async (kind: 'duress_word' | 'safe_word' | 'checkin_spoken' | 'loud_noise' | 'distress_keyword', confidence: number) => {
    if (!tripId) return
    if (kind === 'loud_noise' || kind === 'distress_keyword') {
      try { await triggerSOS(tripId) } catch { /* ignore */ }
    } else {
      try { await sendVoiceEvent(tripId, { kind, phrase_hash: '', confidence }) } catch { /* ignore */ }
    }
    fetchEscalation()
  }, [tripId, fetchEscalation])

  const sendPing = useCallback((p: GPSPoint) => {
    wsRef.current?.sendPing(p)
  }, [])

  return { escalation, wsStatus, fetchEscalation, checkin, sos, voiceEvent, sendPing }
}
