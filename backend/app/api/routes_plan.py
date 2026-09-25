from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.schemas.core import RoutePlanRequest, RouteCandidate
from app.services.osrm_client import get_routes
from app.core.route_scorer import score_candidate_route, rank_routes

router = APIRouter(prefix="/routes", tags=["Routes"])

@router.post("/plan", response_model=list[RouteCandidate])
async def plan_route(req: RoutePlanRequest, db: Session = Depends(get_db)):
    # 1. Fetch raw candidates from OSRM
    raw_routes = await get_routes(tuple(req.origin), tuple(req.destination), req.mode)
    
    # 2. Segment and score candidates
    scored = []
    for r in raw_routes:
        res = score_candidate_route(db, r, req.depart_at, req.mode)
        scored.append(res)
        
    # 3. Rank
    ranked = rank_routes(scored)
    
    return ranked