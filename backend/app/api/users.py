from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import datetime

from app.models.database import get_db
from app.models.schema import User, UserTrust, Trip
from app.deps import get_current_user

router = APIRouter(tags=["Users"])

class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str]
    trust_score: float
    total_trips: int

@router.get("/users/me", response_model=UserProfileResponse)
def get_my_profile(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    trust = db.query(UserTrust).filter(UserTrust.user_id == user_id).first()
    trust_score = trust.trust_score if trust else 1.0
    
    total_trips = db.query(Trip).filter(Trip.user_id == user_id).count()
    
    return {
        "id": user.id,
        "name": user.name or "User",
        "email": user.email or "",
        "phone": user.phone,
        "trust_score": trust_score,
        "total_trips": total_trips
    }
