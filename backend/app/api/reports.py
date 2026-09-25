from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.schema import Report, Trip
from app.deps import get_current_user
from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime

router = APIRouter(tags=["Reports"])

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

@router.post("/trips/{trip_id}/report", response_model=ReportResponse)
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
import h3
from app.models.schema import UserTrust

class CommunityReportRequest(BaseModel):
    lat: float
    lon: float
    rating: str
    tags: Optional[List[str]] = []
    note: Optional[str] = None

@router.post("/reports/community")
async def submit_community_report(
    req: CommunityReportRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user)
):
    # Rate limit: 1 report / user / cell / day
    h3_idx = h3.latlng_to_cell(req.lat, req.lon, 9)
    today = datetime.utcnow().date()
    
    existing = db.query(Report).filter(
        Report.user_id == user_id,
        Report.h3_index == h3_idx,
        Report.source == 'community'
    ).first()
    
    if existing and existing.ts.date() == today:
        raise HTTPException(status_code=429, detail="Only one community report per cell per day allowed")
        
    report = Report(
        id=str(uuid.uuid4()),
        user_id=user_id,
        trip_id=None,
        h3_index=h3_idx,
        rating=req.rating,
        tags=req.tags,
        note=req.note,
        source='community',
        ts=datetime.utcnow()
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"status": "success", "report_id": report.id}

@router.get("/reports/community/nearby")
async def get_nearby_community_reports(
    lat: float,
    lon: float,
    radius: float = 5.0,  # km
    db: Session = Depends(get_db)
):
    h3_idx = h3.latlng_to_cell(lat, lon, 9)
    # Get neighbors to simulate radius (k-ring 2 roughly covers ~2-3km for res 9, let's use k=3)
    neighbors = h3.k_ring(h3_idx, 3)
    
    reports = db.query(Report).filter(
        Report.h3_index.in_(neighbors),
        Report.source == 'community'
    ).order_by(Report.ts.desc()).limit(50).all()
    
    # We might need to return lat/lon for pins. Let's just use the H3 center for now
    results = []
    for r in reports:
        cell_lat, cell_lon = h3.cell_to_latlng(r.h3_index)
        results.append({
            "id": r.id,
            "lat": cell_lat,
            "lon": cell_lon,
            "rating": r.rating,
            "tags": r.tags,
            "note": r.note,
            "ts": r.ts
        })
    return results
