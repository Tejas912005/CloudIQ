from core.database import SessionLocal
from models.models import CloudResource
from services.anomaly_service import get_full_anomaly_report
from services.prediction_service import predict_costs, predict_resource_risk
from services.recommendation_service import generate_recommendations


def get_tool_data(intent_name: str) -> dict:
    """Resolve an agent action name to structured service data."""
    db = SessionLocal()
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
        return None
    except Exception as e:
        return {"error": f"Tool execution failed: {str(e)}"}
    finally:
        db.close()
