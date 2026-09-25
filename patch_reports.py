import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\api\reports.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('router = APIRouter(prefix="/trips", tags=["Reports"])', 'router = APIRouter(tags=["Reports"])')
content = content.replace('@router.post("/{trip_id}/report"', '@router.post("/trips/{trip_id}/report"')

# Now append our new endpoints
new_endpoints = """
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
"""
content += new_endpoints

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated reports.py")
