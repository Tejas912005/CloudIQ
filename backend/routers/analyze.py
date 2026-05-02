"""
routers/analyze.py
-------------------
GET /api/analyze — Full cloud infrastructure analysis.
Returns resource summary + graph statistics + anomaly summary.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.schemas import AnalyzeResponse, ResourceSummary, GraphStats, AnomalySummary
from models.models import CloudResource
from services.graph_service import build_graph, get_graph_stats
from services.anomaly_service import detect_cost_anomalies

logger = logging.getLogger("cloudiq.router.analyze")

router = APIRouter(prefix="/api", tags=["Analyze"])


@router.get("/analyze", response_model=AnalyzeResponse)
def analyze(db: Session = Depends(get_db)):
    """
    Full cloud infrastructure analysis:
    - Resource health summary (total, idle, over-utilized, healthy, cost)
    - Graph topology statistics (nodes, edges, density, high-risk count)
    - Cost anomaly summary (flagged days, mean, std)
    """
    try:
        # ── Resource summary ─────────────────────────────────────────────────
        resources = db.query(CloudResource).all()
        total   = len(resources)
        idle    = sum(1 for r in resources if r.status == "Idle")
        over    = sum(1 for r in resources if r.status == "Over-Utilized")
        healthy = sum(1 for r in resources if r.status == "Healthy")
        total_cost = sum((r.monthly_cost or 0) for r in resources)

        resource_summary = ResourceSummary(
            total_resources=total,
            idle_count=idle,
            over_utilized_count=over,
            healthy_count=healthy,
            total_monthly_cost=round(total_cost, 2),
        )

        # ── Graph stats ───────────────────────────────────────────────────────
        G = build_graph(db)
        stats = get_graph_stats(G)
        graph_stats = GraphStats(**stats)

        # ── Anomaly summary ───────────────────────────────────────────────────
        anomaly_data = detect_cost_anomalies(db)
        anomaly_summary = AnomalySummary(
            total_anomaly_days=anomaly_data["total_anomaly_days"],
            mean_cost=anomaly_data["mean_cost"],
            std_cost=anomaly_data["std_cost"],
        )

        logger.info(f"[ANALYZE] resources={total}, graph_nodes={stats['total_nodes']}, anomalies={anomaly_data['total_anomaly_days']}")

        return AnalyzeResponse(
            resources=resource_summary,
            graph=graph_stats,
            anomalies=anomaly_summary,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error(f"[ANALYZE] Error: {e}")
        raise
