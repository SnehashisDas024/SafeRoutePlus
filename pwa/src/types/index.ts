// SafeRoute+ PWA - Shared TypeScript Types

// GPS & Location
export interface GPSPoint {
  lat: number
  lon: number
  speed: number
  accuracy: number
  timestamp: number
}

export interface LocationPermissionState {
  granted: boolean
  prompt: boolean
  denied: boolean
}

// Trip & Routing
export interface RouteSegment {
  start: [number, number]
  end: [number, number]
  mid: [number, number]
  distance: number
  h3_index: string
  duration: number
  predicted_arrival: string
  score_data: {
    score: number
    confidence: 'high' | 'estimated'
    factors: Record<string, number>
  }
}

export interface RouteCandidate {
  worst_segment_score: number
  mean_segment_score: number
  segments: RouteSegment[]
  total_time_sec: number
}

export interface RoutePlanRequest {
  origin: [number, number]
  destination: [number, number]
  mode: 'walk' | 'drive'
  depart_at: string
}

export interface TripStartRequest {
  origin: [number, number]
  destination: [number, number]
  mode: string
  planned_route_geom: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  planned_segments: RouteSegment[]
}

export interface TripStartResponse {
  trip_id: string
  ws_token: string
}

export interface Trip {
  id: string
  user_id: string
  mode: string
  started_at: string
  status: 'active' | 'completed' | 'cancelled'
  origin?: [number, number]
  destination?: [number, number]
  planned_route_geom?: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  position?: [number, number]
}

// Escalation
export type EscalationLevel = 'L0_Normal' | 'L1_Watch' | 'L2_Checkin' | 'L3_Alert' | 'L4_Sustained'

export interface EscalationState {
  level: EscalationLevel
  reason: string
  checkin_deadline?: number
  trigger_source?: string
}

export interface Alert {
  id: string
  trip_id: string
  level: EscalationLevel
  type: string
  triggered_at: string
  resolved_at?: string
  payload: {
    contacts_notified?: string[]
    [key: string]: unknown
  }
}

// Contacts
export type ContactTier = 'primary' | 'secondary'

export interface Contact {
  id: string
  user_id: string
  name: string
  phone: string
  tier: ContactTier
  priority: number
}

// Reports
export type Rating = '🟢' | '🟡' | '🔴'

export interface ReportPayload {
  rating: Rating
  tags?: string[]
  note?: string
}

export interface Report {
  id: string
  trip_id: string
  h3_index: string
  rating: Rating
  tags: string[]
  note?: string
  ts: string
}

export interface TagSuggestion {
  tag: string
  confidence: number
}

// Voice
export interface VoiceConfig {
  safeWordHash: string
  duressWordHash: string
  enabled: boolean
}

export interface VoiceEvent {
  kind: 'duress_word' | 'safe_word' | 'checkin_spoken' | 'no_response'
  phrase_hash: string
  confidence: number
}

export type VoiceEventKind = 'duress_word' | 'safe_word' | 'checkin_spoken' | 'no_response'

// WebSocket
export interface WSMessage {
  type: 'ping' | 'escalation' | 'checkin_prompt' | 'status'
  level?: EscalationLevel
  reason?: string
  timestamp?: number
  deadline?: number
  lat?: number
  lon?: number
  status?: string
}

// API Response
export interface ApiError {
  detail: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// Geolocation
export interface GeocodeResult {
  lat: number
  lon: number
  address: string
  place_type: string
}

// Safe Points
export interface SafePoint {
  id: string
  name: string
  type: 'police' | 'shop' | 'hospital' | 'transit' | 'well_lit'
  lat: number
  lon: number
  distance_m: number
  opening_hours?: string
  is_open_now?: boolean
}

// Offline Queue
export type OfflineQueueType = 'sos' | 'report' | 'ping'

export interface OfflineQueueItem {
  id: string
  type: OfflineQueueType
  payload: unknown
  timestamp: number
  retries: number
}

// Push Notifications
export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, unknown>
  actions?: Array<{ action: string; title: string }>
}

// Demo
export interface DemoPair {
  id: string
  name: string
  origin: [number, number]
  destination: [number, number]
  mode: 'walk' | 'drive'
}

// Live Share
export interface LiveTripData {
  id: string
  status: string
  origin: [number, number]
  destination: [number, number]
  planned_route_geom?: { coordinates: [number, number][] }
  position?: [number, number]
}