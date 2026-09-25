import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

# We will use the existing FastAPI app
from app.main import app
from app.models.database import Base, get_db
from app.models.schema import Report
from app.core.risk_aggregator import run_full_aggregation

client = TestClient(app)

def test_community_report_route_score_impact():
    # 1. Plan a route
    req = {
        "origin": [88.3524, 22.5513], 
        "destination": [88.3426, 22.5448],
        "mode": "walk"
    }
    
    # We must ensure there is no mocked prefetched routes to force the scoring 
    res1 = client.post("/routes/safe-plan", json=req)
    assert res1.status_code == 200, res1.text
    routes_1 = res1.json()
    assert len(routes_1) > 0
    
    best_route_1 = routes_1[0]
    initial_score = best_route_1["safety_score"]
    
    # Extract a coordinate from the middle of the best route to report it
    mid_idx = len(best_route_1["geometry"]["coordinates"]) // 2
    mid_lon, mid_lat = best_route_1["geometry"]["coordinates"][mid_idx]
    
    # 2. Submit 2 community "unsafe" reports on that cell
    # First report
    rep1 = client.post(
        "/trips/reports/community", 
        json={"lat": mid_lat, "lon": mid_lon, "rating": "unsafe", "tags": ["Poorly lit", "Harassment"]},
        headers={"Authorization": "Bearer test1"}
    )
    assert rep1.status_code == 200
    
    # Second report (different user)
    rep2 = client.post(
        "/trips/reports/community", 
        json={"lat": mid_lat, "lon": mid_lon, "rating": "unsafe", "tags": ["Suspicious Activity"]},
        headers={"Authorization": "Bearer test2"}
    )
    assert rep2.status_code == 200
    
    # 3. Re-trigger aggregation
    agg_res = client.post("/debug/run-aggregator")
    assert agg_res.status_code == 200
    
    # 4. Re-plan the same route
    res2 = client.post("/routes/safe-plan", json=req)
    assert res2.status_code == 200
    routes_2 = res2.json()
    
    # Find the exact same route by geometry or index
    # We can just look at the best route or match the name/index
    # For simplicity, if the same route is still #1, its score should be lower. 
    # If it fell down the ranks, we can find it by route_name
    best_route_2_matching = next((r for r in routes_2 if r["route_name"] == best_route_1["route_name"]), None)
    
    assert best_route_2_matching is not None
    new_score = best_route_2_matching["safety_score"]
    
    # 5. Assert the new safety score is lower than the original
    assert new_score < initial_score, f"Score did not drop! Initial: {initial_score}, New: {new_score}"
