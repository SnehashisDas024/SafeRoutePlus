from fastapi.testclient import TestClient
import uuid

from app.main import app
from app.models.database import Base, get_db

client = TestClient(app)

def test_community_report_route_score_impact():
    req = {
        "origin": [88.3524, 22.5513], 
        "destination": [88.3426, 22.5448],
        "mode": "walk"
    }
    
    res1 = client.post("/routes/plan", json=req)
    assert res1.status_code == 200, res1.text
    best_route_1 = res1.json()[0]
    initial_score = best_route_1["worst_segment_score"]
    
    mid_idx = len(best_route_1["segments"]) // 2
    mid_lon, mid_lat = best_route_1["segments"][mid_idx]["mid"]
    
    rep1 = client.post(
        "/reports/community", 
        json={"lat": mid_lat, "lon": mid_lon, "rating": "unsafe", "tags": ["Poorly lit", "Harassment"]},
        headers={"Authorization": f"Bearer test1_{uuid.uuid4()}"}
    )
    assert rep1.status_code == 200, rep1.text
    
    rep2 = client.post(
        "/reports/community", 
        json={"lat": mid_lat, "lon": mid_lon, "rating": "unsafe", "tags": ["Suspicious Activity"]},
        headers={"Authorization": f"Bearer test2_{uuid.uuid4()}"}
    )
    assert rep2.status_code == 200, rep2.text
    
    agg_res = client.post("/debug/run-aggregator")
    assert agg_res.status_code == 200, agg_res.text
    
    res2 = client.post("/routes/plan", json=req)
    assert res2.status_code == 200, res2.text
    routes_2 = res2.json()
    
    best_route_2_matching = next((r for r in routes_2 if r.get("route_name") or r.get("id") == best_route_1.get("route_name") or best_route_1.get("id")), None)
    
    assert best_route_2_matching is not None
    new_score = best_route_2_matching["worst_segment_score"]
    print(f"Initial: {initial_score}, New: {new_score}")
    
    assert new_score < initial_score, f"Score did not drop! Initial: {initial_score}, New: {new_score}"
    print("TEST PASSED!")

if __name__ == "__main__":
    test_community_report_route_score_impact()
