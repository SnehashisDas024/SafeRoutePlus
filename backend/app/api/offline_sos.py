from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.escalation import transition_escalation
from app.core.offline_sos import (
    acknowledgement_token,
    is_expired,
    payload_hash,
    verify_envelope,
)
from app.deps import get_current_user
from app.models.database import get_db
from app.models.schema import EscalationLevel, OfflineSosEvent, Trip
from app.schemas.offline_sos import OfflineSosIngestRequest, OfflineSosIngestResponse

router = APIRouter(prefix="/offline-sos", tags=["Offline SOS"])


@router.post("/ingest", response_model=OfflineSosIngestResponse)
async def ingest_offline_sos(
    request: OfflineSosIngestRequest,
    db: Session = Depends(get_db),
    gateway_user_id: str = Depends(get_current_user),
):
    envelope = request.envelope
    if envelope.hop_count > envelope.hop_limit:
        raise HTTPException(status_code=400, detail="Invalid hop metadata")
    if is_expired(envelope):
        return OfflineSosIngestResponse(
            status="expired",
            message_id=envelope.message_id,
            ack_token=acknowledgement_token(envelope.message_id, envelope.signature),
        )
    if not verify_envelope(envelope):
        raise HTTPException(status_code=400, detail="Invalid SOS signature")

    digest = payload_hash(envelope)
    ack = acknowledgement_token(envelope.message_id, digest)
    existing = db.query(OfflineSosEvent).filter(
        OfflineSosEvent.message_id == envelope.message_id
    ).first()
    if existing:
        return OfflineSosIngestResponse(
            status="duplicate",
            message_id=envelope.message_id,
            ack_token=acknowledgement_token(existing.message_id, existing.payload_hash),
            escalation_level=EscalationLevel.L3.value,
        )

    trip = None
    if envelope.trip_id:
        trip = db.query(Trip).filter(Trip.id == envelope.trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

    received_at = datetime.now(timezone.utc).replace(tzinfo=None)
    event = OfflineSosEvent(
        message_id=envelope.message_id,
        trip_id=envelope.trip_id,
        user_id=trip.user_id if trip else gateway_user_id,
        origin_device_id=envelope.origin_device_id,
        origin_public_key=envelope.public_key,
        event_type=envelope.event_type,
        created_at=envelope.created_at.replace(tzinfo=None) if envelope.created_at.tzinfo else envelope.created_at,
        received_at=received_at,
        expires_at=envelope.expires_at.replace(tzinfo=None) if envelope.expires_at.tzinfo else envelope.expires_at,
        hop_count=envelope.hop_count,
        hop_limit=envelope.hop_limit,
        gateway_device_id=request.gateway_device_id,
        payload_hash=digest,
        relay_metadata=request.relay_metadata,
        status="accepted",
    )
    db.add(event)
    if trip:
        transition_escalation(db, trip.id, EscalationLevel.L3, "offline_ble_sos")
    db.commit()

    return OfflineSosIngestResponse(
        status="accepted",
        message_id=envelope.message_id,
        ack_token=ack,
        escalation_level=EscalationLevel.L3.value if trip else None,
    )