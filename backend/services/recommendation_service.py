"""
services/recommendation_service.py
------------------------------------
Recommendation engine for CloudIQ v2.
Merges CloudIQ recommendation logic with Cloud_Project security analysis.

Categories:
  cost        → idle termination, right-sizing, downsize opportunities
  performance → scale up over-utilized, restart long-running
  security    → disable public access, reduce connectivity, add encryption
  graph       → segment high-connectivity nodes, isolate high-risk chains
"""

import logging
import time
from typing import List, Dict
from sqlalchemy.orm import Session

from models.models import CloudResource, Recommendation
from services.graph_service import build_graph, compute_risk_analysis

logger = logging.getLogger("cloudiq.recommendation_service")

PRIORITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}

# ── In-memory cache (60s TTL) ─────────────────────────────────────────────────
_rec_cache: dict = {"result": None, "ts": 0.0}
CACHE_TTL = 60  # seconds


# ══════════════════════════════════════════════════════════════════════════════
#  COST RECOMMENDATIONS
# ══════════════════════════════════════════════════════════════════════════════

def _cost_recommendations(resources: List[CloudResource]) -> List[Dict]:
    recs = []
    for r in resources:
        monthly = r.monthly_cost or (r.hourly_cost * 24 * 30)

        if r.status == "Idle":
            recs.append({
                "resource_name":     r.name,
                "resource_type":     r.resource_type,
                "action":            "Terminate or Stop Instance",
                "reason":            f"CPU {r.cpu_usage:.0f}% and memory {r.memory_usage:.0f}%. Resource is idle — wasting ${monthly:.2f}/mo.",
                "priority":          "High",
                "category":          "cost",
                "estimated_savings": round(monthly * 0.95, 2),
                "resource_id":       r.id,
            })
        elif r.status == "Over-Utilized":
            recs.append({
                "resource_name":     r.name,
                "resource_type":     r.resource_type,
                "action":            "Scale Up or Upgrade Instance",
                "reason":            f"CPU {r.cpu_usage:.0f}% and memory {r.memory_usage:.0f}%. Scale up to prevent failure.",
                "priority":          "High",
                "category":          "performance",
                "estimated_savings": round(-monthly * 0.15, 2),  # cost increase to prevent bigger loss
                "resource_id":       r.id,
            })
        elif r.cpu_usage and r.cpu_usage < 30 and r.memory_usage and r.memory_usage < 35:
            recs.append({
                "resource_name":     r.name,
                "resource_type":     r.resource_type,
                "action":            "Downsize to Smaller Instance",
                "reason":            f"CPU {r.cpu_usage:.0f}% and memory {r.memory_usage:.0f}%. Right-size for cost savings.",
                "priority":          "Medium",
                "category":          "cost",
                "estimated_savings": round(monthly * 0.40, 2),
                "resource_id":       r.id,
            })

        if r.uptime_hours and r.uptime_hours > 600:
            recs.append({
                "resource_name":     r.name,
                "resource_type":     r.resource_type,
                "action":            "Schedule Restart / Maintenance Window",
                "reason":            f"Uptime {r.uptime_hours:.0f}h — schedule restart to clear memory leaks and apply patches.",
                "priority":          "Medium",
                "category":          "performance",
                "estimated_savings": 0.0,
                "resource_id":       r.id,
            })

    return recs


# ══════════════════════════════════════════════════════════════════════════════
#  SECURITY / GRAPH RECOMMENDATIONS
# ══════════════════════════════════════════════════════════════════════════════

def _security_recommendations(db: Session, resources: List[CloudResource]) -> List[Dict]:
    """
    Graph-aware security recommendations.
    Checks public_access, sensitivity, high connectivity, and error rates.
    """
    try:
        G = build_graph(db)
    except Exception:
        G = None

    recs = []
    for r in resources:
        connectivity = G.degree(r.id) if G and r.id in G else 0

        if r.public_access:
            recs.append({
                "resource_name":     r.name,
                "resource_type":     r.resource_type,
                "action":            "Disable Public Access",
                "reason":            f"'{r.name}' is publicly accessible. This is a major exposure risk — restrict to VPC/private subnet.",
                "priority":          "High",
                "category":          "security",
                "estimated_savings": 0.0,
                "resource_id":       r.id,
            })

        if connectivity > 4:
            recs.append({
                "resource_name":     r.name,
                "resource_type":     r.resource_type,
                "action":            "Segment Network — Reduce Connectivity",
                "reason":            f"'{r.name}' has {connectivity} connections. High connectivity = large blast radius. Introduce network segmentation.",
                "priority":          "High",
                "category":          "graph",
                "estimated_savings": 0.0,
                "resource_id":       r.id,
            })
        elif connectivity > 2:
            recs.append({
                "resource_name":     r.name,
                "resource_type":     r.resource_type,
                "action":            "Review Network Dependencies",
                "reason":            f"'{r.name}' has {connectivity} connections. Review if all dependencies are necessary.",
                "priority":          "Medium",
                "category":          "graph",
                "estimated_savings": 0.0,
                "resource_id":       r.id,
            })

        if r.sensitivity == "High":
            recs.append({
                "resource_name":     r.name,
                "resource_type":     r.resource_type,
                "action":            "Enable Encryption + Strict IAM Policies",
                "reason":            f"'{r.name}' handles highly sensitive data. Apply data-at-rest encryption and enforce least-privilege IAM.",
                "priority":          "High",
                "category":          "security",
                "estimated_savings": 0.0,
                "resource_id":       r.id,
            })

        if r.error_rate and r.error_rate > 5:
            recs.append({
                "resource_name":     r.name,
                "resource_type":     r.resource_type,
                "action":            "Investigate High Error Rate",
                "reason":            f"'{r.name}' has {r.error_rate:.1f}% error rate. Investigate logs, add circuit breaker, and retry logic.",
                "priority":          "High",
                "category":          "performance",
                "estimated_savings": 0.0,
                "resource_id":       r.id,
            })

    return recs


# ══════════════════════════════════════════════════════════════════════════════
#  COMBINED RECOMMENDATION ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def generate_recommendations(db: Session) -> Dict:
    """
    Run all recommendation checks and persist results to DB.
    Returns sorted list + total potential savings.
    Results are cached for 60 seconds to prevent DB thrashing on every poll.
    """
    # ── Cache hit: skip expensive DB delete+reinsert ──────────────────────────
    if _rec_cache["result"] and time.time() - _rec_cache["ts"] < CACHE_TTL:
        logger.info("[RECOMMEND] Returning cached recommendations")
        return _rec_cache["result"]
    resources = db.query(CloudResource).all()

    cost_recs     = _cost_recommendations(resources)
    security_recs = _security_recommendations(db, resources)
    all_recs      = cost_recs + security_recs

    # Sort: High → Medium → Low, then by savings desc
    all_recs.sort(key=lambda x: (
        PRIORITY_ORDER.get(x["priority"], 2),
        -x["estimated_savings"]
    ))

    # Persist to DB — clear old, bulk insert new
    db.query(Recommendation).delete()
    if all_recs:
        # Build name-to-id map to prevent N+1 query loop
        name_to_id = {r.name: r.id for r in db.query(CloudResource.name, CloudResource.id).all()}
        db.bulk_insert_mappings(
            Recommendation,
            [
                dict(
                    resource_id=name_to_id.get(rec["resource_name"]),
                    resource_name=rec["resource_name"],
                    resource_type=rec.get("resource_type"),
                    action=rec["action"],
                    reason=rec["reason"],
                    priority=rec["priority"],
                    category=rec.get("category", "cost"),
                    estimated_savings=rec.get("estimated_savings", 0.0),
                )
                for rec in all_recs
            ]
        )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[RECOMMEND] DB commit failed: {e}")

    total_savings = sum(r["estimated_savings"] for r in all_recs if r["estimated_savings"] > 0)
    logger.info(f"[RECOMMEND] Generated {len(all_recs)} recommendations. Total savings: ${total_savings:.2f}")

    result = {
        "recommendations":         all_recs,
        "total_potential_savings": round(total_savings, 2),
        "count":                   len(all_recs),
    }

    # \u2500\u2500 Store in cache \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    _rec_cache["result"] = result
    _rec_cache["ts"] = time.time()
    return result
