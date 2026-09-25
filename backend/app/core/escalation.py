from datetime import datetime, timedelta
from app.models.schema import EscalationState, Alert, EscalationLevel
from sqlalchemy.orm import Session
from app.config import settings

def transition_escalation(db: Session, trip_id: str, new_level: EscalationLevel, reason: str, ts: datetime = None):
    if not ts:
        ts = datetime.utcnow()
        
    state = db.query(EscalationState).filter(EscalationState.trip_id == trip_id).first()
    if not state:
        state = EscalationState(trip_id=trip_id, level=EscalationLevel.L0.value, entered_at=ts)
        db.add(state)
        
    # Validate transition
    current = EscalationLevel(state.level)
    
    if new_level == EscalationLevel.L3 and current not in [EscalationLevel.L0, EscalationLevel.L1, EscalationLevel.L2, EscalationLevel.L3]:
        # Always allow jumping to L3
        pass
    elif new_level == EscalationLevel.L0:
        # User manually cleared
        state.checkin_deadline = None
    elif new_level.value > current.value:
        # Enforce step-by-step
        expected_next_idx = list(EscalationLevel).index(current) + 1
        if expected_next_idx < len(EscalationLevel) and list(EscalationLevel)[expected_next_idx] != new_level and new_level != EscalationLevel.L3:
            # Force to go through L2
            new_level = EscalationLevel.L2
            
    # Apply new level
    state.level = new_level.value
    state.entered_at = ts
    state.reason = reason
    
    if new_level == EscalationLevel.L2:
        state.checkin_deadline = ts + timedelta(seconds=settings.CHECKIN_WINDOW_SEC)
        
    # Log alert
    alert = Alert(trip_id=trip_id, level=new_level.value, type=reason, triggered_at=ts)
    db.add(alert)
    db.commit()
    return state

