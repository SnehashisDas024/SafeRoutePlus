from datetime import datetime, timedelta

def estimate_arrival_times(route_segments: list, depart_at: datetime, mode: str) -> list:
    """
    Walk the route from departure time, accumulating segment traversal time.
    Returns segments with predicted_arrival_timestamp appended.
    """
    current_time = depart_at
    speed_m_s = 1.4 if mode == 'walk' else 5.5 # rough estimates
    
    shifted_segments = []
    for segment in route_segments:
        # segment is assumed to have a 'distance' key in meters
        distance = segment.get("distance", 200)
        duration_sec = distance / speed_m_s
        current_time += timedelta(seconds=duration_sec)
        
        segment_with_time = segment.copy()
        segment_with_time["predicted_arrival"] = current_time
        shifted_segments.append(segment_with_time)
        
    return shifted_segments

