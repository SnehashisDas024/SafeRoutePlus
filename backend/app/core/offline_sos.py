import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from app.schemas.offline_sos import OfflineSosEnvelope


def canonical_envelope(envelope: OfflineSosEnvelope) -> bytes:
    payload = envelope.model_dump(mode="json", exclude={"signature"}, exclude_none=True)
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def verify_envelope(envelope: OfflineSosEnvelope) -> bool:
    try:
        public_key = Ed25519PublicKey.from_public_bytes(base64.b64decode(envelope.public_key))
        signature = base64.b64decode(envelope.signature)
        public_key.verify(signature, canonical_envelope(envelope))
        return True
    except (ValueError, TypeError, Exception):
        return False


def payload_hash(envelope: OfflineSosEnvelope) -> str:
    return hashlib.sha256(canonical_envelope(envelope)).hexdigest()


def acknowledgement_token(message_id: str, payload_digest: str) -> str:
    return hashlib.sha256(f"{message_id}:{payload_digest}".encode("utf-8")).hexdigest()


def is_expired(envelope: OfflineSosEnvelope, now: datetime | None = None) -> bool:
    current = now or datetime.now(timezone.utc)
    expiry = envelope.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    return expiry <= current