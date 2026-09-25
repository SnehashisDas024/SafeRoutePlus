from geoalchemy2.shape import to_shape
from shapely.geometry import Point, LineString
from shapely import Geometry as BaseGeometry

def calculate_distance(point: Point, line: LineString) -> float:
    # Projection distance in meters. This is simplified; proper ST_Distance with geography is better.
    # Using roughly 1 deg = 111km for quick approximation.
    return point.distance(line) * 111000

def _ensure_shapely(geom):
    """Convert GeoAlchemy geometry to Shapely if needed."""
    if isinstance(geom, BaseGeometry):
        return geom
    return to_shape(geom)

def check_deviation(ping, planned_route_geom, deviation_state) -> bool:
    """
    Checks if a ping deviates from the route.
    Mitigations:
    1. Accuracy gating: accuracy > 50m discarded
    2. Hysteresis: requires N consecutive deviating pings
    3. (Assumes ping geom is already map-matched via OSRM)
    """
    if ping.accuracy and ping.accuracy > 50.0:
        return False
        
    point = _ensure_shapely(ping.geom)
    line = _ensure_shapely(planned_route_geom)
    
    distance = calculate_distance(point, line)
    is_deviating = distance > 100.0  # 100 meters threshold
    
    # Hysteresis state update
    if is_deviating:
        deviation_state['consecutive'] = deviation_state.get('consecutive', 0) + 1
    else:
        deviation_state['consecutive'] = max(0, deviation_state.get('consecutive', 0) - 1)
        
    # Return true if hysteresis threshold met (e.g., 3 pings)
    return deviation_state['consecutive'] >= 3