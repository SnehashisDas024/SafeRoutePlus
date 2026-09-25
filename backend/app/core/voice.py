import hashlib
import hmac

def verify_phrase(user_hash: str, spoken_hash: str) -> bool:
    """
    Constant time string comparison for hashes.
    """
    if not user_hash or not spoken_hash:
        return False
    return hmac.compare_digest(user_hash, spoken_hash)

def handle_voice_event(event_kind: str, phrase_hash: str, confidence: float, user_config: dict) -> str:
    """
    Returns the action to take based on the voice event.
    """
    if event_kind == "duress_word":
        if verify_phrase(user_config.get("duress_word_hash"), phrase_hash):
            return "escalate_l3_silent"
            
    if event_kind == "safe_word":
        # Low confidence safe word does NOT de-escalate.
        if confidence < 0.6:
            return "ignore"
        if verify_phrase(user_config.get("safe_word_hash"), phrase_hash):
            return "de_escalate"
            
    if event_kind == "checkin_spoken":
        return "de_escalate"
        
    return "ignore"

