from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.deps import get_current_user
from app.core.escalation import transition_escalation
from app.models.schema import EscalationLevel
from datetime import datetime

router = APIRouter(prefix="/trips", tags=["SOS"])

@router.post("/{trip_id}/sos")
async def trigger_sos(trip_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """
    Immediate manual escalation (jumps to L3)
    """
    # Trigger L3
    transition_escalation(db, trip_id, EscalationLevel.L3, "manual_sos")
    
    # In a real app, this would also push an event to the background task to notify Twilio
    return {"status": "escalated_l3"}

@router.post("/{trip_id}/checkin")
async def checkin_ok(trip_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """
    User manually says "I'm okay", de-escalates to L0.
    """
    transition_escalation(db, trip_id, EscalationLevel.L0, "manual_checkin")
    return {"status": "de_escalated"}

