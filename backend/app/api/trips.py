from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.schema import Trip, EscalationLevel, Alert
from app.schemas.core import TripStartRequest
from app.deps import get_current_user
import uuid
from datetime import datetime
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point, LineString, mapping

router = APIRouter(prefix="/trips", tags=["Trips"])

@router.post("/start")
async def start_trip(req: TripStartRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    from app.models.schema import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id, phone="+919876543210", name="Demo User")
        db.add(user)
        db.commit()

    trip_id = str(uuid.uuid4())
    
    origin_pt = Point(req.origin[0], req.origin[1])
    dest_pt = Point(req.destination[0], req.destination[1])
    
    # Convert planned route geometry from request
    route_line = None
    if req.planned_route_geom and req.planned_route_geom.get("coordinates"):
        coords = req.planned_route_geom["coordinates"]
        route_line = LineString(coords)
    
    trip = Trip(
        id=trip_id,
        user_id=user_id,
        origin_geom=from_shape(origin_pt, srid=4326),
        dest_geom=from_shape(dest_pt, srid=4326),
        mode=req.mode,
        planned_route_geom=from_shape(route_line, srid=4326) if route_line else None,
        planned_segments=req.planned_segments,
        started_at=datetime.utcnow(),
        status="active"
    )
    
    db.add(trip)
    db.commit()
    
    # Initialize in-process state
    from app.state import trip_runtimes
    trip_runtimes[trip_id] = {
        "status": "active",
        "started_at": datetime.utcnow()
    }
    
    # Return WebSocket token (for simplicity using trip_id as token here)
    return {"trip_id": trip_id, "ws_token": trip_id}

@router.get("/{trip_id}/escalation")
async def get_escalation(trip_id: str, db: Session = Depends(get_db)):
    from app.models.schema import EscalationState
    state = db.query(EscalationState).filter(EscalationState.trip_id == trip_id).first()
    if not state:
        return {"level": EscalationLevel.L0.value, "reason": "normal"}
    return {"level": state.level, "reason": state.reason}

# Public share endpoint (no auth)
@router.get("/share/{token}")
async def get_share_trip(token: str, db: Session = Depends(get_db)):
    """Public live-share endpoint - no authentication required."""
    trip = db.query(Trip).filter(Trip.id == token).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found or expired")
    
    if trip.status != 'active':
        raise HTTPException(status_code=410, detail="Trip has ended")
    
    # Get current position from latest GPS ping
    from app.models.schema import GpsPing
    latest_ping = db.query(GpsPing).filter(GpsPing.trip_id == token).order_by(GpsPing.ts.desc()).first()
    
    position = None
    if latest_ping:
        pt = to_shape(latest_ping.geom)
        position = [pt.y, pt.x]
    
    # Convert route geometry
    route_geom = None
    if trip.planned_route_geom:
        line = to_shape(trip.planned_route_geom)
        route_geom = mapping(line)
    
    # Convert origin and destination geometries to proper lat/lon
    origin = [0.0, 0.0]
    destination = [0.0, 0.0]
    if trip.origin_geom:
        origin_pt = to_shape(trip.origin_geom)
        origin = [origin_pt.y, origin_pt.x]
    if trip.dest_geom:
        dest_pt = to_shape(trip.dest_geom)
        destination = [dest_pt.y, dest_pt.x]
    
    return {
        "id": trip.id,
        "status": trip.status,
        "origin": origin,
        "destination": destination,
        "planned_route_geom": route_geom,
        "position": position,
        "mode": trip.mode,
    }

# Dashboard endpoints
@router.get("")
async def list_trips(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    trips = db.query(Trip).filter(Trip.user_id == user_id).order_by(Trip.started_at.desc()).all()
    return [
        {
            "id": t.id,
            "user_id": t.user_id,
            "mode": t.mode,
            "started_at": t.started_at.isoformat() if t.started_at else None,
            "status": t.status,
        }
        for t in trips
    ]

@router.get("/alerts")
async def list_alerts(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    # Get alerts for user's trips
    user_trips = db.query(Trip.id).filter(Trip.user_id == user_id).subquery()
    alerts = db.query(Alert).filter(Alert.trip_id.in_(user_trips)).order_by(Alert.triggered_at.desc()).limit(100).all()
    return [
        {
            "id": a.id,
            "trip_id": a.trip_id,
            "level": a.level,
            "type": a.type,
            "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
            "payload": a.payload,
        }
        for a in alerts
    ]