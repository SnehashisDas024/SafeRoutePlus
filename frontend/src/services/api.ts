import { BASE_URL, AUTH_TOKEN } from './config'
import type {
  RoutePlanRequest,
  RouteCandidate,
  TripStartRequest,
  TripStartResponse,
  EscalationState,
  Trip,
  Alert,
  Contact,
  ReportPayload,
  VoiceConfig,
} from '../types'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: AUTH_TOKEN,
        ...options.headers,
      },
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try {
        const data = await res.json()
        if (typeof data.detail === 'string') msg = data.detail
      } catch { /* keep default */ }
      throw new ApiError(res.status, msg)
    }
    return res.json() as Promise<T>
  } catch (e) {
    clearTimeout(timeoutId)
    if (e instanceof ApiError) throw e
    if (e instanceof DOMException && e.name === 'AbortError') throw new ApiError(408, 'Request timed out')
    throw new ApiError(0, 'Cannot reach the SafeRoute server. Is the backend running?')
  }
}

// Routes
export const planRoute = (req: RoutePlanRequest): Promise<RouteCandidate[]> =>
  fetchApi<RouteCandidate[]>('/routes/plan', { method: 'POST', body: JSON.stringify(req) })

// Trips
export const startTrip = (data: TripStartRequest): Promise<TripStartResponse> =>
  fetchApi<TripStartResponse>('/trips/start', { method: 'POST', body: JSON.stringify(data) })

export const getEscalation = (tripId: string): Promise<EscalationState> =>
  fetchApi<EscalationState>(`/trips/${tripId}/escalation`)

export const sendCheckin = (tripId: string): Promise<{ status: string }> =>
  fetchApi<{ status: string }>(`/trips/${tripId}/checkin`, { method: 'POST', body: JSON.stringify({}) })

export const triggerSOS = (tripId: string): Promise<{ status: string }> =>
  fetchApi<{ status: string }>(`/trips/${tripId}/sos`, { method: 'POST', body: JSON.stringify({}) })

export const sendVoiceEvent = (
  tripId: string,
  event: { kind: string; phrase_hash: string; confidence: number },
): Promise<{ action?: string; status?: string }> =>
  fetchApi(`/trips/${tripId}/voice-event`, { method: 'POST', body: JSON.stringify(event) })

export const sendReport = (tripId: string, payload: ReportPayload): Promise<unknown> =>
  fetchApi(`/trips/${tripId}/report`, { method: 'POST', body: JSON.stringify(payload) })

export const getTrips = (): Promise<Trip[]> => fetchApi<Trip[]>('/trips')
export const getAlerts = (): Promise<Alert[]> => fetchApi<Alert[]>('/trips/alerts')

export interface ShareData {
  id: string
  status: string
  origin: [number, number]
  destination: [number, number]
  planned_route_geom?: { coordinates: [number, number][] }
  position?: [number, number]
  mode: string
}
export const getShareData = (token: string): Promise<ShareData> =>
  fetchApi<ShareData>(`/share/${token}`)

// Contacts
export const getContacts = (): Promise<Contact[]> => fetchApi<Contact[]>('/contacts')
export const createContact = (data: { name: string; phone: string; tier: string; priority: number }): Promise<Contact> =>
  fetchApi<Contact>('/contacts', { method: 'POST', body: JSON.stringify(data) })
export const updateContact = (id: string, data: Partial<Contact>): Promise<Contact> =>
  fetchApi<Contact>(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteContact = (id: string): Promise<void> =>
  fetchApi(`/contacts/${id}`, { method: 'DELETE' })

// Reports / tags
export const suggestTags = (note: string): Promise<{ tags: string[]; confidence: number[] }> =>
  fetchApi('/reports/suggest-tags', { method: 'POST', body: JSON.stringify({ note }) })

// Voice config
export const getVoiceConfig = (): Promise<{ safe_word_hash: string; duress_word_hash: string; enabled: boolean }> =>
  fetchApi('/users/voice-config')
export const setVoiceConfig = (c: { safe_word_hash: string; duress_word_hash: string; enabled: boolean }): Promise<void> =>
  fetchApi('/users/voice-config', { method: 'POST', body: JSON.stringify(c) })

export { ApiError, BASE_URL }
