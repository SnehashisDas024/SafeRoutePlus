from app.config import settings
import logging

logger = logging.getLogger(__name__)

async def send_sms(to_number: str, message: str):
    """
    Send SMS via Twilio.
    Includes fallback to log if credentials are not provided.
    """
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_FROM_NUMBER:
        logger.warning(f"MOCK SMS to {to_number}: {message}")
        return
        
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        
        message = client.messages.create(
            body=message,
            from_=settings.TWILIO_FROM_NUMBER,
            to=to_number
        )
        logger.info(f"Sent SMS SID: {message.sid}")
    except Exception as e:
        logger.error(f"Failed to send SMS: {e}")

