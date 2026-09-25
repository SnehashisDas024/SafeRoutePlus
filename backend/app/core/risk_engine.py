from datetime import datetime
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models.schema import RiskCell

def score_cell(db: Session, h3_index: str, ts: datetime) -> Dict[str, Any]:
    """
    Given (h3_index, timestamp), returns the structured score object.
    Must always return {score, confidence, factors}.
    """
    hour = ts.hour
    dow = ts.weekday()
    
    # Query database
    cell = db.query(RiskCell).filter(
        RiskCell.h3_index == h3_index,
        RiskCell.hour == hour,
        RiskCell.dow == dow
    ).first()
    
    if cell:
        return {
            "score": cell.risk_score,
            "confidence": cell.confidence,
            "factors": {
                "lit_ratio": 0.0, # Placeholder for actual joined static features
                "police_dist": 0.0,
                "crowd": 0.0
            }
        }
    
    # Fallback if no cell data is found
    return {
        "score": 0.5, # Neutral/Medium risk fallback
        "confidence": "estimated",
        "factors": {}
    }

