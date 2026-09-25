from app.models.database import SessionLocal
from app.state import trip_runtimes, ping_buffers, trip_websockets
from app.core.deviation import check_deviation
from app.core.stop_detector import check_prolonged_stop
from app.core.escalation import transition_escalation
from app.models.schema import EscalationLevel, Trip
from geoalchemy2.shape import to_shape
from shapely.geometry import Point
import logging
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

DEVIATION_THRESHOLD_M = 100.0
STOP_SPEED_THRESHOLD = 1.0
STOP_EXPECTED_WAIT_SEC = 120

async def broadcast_escalation(trip_id: str, level: str, reason: str):
    """Broadcast escalation level change to all WebSocket connections for this trip."""
    import json
    message = json.dumps({
        "type": "escalation",
        "level": level,
        "reason": reason,
        "timestamp": datetime.utcnow().isoformat()
    })
    disconnected = []
    for ws in trip_websockets.get(trip_id, set()):
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        trip_websockets[trip_id].discard(ws)

def get_planned_route_line(db: SessionLocal, trip_id: str):
    """Get the planned route as a Shapely LineString."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if trip and trip.planned_route_geom:
        return to_shape(trip.planned_route_geom)
    return None

def process_trip_pings(db: SessionLocal, trip_id: str):
    """Process all buffered pings for a trip, run detection, update escalation."""
    print(f"[MONITOR] process_trip_pings called for {trip_id}")
    buffer = ping_buffers.get(trip_id)
    print(f"[MONITOR] Buffer size for {trip_id}: {len(buffer) if buffer else 0}")
    if not buffer or len(buffer) == 0:
        print(f"[MONITOR] No pings in buffer for {trip_id}")
        return
    
    planned_line = get_planned_route_line(db, trip_id)
    if not planned_line:
        logger.warning(f"Trip {trip_id}: no planned route geometry")
        print(f"[MONITOR] No planned route geometry for {trip_id}")
        return
    print(f"[MONITOR] Planned route found for {trip_id}")
    
    runtime = trip_runtimes.setdefault(trip_id, {
        "deviation_state": {"consecutive": 0},
        "stop_state": {"stopped_since": None},
        "current_level": "L0_Normal"
    })
    
    deviation_state = runtime["deviation_state"]
    stop_state = runtime["stop_state"]
    
    class PingObj:
        def __init__(self, data):
            self.geom = Point(data["lon"], data["lat"])
            self.speed = data.get("speed")
            self.accuracy = data.get("accuracy")
            self.ts = data["ts"]
    
    for ping_data in list(buffer):
        ping = PingObj(ping_data)
        
        # Deviation detection
        deviated = False
        if planned_line:
            deviated = check_deviation(ping, planned_line, deviation_state)
        
        # Stop detection
        stopped = check_prolonged_stop(ping, stop_state, STOP_EXPECTED_WAIT_SEC)
        
        print(f"[MONITOR] Ping: lat={ping_data['lat']}, lon={ping_data['lon']}, deviated={deviated}, stopped={stopped}, dev_consecutive={deviation_state.get('consecutive', 0)}")
        
        current_level = EscalationLevel(runtime["current_level"])
        
        # Escalation logic
        if deviated or stopped:
            if current_level == EscalationLevel.L0:
                # First anomaly -> L1 (silent)
                new_state = transition_escalation(db, trip_id, EscalationLevel.L1, "anomaly_detected")
                runtime["current_level"] = new_state.level
                logger.info(f"Trip {trip_id}: L0 -> L1 (anomaly_detected)")
                print(f"[MONITOR] Trip {trip_id}: L0 -> L1 (anomaly_detected)")
                
            elif current_level == EscalationLevel.L1:
                # Confirmed anomaly -> L2 (check-in)
                new_state = transition_escalation(db, trip_id, EscalationLevel.L2, "anomaly_confirmed")
                runtime["current_level"] = new_state.level
                logger.info(f"Trip {trip_id}: L1 -> L2 (anomaly_confirmed)")
                print(f"[MONITOR] Trip {trip_id}: L1 -> L2 (anomaly_confirmed)")
                # Broadcast L2 so frontend shows check-in prompt
                asyncio.create_task(broadcast_escalation(trip_id, "L2_Checkin", "anomaly_confirmed"))
                
            elif current_level == EscalationLevel.L2:
                # Check if check-in deadline passed
                from app.models.schema import EscalationState
                esc_state = db.query(EscalationState).filter(EscalationState.trip_id == trip_id).first()
                if esc_state and esc_state.checkin_deadline and datetime.utcnow() > esc_state.checkin_deadline:
                    new_state = transition_escalation(db, trip_id, EscalationLevel.L3, "checkin_timeout")
                    runtime["current_level"] = new_state.level
                    logger.info(f"Trip {trip_id}: L2 -> L3 (checkin_timeout)")
                    print(f"[MONITOR] Trip {trip_id}: L2 -> L3 (checkin_timeout)")
                    asyncio.create_task(broadcast_escalation(trip_id, "L3_Alert", "checkin_timeout"))
        else:
            # No anomaly detected - reset hysteresis counters if we were at L1
            if current_level == EscalationLevel.L1:
                deviation_state["consecutive"] = 0
                stop_state["stopped_since"] = None
    
    # Clear buffer after processing to avoid re-processing same pings
    buffer.clear()
    print(f"[MONITOR] Cleared buffer for {trip_id}")

def check_active_trips():
    """
    Scheduled via APScheduler to run frequently (every 5-10s).
    Consumes in-memory ping_buffers, runs deviation/stop detection.
    Also checks check-in deadlines for L2 trips even without new pings.
    """
    print(f"[MONITOR] Starting check_active_trips at {datetime.utcnow()}")
    db = SessionLocal()
    try:
        # Get active trips from both in-process state and database
        in_memory_ids = {tid for tid, rt in trip_runtimes.items() if rt.get("status") == "active"}
        print(f"[MONITOR] In-memory active trips: {in_memory_ids}")
        
        # Also load any active trips from DB that aren't in memory yet
        db_active = db.query(Trip.id).filter(Trip.status == "active").all()
        db_ids = {row[0] for row in db_active}
        print(f"[MONITOR] DB active trips: {db_ids}")
        
        # Combine and initialize missing ones
        all_active_ids = in_memory_ids | db_ids
        print(f"[MONITOR] All active trips to process: {all_active_ids}")
        
        for trip_id in all_active_ids:
            if trip_id not in trip_runtimes:
                trip_runtimes[trip_id] = {
                    "status": "active",
                    "deviation_state": {"consecutive": 0},
                    "stop_state": {"stopped_since": None},
                    "current_level": "L0_Normal"
                }
            
            # Always check check-in deadlines for L2 trips, even without new pings
            runtime = trip_runtimes.get(trip_id)
            if runtime and runtime.get("current_level") == "L2_Checkin":
                from app.models.schema import EscalationState
                esc_state = db.query(EscalationState).filter(EscalationState.trip_id == trip_id).first()
                if esc_state and esc_state.checkin_deadline and datetime.utcnow() > esc_state.checkin_deadline:
                    from app.core.escalation import transition_escalation
                    from app.models.schema import EscalationLevel
                    new_state = transition_escalation(db, trip_id, EscalationLevel.L3, "checkin_timeout")
                    runtime["current_level"] = new_state.level
                    logger.info(f"Trip {trip_id}: L2 -> L3 (checkin_timeout)")
                    print(f"[MONITOR] Trip {trip_id}: L2 -> L3 (checkin_timeout)")
                    asyncio.create_task(broadcast_escalation(trip_id, "L3_Alert", "checkin_timeout"))
            
            try:
                print(f"[MONITOR] Processing trip {trip_id}")
                process_trip_pings(db, trip_id)
            except Exception as e:
                logger.error(f"Error monitoring trip {trip_id}: {e}")
                print(f"[MONITOR] Error: {e}")
        db.commit()
    except Exception as e:
        logger.error(f"Monitor cycle error: {e}")
        print(f"[MONITOR] Cycle error: {e}")
        db.rollback()
    finally:
        db.close()
    print(f"[MONITOR] Finished check_active_trips at {datetime.utcnow()}")