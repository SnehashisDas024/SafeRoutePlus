import { useState, useEffect, useCallback, useRef } from 'react'
import { createTripWebSocket, type TripWebSocket, type WSMessage } from '../services/ws'
import { getEscalation, sendCheckin, triggerSOS } from '../services/api'
import type { EscalationState, GPSPoint, Trip } from '../types'

export function useTrip(tripId: string | null) {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [escalation, setEscalation] = useState<EscalationState | null>(null)
  const [ws, setWs] = useState<TripWebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const wsRef = useRef<TripWebSocket | null>(null)

  const fetchEscalation = useCallback(async () => {
    if (!tripId) return
    try {
      const state = await getEscalation(tripId)
      setEscalation(state)
    } catch (err) {
      console.error('Fetch escalation error:', err)
    }
  }, [tripId])

  const handleWSMessage = useCallback((message: WSMessage) => {
    console.log('WS message:', message)
    
    if (message.type === 'escalation' && message.level) {
      const newLevel = message.level
      setEscalation(prev => prev 
        ? { ...prev, level: newLevel, reason: message.reason ?? prev.reason }
        : { level: newLevel, reason: message.reason ?? '' }
      )
      
      if (newLevel === 'L2_Checkin') {
        // Check-in modal will be handled by UI
      } else if (newLevel === 'L3_Alert') {
        // Duress word check
        const triggerSource = (message as { trigger_source?: string }).trigger_source
        if (triggerSource === 'voice_duress') {
          console.log('DURESS TRIGGERED - screen stays normal')
        }
      }
    } else if (message.type === 'checkin_prompt' && message.deadline) {
      // Check-in prompt from server
      setEscalation(prev => prev 
        ? { ...prev, level: 'L2_Checkin' }
        : { level: 'L2_Checkin', reason: 'checkin_prompt' }
      )
    } else if (message.type === 'status' && message.status) {
      setTrip(prev => prev 
        ? { ...prev, status: message.status as Trip['status'] }
        : null
      )
    }
  }, [])

  const handleWSStatusChange = useCallback((status: string) => {
    setConnected(status === 'connected')
  }, [])

  const handleWSReconnect = useCallback(() => {
    fetchEscalation()
  }, [fetchEscalation])

  useEffect(() => {
    if (!tripId) {
      setTrip(null)
      setEscalation(null)
      return
    }

    // Fetch initial escalation state
    fetchEscalation()

    // Initialize WebSocket
    const wsInstance = createTripWebSocket({
      tripId,
      onMessage: handleWSMessage,
      onStatusChange: handleWSStatusChange,
      onReconnect: handleWSReconnect,
    })
    
    wsRef.current = wsInstance
    setWs(wsInstance)
    wsInstance.connect()

    return () => {
      wsInstance.disconnect()
    }
  }, [tripId, fetchEscalation, handleWSMessage, handleWSStatusChange, handleWSReconnect])

  const handleCheckin = useCallback(async (method: 'tap' | 'voice') => {
    if (!tripId) return
    try {
      await sendCheckin(tripId, method)
      fetchEscalation()
    } catch (err) {
      console.error('Check-in failed:', err)
      throw err
    }
  }, [tripId, fetchEscalation])

  const handleSOS = useCallback(async () => {
    if (!tripId) return
    try {
      await triggerSOS(tripId)
    } catch (err) {
      console.error('SOS failed:', err)
      throw err
    }
  }, [tripId])

  const handleVoiceEvent = useCallback(async (
    kind: 'duress_word' | 'safe_word' | 'checkin_spoken',
    confidence: number
  ) => {
    if (!tripId) return
    try {
      const { sendVoiceEvent } = await import('../services/api')
      await sendVoiceEvent(tripId, { kind, phrase_hash: '', confidence })
    } catch (err) {
      console.error('Voice event failed:', err)
    }
  }, [tripId])

  const sendPing = useCallback((point: GPSPoint) => {
    wsRef.current?.sendPing(point)
  }, [])

  return {
    trip,
    escalation,
    connected,
    error,
    fetchEscalation,
    handleCheckin,
    handleSOS,
    handleVoiceEvent,
    sendPing,
  }
}