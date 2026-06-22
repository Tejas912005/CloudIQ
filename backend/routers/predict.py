"""
routers/predict.py
-------------------
GET /api/predict — Cost forecast + resource risk prediction.
"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.auth import verify_api_key
from core.database import get_db
from schemas.schemas import PredictResponse
from services.prediction_service import get_full_prediction_report

logger = logging.getLogger("cloudiq.router.predict")

router = APIRouter(prefix="/api", tags=["Predict"])


@router.get("/predict", response_model=PredictResponse, dependencies=[Depends(verify_api_key)])
def predict(db: Session = Depends(get_db)):
    """
    ML-powered predictions:
    - 30-day cost forecast using Linear Regression on cost history
    - Resource risk predictions based on CPU, memory, latency, error rate, uptime
    - Trend direction: increasing | decreasing
    """
    try:
        data = get_full_prediction_report(db)
        logger.info(f"[PREDICT] trend={data['trend_direction']} forecast=${data['monthly_forecast']} risks={len(data['resource_risks'])}")
        return PredictResponse(
            historical=data["historical"],
            forecast=data["forecast"],
            trend_slope=data["trend_slope"],
            monthly_forecast=data["monthly_forecast"],
            trend_direction=data["trend_direction"],
            resource_risks=data["resource_risks"],
            confidence=data.get("confidence", 0.0),
            r_squared=data.get("r_squared", 0.0),
        )
    except Exception as e:
        logger.error(f"[PREDICT] Error: {e}")
        raise
