import sys
sys.path.insert(0, 'C:\\Users\\sneha\\Desktop\\SafeRoute\\backend')

from app.models.database import SessionLocal
from app.models.schema import Incident, Report

db = SessionLocal()
inc_count = db.query(Incident).count()
rep_count = db.query(Report).count()
print('Incidents:', inc_count)
print('Reports:', rep_count)

for i in db.query(Incident).limit(3):
    print('  Incident:', i.type, 'trust=', i.trust_weight)

for r in db.query(Report).limit(3):
    print('  Report: h3=', r.h3_index, 'tags=', r.tags)

db.close()