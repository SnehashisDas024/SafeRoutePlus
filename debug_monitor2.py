import sys
sys.path.insert(0, '.')
from app.state import ping_buffers, trip_runtimes
from app.models.database import SessionLocal
from app.core.deviation import check_deviation
from app.workers.monitor import get_planned_route_line
from shapely.geometry import Point

trip_id = '4dfbfb22-ad0a-406e-90c8-b44d0b88d4db'

db = SessionLocal()
buffer = ping_buffers.get(trip_id)
print('Buffer size:', len(buffer) if buffer else 0)

planned_line = get_planned_route_line(db, trip_id)
print('Planned line:', planned_line)

if buffer and planned_line:
    runtime = trip_runtimes.setdefault(trip_id, {
        'deviation_state': {'consecutive': 0},
        'stop_state': {'stopped_since': None},
        'current_level': 'L0_Normal'
    })
    
    deviation_state = runtime['deviation_state']
    
    for i, ping_data in enumerate(list(buffer)):
        class PingObj:
            def __init__(self, data):
                self.geom = Point(data['lon'], data['lat'])
                self.speed = data.get('speed')
                self.accuracy = data.get('accuracy')
                self.ts = data['ts']
        
        ping = PingObj(ping_data)
        dev_state_copy = deviation_state.copy()
        deviated = check_deviation(ping, planned_line, dev_state_copy)
        dist = ping.geom.distance(planned_line) * 111000
        
        print('Ping {}: lat={}, lon={}, dist={:.1f}m, deviated={}, consecutive={}'.format(
            i, ping_data["lat"], ping_data["lon"], dist, deviated, dev_state_copy.get("consecutive", 0)
        ))

db.close()