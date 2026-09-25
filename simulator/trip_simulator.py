import asyncio
import websockets
import json
import argparse
import os
import httpx
from datetime import datetime

SCENARIOS_DIR = os.path.join(os.path.dirname(__file__), "scenarios")

async def send_voice_event(trip_id: str, event: dict):
    """Send voice event via REST API."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"http://127.0.0.1:8000/trips/{trip_id}/voice-event",
                json=event,
                headers={"Authorization": "test_user_id", "Content-Type": "application/json"},
                timeout=5.0
            )
            print(f"  Voice event response: {resp.status_code} {resp.text}")
        except Exception as e:
            print(f"  Voice event error: {e}")

async def simulate_trip(scenario_name: str, trip_id: str):
    scenario_path = os.path.join(SCENARIOS_DIR, f"{scenario_name}.json")
    if not os.path.exists(scenario_path):
        print(f"Scenario file not found: {scenario_path}")
        return
    
    with open(scenario_path) as f:
        scenario = json.load(f)
    
    points = scenario.get("points", [])
    interval = scenario.get("interval_sec", 2)
    voice_events = scenario.get("voice_events", [])
    stop_after_ping = scenario.get("stop_after_ping", None)
    
    uri = f"ws://127.0.0.1:8000/trips/{trip_id}/stream"
    print(f"Connected to {uri} for scenario '{scenario_name}' ({len(points)} points, interval={interval}s)")
    
    voice_event_idx = 0
    
    try:
        async with websockets.connect(uri) as websocket:
            for i, point in enumerate(points):
                if stop_after_ping is not None and i >= stop_after_ping:
                    print(f"  Stopping after ping {i} (phone_dies)")
                    break
                
                # Check for voice events at this ping
                while voice_event_idx < len(voice_events) and voice_events[voice_event_idx]["at_ping"] == i:
                    ve = voice_events[voice_event_idx]
                    print(f"  Sending voice event: {ve['kind']} (confidence={ve['confidence']})")
                    await send_voice_event(trip_id, {
                        "kind": ve["kind"],
                        "phrase_hash": ve["phrase_hash"],
                        "confidence": ve["confidence"]
                    })
                    voice_event_idx += 1
                
                ping = {
                    "lat": point["lat"],
                    "lon": point["lon"],
                    "speed": point.get("speed", 1.2),
                    "accuracy": point.get("accuracy", 10.0)
                }
                await websocket.send(json.dumps(ping))
                resp = await websocket.recv()
                print(f"  Ping {i+1}/{len(points)}: lat={ping['lat']:.4f}, lon={ping['lon']:.4f}, speed={ping['speed']}, Server: {resp}")
                
                await asyncio.sleep(interval)
            
            # Send any remaining voice events after the loop
            while voice_event_idx < len(voice_events):
                ve = voice_events[voice_event_idx]
                print(f"  Sending voice event (post-loop): {ve['kind']}")
                await send_voice_event(trip_id, {
                    "kind": ve["kind"],
                    "phrase_hash": ve["phrase_hash"],
                    "confidence": ve["confidence"]
                })
                voice_event_idx += 1
                
    except Exception as e:
        print(f"Simulator error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", default="normal")
    parser.add_argument("--trip-id", default="test_trip")
    args = parser.parse_args()
    
    asyncio.run(simulate_trip(args.scenario, args.trip_id))