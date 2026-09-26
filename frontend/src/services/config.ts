export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://127.0.0.1:8000'
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'SafeRoute+'

export const AUTH_TOKEN = 'test_user_id'

export const WS_RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]
export const WS_HEARTBEAT_INTERVAL = 30000

export const VOICE_SAFE_WORD_MIN_CONFIDENCE = 0.6

export const SHAKE_THRESHOLD = 15
export const SHAKE_COOLDOWN_MS = 4000

export const MAP_DEFAULTS = {
  center: [22.57, 88.36] as [number, number],
  zoom: 14,
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}

export const KOLKATA_PRESETS = [
  {
    name: 'Park Street → Victoria Memorial',
    originName: 'Park Street',
    destName: 'Victoria Memorial',
    mode: 'walk' as const,
    origin: [88.3524, 22.5513] as [number, number],
    destination: [88.3426, 22.5448] as [number, number],
  },
  {
    name: 'Howrah Station → B.B.D. Bagh',
    originName: 'Howrah Station',
    destName: 'B.B.D. Bagh',
    mode: 'walk' as const,
    origin: [88.3426, 22.5851] as [number, number],
    destination: [88.3512, 22.5726] as [number, number],
  },
  {
    name: 'Salt Lake Sector V → Esplanade',
    originName: 'Salt Lake Sector V',
    destName: 'Esplanade',
    mode: 'drive' as const,
    origin: [88.4332, 22.5744] as [number, number],
    destination: [88.3528, 22.5647] as [number, number],
  },
]
