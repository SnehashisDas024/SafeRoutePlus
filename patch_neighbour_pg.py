import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\core\risk_aggregator.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_add = """                    new_cell = RiskCell(
                        h3_index=cell,
                        hour=hour,
                        dow=dow,
                        risk_score=round(avg_score, 3),
                        confidence="estimated",
                        sample_count=0,
                    )
                    db.add(new_cell)
                    filled += 1"""

new_add = """                    from sqlalchemy.dialects.postgresql import insert
                    stmt = insert(RiskCell).values({
                        "h3_index": cell,
                        "hour": hour,
                        "dow": dow,
                        "risk_score": round(avg_score, 3),
                        "confidence": "estimated",
                        "sample_count": 0
                    }).on_conflict_do_nothing(index_elements=['h3_index', 'hour', 'dow'])
                    db.execute(stmt)
                    filled += 1"""

content = content.replace(old_add, new_add)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched neighbour_fill to use Postgres UPSERT")
