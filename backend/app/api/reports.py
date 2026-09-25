from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.schema import Report, Trip
from app.deps import get_current_user
from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime

router = APIRouter(prefix="/trips", tags=["Reports"])

class ReportRequest(BaseModel):
    rating: str  # '🟢' | '🟡' | '🔴'
    tags: Optional[List[str]] = []
    note: Optional[str] = None

class ReportResponse(BaseModel):
    id: str
    trip_id: str
    h3_index: str
    rating: str
    tags: List[str]
    note: Optional[str]
    ts: datetime

    class Config:
        from_attributes = True

@router.post("/{trip_id}/report", response_model=ReportResponse)
async def submit_report(trip_id: str, req: ReportRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    # Verify trip belongs to user
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == user_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.status != 'completed' and trip.status != 'active':
        raise HTTPException(status_code=400, detail="Can only report on completed or active trips")
    
    # Get the last GPS ping to determine H3 cell
    from app.models.schema import GpsPing
    from app.models.database import SessionLocal
    import h3
    
    last_ping = db.query(GpsPing).filter(GpsPing.trip_id == trip_id).order_by(GpsPing.ts.desc()).first()
    
    if last_ping:
        from geoalchemy2.shape import to_shape
        pt = to_shape(last_ping.geom)
        h3_idx = h3.latlng_to_cell(pt.y, pt.x, 9)
    else:
        # Fallback to destination
        from geoalchemy2.shape import to_shape
        pt = to_shape(trip.dest_geom)
        h3_idx = h3.latlng_to_cell(pt.y, pt.x, 9)
    
    report = Report(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        h3_index=h3_idx,
        rating=req.rating,
        tags=req.tags,
        note=req.note,
        ts=datetime.utcnow()
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    # Mark trip as completed
    trip.status = 'completed'
    db.commit()
    
    return report