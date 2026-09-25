from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.models.database import get_db, SessionLocal
from app.state import trip_websockets, ping_buffers
from app.models.schema import GpsPing
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from datetime import datetime
import uuid

router = APIRouter(tags=["WebSocket"])

@router.websocket("/trips/{trip_id}/stream")
async def trip_stream(websocket: WebSocket, trip_id: str):
    await websocket.accept()
    trip_websockets[trip_id].add(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # Handle heartbeat from client
            if msg_type == "heartbeat":
                await websocket.send_json({"type": "heartbeat_ack"})
                continue

            # Extract ping coordinates from polymorphic message formats
            # Format 1: { "type": "ping", "payload": { "lat": ..., "lon": ..., ... } }
            # Format 2: { "lat": ..., "lon": ..., "speed": ..., "accuracy": ... } (flat)
            ping_data = data.get("payload") if msg_type == "ping" else data
            
            if not isinstance(ping_data, dict) or "lat" not in ping_data or "lon" not in ping_data:
                await websocket.send_json({"status": "ignored", "reason": "invalid_ping_data"})
                continue

            ts = datetime.utcnow()
            
            # Store in in-process buffer
            ping_buffers[trip_id].append({
                "ts": ts,
                **ping_data
            })
            
            # Also persist to database
            db = SessionLocal()
            try:
                point = Point(ping_data["lon"], ping_data["lat"])
                gps_ping = GpsPing(
                    trip_id=trip_id,
                    ts=ts,
                    geom=from_shape(point, srid=4326),
                    speed=ping_data.get("speed"),
                    accuracy=ping_data.get("accuracy")
                )
                db.add(gps_ping)
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"[WS] Error persisting ping: {e}")
            finally:
                db.close()
            
            # Echo back status
            await websocket.send_json({"status": "received"})
            
    except WebSocketDisconnect:
        trip_websockets[trip_id].discard(websocket)