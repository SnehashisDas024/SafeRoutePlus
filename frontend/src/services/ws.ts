import { WS_BASE_URL, WS_RECONNECT_DELAYS, WS_HEARTBEAT_INTERVAL } from './config'
import type { GPSPoint, WSMessage } from '../types'

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

export interface TripWebSocketOptions {
  tripId: string
  onMessage: (message: WSMessage) => void
  onStatusChange?: (status: WSStatus) => void
}

export class TripWebSocket {
  private ws: WebSocket | null = null
  private options: TripWebSocketOptions
  private reconnectAttempt = 0
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private status: WSStatus = 'disconnected'
  private closedByUser = false
  private queue: Array<{ type: string; payload: unknown }> = []

  constructor(options: TripWebSocketOptions) {
    this.options = options
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.closedByUser = false
    this.setStatus('connecting')
    try {
      this.ws = new WebSocket(`${WS_BASE_URL}/trips/${this.options.tripId}/stream`)
      this.ws.onopen = () => {
        this.reconnectAttempt = 0
        this.setStatus('connected')
        this.flushQueue()
        this.heartbeat = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'heartbeat' }))
          }
        }, WS_HEARTBEAT_INTERVAL)
      }
      this.ws.onmessage = (ev) => {
        try { this.options.onMessage(JSON.parse(ev.data)) } catch { /* ignore */ }
      }
      this.ws.onclose = () => {
        this.stopHeartbeat()
        if (!this.closedByUser) {
          this.setStatus('reconnecting')
          this.scheduleReconnect()
        } else {
          this.setStatus('disconnected')
        }
      }
      this.ws.onerror = () => { /* handled by onclose */ }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempt >= WS_RECONNECT_DELAYS.length) {
      this.setStatus('disconnected')
      return
    }
    const delay = WS_RECONNECT_DELAYS[this.reconnectAttempt]
    this.reconnectAttempt++
    setTimeout(() => { if (!this.closedByUser) this.connect() }, delay)
  }

  private setStatus(s: WSStatus) {
    this.status = s
    this.options.onStatusChange?.(s)
  }

  private flushQueue() {
    while (this.queue.length && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.queue.shift()!
      this.ws.send(JSON.stringify(msg))
    }
  }

  sendPing(point: GPSPoint) {
    this.send({ type: 'ping', payload: point })
  }

  private send(msg: { type: string; payload: unknown }) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
    else this.queue.push(msg)
  }

  disconnect() {
    this.closedByUser = true
    this.stopHeartbeat()
    this.setStatus('disconnected')
    this.ws?.close(1000, 'Client disconnect')
    this.ws = null
  }

  getStatus() { return this.status }
  private stopHeartbeat() {
    if (this.heartbeat) { clearInterval(this.heartbeat); this.heartbeat = null }
  }
}

export const createTripWebSocket = (o: TripWebSocketOptions) => new TripWebSocket(o)
