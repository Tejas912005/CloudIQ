"""
routers/recommend.py
---------------------
GET /api/recommend — Prioritized cloud optimization recommendations.
"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.schemas import RecommendResponse, RecommendationItem
from services.recommendation_service import generate_recommendations

logger = logging.getLogger("cloudiq.router.recommend")

router = APIRouter(prefix="/api", tags=["Recommend"])


@router.get("/recommend", response_model=RecommendResponse)
def recommend(db: Session = Depends(get_db)):
    """
    Intelligent recommendation engine combining:
    - Cost optimization (idle shutdown, right-sizing, downsizing)
    - Performance (scale-up, restart scheduling)
    - Security (disable public access, IAM hardening)
    - Graph-based (network segmentation, blast radius reduction)

    Results are sorted: High → Medium → Low priority.
    """
    try:
        data = generate_recommendations(db)
        logger.info(f"[RECOMMEND] count={data['count']} savings=${data['total_potential_savings']}")

        items = [
            RecommendationItem(
                resource_name=r["resource_name"],
                resource_type=r.get("resource_type"),
                action=r["action"],
                reason=r["reason"],
                priority=r["priority"],
                category=r["category"],
                estimated_savings=r["estimated_savings"],
            )
            for r in data["recommendations"]
        ]

        return RecommendResponse(
            recommendations=items,
            total_potential_savings=data["total_potential_savings"],
            count=data["count"],
        )

    except Exception as e:
        logger.error(f"[RECOMMEND] Error: {e}")
        raise
