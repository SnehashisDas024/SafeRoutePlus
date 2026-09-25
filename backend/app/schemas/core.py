from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class RoutePlanRequest(BaseModel):
    origin: List[float] # [lon, lat]
    destination: List[float] # [lon, lat]
    mode: str = "walk"
    depart_at: datetime = Field(default_factory=datetime.utcnow)

class RouteCandidate(BaseModel):
    worst_segment_score: float
    mean_segment_score: float
    segments: List[dict]
    total_time_sec: float

class TripStartRequest(BaseModel):
    origin: List[float]
    destination: List[float]
    mode: str
    planned_route_geom: dict
    planned_segments: List[dict]

class VoiceEventRequest(BaseModel):
    kind: str
    phrase_hash: str
    confidence: float

class VoiceConfigRequest(BaseModel):
    safe_word_hash: str
    duress_word_hash: str
    enabled: bool = True

class ReportRequest(BaseModel):
    rating: str
    tags: Optional[List[str]] = []
    note: Optional[str] = None

