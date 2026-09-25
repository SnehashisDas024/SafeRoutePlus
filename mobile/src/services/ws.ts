export interface WSMessage {
  type?: 'escalation' | 'checkin_prompt' | 'alert' | 'status';
  level?: string;
  reason?: string;
  timestamp?: string;
  deadline?: number;
  trigger_source?: 'auto' | 'manual_sos' | 'voice_duress' | 'voice_safe' | 'checkin_timeout';
}

type WSHandler = (data: WSMessage) => void;

export interface TripWebSocketConfig {
  tripId: string;
  onMessage: (data: any) => void;
  onReconnect?: () => Promise<void>; // Called after reconnect to resync escalation
}

export class TripWebSocket {
  private ws: WebSocket | null = null;
  private tripId: string;
  private onMessage: (data: any) => void;
  private onReconnect: (() => Promise<void>) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1 second
  private maxReconnectDelay = 30000; // 30 seconds
  private shouldReconnect = true;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: TripWebSocketConfig) {
    this.tripId = config.tripId;
    this.onMessage = config.onMessage;
    this.onReconnect = config.onReconnect || null;
  }

  connect() {
    if (!this.shouldReconnect) return;
    
    this.ws = new WebSocket(`ws://10.0.2.2:8000/trips/${this.tripId}/stream`);
    
    this.ws.onopen = () => {
      console.log(`WS connected for trip ${this.tripId}`);
      this.reconnectAttempts = 0;
      
      // On reconnect, resync escalation state from server
      if (this.reconnectAttempts > 0 && this.onReconnect) {
        this.onReconnect();
      }
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.onMessage(data);
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.log(`WS closed for trip ${this.tripId}, attempt ${this.reconnectAttempts + 1}`);
      if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error('WS error:', err);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      this.maxReconnectDelay
    );
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  sendPing(ping: { lat: number; lon: number; speed: number; accuracy: number }) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(ping));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}