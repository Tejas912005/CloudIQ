"""
services/anomaly_service.py
----------------------------
Anomaly detection service for CloudIQ v2.
Upgraded from CloudIQ's anomaly_detector.py to:
  - Use SQLAlchemy ORM instead of raw sqlite3
  - Detect anomalies in BOTH cost history AND resource metrics (CPU, latency, error_rate)
  - Persist detected anomalies to AnomalyRecord table
  - Return structured results with severity classification
"""

import logging
import numpy as np
from datetime import datetime
from typing import List, Dict
from sqlalchemy.orm import Session

from models.models import CostHistory, CloudResource, AnomalyRecord

logger = logging.getLogger("cloudiq.anomaly_service")


# â”€â”€â”€ Severity classification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import time

_cost_cache = {"result": None, "ts": 0.0}
_metric_cache = {"result": None, "ts": 0.0}
CACHE_TTL = 60

def _format_currency_simple(amount: float) -> str:
    return f"${amount:,.2f}"


# â”€â”€â”€ Severity classification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _severity(z_score: float) -> str:
    az = abs(z_score)
    if az >= 4.0:
        return "critical"
    elif az >= 3.0:
        return "high"
    elif az >= 2.0:
        return "medium"
    return "low"


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
#  COST ANOMALY DETECTION  (Z-score on daily cost history)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def detect_cost_anomalies(db: Session) -> Dict:
    """
    Z-score anomaly detection on CostHistory table.
    Flags days where |z| > 2.0.
    Also updates CostHistory.is_anomaly and persists AnomalyRecord rows.
    """
    global _cost_cache
    now_ts = time.time()
    if _cost_cache["result"] is not None and now_ts - _cost_cache["ts"] < CACHE_TTL:
        return _cost_cache["result"]

    rows = db.query(CostHistory).order_by(CostHistory.date).all()
    if not rows:
        return {"anomalies": [], "mean_cost": 0, "std_cost": 0, "total_anomaly_days": 0}

    dates = [r.date for r in rows]
    costs = np.array([r.daily_cost for r in rows], dtype=float)

    mean = float(np.mean(costs))
    std  = float(np.std(costs))
    z_scores = (costs - mean) / (std if std > 0 else 1)

    anomalies = []

    # Clear old cost anomaly records
    db.query(AnomalyRecord).filter(AnomalyRecord.anomaly_type == "cost").delete()

    for row, z, cost in zip(rows, z_scores, costs):
        is_anomaly = abs(z) > 2.0
        row.is_anomaly = 1 if is_anomaly else 0

        if is_anomaly:
            sev = _severity(z)
            deviation = float(cost - mean)
            anomalies.append({
                "date":       row.date,
                "daily_cost": round(float(cost), 2),
                "z_score":    round(float(z), 2),
                "deviation":  round(deviation, 2),
                "severity":   sev,
            })
            
            db.add(AnomalyRecord(
                anomaly_type="cost",
                date=row.date,
                value=round(float(cost), 2),
                z_score=round(float(z), 2),
                deviation=round(deviation, 2),
                severity=sev,
                description=f"Daily spend anomaly detected: daily cost was {_format_currency_simple(cost)} (deviation: {_format_currency_simple(deviation)})"
            ))

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[ANOMALY] Failed to commit cost anomalies: {e}")

    logger.info(f"[ANOMALY] Cost anomalies detected: {len(anomalies)} / {len(rows)} days")

    result = {
        "anomalies":          anomalies,
        "mean_cost":          round(mean, 2),
        "std_cost":           round(std, 2),
        "total_anomaly_days": len(anomalies),
    }
    _cost_cache["result"] = result
    _cost_cache["ts"] = now_ts
    return result


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
#  METRIC ANOMALY DETECTION  (CPU, latency, error_rate per resource)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def detect_metric_anomalies(db: Session) -> List[Dict]:
    """
    Detects anomalies in resource-level metrics using threshold rules.
    Generates AnomalyRecord entries for metric violations.

    Thresholds:
      - cpu_usage     > 90% â†’ high/critical
      - latency_ms    > 500 â†’ medium/high
      - error_rate    > 5%  â†’ medium/high/critical
      - memory_usage  > 90% â†’ high
    """
    global _metric_cache
    now_ts = time.time()
    if _metric_cache["result"] is not None and now_ts - _metric_cache["ts"] < CACHE_TTL:
        return _metric_cache["result"]

    resources = db.query(CloudResource).all()
    metric_anomalies = []

    # Clear old metric anomalies
    db.query(AnomalyRecord).filter(AnomalyRecord.anomaly_type != "cost").delete()

    today = datetime.utcnow().strftime("%Y-%m-%d")

    for r in resources:
        checks = [
            ("cpu",        r.cpu_usage,    90.0,  "CPU usage"),
            ("memory",     r.memory_usage, 90.0,  "Memory usage"),
            ("latency",    r.latency_ms,   500.0, "Response latency (ms)"),
            ("error_rate", r.error_rate,   5.0,   "Error rate (%)"),
        ]
        for metric_type, value, threshold, label in checks:
            if value and value > threshold:
                # Simple severity scaling
                ratio = value / threshold
                if ratio >= 2.0:
                    sev = "critical"
                elif ratio >= 1.5:
                    sev = "high"
                else:
                    sev = "medium"

                desc = f"{label} is {value:.1f} (threshold: {threshold})"
                metric_anomalies.append({
                    "resource_name": r.name,
                    "resource_uid":  r.resource_uid,
                    "metric":        metric_type,
                    "value":         round(value, 2),
                    "threshold":     threshold,
                    "severity":      sev,
                    "description":   desc,
                })
                
                db.add(AnomalyRecord(
                    resource_id=r.id,
                    anomaly_type=metric_type,
                    date=today,
                    value=round(value, 2),
                    z_score=0.0,
                    deviation=round(value - threshold, 2),
                    severity=sev,
                    description=desc
                ))

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[ANOMALY] Failed to commit metric anomalies: {e}")

    logger.info(f"[ANOMALY] Metric anomalies detected: {len(metric_anomalies)} violations")
    
    _metric_cache["result"] = metric_anomalies
    _metric_cache["ts"] = now_ts
    return metric_anomalies


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
#  COMBINED ANOMALY REPORT
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def get_full_anomaly_report(db: Session) -> Dict:
    """Combined cost + metric anomaly detection."""
    cost_report   = detect_cost_anomalies(db)
    metric_report = detect_metric_anomalies(db)
    return {
        "cost_anomalies":    cost_report,
        "metric_anomalies":  metric_report,
        "total_anomalies":   cost_report["total_anomaly_days"] + len(metric_report),
    }
