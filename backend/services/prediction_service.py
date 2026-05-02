"""
services/prediction_service.py
--------------------------------
Prediction service for CloudIQ v2.
Upgraded from CloudIQ's predictor.py:
  - Uses SQLAlchemy ORM
  - Linear regression on cost history (30-day forecast)
  - Resource risk scoring using metrics + graph context
  - Persists PredictionRecord entries to DB
"""

import logging
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict
from sqlalchemy.orm import Session

from models.models import CostHistory, CloudResource, PredictionRecord

logger = logging.getLogger("cloudiq.prediction_service")


# ══════════════════════════════════════════════════════════════════════════════
#  COST FORECAST  (Linear Regression, 30-day horizon)
# ══════════════════════════════════════════════════════════════════════════════

def predict_costs(db: Session) -> Dict:
    """
    Fit a linear regression model on CostHistory and forecast next 30 days.
    Returns historical (actual + fitted) and predicted future points.
    """
    rows = db.query(CostHistory).order_by(CostHistory.date).all()

    if not rows:
        return {
            "historical": [], "forecast": [],
            "trend_slope": 0, "monthly_forecast": 0,
            "trend_direction": "stable",
        }

    dates = [r.date for r in rows]
    costs = np.array([r.daily_cost for r in rows], dtype=float)
    X = np.arange(len(costs)).reshape(-1, 1)

    if len(costs) > 1:
        from sklearn.linear_model import LinearRegression
        model = LinearRegression()
        model.fit(X, costs)
        slope = float(model.coef_[0])
        intercept = float(model.intercept_)
        r_squared = float(model.score(X, costs))
        confidence = round(max(0.0, min(1.0, r_squared)), 2)
    else:
        slope, intercept = 0.0, float(costs[0])
        r_squared, confidence = 1.0, 1.0

    # Future 30 days
    future_X = np.arange(len(costs), len(costs) + 30).reshape(-1, 1)
    future_preds = (future_X.flatten() * slope) + intercept

    last_date = datetime.strptime(dates[-1], "%Y-%m-%d")
    future_dates = [
        (last_date + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        for i in range(30)
    ]

    fitted = (X.flatten() * slope) + intercept
    slope = float(slope)
    monthly_total = float(np.sum(future_preds))
    trend_dir = "increasing" if slope > 0 else "decreasing"

    # We removed db.query(PredictionRecord).delete() to avoid SQLite concurrent write locks

    logger.info(f"[PREDICT] Cost forecast: {trend_dir}, 30d total=${monthly_total:.2f}")

    return {
        "historical": [
            {"date": d, "actual": round(float(c), 2), "fitted": round(float(f), 2)}
            for d, c, f in zip(dates, costs, fitted)
        ],
        "forecast": [
            {"date": d, "predicted": round(float(p), 2)}
            for d, p in zip(future_dates, future_preds)
        ],
        "trend_slope":      round(slope, 4),
        "monthly_forecast": round(monthly_total, 2),
        "trend_direction":  trend_dir,
        "confidence":       confidence,
        "r_squared":        round(r_squared, 4),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  RESOURCE RISK PREDICTION  (metric-based scoring)
# ══════════════════════════════════════════════════════════════════════════════

def predict_resource_risk(db: Session) -> List[Dict]:
    """
    Score each resource based on operational metrics:
      - High CPU (>85%) or Memory (>90%) → critical pressure
      - Long uptime (>600h) → maintenance risk
      - Low efficiency (<30) → waste + instability risk
      - High latency (>500ms) → performance risk
      - High error rate (>5%) → reliability risk
    Returns top 10 highest-risk resources.
    """
    resources = db.query(CloudResource).all()
    risks = []

    for r in resources:
        risk_score = 0
        reasons = []

        if r.cpu_usage and r.cpu_usage > 85:
            risk_score += 40
            reasons.append(f"High CPU ({r.cpu_usage:.0f}%)")
        if r.memory_usage and r.memory_usage > 90:
            risk_score += 40
            reasons.append(f"High memory ({r.memory_usage:.0f}%)")
        if r.uptime_hours and r.uptime_hours > 600:
            risk_score += 20
            reasons.append(f"Extended uptime ({r.uptime_hours:.0f}h)")
        if r.efficiency_score and r.efficiency_score < 30:
            risk_score += 15
            reasons.append(f"Low efficiency ({r.efficiency_score:.0f}/100)")
        if r.latency_ms and r.latency_ms > 500:
            risk_score += 25
            reasons.append(f"High latency ({r.latency_ms:.0f}ms)")
        if r.error_rate and r.error_rate > 5:
            risk_score += 30
            reasons.append(f"High error rate ({r.error_rate:.1f}%)")

        if risk_score > 0:
            risk_score = min(risk_score, 100)
            risks.append({
                "name":       r.name,
                "type":       r.resource_type,
                "risk_score": risk_score,
                "risk_level": "High" if risk_score >= 60 else "Medium" if risk_score >= 30 else "Low",
                "reasons":    reasons,
            })

    risks.sort(key=lambda x: x["risk_score"], reverse=True)
    logger.info(f"[PREDICT] Resource risks identified: {len(risks)} resources at risk")
    return risks[:10]


# ══════════════════════════════════════════════════════════════════════════════
#  COMBINED PREDICTION REPORT
# ══════════════════════════════════════════════════════════════════════════════

def get_full_prediction_report(db: Session) -> Dict:
    """Combined cost forecast + resource risk prediction."""
    cost_pred    = predict_costs(db)
    resource_risk = predict_resource_risk(db)
    return {
        **cost_pred,
        "resource_risks": resource_risk,
    }
