"""
tools.py
--------
Agent tool resolver for the CloudIQ agentic loop.

FIXED: No longer creates its own SessionLocal(). Instead accepts a db session
passed in from the caller, keeping all operations in the same transaction
as the parent request.
"""
from sqlalchemy.orm import Session
from models.models import CloudResource
from services.anomaly_service import get_full_anomaly_report
from services.prediction_service import predict_costs, predict_resource_risk
from services.recommendation_service import generate_recommendations


def get_tool_data(intent_name: str, db: Session) -> dict:
    """
    Resolve an agent action name to structured service data.
    Accepts the request-scoped db session — does NOT open its own connection.
    """
    try:
        if intent_name == "analyze_resources":
            resources = db.query(CloudResource).all()
            return {
                "total_resources": len(resources),
                "idle_count": sum(1 for r in resources if r.status == "Idle"),
                "over_utilized_count": sum(1 for r in resources if r.status == "Over-Utilized"),
                "healthy_count": sum(1 for r in resources if r.status == "Healthy"),
                "total_monthly_cost": round(sum((r.monthly_cost or 0) for r in resources), 2),
            }
        if intent_name == "detect_anomalies":
            return get_full_anomaly_report(db)
        if intent_name == "predict_costs":
            return predict_costs(db)
        if intent_name == "predict_resource_risk":
            return {"high_risk_resources": predict_resource_risk(db)}
        if intent_name == "generate_recommendations":
            return generate_recommendations(db)
        return {"error": f"Unknown tool: {intent_name}"}
    except Exception as e:
        return {"error": f"Tool execution failed: {str(e)}"}
