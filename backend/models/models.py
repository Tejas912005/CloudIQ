"""
models/models.py
----------------
Unified SQLAlchemy ORM models for CloudIQ v2.
Merges CloudIQ's resource/cost tables with Cloud_Project's graph tables.
All 7 entity types:
  1. CloudResource     — EC2, RDS, S3, etc. with metrics + graph fields
  2. ResourceConnection — Directed edges for the dependency graph
  3. CostHistory       — Daily cost time-series (90 days simulated)
  4. AnomalyRecord     — Persisted anomaly detections (cost + metric)
  5. PredictionRecord  — Stored forecasts
  6. Recommendation    — Prioritized action items with savings
  7. ChatLog           — Conversation persistence (replaces in-memory)
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime,
    Text, Boolean, ForeignKey
)
from sqlalchemy.orm import relationship
from core.database import Base


# ══════════════════════════════════════════════════════════════════
#  1. CloudResource
# ══════════════════════════════════════════════════════════════════
class CloudResource(Base):
    __tablename__ = "cloud_resources"

    id              = Column(Integer, primary_key=True, index=True)

    # Identity
    name            = Column(String(100), nullable=False)
    resource_uid    = Column(String(50), unique=True, index=True, nullable=False)
    resource_type   = Column(String(50), nullable=False)   # EC2, RDS, S3, Lambda, VM…
    provider        = Column(String(30), default="AWS")    # AWS | GCP | Azure
    region          = Column(String(50), default="us-east-1")
    status          = Column(String(20), default="Healthy") # Healthy | Idle | Over-Utilized

    # Cost
    hourly_cost     = Column(Float, default=0.0)   # USD per hour
    monthly_cost    = Column(Float, default=0.0)   # pre-computed convenience field

    # Operational metrics (latest snapshot — updated by simulator)
    cpu_usage       = Column(Float, default=0.0)   # %
    memory_usage    = Column(Float, default=0.0)   # %
    uptime_hours    = Column(Float, default=0.0)
    efficiency_score = Column(Float, default=0.0)  # 0–100

    # Extended telemetry
    latency_ms      = Column(Float, default=0.0)   # avg response latency
    error_rate      = Column(Float, default=0.0)   # % of requests failing
    traffic_rps     = Column(Float, default=0.0)   # requests per second

    # Graph / risk fields (from Cloud_Project)
    sensitivity     = Column(String(10), default="Low")    # High | Medium | Low
    public_access   = Column(Boolean, default=False)
    risk_score      = Column(Float, default=0.0)           # auto-computed by graph_service

    created_at      = Column(DateTime, default=datetime.utcnow)

    # Relationships
    source_connections = relationship(
        "ResourceConnection",
        foreign_keys="ResourceConnection.source_id",
        back_populates="source",
        cascade="all, delete-orphan",
    )
    target_connections = relationship(
        "ResourceConnection",
        foreign_keys="ResourceConnection.target_id",
        back_populates="target",
        cascade="all, delete-orphan",
    )
    anomalies   = relationship("AnomalyRecord",    back_populates="resource", cascade="all, delete-orphan")
    predictions = relationship("PredictionRecord", back_populates="resource", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="resource", cascade="all, delete-orphan")


# ══════════════════════════════════════════════════════════════════
#  2. ResourceConnection  (graph edges)
# ══════════════════════════════════════════════════════════════════
class ResourceConnection(Base):
    __tablename__ = "resource_connections"

    id              = Column(Integer, primary_key=True, index=True)
    from_node       = Column(String(50), nullable=False)   # resource_uid of source
    to_node         = Column(String(50), nullable=False)   # resource_uid of target
    source_id       = Column(Integer, ForeignKey("cloud_resources.id"), nullable=True)
    target_id       = Column(Integer, ForeignKey("cloud_resources.id"), nullable=True)
    connection_type = Column(String(50), default="network")  # network | dependency | data
    risk_weight     = Column(Float, default=1.0)
    created_at      = Column(DateTime, default=datetime.utcnow)

    source = relationship("CloudResource", foreign_keys=[source_id], back_populates="source_connections")
    target = relationship("CloudResource", foreign_keys=[target_id], back_populates="target_connections")


# ══════════════════════════════════════════════════════════════════
#  3. CostHistory  (daily cost time-series)
# ══════════════════════════════════════════════════════════════════
class CostHistory(Base):
    __tablename__ = "cost_history"

    id          = Column(Integer, primary_key=True, index=True)
    date        = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    daily_cost  = Column(Float, nullable=False)
    is_anomaly  = Column(Integer, default=0)   # 0 = normal, 1 = anomaly
    created_at  = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════
#  4. AnomalyRecord  (persisted detections)
# ══════════════════════════════════════════════════════════════════
class AnomalyRecord(Base):
    __tablename__ = "anomaly_records"

    id              = Column(Integer, primary_key=True, index=True)
    resource_id     = Column(Integer, ForeignKey("cloud_resources.id"), nullable=True)
    anomaly_type    = Column(String(50), default="cost")  # cost | cpu | latency | error_rate
    date            = Column(String(10), nullable=False)
    value           = Column(Float, nullable=False)
    z_score         = Column(Float, default=0.0)
    deviation       = Column(Float, default=0.0)
    severity        = Column(String(20), default="medium")  # low | medium | high | critical
    description     = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    resource = relationship("CloudResource", back_populates="anomalies")


# ══════════════════════════════════════════════════════════════════
#  5. PredictionRecord  (stored forecasts)
# ══════════════════════════════════════════════════════════════════
class PredictionRecord(Base):
    __tablename__ = "prediction_records"

    id              = Column(Integer, primary_key=True, index=True)
    resource_id     = Column(Integer, ForeignKey("cloud_resources.id"), nullable=True)
    prediction_type = Column(String(50), default="cost")   # cost | risk
    target_date     = Column(String(10), nullable=False)
    predicted_value = Column(Float, nullable=False)
    confidence      = Column(Float, default=0.8)   # 0.0–1.0
    trend_direction = Column(String(20), default="stable") # increasing | decreasing | stable
    created_at      = Column(DateTime, default=datetime.utcnow)

    resource = relationship("CloudResource", back_populates="predictions")


# ══════════════════════════════════════════════════════════════════
#  6. Recommendation  (prioritized action items)
# ══════════════════════════════════════════════════════════════════
class Recommendation(Base):
    __tablename__ = "recommendations"

    id                  = Column(Integer, primary_key=True, index=True)
    resource_id         = Column(Integer, ForeignKey("cloud_resources.id"), nullable=True)
    resource_name       = Column(String(100), nullable=False)
    resource_type       = Column(String(50), nullable=True)
    action              = Column(Text, nullable=False)
    reason              = Column(Text, nullable=False)
    priority            = Column(String(10), nullable=False, default="Medium")  # High | Medium | Low
    category            = Column(String(30), default="cost")   # cost | security | performance | graph
    estimated_savings   = Column(Float, default=0.0)
    created_at          = Column(DateTime, default=datetime.utcnow)

    resource = relationship("CloudResource", back_populates="recommendations")


# ══════════════════════════════════════════════════════════════════
#  7. ChatLog  (conversation persistence)
# ══════════════════════════════════════════════════════════════════
class ChatLog(Base):
    __tablename__ = "chat_logs"

    id          = Column(Integer, primary_key=True, index=True)
    role        = Column(String(10), nullable=False)   # user | model
    message     = Column(Text, nullable=False)
    intent      = Column(String(50), nullable=True)
    mode        = Column(String(20), nullable=True)    # gemini | local_fallback
    created_at  = Column(DateTime, default=datetime.utcnow)
