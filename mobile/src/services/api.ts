import { BASE_URL } from './config';

export interface RoutePlanRequest {
  origin: number[];
  destination: number[];
  mode: string;
  depart_at: string;
}

export interface RouteSegment {
  start: [number, number];
  end: [number, number];
  mid: [number, number];
  distance: number;
  h3_index: string;
  duration: number;
  predicted_arrival: string;
  score_data: {
    score: number;
    confidence: string;
    factors: Record<string, number>;
  };
}

export interface RouteCandidate {
  worst_segment_score: number;
  mean_segment_score: number;
  segments: RouteSegment[];
  total_time_sec: number;
}

export interface TripStartRequest {
  origin: number[];
  destination: number[];
  mode: string;
  planned_route_geom: any;
  planned_segments: RouteSegment[];
}

export interface TripStartResponse {
  trip_id: string;
  ws_token: string;
}

export interface EscalationState {
  level: string;
  reason: string;
}

export interface CheckinPayload {
  method: 'tap' | 'voice';
  phrase_hash?: string;
}

export interface VoiceEventPayload {
  kind: 'duress_word' | 'safe_word' | 'checkin_spoken' | 'no_response';
  phrase_hash: string;
  confidence: number;
}

export interface ReportPayload {
  rating: '🟢' | '🟡' | '🔴';
  tags?: string[];
  note?: string;
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'test_user_id',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const planRoute = async (req: RoutePlanRequest): Promise<RouteCandidate[]> => {
  return fetchApi<RouteCandidate[]>('/routes/plan', {
    method: 'POST',
    body: JSON.stringify(req),
  });
};

export const startTrip = async (data: TripStartRequest): Promise<TripStartResponse> => {
  return fetchApi<TripStartResponse>('/trips/start', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const getEscalation = async (tripId: string): Promise<EscalationState> => {
  return fetchApi<EscalationState>(`/trips/${tripId}/escalation`);
};

export const sendCheckin = async (tripId: string, payload: CheckinPayload) => {
  return fetchApi(`/trips/${tripId}/checkin`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const triggerSOS = async (tripId: string) => {
  return fetchApi(`/trips/${tripId}/sos`, {
    method: 'POST',
  });
};

export const sendVoiceEvent = async (tripId: string, payload: VoiceEventPayload) => {
  return fetchApi(`/trips/${tripId}/voice-event`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const sendReport = async (tripId: string, payload: ReportPayload) => {
  return fetchApi(`/trips/${tripId}/report`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const setVoiceConfig = async (safeWordHash: string, duressWordHash: string, enabled: boolean = true) => {
  return fetchApi('/users/voice-config', {
    method: 'POST',
    body: JSON.stringify({ safe_word_hash: safeWordHash, duress_word_hash: duressWordHash, enabled }),
  });
};

export const getShareToken = async (tripId: string): Promise<{ token: string }> => {
  return fetchApi<{ token: string }>(`/trips/${tripId}/share`);
};

export interface SuggestTagsResponse {
  tags: string[];
  confidence: number[];
}

export const suggestTags = async (note: string): Promise<SuggestTagsResponse> => {
  return fetchApi<SuggestTagsResponse>('/reports/suggest-tags', {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
};