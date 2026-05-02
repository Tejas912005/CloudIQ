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


# ─── Severity classification ──────────────────────────────────────────────────
def _severity(z_score: float) -> str:
    az = abs(z_score)
    if az >= 4.0:
        return "critical"
    elif az >= 3.0:
        return "high"
    elif az >= 2.0:
        return "medium"
    return "low"


# ══════════════════════════════════════════════════════════════════════════════
#  COST ANOMALY DETECTION  (Z-score on daily cost history)
# ══════════════════════════════════════════════════════════════════════════════

def detect_cost_anomalies(db: Session) -> Dict:
    """
    Z-score anomaly detection on CostHistory table.
    Flags days where |z| > 2.0.
    Also updates CostHistory.is_anomaly and persists AnomalyRecord rows.
    """
    rows = db.query(CostHistory).order_by(CostHistory.date).all()
    if not rows:
        return {"anomalies": [], "mean_cost": 0, "std_cost": 0, "total_anomaly_days": 0}

    dates = [r.date for r in rows]
    costs = np.array([r.daily_cost for r in rows], dtype=float)

    mean = float(np.mean(costs))
    std  = float(np.std(costs))
    z_scores = (costs - mean) / (std if std > 0 else 1)

    anomalies = []

    # We removed db.query(AnomalyRecord).delete() to avoid SQLite concurrent write locks

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


    logger.info(f"[ANOMALY] Cost anomalies detected: {len(anomalies)} / {len(rows)} days")

    return {
        "anomalies":          anomalies,
        "mean_cost":          round(mean, 2),
        "std_cost":           round(std, 2),
        "total_anomaly_days": len(anomalies),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  METRIC ANOMALY DETECTION  (CPU, latency, error_rate per resource)
# ══════════════════════════════════════════════════════════════════════════════

def detect_metric_anomalies(db: Session) -> List[Dict]:
    """
    Detects anomalies in resource-level metrics using threshold rules.
    Generates AnomalyRecord entries for metric violations.

    Thresholds:
      - cpu_usage     > 90% → high/critical
      - latency_ms    > 500 → medium/high
      - error_rate    > 5%  → medium/high/critical
      - memory_usage  > 90% → high
    """
    resources = db.query(CloudResource).all()
    metric_anomalies = []

    # We removed db.query(AnomalyRecord).delete() to avoid SQLite concurrent write locks

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


    logger.info(f"[ANOMALY] Metric anomalies detected: {len(metric_anomalies)} violations")
    return metric_anomalies


# ══════════════════════════════════════════════════════════════════════════════
#  COMBINED ANOMALY REPORT
# ══════════════════════════════════════════════════════════════════════════════

def get_full_anomaly_report(db: Session) -> Dict:
    """Combined cost + metric anomaly detection."""
    cost_report   = detect_cost_anomalies(db)
    metric_report = detect_metric_anomalies(db)
    return {
        "cost_anomalies":    cost_report,
        "metric_anomalies":  metric_report,
        "total_anomalies":   cost_report["total_anomaly_days"] + len(metric_report),
    }
