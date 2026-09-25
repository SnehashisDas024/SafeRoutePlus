from collections import defaultdict, deque
from typing import Dict, Set, Any
from fastapi import WebSocket
from datetime import datetime, timedelta

# In-process registries to replace Redis

# Active trip runtimes
# trip_id -> TripRuntime (e.g., status, checkin_deadline, etc.)
trip_runtimes: Dict[str, Any] = {}

# GPS ping rolling buffers
# trip_id -> deque(maxlen=N)
ping_buffers: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))

# WebSocket connections for live-share fan-out
# trip_id -> set of WebSockets
trip_websockets: Dict[str, Set[WebSocket]] = defaultdict(set)

def rehydrate_state_from_db():
    """
    Rebuild in-process state from Postgres on startup so a restart 
    mid-demo recovers correctly.
    """
    from app.models.database import SessionLocal
    from app.models.schema import Trip, GpsPing, EscalationState
    from app.core.escalation import EscalationLevel
    
    db = SessionLocal()
    try:
        from app.models.schema import User
        if not db.query(User).filter(User.id == "test_user_id").first():
            db.add(User(id="test_user_id", phone="+919876543210", name="Demo User"))
            db.commit()

        # Load active trips
        active_trips = db.query(Trip).filter(Trip.status == "active").all()
        for trip in active_trips:
            trip_runtimes[trip.id] = {
                "status": "active",
                "deviation_state": {"consecutive": 0},
                "stop_state": {"stopped_since": None},
                "current_level": "L0_Normal"
            }
        
        # Load escalation state for active trips
        esc_states = db.query(EscalationState).filter(EscalationState.trip_id.in_([t.id for t in active_trips])).all()
        for esc in esc_states:
            if esc.trip_id in trip_runtimes:
                trip_runtimes[esc.trip_id]["current_level"] = esc.level
        
        # Load recent GPS pings (last 1 hour) for active trips
        cutoff = datetime.utcnow() - timedelta(hours=1)
        recent_pings = db.query(GpsPing).filter(
            GpsPing.trip_id.in_([t.id for t in active_trips]),
            GpsPing.ts >= cutoff
        ).order_by(GpsPing.trip_id, GpsPing.ts).all()
        
        for ping in recent_pings:
            from geoalchemy2.shape import to_shape
            point = to_shape(ping.geom)
            ping_buffers[ping.trip_id].append({
                "ts": ping.ts,
                "lat": point.y,
                "lon": point.x,
                "speed": ping.speed,
                "accuracy": ping.accuracy
            })
        
        print(f"[REHYDRATE] Loaded {len(active_trips)} active trips, {len(recent_pings)} recent pings")
    except Exception as e:
        print(f"[REHYDRATE] Error: {e}")
    finally:
        db.close()