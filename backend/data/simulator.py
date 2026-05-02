"""
data/simulator.py
------------------
Enhanced cloud data simulator for CloudIQ v2.
Upgraded from data_generator.py to:
  - Use SQLAlchemy ORM instead of raw sqlite3
  - Add extended telemetry: latency_ms, error_rate, traffic_rps
  - Add resource_uid for graph compatibility
  - Seed ResourceConnection edges (EC2→RDS→S3 chains)
  - Add sensitivity + public_access fields for graph risk scoring
"""

import random
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models.models import CloudResource, ResourceConnection, CostHistory


RESOURCE_CONFIGS = [
    # (name, type, provider, region, sensitivity, public_access)
    ("web-server-prod",    "EC2",      "AWS",   "us-east-1",    "Low",    True),
    ("api-server-01",      "EC2",      "AWS",   "us-east-1",    "Medium", False),
    ("db-primary",         "RDS",      "AWS",   "us-east-1",    "High",   False),
    ("cache-node-01",      "ElastiCache","AWS", "us-east-1",    "Low",    False),
    ("worker-node-01",     "EC2",      "AWS",   "us-west-2",    "Low",    False),
    ("ml-training-01",     "EC2",      "GCP",   "us-central1",  "Medium", False),
    ("cdn-proxy-01",       "CloudFront","AWS",  "us-east-1",    "Low",    True),
    ("auth-service",       "Lambda",   "AWS",   "us-east-1",    "High",   False),
    ("queue-processor",    "SQS",      "AWS",   "us-west-2",    "Low",    False),
    ("log-aggregator",     "EC2",      "AWS",   "eu-west-1",    "Medium", False),
    ("backup-server",      "S3",       "AWS",   "us-east-1",    "High",   False),
    ("dev-instance-01",    "VM",       "Azure", "eastus",       "Low",    True),
    ("staging-env-01",     "EC2",      "AWS",   "us-west-2",    "Low",    True),
    ("analytics-db",       "BigQuery", "GCP",   "us-central1",  "High",   False),
    ("report-generator",   "Lambda",   "AWS",   "us-east-1",    "Low",    False),
    ("image-processor",    "EC2",      "AWS",   "ap-south-1",   "Low",    False),
    ("payment-gateway",    "EC2",      "AWS",   "us-east-1",    "High",   True),
    ("notification-svc",   "Lambda",   "AWS",   "us-east-1",    "Low",    False),
    ("search-idx",         "Elasticsearch","AWS","us-east-1",   "Medium", False),
    ("user-profile-svc",   "EC2",      "AWS",   "ap-southeast-1","Medium",False),
    ("recommendation-svc", "EC2",      "AWS",   "us-east-1",    "Low",    False),
    ("billing-service",    "EC2",      "AWS",   "us-east-1",    "High",   False),
    ("admin-panel",        "EC2",      "AWS",   "us-east-1",    "High",   True),
    ("monitoring-agent",   "EC2",      "AWS",   "us-east-1",    "Low",    False),
    ("data-pipeline-01",   "GCE",      "GCP",   "us-central1",  "Medium", False),
    ("etl-processor",      "EC2",      "AWS",   "us-east-1",    "Medium", False),
    ("frontend-server",    "EC2",      "AWS",   "us-east-1",    "Low",    True),
    ("load-balancer",      "ALB",      "AWS",   "us-east-1",    "Low",    True),
    ("archival-node",      "S3",       "AWS",   "us-east-1",    "High",   False),
    ("test-runner-01",     "EC2",      "AWS",   "us-west-2",    "Low",    False),
]

# Realistic graph topology — (from_uid, to_uid, connection_type, risk_weight)
GRAPH_EDGES = [
    # Web → API → DB chain
    ("RES-001", "RES-002", "network",    1.5),  # web-server → api-server
    ("RES-002", "RES-003", "dependency", 2.0),  # api-server → db-primary
    ("RES-002", "RES-004", "network",    1.0),  # api-server → cache-node
    ("RES-003", "RES-011", "dependency", 1.5),  # db-primary → backup-server
    # Load balancer → web servers
    ("RES-028", "RES-001", "network",    1.0),  # load-balancer → web-server
    ("RES-028", "RES-027", "network",    1.0),  # load-balancer → frontend
    # Auth → downstream
    ("RES-008", "RES-002", "dependency", 2.0),  # auth-service → api-server
    ("RES-008", "RES-017", "dependency", 2.5),  # auth-service → payment-gateway
    # Payment → DB
    ("RES-017", "RES-003", "dependency", 2.5),  # payment-gateway → db-primary
    ("RES-017", "RES-022", "dependency", 1.5),  # payment-gateway → billing-service
    # ML pipeline
    ("RES-006", "RES-025", "data",       1.0),  # ml-training → data-pipeline
    ("RES-025", "RES-026", "data",       1.0),  # data-pipeline → etl-processor
    ("RES-026", "RES-011", "data",       1.5),  # etl-processor → backup-server
    # Analytics
    ("RES-002", "RES-014", "data",       1.0),  # api-server → analytics-db
    # Queue
    ("RES-009", "RES-005", "network",    1.0),  # queue → worker-node
    # Monitoring observing everything
    ("RES-024", "RES-001", "monitoring", 0.5),
    ("RES-024", "RES-003", "monitoring", 0.5),
    ("RES-024", "RES-017", "monitoring", 0.5),
]


def _compute_status(cpu: float, memory: float) -> str:
    if cpu < 10 and memory < 20:
        return "Idle"
    elif cpu > 85 or memory > 90:
        return "Over-Utilized"
    return "Healthy"


def _compute_efficiency(cpu: float, memory: float, uptime: float) -> float:
    cpu_score = max(0, 100 - abs(cpu - 65))
    mem_score = max(0, 100 - abs(memory - 65))
    uptime_score = min(100, uptime / 720 * 100)
    return round(cpu_score * 0.4 + mem_score * 0.4 + uptime_score * 0.2, 1)


def seed_resources(db: Session) -> int:
    """
    Seed CloudResource table with 30 realistic cloud resources.
    Includes extended telemetry fields and graph metadata.
    """
    # Dynamic randomness - seeds removed so telemetry changes on every run
    resources_created = 0

    for i, (name, rtype, provider, region, sensitivity, public_access) in enumerate(RESOURCE_CONFIGS):
        uid = f"RES-{i+1:03d}"

        # Vary metrics based on position (create interesting variety)
        if i < 6:          # First 6 are idle
            cpu    = round(random.uniform(1, 9), 1)
            memory = round(random.uniform(5, 18), 1)
        elif i < 9:        # Next 3 are over-utilized
            cpu    = round(random.uniform(86, 99), 1)
            memory = round(random.uniform(88, 99), 1)
        else:              # Rest are healthy
            cpu    = round(random.uniform(20, 80), 1)
            memory = round(random.uniform(25, 85), 1)

        uptime  = round(random.uniform(24, 720), 1)
        hourly  = round(random.uniform(0.05, 2.5), 4)
        monthly = round(hourly * 24 * 30, 2)
        status  = _compute_status(cpu, memory)
        eff     = _compute_efficiency(cpu, memory, uptime)

        # Extended telemetry
        latency    = round(random.uniform(5, 800) if i < 9 else random.uniform(5, 300), 1)
        error_rate = round(random.uniform(0, 15) if i < 9 else random.uniform(0, 4), 2)
        traffic    = round(random.uniform(10, 5000), 1)

        resource = CloudResource(
            name=name,
            resource_uid=uid,
            resource_type=rtype,
            provider=provider,
            region=region,
            status=status,
            hourly_cost=hourly,
            monthly_cost=monthly,
            cpu_usage=cpu,
            memory_usage=memory,
            uptime_hours=uptime,
            efficiency_score=eff,
            latency_ms=latency,
            error_rate=error_rate,
            traffic_rps=traffic,
            sensitivity=sensitivity,
            public_access=public_access,
            risk_score=0.0,  # Will be computed by graph_service
        )
        db.add(resource)
        resources_created += 1

    db.commit()
    return resources_created


def seed_connections(db: Session) -> int:
    """Seed ResourceConnection edges using resource UIDs."""
    uid_to_id = {r.resource_uid: r.id for r in db.query(CloudResource).all()}
    edges_created = 0

    for from_uid, to_uid, conn_type, risk_weight in GRAPH_EDGES:
        src_id = uid_to_id.get(from_uid)
        tgt_id = uid_to_id.get(to_uid)

        if src_id and tgt_id and src_id != tgt_id:
            # Check no duplicate
            existing = db.query(ResourceConnection).filter(
                ResourceConnection.source_id == src_id,
                ResourceConnection.target_id == tgt_id
            ).first()
            if not existing:
                db.add(ResourceConnection(
                    from_node=from_uid,
                    to_node=to_uid,
                    source_id=src_id,
                    target_id=tgt_id,
                    connection_type=conn_type,
                    risk_weight=risk_weight,
                ))
                edges_created += 1

    db.commit()
    return edges_created


def seed_cost_history(db: Session) -> int:
    """Seed 90 days of daily cost history with realistic trend and injected anomaly spikes."""
    # Dynamic cost baseline on every run
    today = datetime.now()
    base_cost = random.uniform(350.0, 600.0)
    records_created = 0

    for i in range(90):
        date = (today - timedelta(days=89 - i)).strftime("%Y-%m-%d")
        trend = i * 1.2         # upward drift
        noise = float(np.random.normal(0, 25))
        spike = 180.0 if i in [15, 45, 72] else 0.0   # inject anomaly spikes
        daily_cost = round(max(0, base_cost + trend + noise + spike), 2)
        db.add(CostHistory(date=date, daily_cost=daily_cost, is_anomaly=0))
        records_created += 1

    db.commit()
    return records_created


def run_full_seed(db: Session) -> dict:
    """
    Clear all existing data and re-seed everything.
    Called on startup by main.py.
    """
    from sqlalchemy import text

    # Clear tables in correct FK order
    db.execute(text("DELETE FROM chat_logs"))
    db.execute(text("DELETE FROM recommendations"))
    db.execute(text("DELETE FROM prediction_records"))
    db.execute(text("DELETE FROM anomaly_records"))
    db.execute(text("DELETE FROM cost_history"))
    db.execute(text("DELETE FROM resource_connections"))
    db.execute(text("DELETE FROM cloud_resources"))
    db.commit()

    resources = seed_resources(db)
    connections = seed_connections(db)
    cost_days = seed_cost_history(db)

    return {
        "resources_seeded":   resources,
        "connections_seeded": connections,
        "cost_days_seeded":   cost_days,
    }
