from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.models.database import get_db
from app.deps import get_current_user
from app.core.tag_suggester import TagSuggester

router = APIRouter(prefix="/reports", tags=["Tags"])

class SuggestRequest(BaseModel):
    note: str

class SuggestResponse(BaseModel):
    tags: List[str]
    confidence: List[float]

class RetrainResponse(BaseModel):
    status: str
    samples: Optional[int] = None
    reason: Optional[str] = None


@router.post("/suggest-tags", response_model=SuggestResponse)
async def suggest_tags(req: SuggestRequest, user_id: str = Depends(get_current_user)):
    """
    Get tag suggestions for a note as user types.
    Returns top-3 tags with confidence >= 0.3.
    """
    suggester = TagSuggester.load()
    results = suggester.predict(req.note, top_k=3, min_conf=0.3)
    return {
        "tags": [t for t, _ in results],
        "confidence": [c for _, c in results]
    }


@router.post("/retrain", response_model=RetrainResponse)
async def retrain_tags(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """
    Retrain the tag suggester model from all reports in the database.
    Called automatically by aggregator, can also be triggered manually.
    """
    suggester = TagSuggester()
    result = suggester.retrain_from_db(db)
    return result