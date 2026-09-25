import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\core\risk_aggregator.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_upsert = """    # Delete existing and re-insert (full rebuild)
    db.query(RiskCell).delete()
    db.commit()
    db.bulk_save_objects(batch)
    db.commit()
    
    return len(batch)"""

new_upsert = """    # UPSERT strategy to avoid duplicate key errors in Postgres
    from sqlalchemy.dialects.postgresql import insert
    
    # Execute insert with on_conflict_do_update
    stmt = insert(RiskCell).values([{
        "h3_index": c.h3_index,
        "hour": c.hour,
        "dow": c.dow,
        "risk_score": c.risk_score,
        "confidence": c.confidence,
        "sample_count": c.sample_count
    } for c in batch])
    
    stmt = stmt.on_conflict_do_update(
        index_elements=['h3_index', 'hour', 'dow'],
        set_={
            "risk_score": stmt.excluded.risk_score,
            "confidence": stmt.excluded.confidence,
            "sample_count": stmt.excluded.sample_count
        }
    )
    
    db.execute(stmt)
    db.commit()
    
    return len(batch)"""

content = content.replace(old_upsert, new_upsert)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched upsert_risk_cells to use Postgres UPSERT")
