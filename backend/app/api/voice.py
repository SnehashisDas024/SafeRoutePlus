from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.deps import get_current_user
from app.schemas.core import VoiceEventRequest, VoiceConfigRequest
from app.models.schema import VoiceConfig, VoiceEvent, EscalationLevel
from app.core.voice import handle_voice_event
from app.core.escalation import transition_escalation
from datetime import datetime
import os
import uuid
from groq import Groq

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

@router.post("/trips/{trip_id}/audio-stream")
async def process_audio_stream(
    trip_id: str, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    try:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            return {"action": "none", "error": "GROQ_API_KEY not set"}
            
        groq_client = Groq(api_key=api_key)
        
        # Save temp file
        import tempfile
        temp_file = os.path.join(tempfile.gettempdir(), f"temp_{uuid.uuid4()}.webm")
        with open(temp_file, "wb") as buffer:
            buffer.write(await file.read())
            
        with open(temp_file, "rb") as audio:
            transcription = groq_client.audio.transcriptions.create(
                file=(temp_file, audio.read()),
                model="whisper-large-v3",
                response_format="text"
            )
            
        if os.path.exists(temp_file):
            os.remove(temp_file)
            
        transcript = str(transcription).strip()
        print(f"[VOICE] Trip {trip_id} Transcript: {transcript}")
        if not transcript or len(transcript) < 3:
            return {"action": "none", "transcript": transcript}
            
        # Sentiment analysis
        completion = groq_client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a safety AI. Analyze the following transcript captured during a trip. If the person seems to be in danger, distressed, harassed, or facing unfavourable conditions, output exactly 'YES'. Otherwise output 'NO'."
                },
                {"role": "user", "content": transcript}
            ],
            temperature=0
        )
        
        sentiment = completion.choices[0].message.content.strip().upper()
        print(f"[VOICE] Trip {trip_id} Sentiment: {sentiment}")
        
        if "YES" in sentiment:
            return {"action": "trigger_sos", "transcript": transcript}
            
        return {"action": "none", "transcript": transcript}
    except Exception as e:
        print("Error processing audio:", e)
        if 'temp_file' in locals() and os.path.exists(temp_file):
            os.remove(temp_file)
        return {"action": "error", "message": str(e)}
