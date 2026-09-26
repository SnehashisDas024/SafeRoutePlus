from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class OfflineSosEnvelope(BaseModel):
    protocol_version: int = Field(default=1, ge=1)
    message_id: str = Field(min_length=16, max_length=128)
    origin_device_id: str = Field(min_length=8, max_length=128)
    trip_id: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    hop_limit: int = Field(ge=1, le=16)
    hop_count: int = Field(ge=0, le=16)
    event_type: Literal["manual_sos", "voice_duress", "automatic"]
    approximate_location: Optional[dict[str, float]] = None
    payload_ciphertext: str = Field(min_length=1, max_length=8192)
    public_key: str = Field(min_length=32, max_length=256)
    signature: str = Field(min_length=32, max_length=256)


class OfflineSosIngestRequest(BaseModel):
    envelope: OfflineSosEnvelope
    gateway_device_id: Optional[str] = Field(default=None, max_length=128)
    relay_metadata: Optional[dict[str, Any]] = None


class OfflineSosIngestResponse(BaseModel):
    status: Literal["accepted", "duplicate", "rejected", "expired"]
    message_id: str
    ack_token: str
    escalation_level: Optional[str] = None