from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.deps import get_current_user
from app.schemas.core import VoiceEventRequest, VoiceConfigRequest
from app.models.schema import VoiceConfig, VoiceEvent, EscalationLevel
from app.core.voice import handle_voice_event
from app.core.escalation import transition_escalation
from datetime import datetime

router = APIRouter(tags=["Voice"])

@router.get("/users/voice-config")
async def get_voice_config(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    config = db.query(VoiceConfig).filter(VoiceConfig.user_id == user_id).first()
    if not config:
        return {"safe_word_hash": "", "duress_word_hash": "", "enabled": True}
    return {
        "safe_word_hash": config.safe_word_hash,
        "duress_word_hash": config.duress_word_hash,
        "enabled": config.enabled
    }

@router.post("/users/voice-config")
async def set_voice_config(req: VoiceConfigRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    config = db.query(VoiceConfig).filter(VoiceConfig.user_id == user_id).first()
    if not config:
        config = VoiceConfig(user_id=user_id)
        db.add(config)
        
    config.safe_word_hash = req.safe_word_hash
    config.duress_word_hash = req.duress_word_hash
    config.enabled = req.enabled
    db.commit()
    return {"status": "success"}

@router.post("/trips/{trip_id}/voice-event")
async def submit_voice_event(trip_id: str, req: VoiceEventRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    config = db.query(VoiceConfig).filter(VoiceConfig.user_id == user_id).first()
    if not config or not config.enabled:
        return {"status": "ignored"}
        
    action = handle_voice_event(req.kind, req.phrase_hash, req.confidence, {
        "duress_word_hash": config.duress_word_hash,
        "safe_word_hash": config.safe_word_hash
    })
    
    if action == "escalate_l3_silent":
        transition_escalation(db, trip_id, EscalationLevel.L3, "voice_duress")
    elif action == "de_escalate":
        transition_escalation(db, trip_id, EscalationLevel.L0, "voice_safe_word")
        
    # Log event
    import uuid
    evt = VoiceEvent(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        kind=req.kind,
        transcript_hash=req.phrase_hash,
        confidence=req.confidence,
        ts=datetime.utcnow()
    )
    db.add(evt)
    db.commit()
    
    return {"action": action}