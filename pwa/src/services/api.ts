import { BASE_URL, ENDPOINTS } from './config'
import type {
  RoutePlanRequest,
  RouteCandidate,
  RouteHistoryItem,
  TripStartRequest,

  TripStartResponse,
  EscalationState,
  Trip,
  Alert,
  Contact,
  ReportPayload,
  Report,
  VoiceConfig,
  VoiceEvent,
  TagSuggestion,
  SafePoint,
  GPSPoint,
} from '../types'

const AUTH_TOKEN = 'test_user_id'

class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTH_TOKEN,
        ...options.headers,
      },
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const rawText = await res.text()
      let errorDetail: any
      try {
        errorDetail = JSON.parse(rawText)
      } catch {
        errorDetail = rawText
      }

      let errorMessage = `HTTP ${res.status}`
      if (typeof errorDetail === 'string') {
        errorMessage = errorDetail
      } else if (errorDetail && typeof errorDetail === 'object') {
        if (typeof errorDetail.detail === 'string') {
          errorMessage = errorDetail.detail
        } else if (Array.isArray(errorDetail.detail)) {
          errorMessage = errorDetail.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
        } else {
          errorMessage = JSON.stringify(errorDetail)
        }
      }
      throw new ApiError(res.status, errorMessage, errorDetail)
    }

    if (res.status === 204) return undefined as T
    return res.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, 'Request timeout')
    }
    throw new ApiError(0, error instanceof Error ? error.message : 'Network error')
  }
}

// Routes
export const planRoute = (req: RoutePlanRequest): Promise<RouteCandidate[]> =>
  fetchApi<RouteCandidate[]>(ENDPOINTS.routes.plan, {
    method: 'POST',
    body: JSON.stringify(req),
  })

export const getRecentRoutes = (limit: number = 10): Promise<RouteHistoryItem[]> =>
  fetchApi<RouteHistoryItem[]>(`${ENDPOINTS.routes.history}?limit=${limit}`)

export const getFrequentRoutes = (limit: number = 10): Promise<RouteHistoryItem[]> =>
  fetchApi<RouteHistoryItem[]>(`${ENDPOINTS.routes.frequent}?limit=${limit}`)


// Trips
export const startTrip = (data: TripStartRequest): Promise<TripStartResponse> =>
  fetchApi<TripStartResponse>(ENDPOINTS.trips.start, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const getEscalation = (tripId: string): Promise<EscalationState> =>
  fetchApi<EscalationState>(ENDPOINTS.trips.escalation(tripId))

export const sendCheckin = (tripId: string, method: 'tap' | 'voice'): Promise<void> =>
  fetchApi<void>(ENDPOINTS.trips.checkin(tripId), {
    method: 'POST',
    body: JSON.stringify({ method }),
  })

export const triggerSOS = (tripId: string): Promise<void> =>
  fetchApi<void>(ENDPOINTS.trips.sos(tripId), { method: 'POST' })

export const sendVoiceEvent = (tripId: string, event: VoiceEvent): Promise<void> =>
  fetchApi<void>(ENDPOINTS.trips.voiceEvent(tripId), {
    method: 'POST',
    body: JSON.stringify(event),
  })

export const sendReport = (tripId: string, payload: ReportPayload): Promise<Report> =>
  fetchApi<Report>(ENDPOINTS.trips.report(tripId), {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const getTrips = (): Promise<Trip[]> =>
  fetchApi<Trip[]>('/trips')

export const getAlerts = (): Promise<Alert[]> =>
  fetchApi<Alert[]>('/trips/alerts')

export const getShareData = (token: string): Promise<{
  id: string
  status: string
  origin: [number, number]
  destination: [number, number]
  planned_route_geom?: { coordinates: [number, number][] }
  position?: [number, number]
  mode: string
}> => fetchApi(ENDPOINTS.share(token))

// Contacts
export const getContacts = (): Promise<Contact[]> =>
  fetchApi<Contact[]>(ENDPOINTS.contacts.list)

export const createContact = (data: Omit<Contact, 'id' | 'user_id'>): Promise<Contact> =>
  fetchApi<Contact>(ENDPOINTS.contacts.create, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateContact = (id: string, data: Partial<Contact>): Promise<Contact> =>
  fetchApi<Contact>(ENDPOINTS.contacts.update(id), {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteContact = (id: string): Promise<void> =>
  fetchApi<void>(ENDPOINTS.contacts.delete(id), { method: 'DELETE' })

// Reports
export const suggestTags = (note: string): Promise<{ tags: string[]; confidence: number[] }> =>
  fetchApi<{ tags: string[]; confidence: number[] }>(ENDPOINTS.reports.suggestTags, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })

export const retrainTags = (): Promise<{ status: string; samples?: number; reason?: string }> =>
  fetchApi(ENDPOINTS.reports.retrain, { method: 'POST' })

// Voice Config
export const setVoiceConfig = (config: VoiceConfig): Promise<void> =>
  fetchApi<void>(ENDPOINTS.users.voiceConfig, {
    method: 'POST',
    body: JSON.stringify({
      safe_word_hash: config.safeWordHash,
      duress_word_hash: config.duressWordHash,
      enabled: config.enabled,
    }),
  })

export const getVoiceConfig = (): Promise<VoiceConfig | null> =>
  fetchApi<VoiceConfig | null>(ENDPOINTS.users.voiceConfig, { method: 'GET' }).catch(() => null)

// Safe Points
export const getNearestSafePoints = (lat: number, lon: number, radius = 500): Promise<SafePoint[]> =>
  fetchApi<SafePoint[]>(`/safe-points/nearest?lat=${lat}&lon=${lon}&radius=${radius}`)

export { ApiError, BASE_URL }