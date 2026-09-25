from app.config import settings
import logging

logger = logging.getLogger(__name__)

async def send_push_notification(token: str, title: str, body: str, data: dict = None):
    """
    Send Push notification via Firebase Cloud Messaging.
    Includes fallback to log if credentials are not provided.
    """
    if not settings.FCM_SERVICE_ACCOUNT_JSON_PATH:
        logger.warning(f"MOCK PUSH to {token}: {title} - {body} - {data}")
        return
        
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(settings.FCM_SERVICE_ACCOUNT_JSON_PATH)
            firebase_admin.initialize_app(cred)
            
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=token,
        )
        response = messaging.send(message)
        logger.info(f"Sent FCM message ID: {response}")
    except Exception as e:
        logger.error(f"Failed to send push: {e}")

