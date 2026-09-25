from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/saferoute"
    JWT_SECRET_KEY: Optional[str] = None
    OSRM_BASE_URL: str = "http://localhost:5000"
    
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None
    
    FCM_SERVICE_ACCOUNT_JSON_PATH: Optional[str] = None
    
    CHECKIN_WINDOW_SEC: int = 45
    ESCALATION_SUSTAINED_SEC: int = 300
    ALERT_COOLDOWN_SEC: int = 300
    
    MAPBOX_ACCESS_TOKEN: Optional[str] = None
    MINIO_ACCESS_KEY: Optional[str] = None
    MINIO_SECRET_KEY: Optional[str] = None

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env"),
        extra="ignore"
    )

settings = Settings()

