
import math
import random
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models.models import CloudResource, ResourceConnection, CostHistory

PROVIDERS = ["AWS", "GCP", "Azure"]
REGIONS = {
    "AWS":   ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1", "ca-central-1"],
    "GCP":   ["us-central1", "europe-west1", "asia-east1", "us-east4"],
    "Azure": ["eastus", "westeurope", "southeastasia", "canadacentral"],
}
RESOURCE_TYPES_BY_PROVIDER = {
    "AWS":   ["EC2", "RDS", "S3", "Lambda", "EKS", "ElastiCache", "CloudFront"],
    "GCP":   ["Compute Engine", "Cloud SQL", "GCS", "Cloud Run", "GKE", "Firestore"],
    "Azure": ["VM", "Azure SQL", "Blob Storage", "Functions", "AKS", "Cosmos DB"],
}

RESOURCE_CONFIGS = [
    ("web-server-prod",    "EC2",      "AWS",   "us-east-1",    "Low",    True),
    ("api-server-01",      "EC2",      "AWS",   "us-east-1",    "Medium", False),
    ("db-primary",         "RDS",      "AWS",   "us-east-1",    "High",   False),
    ("cache-node-01",      "ElastiCache","AWS", "us-east-1",    "Low",    False),
    ("worker-node-01",     "EC2",      "AWS",   "us-west-2",    "Low",    False),
    ("ml-training-01",     "Compute Engine", "GCP",   "us-central1",  "Medium", False),
    ("cdn-proxy-01",       "CloudFront","AWS",  "us-east-1",    "Low",    True),
    ("auth-service",       "Lambda",   "AWS",   "us-east-1",    "High",   False),
    ("queue-processor",    "Cloud Run","GCP",   "europe-west1", "Low",    False),
    ("log-aggregator",     "EC2",      "AWS",   "eu-west-1",    "Medium", False),
    ("backup-server",      "S3",       "AWS",   "us-east-1",    "High",   False),
    ("dev-instance-01",    "VM",       "Azure", "eastus",       "Low",    True),
    ("staging-env-01",     "EC2",      "AWS",   "us-west-2",    "Low",    True),
    ("analytics-db",       "Cloud SQL","GCP",   "us-central1",  "High",   False),
    ("report-generator",   "Lambda",   "AWS",   "us-east-1",    "Low",    False),
    ("image-processor",    "EC2",      "AWS",   "ap-southeast-1","Low",    False),
    ("payment-gateway",    "EC2",      "AWS",   "us-east-1",    "High",   True),
    ("notification-svc",   "Functions","Azure", "westeurope",   "Low",    False),
    ("search-idx",         "Cosmos DB","Azure", "eastus",       "Medium", False),
    ("user-profile-svc",   "EC2",      "AWS",   "ap-southeast-1","Medium",False),
    ("recommendation-svc", "GKE",      "GCP",   "us-east4",     "Low",    False),
    ("billing-service",    "EC2",      "AWS",   "us-east-1",    "High",   False),
    ("admin-panel",        "VM",       "Azure", "canadacentral","High",   True),
    ("monitoring-agent",   "EC2",      "AWS",   "us-east-1",    "Low",    False),
    ("data-pipeline-01",   "Firestore","GCP",   "us-central1",  "Medium", False),
    ("etl-processor",      "AKS",      "Azure", "southeastasia","Medium", False),
    ("frontend-server",    "EC2",      "AWS",   "us-east-1",    "Low",    True),
    ("load-balancer",      "EKS",      "AWS",   "us-east-1",    "Low",    True),
    ("archival-node",      "Blob Storage","Azure","canadacentral","High",   False),
    ("test-runner-01",     "EC2",      "AWS",   "ca-central-1", "Low",    False),
]

GRAPH_EDGES = [
    ("RES-001", "RES-002", "network",    1.5),
    ("RES-002", "RES-003", "dependency", 2.0),
    ("RES-002", "RES-004", "network",    1.0),
    ("RES-003", "RES-011", "dependency", 1.5),
    ("RES-028", "RES-001", "network",    1.0),
    ("RES-028", "RES-027", "network",    1.0),
    ("RES-008", "RES-002", "dependency", 2.0),
    ("RES-008", "RES-017", "dependency", 2.5),
    ("RES-017", "RES-003", "dependency", 2.5),
    ("RES-017", "RES-022", "dependency", 1.5),
    ("RES-006", "RES-025", "data",       1.0),
    ("RES-025", "RES-026", "data",       1.0),
    ("RES-026", "RES-011", "data",       1.5),
    ("RES-002", "RES-014", "data",       1.0),
    ("RES-009", "RES-005", "network",    1.0),
    ("RES-024", "RES-001", "monitoring", 0.5),
    ("RES-024", "RES-003", "monitoring", 0.5),
    ("RES-024", "RES-017", "monitoring", 0.5),
]

def simulate_resource_metrics(status: str) -> dict:
    if status == "Over-Utilized":
        cpu     = random.uniform(82, 98)
        mem     = random.uniform(78, 96)
        latency = random.uniform(280, 850)
        traffic = random.uniform(180, 420)
        error   = random.uniform(2.5, 8.0)
    elif status == "Idle":
        cpu     = random.uniform(1, 8)
        mem     = random.uniform(5, 18)
        latency = random.uniform(8, 35)
        traffic = random.uniform(0.1, 3)
        error   = random.uniform(0, 0.3)
    else:
        cpu     = random.uniform(22, 68)
        mem     = random.uniform(28, 72)
        latency = random.uniform(40, 150)
        traffic = random.uniform(15, 120)
        error   = random.uniform(0.1, 1.2)
    return dict(
        cpu_usage=round(cpu, 1), memory_usage=round(mem, 1),
        latency_ms=round(latency, 1), traffic_rps=round(traffic, 1),
        error_rate=round(error, 2),
    )

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
    resources_created = 0

    for i, (name, rtype, provider, region, sensitivity, public_access) in enumerate(RESOURCE_CONFIGS):
        uid = f"RES-{i+1:03d}"

        if i < 6:
            status = "Idle"
        elif i < 9:
            status = "Over-Utilized"
        else:
            status = "Healthy"

        metrics = simulate_resource_metrics(status)
        cpu    = metrics["cpu_usage"]
        memory = metrics["memory_usage"]

        uptime  = round(random.uniform(24, 720), 1)
        hourly  = round(random.uniform(0.05, 2.5), 4)
        monthly = round(hourly * 24 * 30, 2)
        eff     = _compute_efficiency(cpu, memory, uptime)

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
            latency_ms=metrics["latency_ms"],
            error_rate=metrics["error_rate"],
            traffic_rps=metrics["traffic_rps"],
            sensitivity=sensitivity,
            public_access=public_access,
            risk_score=0.0,
        )
        db.add(resource)
        resources_created += 1

    db.commit()
    return resources_created

def seed_connections(db: Session) -> int:
    uid_to_id = {r.resource_uid: r.id for r in db.query(CloudResource).all()}
    edges_created = 0

    for from_uid, to_uid, conn_type, risk_weight in GRAPH_EDGES:
        src_id = uid_to_id.get(from_uid)
        tgt_id = uid_to_id.get(to_uid)

        if src_id and tgt_id and src_id != tgt_id:
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
    today = datetime.utcnow()
    days = 90
    base_cost = 420.00
    spike_days = random.sample(range(days), k=max(2, days // 30 * 2))
    records_created = 0

    for i in range(days):
        date = (today - timedelta(days=days - i)).strftime("%Y-%m-%d")
        trend = base_cost * (1 + 0.04 * (i / 7))
        day_of_week = (today - timedelta(days=days - i)).weekday()
        seasonal = 0.80 if day_of_week >= 5 else 1.0
        variance  = random.uniform(0.85, 1.15)
        spike     = random.uniform(1.4, 2.1) if i in spike_days else 1.0

        daily_cost = round(trend * seasonal * variance * spike, 2)
        is_anomaly = 1 if spike > 1.3 else 0
        db.add(CostHistory(date=date, daily_cost=max(0, daily_cost), is_anomaly=is_anomaly))
        records_created += 1

    db.commit()
    return records_created

def run_full_seed(db: Session) -> dict:
    from sqlalchemy import text

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
