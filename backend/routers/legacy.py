"""
routers/legacy.py
------------------
Backward-compatibility routes mapping old Flask endpoint paths
to new FastAPI service calls. This avoids breaking any old frontend
calls that still use /api/summary, /api/anomalies, etc.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from models.models import CloudResource, CostHistory, Recommendation
from services.anomaly_service import detect_cost_anomalies
from services.prediction_service import get_full_prediction_report
from services.recommendation_service import generate_recommendations

router = APIRouter(prefix="/api", tags=["Legacy (Backward Compat)"])


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    """Legacy: was /api/summary in Flask. Maps to /api/analyze now."""
    resources = db.query(CloudResource).all()
    total = len(resources)
    idle  = sum(1 for r in resources if r.status == "Idle")
    over  = sum(1 for r in resources if r.status == "Over-Utilized")
    cost  = round(sum((r.monthly_cost or 0) for r in resources), 2)

    anomaly_data = detect_cost_anomalies(db)
    pred_data    = get_full_prediction_report(db)

    # BUG-010 FIX: read existing Recommendation count instead of regenerating
    # generate_recommendations() causes delete+reinsert race condition
    rec_rows = db.query(Recommendation).all()
    total_savings = sum((r.estimated_savings or 0) for r in rec_rows if (r.estimated_savings or 0) > 0)

    return {
        "total_resources":        total,
        "idle_count":             idle,
        "over_utilized_count":    over,
        "healthy_count":          total - idle - over,
        "total_monthly_cost":     cost,
        "anomaly_count":          anomaly_data["total_anomaly_days"],
        "recommendation_count":   len(rec_rows),
        "total_potential_savings": round(total_savings, 2),
        "trend_direction":        pred_data["trend_direction"],
        "monthly_forecast":       pred_data["monthly_forecast"],
    }


@router.get("/resources")
def resources(db: Session = Depends(get_db)):
    """Legacy: was /api/resources in Flask."""
    rows = db.query(CloudResource).all()
    return [
        {
            "id": r.id, "name": r.name, "type": r.resource_type,
            "region": r.region, "cpu_usage": r.cpu_usage,
            "memory_usage": r.memory_usage, "uptime_hours": r.uptime_hours,
            "hourly_cost": r.hourly_cost, "monthly_cost": r.monthly_cost, "status": r.status,
            "efficiency_score": r.efficiency_score,
            "latency_ms": r.latency_ms, "error_rate": r.error_rate,
            "risk_score": r.risk_score, "sensitivity": r.sensitivity,
            "public_access": r.public_access,
        }
        for r in rows
    ]


@router.get("/cost-history")
def cost_history(db: Session = Depends(get_db)):
    """Legacy: was /api/cost-history in Flask."""
    rows = db.query(CostHistory).order_by(CostHistory.date).all()
    return [{"date": r.date, "daily_cost": r.daily_cost, "is_anomaly": r.is_anomaly} for r in rows]


@router.get("/anomalies")
def anomalies(db: Session = Depends(get_db)):
    """Legacy: was /api/anomalies in Flask."""
    return detect_cost_anomalies(db)


@router.get("/predictions")
def predictions(db: Session = Depends(get_db)):
    """Legacy: was /api/predictions in Flask."""
    return get_full_prediction_report(db)


@router.get("/recommendations")
def recommendations(db: Session = Depends(get_db)):
    """Legacy: was /api/recommendations in Flask."""
    return generate_recommendations(db)
