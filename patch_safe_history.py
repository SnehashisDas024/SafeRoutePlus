import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\api\safe_routes.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update SafePlanRequest
old_class = """class SafePlanRequest(BaseModel):
    origin: List[float]       # [lon, lat]
    destination: List[float]  # [lon, lat]
    mode: str = "walk"
    depart_at: Optional[datetime] = None
    depart_hour: Optional[int] = None
    prefetched_routes: Optional[List[dict]] = None"""

new_class = """class SafePlanRequest(BaseModel):
    origin: List[float]       # [lon, lat]
    destination: List[float]  # [lon, lat]
    mode: str = "walk"
    depart_at: Optional[datetime] = None
    depart_hour: Optional[int] = None
    prefetched_routes: Optional[List[dict]] = None
    origin_name: Optional[str] = None
    destination_name: Optional[str] = None"""

content = content.replace(old_class, new_class)

# 2. Add imports
old_imports = """from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional"""

new_imports = """from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.api.routes_plan import _upsert_route_history
from app.deps import get_current_user"""

content = content.replace(old_imports, new_imports)

# 3. Update router signature and call _upsert_route_history
old_sig = """@router.post("/safe-plan", response_model=List[ScoredRoute])
async def safe_plan(req: SafePlanRequest):"""

new_sig = """@router.post("/safe-plan", response_model=List[ScoredRoute])
async def safe_plan(
    req: SafePlanRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):"""

content = content.replace(old_sig, new_sig)

old_ret = """    # Secondary sort: tie-breaker by duration (fastest first if tie)
    scored_routes.sort(key=lambda r: (r.safety_score, -r.total_time_sec), reverse=True)

    return scored_routes"""

new_ret = """    # Secondary sort: tie-breaker by duration (fastest first if tie)
    scored_routes.sort(key=lambda r: (r.safety_score, -r.total_time_sec), reverse=True)

    # Upsert to history!
    try:
        user_id = "test_user_id" if authorization else "test_user_id" # Force mock user for MVP demo
        if user_id and len(scored_routes) > 0:
            # We map SafePlanRequest back to RoutePlanRequest structure for _upsert_route_history
            from app.schemas.core import RoutePlanRequest
            mock_req = RoutePlanRequest(
                origin=req.origin,
                destination=req.destination,
                origin_name=req.origin_name,
                destination_name=req.destination_name,
                mode=req.mode,
                depart_at=req.depart_at or datetime.utcnow().isoformat()
            )
            _upsert_route_history(db, user_id, mock_req)
    except Exception as e:
        pass # Don't fail the routing if history fails

    return scored_routes"""

content = content.replace(old_ret, new_ret)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched safe_routes.py with _upsert_route_history!")
