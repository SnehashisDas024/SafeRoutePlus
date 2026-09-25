from fastapi import Header, HTTPException
from typing import Optional
from app.models.database import get_db

async def get_current_user(authorization: Optional[str] = Header(None)):
    # Mock JWT authentication for MVP
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return "test_user_id"

