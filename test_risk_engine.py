import sys
sys.path.insert(0, 'C:\\Users\\sneha\\Desktop\\SafeRoute\\backend')

from app.models.database import SessionLocal
from app.core.risk_engine import score_cell
from datetime import datetime

db = SessionLocal()

test_cells = [
    ('893cf2c70d7ffff', 21, 5),
    ('893cf2c70d7ffff', 10, 5),
    ('893cf2c70d7ffff', 2, 6),
]

for h3_idx, hour, dow in test_cells:
    ts = datetime(2026, 9, 20, hour, 0, 0)
    result = score_cell(db, h3_idx, ts)
    print('Cell {} at {}:00 dow={}: score={}, conf={}, factors={}'.format(h3_idx, hour, dow, result["score"], result["confidence"], result["factors"]))

# Test a cell with no data
result = score_cell(db, '893cf2c0000ffff', datetime(2026, 9, 20, 21, 0, 0))
print('Unknown cell: score={}, conf={}'.format(result["score"], result["confidence"]))

db.close()