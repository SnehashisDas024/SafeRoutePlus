import base64
import unittest
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from backend.app.core.offline_sos import canonical_envelope, is_expired, verify_envelope
from backend.app.schemas.offline_sos import OfflineSosEnvelope


class OfflineSosProtocolTests(unittest.TestCase):
    def make_envelope(self, expires_at=None):
        now = datetime.now(timezone.utc)
        key = Ed25519PrivateKey.generate()
        unsigned = OfflineSosEnvelope(
            message_id="message-1234567890",
            origin_device_id="device-12345678",
            trip_id="trip-1",
            created_at=now,
            expires_at=expires_at or now + timedelta(minutes=15),
            hop_limit=8,
            hop_count=0,
            event_type="manual_sos",
            payload_ciphertext="encrypted-payload",
            public_key=base64.b64encode(key.public_key().public_bytes_raw()).decode(),
            signature="placeholder-signature-0000000000000000",
        )
        signature = base64.b64encode(key.sign(canonical_envelope(unsigned))).decode()
        return unsigned.model_copy(update={"signature": signature})

    def test_valid_signature_is_accepted(self):
        self.assertTrue(verify_envelope(self.make_envelope()))

    def test_tampering_invalidates_signature(self):
        envelope = self.make_envelope()
        tampered = envelope.model_copy(update={"hop_count": 1})
        self.assertFalse(verify_envelope(tampered))

    def test_expired_envelope_is_rejected(self):
        expired = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.assertTrue(is_expired(self.make_envelope(expired)))


if __name__ == "__main__":
    unittest.main()
