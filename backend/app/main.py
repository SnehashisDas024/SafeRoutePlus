from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.state import rehydrate_state_from_db, ping_buffers, trip_runtimes
from app.workers.aggregator import run_aggregator
from app.workers.monitor import check_active_trips, process_trip_pings

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    rehydrate_state_from_db()
    
    # Schedule workers
    scheduler.add_job(run_aggregator, 'interval', minutes=60)
    scheduler.add_job(check_active_trips, 'interval', seconds=10)
    
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(title="SafeRoute+ Backend", lifespan=lifespan)

# CORS for local dev (Vite on 5173, 5174, 5175, Expo web on 8081, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api import routes_plan, trips, sos, voice, ws_stream, contacts, reports, tags
from app.api import safe_routes

app.include_router(routes_plan.router)
app.include_router(safe_routes.router)
app.include_router(trips.router)
app.include_router(sos.router)
app.include_router(voice.router)
app.include_router(ws_stream.router)
app.include_router(contacts.router)
app.include_router(reports.router)
app.include_router(tags.router)

# Top-level alias route for live-share
from app.api.trips import get_share_trip
app.add_api_route("/share/{token}", get_share_trip, methods=["GET"], tags=["LiveShare"])

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/debug/state")
async def debug_state():
    """Debug endpoint to inspect in-process state."""
    return {
        "ping_buffers": {tid: len(buf) for tid, buf in ping_buffers.items()},
        "trip_runtimes": {tid: rt for tid, rt in trip_runtimes.items()},
    }

@app.get("/debug/monitor/{trip_id}")
async def debug_monitor(trip_id: str):
    """Run monitor logic for a specific trip and return debug info."""
    from app.core.deviation import check_deviation
    from app.state import ping_buffers, trip_runtimes
    from app.models.database import SessionLocal
    from app.models.schema import Trip
    from geoalchemy2.shape import to_shape
    from shapely.geometry import Point
    from datetime import datetime
    
    def get_planned_route_line(db: SessionLocal, trip_id: str):
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if trip and trip.planned_route_geom:
            return to_shape(trip.planned_route_geom)
        return None
    
    db = SessionLocal()
    try:
        buffer = ping_buffers.get(trip_id)
        if not buffer or len(buffer) == 0:
            return {"error": "No pings in buffer"}
        
        planned_line = get_planned_route_line(db, trip_id)
        if not planned_line:
            return {"error": "No planned route geometry"}
        
        runtime = trip_runtimes.setdefault(trip_id, {
            "deviation_state": {"consecutive": 0},
            "stop_state": {"stopped_since": None},
            "current_level": "L0_Normal"
        })
        
        deviation_state = runtime["deviation_state"]
        stop_state = runtime["stop_state"]
        
        results = []
        for i, ping_data in enumerate(list(buffer)):
            class PingObj:
                def __init__(self, data):
                    self.geom = Point(data["lon"], data["lat"])
                    self.speed = data.get("speed")
                    self.accuracy = data.get("accuracy")
                    self.ts = data["ts"]
            
            ping = PingObj(ping_data)
            
            # Test deviation
            dev_state_copy = deviation_state.copy()
            deviated = check_deviation(ping, planned_line, dev_state_copy)
            
            # Distance calculation
            dist = ping.geom.distance(planned_line) * 111000
            
            results.append({
                "ping_index": i,
                "lat": ping_data["lat"],
                "lon": ping_data["lon"],
                "speed": ping_data.get("speed"),
                "accuracy": ping_data.get("accuracy"),
                "distance_from_route_m": round(dist, 1),
                "deviated": deviated,
                "deviation_consecutive": dev_state_copy.get("consecutive", 0),
            })
        
        return {
            "trip_id": trip_id,
            "buffer_size": len(buffer),
            "runtime": runtime,
            "ping_results": results,
            "final_deviation_state": deviation_state,
            "final_stop_state": stop_state,
        }
    finally:
        db.close()

@app.post("/debug/run-monitor")
async def run_monitor():
    """Manually trigger the monitor for debugging."""
    check_active_trips()
    return {"status": "monitor executed"}

@app.post("/debug/run-aggregator")
async def run_aggregator_endpoint():
    """Manually trigger the aggregator for debugging."""
    from app.workers.aggregator import run_aggregator
    run_aggregator()
    return {"status": "aggregator executed"}