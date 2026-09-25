import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\core\risk_aggregator.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
"""    # Delete existing and re-insert (full rebuild)
    db.query(RiskCell).delete()
    db.bulk_save_objects(batch)
    db.commit()""",
"""    # Delete existing and re-insert (full rebuild)
    db.query(RiskCell).delete()
    db.commit()
    db.bulk_save_objects(batch)
    db.commit()"""
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched upsert_risk_cells")
