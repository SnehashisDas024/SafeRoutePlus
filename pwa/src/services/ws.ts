import { WS_BASE_URL, WS_RECONNECT_DELAYS, WS_HEARTBEAT_INTERVAL } from './config'
import type { WSMessage, GPSPoint } from '../types'

export type { WSMessage }

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

export interface TripWebSocketOptions {
  tripId: string
  onMessage: (message: WSMessage) => void
  onStatusChange?: (status: WSStatus) => void
  onReconnect?: () => void
}

export class TripWebSocket {
  private ws: WebSocket | null = null
  private tripId: string
  private options: TripWebSocketOptions
  private reconnectAttempt = 0
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private status: WSStatus = 'disconnected'
  private messageQueue: Array<{ type: string; payload: unknown }> = []

  constructor(options: TripWebSocketOptions) {
    this.tripId = options.tripId
    this.options = options
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    
    this.setStatus('connecting')
    
    try {
      this.ws = new WebSocket(`${WS_BASE_URL}/trips/${this.tripId}/stream`)
      this.setupEventListeners()
    } catch (error) {
      console.error('WS connection error:', error)
      this.scheduleReconnect()
    }
  }

  private setupEventListeners() {
    if (!this.ws) return

    this.ws.onopen = () => {
      console.log('WS connected for trip:', this.tripId)
      this.reconnectAttempt = 0
      this.setStatus('connected')
      this.flushMessageQueue()
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSMessage
        this.options.onMessage(message)
      } catch (error) {
        console.error('WS parse error:', error)
      }
    }

    this.ws.onclose = (event) => {
      console.log('WS closed:', event.code, event.reason)
      this.stopHeartbeat()
      if (this.status !== 'disconnected') {
        this.setStatus('reconnecting')
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (error) => {
      console.error('WS error:', error)
    }
  }

  private setStatus(status: WSStatus) {
    this.status = status
    this.options.onStatusChange?.(status)
  }

  private scheduleReconnect() {
    if (this.reconnectAttempt >= WS_RECONNECT_DELAYS.length) {
      console.error('Max reconnect attempts reached')
      this.setStatus('disconnected')
      return
    }

    const delay = WS_RECONNECT_DELAYS[this.reconnectAttempt]
    this.reconnectAttempt++

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`)
    
    setTimeout(() => {
      if (this.status !== 'disconnected') {
        this.connect()
      }
    }, delay)
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }))
      }
    }, WS_HEARTBEAT_INTERVAL)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()
      if (msg && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg))
      }
    }
  }

  sendPing(point: GPSPoint) {
    const message = {
      type: 'ping',
      payload: point,
    }
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.messageQueue.push(message)
    }
  }

  sendMessage(type: string, payload: unknown) {
    const message = { type, payload }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.messageQueue.push(message)
    }
  }

  disconnect() {
    this.stopHeartbeat()
    this.setStatus('disconnected')
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
  }

  getStatus() {
    return this.status
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Factory function for easier usage
export function createTripWebSocket(options: TripWebSocketOptions): TripWebSocket {
  return new TripWebSocket(options)
}