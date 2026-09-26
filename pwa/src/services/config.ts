// SafeRoute+ PWA - Configuration

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://127.0.0.1:8000'
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'SafeRoute+'

// API Endpoints
export const ENDPOINTS = {
  routes: {
    plan: '/routes/plan',
    history: '/routes/history',
    frequent: '/routes/history/frequent',
  },
  trips: {

    start: '/trips/start',
    stream: (id: string) => `/trips/${id}/stream`,
    escalation: (id: string) => `/trips/${id}/escalation`,
    checkin: (id: string) => `/trips/${id}/checkin`,
    sos: (id: string) => `/trips/${id}/sos`,
    voiceEvent: (id: string) => `/trips/${id}/voice-event`,
    report: (id: string) => `/trips/${id}/report`,
  },
  reports: {
    suggestTags: '/reports/suggest-tags',
    retrain: '/reports/retrain',
  },
  contacts: {
    list: '/contacts',
    create: '/contacts',
    update: (id: string) => `/contacts/${id}`,
    delete: (id: string) => `/contacts/${id}`,
  },
  users: {
    voiceConfig: '/users/voice-config',
  },
  safePoints: {
    nearest: '/safe-points/nearest',
  },
  share: (token: string) => `/share/${token}`,
} as const

// WebSocket
export const WS_RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]
export const WS_HEARTBEAT_INTERVAL = 30000

// Voice
export const VOICE_LISTEN_WINDOW_MS = 8000
export const VOICE_SAFE_WORD_MIN_CONFIDENCE = 0.6

// Shake Detection
export const SHAKE_THRESHOLD = 15
export const SHAKE_COOLDOWN_MS = 2000

// Offline Queue
export const OFFLINE_QUEUE_MAX_SIZE = 100
export const OFFLINE_QUEUE_RETRY_DELAYS = [5000, 15000, 60000]

// Cache
export const CACHE_NAMES = {
  static: 'saferoute-static-v1',
  api: 'saferoute-api-v1',
  tiles: 'saferoute-tiles-v1',
} as const

// Map
export const MAP_DEFAULTS = {
  center: [22.57, 88.36] as [number, number],
  zoom: 14,
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}

// Colors for escalation levels
export const ESCALATION_COLORS = {
  L0_Normal: '#2e7d32',
  L1_Watch: '#f57f17',
  L2_Checkin: '#f57f17',
  L3_Alert: '#c62828',
  L4_Sustained: '#b71c1c',
} as const

export const ESCALATION_LABELS = {
  L0_Normal: 'NORMAL',
  L1_Watch: 'WATCH',
  L2_Checkin: 'CHECK-IN',
  L3_Alert: 'ALERT',
  L4_Sustained: 'SUSTAINED',
} as const

// Rating
export const RATING_LABELS = {
  '🟢': 'Safe',
  '🟡': 'Okay',
  '🔴': 'Unsafe',
} as const

// Tags
export const PREDEFINED_TAGS = [
  'Poorly lit',
  'Empty street',
  'Harassment',
  'Crowded',
  'No footpath',
  'Broken streetlight',
  'Suspicious activity',
  'Eve teasing',
  'Theft',
  'Accident prone',
] as const

export type PredefinedTag = typeof PREDEFINED_TAGS[number]