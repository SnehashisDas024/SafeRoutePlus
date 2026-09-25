// SafeRoute+ Frontend - Shared Types

export interface GPSPoint {
  lat: number
  lon: number
  speed: number
  accuracy: number
  timestamp: number
}

export interface RouteSegment {
  start: [number, number]
  end: [number, number]
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

export interface RoutePointInfo {
  name?: string
  coordinates: [number, number]
}

export interface RouteHistoryItem {
  id: string
  origin: RoutePointInfo
  destination: RoutePointInfo
  mode: 'walk' | 'drive'
  use_count: number
  last_used_at: string
  created_at?: string
}

export interface RoutePlanRequest {
  origin: [number, number]
  destination: [number, number]
  origin_name?: string
  destination_name?: string
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
}

export type EscalationLevel = 'L0_Normal' | 'L1_Watch' | 'L2_Checkin' | 'L3_Alert' | 'L4_Sustained'

export interface EscalationState {
  level: EscalationLevel
  reason: string
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

export interface Contact {
  id: string
  user_id: string
  name: string
  phone: string
  tier: 'primary' | 'secondary'
  priority: number
}

// NOTE: keep these literal emoji - the backend RATING_RISK map (risk_constants.py) is keyed by them.
export type Rating = '🟢' | '🟡' | '🔴'

export interface ReportPayload {
  rating: Rating
  tags?: string[]
  note?: string
}

export interface VoiceConfig {
  safeWordHash: string
  duressWordHash: string
  enabled: boolean
}

export interface WSMessage {
  type: 'ping' | 'escalation' | 'checkin_prompt' | 'status'
  level?: EscalationLevel
  reason?: string
  trigger_source?: string
  deadline?: number
  status?: string
}

export interface PlanNavState {
  routes: RouteCandidate[]
  origin: [number, number]
  destination: [number, number]
  mode: 'walk' | 'drive'
}

export const ESCALATION_COLORS: Record<EscalationLevel, string> = {
  L0_Normal: '#4E9FDB',
  L1_Watch: '#E8A13A',
  L2_Checkin: '#E8A13A',
  L3_Alert: '#E05B54',
  L4_Sustained: '#B23E38',
}

export const ESCALATION_LABELS: Record<EscalationLevel, string> = {
  L0_Normal: 'Normal',
  L1_Watch: 'Watch',
  L2_Checkin: 'Check-in',
  L3_Alert: 'Alert',
  L4_Sustained: 'Sustained',
}

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
