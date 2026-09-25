import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import get_db
from app.models.schema import RouteHistory
from app.schemas.core import RoutePlanRequest, RouteCandidate, RouteHistoryItem, RoutePointInfo
from app.services.osrm_client import get_routes
from app.core.route_scorer import score_candidate_route, rank_routes
from app.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/routes", tags=["Routes"])

def _normalize_coord(val: float) -> float:
    return round(float(val), 5)

def _to_history_item(row: RouteHistory) -> RouteHistoryItem:
    return RouteHistoryItem(
        id=row.id,
        origin=RoutePointInfo(
            name=row.origin_name,
            coordinates=[row.origin_lon, row.origin_lat]
        ),
        destination=RoutePointInfo(
            name=row.destination_name,
            coordinates=[row.destination_lon, row.destination_lat]
        ),
        mode=row.mode,
        use_count=row.use_count,
        last_used_at=row.last_used_at,
        created_at=row.created_at,
    )

def _upsert_route_history(
    db: Session,
    user_id: str,
    req: RoutePlanRequest
) -> Optional[RouteHistory]:
    try:
        norm_orig_lon = _normalize_coord(req.origin[0])
        norm_orig_lat = _normalize_coord(req.origin[1])
        norm_dest_lon = _normalize_coord(req.destination[0])
        norm_dest_lat = _normalize_coord(req.destination[1])
        travel_mode = (req.mode or "walk").lower()

        # Find existing history record for this user and route
        existing = db.query(RouteHistory).filter(
            RouteHistory.user_id == user_id,
            RouteHistory.origin_lon == norm_orig_lon,
            RouteHistory.origin_lat == norm_orig_lat,
            RouteHistory.destination_lon == norm_dest_lon,
            RouteHistory.destination_lat == norm_dest_lat,
            RouteHistory.mode == travel_mode,
        ).first()

        now = datetime.utcnow()
        if existing:
            existing.use_count += 1
            existing.last_used_at = now
            if req.origin_name:
                existing.origin_name = req.origin_name
            if req.destination_name:
                existing.destination_name = req.destination_name
            db.commit()
            db.refresh(existing)
            return existing
        else:
            new_item = RouteHistory(
                user_id=user_id,
                origin_name=req.origin_name,
                origin_lon=norm_orig_lon,
                origin_lat=norm_orig_lat,
                destination_name=req.destination_name,
                destination_lon=norm_dest_lon,
                destination_lat=norm_dest_lat,
                mode=travel_mode,
                use_count=1,
                last_used_at=now,
                created_at=now,
            )
            db.add(new_item)
            db.commit()
            db.refresh(new_item)
            return new_item
    except Exception as e:
        db.rollback()
        logger.exception("Failed to upsert route history: %s", e)
        return None

@router.post("/plan", response_model=list[RouteCandidate])
async def plan_route(
    req: RoutePlanRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    if len(req.origin) != 2 or len(req.destination) != 2:
        raise HTTPException(status_code=422, detail="Origin and destination must be [lon, lat] coordinates")

    # 1. Fetch raw candidates from OSRM
    raw_routes = await get_routes(tuple(req.origin), tuple(req.destination), req.mode)
    
    # 2. Segment and score candidates
    scored = []
    for r in raw_routes:
        res = score_candidate_route(db, r, req.depart_at, req.mode)
        scored.append(res)
        
    # 3. Rank
    ranked = rank_routes(scored)

    # 4. Asynchronously or gracefully upsert to history if user is authenticated or demo user provided
    if ranked:
        user_id = "test_user_id" if authorization else None
        if authorization:
            try:
                user_id = await get_current_user(authorization)
            except Exception:
                user_id = None
        
        # If user_id resolved, record in route history non-blockingly
        if user_id:
            _upsert_route_history(db, user_id, req)

    return ranked

@router.get("/history", response_model=List[RouteHistoryItem])
async def get_recent_history(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user)
):
    """
    Get recent routes for the authenticated user, ordered by last_used_at desc.
    """
    items = (
        db.query(RouteHistory)
        .filter(RouteHistory.user_id == user_id)
        .order_by(desc(RouteHistory.last_used_at))
        .limit(limit)
        .all()
    )
    return [_to_history_item(item) for item in items]

@router.get("/history/frequent", response_model=List[RouteHistoryItem])
async def get_frequent_history(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user)
):
    """
    Get frequently planned routes for the authenticated user, ordered by use_count desc, then last_used_at desc.
    """
    items = (
        db.query(RouteHistory)
        .filter(RouteHistory.user_id == user_id)
        .order_by(desc(RouteHistory.use_count), desc(RouteHistory.last_used_at))
        .limit(limit)
        .all()
    )
    return [_to_history_item(item) for item in items]
