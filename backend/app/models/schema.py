from sqlalchemy import Column, Integer, String, Float, Boolean, JSON, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.types import TypeDecorator, LargeBinary
from geoalchemy2.elements import WKBElement

class Geometry(TypeDecorator):
    impl = LargeBinary
    cache_ok = True

    def __init__(self, geometry_type='GEOMETRY', srid=4326, **kwargs):
        super().__init__()
        self.geometry_type = geometry_type
        self.srid = srid

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, WKBElement):
            return bytes(value.data)
        if hasattr(value, 'wkb'):
            return value.wkb
        if isinstance(value, bytes):
            return value
        if isinstance(value, str):
            from shapely import wkt
            wkt_part = value.split(";", 1)[1] if ";" in value else value
            shape_obj = wkt.loads(wkt_part)
            return shape_obj.wkb
        if hasattr(value, 'data'):
            if isinstance(value.data, (bytes, memoryview)):
                return bytes(value.data)
            from shapely import wkt
            wkt_part = str(value.data).split(";", 1)[1] if ";" in str(value.data) else str(value.data)
            return wkt.loads(wkt_part).wkb
        return bytes(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return WKBElement(bytes(value), srid=self.srid)
from app.models.database import Base
from datetime import datetime
import enum

class EscalationLevel(enum.Enum):
    L0 = "L0_Normal"
    L1 = "L1_Watch"
    L2 = "L2_Checkin"
    L3 = "L3_Alert"
    L4 = "L4_Sustained"

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    phone = Column(String, unique=True, index=True)
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class TrustedContact(Base):
    __tablename__ = "trusted_contacts"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String)
    phone = Column(String)
    tier = Column(String) # 'primary' or 'secondary'
    priority = Column(Integer)

class Trip(Base):
    __tablename__ = "trips"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    origin_geom = Column(Geometry('POINT', srid=4326))
    dest_geom = Column(Geometry('POINT', srid=4326))
    mode = Column(String)
    planned_route_geom = Column(Geometry('LINESTRING', srid=4326))
    planned_segments = Column(JSONB)
    started_at = Column(DateTime)
    eta = Column(DateTime)
    status = Column(String) # 'active', 'completed', 'cancelled'

class GpsPing(Base):
    __tablename__ = "gps_pings"
    trip_id = Column(String, primary_key=True) 
    ts = Column(DateTime, primary_key=True)
    geom = Column(Geometry('POINT', srid=4326))
    speed = Column(Float)
    accuracy = Column(Float)

class RiskCell(Base):
    __tablename__ = "risk_cells"
    h3_index = Column(String, primary_key=True)
    hour = Column(Integer, primary_key=True)
    dow = Column(Integer, primary_key=True)
    risk_score = Column(Float)
    confidence = Column(String) # 'high', 'estimated'
    sample_count = Column(Integer)

class StaticFeature(Base):
    __tablename__ = "static_features"
    h3_index = Column(String, primary_key=True)
    lit_ratio = Column(Float)
    police_dist_m = Column(Float)
    shop_density = Column(Float)
    road_class = Column(String)
    transit_dist_m = Column(Float)

class Report(Base):
    __tablename__ = "reports"
    id = Column(String, primary_key=True)
    trip_id = Column(String)
    h3_index = Column(String)
    rating = Column(String)
    tags = Column(ARRAY(String))
    note = Column(String)
    ts = Column(DateTime, default=datetime.utcnow)

class Incident(Base):
    __tablename__ = "incidents"
    id = Column(String, primary_key=True)
    type = Column(String)
    geom = Column(Geometry('POINT', srid=4326))
    ts = Column(DateTime)
    source = Column(String)
    trust_weight = Column(Float)

class SafePoint(Base):
    __tablename__ = "safe_points"
    id = Column(String, primary_key=True)
    geom = Column(Geometry('POINT', srid=4326))
    type = Column(String)
    opening_hours = Column(String)

import uuid

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    trip_id = Column(String)
    level = Column(String)
    type = Column(String)
    triggered_at = Column(DateTime)
    resolved_at = Column(DateTime, nullable=True)
    payload = Column(JSONB)

class AlertCooldown(Base):
    __tablename__ = "alert_cooldowns"
    trip_id = Column(String, primary_key=True)
    alert_type = Column(String, primary_key=True)
    cooldown_until = Column(DateTime)
    __table_args__ = (UniqueConstraint('trip_id', 'alert_type'),)

class EscalationState(Base):
    __tablename__ = "escalation_state"
    trip_id = Column(String, primary_key=True)
    level = Column(String)
    entered_at = Column(DateTime)
    reason = Column(String)
    checkin_deadline = Column(DateTime, nullable=True)
    last_notified_at = Column(DateTime, nullable=True)

class VoiceEvent(Base):
    __tablename__ = "voice_events"
    id = Column(String, primary_key=True)
    trip_id = Column(String)
    kind = Column(String) # 'duress_word' | 'safe_word' | 'checkin_spoken' | 'no_response'
    transcript_hash = Column(String)
    confidence = Column(Float)
    ts = Column(DateTime, default=datetime.utcnow)

class VoiceConfig(Base):
    __tablename__ = "voice_config"
    user_id = Column(String, primary_key=True)
    safe_word_hash = Column(String)
    duress_word_hash = Column(String)
    enabled = Column(Boolean, default=True)

class RouteHistory(Base):
    __tablename__ = "route_history"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    origin_name = Column(String, nullable=True)
    origin_lon = Column(Float, nullable=False)
    origin_lat = Column(Float, nullable=False)
    destination_name = Column(String, nullable=True)
    destination_lon = Column(Float, nullable=False)
    destination_lat = Column(Float, nullable=False)
    mode = Column(String, default="walk", nullable=False)
    use_count = Column(Integer, default=1, nullable=False)
    last_used_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            'user_id',
            'origin_lon',
            'origin_lat',
            'destination_lon',
            'destination_lat',
            'mode',
            name='uq_route_history_user_endpoints_mode'
        ),
    )


