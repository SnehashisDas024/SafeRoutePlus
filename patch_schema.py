import os
import re

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\backend\app\models\schema.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add to Report
old_report = """class Report(Base):
    __tablename__ = "reports"
    id = Column(String, primary_key=True)
    trip_id = Column(String)
    h3_index = Column(String)
    rating = Column(String)
    tags = Column(ARRAY(String))
    note = Column(String)
    ts = Column(DateTime, default=datetime.utcnow)"""

new_report = """class Report(Base):
    __tablename__ = "reports"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True)
    trip_id = Column(String, nullable=True)
    h3_index = Column(String)
    rating = Column(String)
    tags = Column(ARRAY(String))
    note = Column(String)
    source = Column(String, default='trip')
    ts = Column(DateTime, default=datetime.utcnow)"""

content = content.replace(old_report, new_report)

# Add UserTrust
user_trust = """
class UserTrust(Base):
    __tablename__ = "user_trust"
    user_id = Column(String, primary_key=True)
    trust_score = Column(Float, default=1.0)
"""
if "class UserTrust" not in content:
    content += user_trust

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated schema.py")
