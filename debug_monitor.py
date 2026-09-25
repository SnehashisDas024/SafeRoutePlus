import sys
sys.path.insert(0, '.')
from app.models.database import SessionLocal
from app.state import trip_runtimes, ping_buffers
from app.core.deviation import check_deviation
from app.core.escalation import transition_escalation
from app.models.schema import EscalationLevel, Trip
from geoalchemy2.shape import to_shape
from shapely.geometry import Point
from datetime import datetime

db = SessionLocal()
trip_id = 'ee32fd2a-676d-445b-b26a-9312549ca352'

# Check buffer
buffer = ping_buffers.get(trip_id)
print('Buffer size:', len(buffer) if buffer else 0)
if buffer:
    for i, p in enumerate(list(buffer)[-3:]):
        print('  Ping {}: lat={}, lon={}, speed={}, accuracy={}'.format(i, p["lat"], p["lon"], p.get("speed"), p.get("accuracy")))

# Check trip runtime
rt = trip_runtimes.get(trip_id)
print('Runtime:', rt)

# Get planned route
trip = db.query(Trip).filter(Trip.id == trip_id).first()
if trip and trip.planned_route_geom:
    line = to_shape(trip.planned_route_geom)
    print('Route line:', line)
    
    # Test last ping deviation
    if buffer:
        last = buffer[-1]
        p = Point(last['lon'], last['lat'])
        dist = p.distance(line) * 111000
        print('Last ping distance from route: {:.1f}m'.format(dist))
        
        # Test deviation state
        dev_state = {'consecutive': 0}
        class PingObj:
            def __init__(self, data):
                self.geom = Point(data['lon'], data['lat'])
                self.speed = data.get('speed')
                self.accuracy = data.get('accuracy')
                self.ts = data['ts']
        ping = PingObj(last)
        result = check_deviation(ping, line, dev_state)
        print('Deviation check result: {}, state: {}'.format(result, dev_state))

db.close()