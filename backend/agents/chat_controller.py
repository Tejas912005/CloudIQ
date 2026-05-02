"""
agents/chat_controller.py
--------------------------
Agentic chat controller for CloudIQ v2.
Replaces chatbot.py — agents now ORCHESTRATE only, no heavy logic.
All data retrieval and AI calls go through services.

Architecture:
  chat() → determines intent → fetches context via services → calls gemini_service
  If Gemini fails → gemini_service.generate_response() handles fallback internally

Chat history is persisted in SQLAlchemy ChatLog (not in-memory).
"""

import logging
from typing import Optional
from sqlalchemy.orm import Session

from models.models import ChatLog
from local_fallback import infer_intent_from_keywords
from services.gemini_service import generate_response

logger = logging.getLogger("cloudiq.agents.chat_controller")


# ── Intent → tool data mapper ─────────────────────────────────────────────────

def _get_context_data(intent: str, db: Session) -> Optional[dict]:
    """Fetch structured data from appropriate service based on intent."""
    try:
        if intent == "analyze_resources":
            from services.anomaly_service import detect_cost_anomalies
            from models.models import CloudResource
            resources = db.query(CloudResource).all()
            anomaly_data = detect_cost_anomalies(db)
            return {
                "total_resources":     len(resources),
                "idle_count":          sum(1 for r in resources if r.status == "Idle"),
                "over_utilized_count": sum(1 for r in resources if r.status == "Over-Utilized"),
                "healthy_count":       sum(1 for r in resources if r.status == "Healthy"),
                "total_monthly_cost":  round(sum((r.monthly_cost or 0) for r in resources), 2),
                "anomaly_days":        anomaly_data["total_anomaly_days"],
            }

        elif intent == "detect_anomalies":
            from services.anomaly_service import get_full_anomaly_report
            return get_full_anomaly_report(db)

        elif intent == "predict_costs":
            from services.prediction_service import predict_costs
            return predict_costs(db)

        elif intent == "predict_resource_risk":
            from services.prediction_service import predict_resource_risk
            risks = predict_resource_risk(db)
            return {"high_risk_resources": risks}

        elif intent == "agent_mode":
            # Full summary data for agent mode
            from services.anomaly_service import detect_cost_anomalies
            from services.prediction_service import predict_costs, predict_resource_risk
            from services.recommendation_service import generate_recommendations
            from models.models import CloudResource

            resources    = db.query(CloudResource).all()
            anomalies    = detect_cost_anomalies(db)
            predictions  = predict_costs(db)
            risks        = predict_resource_risk(db)
            recs         = generate_recommendations(db)

            return {
                "AGENT_MODE_WORKFLOW": True,
                "tools_used": ["analyze_resources", "detect_anomalies", "predict_costs",
                                "predict_resource_risk", "generate_recommendations"],
                "results": {
                    "total_resources":     len(resources),
                    "idle_count":          sum(1 for r in resources if r.status == "Idle"),
                    "over_utilized_count": sum(1 for r in resources if r.status == "Over-Utilized"),
                    "total_monthly_cost":  round(sum((r.monthly_cost or 0) for r in resources), 2),
                    "anomaly_days":        anomalies["total_anomaly_days"],
                    "monthly_forecast":    predictions["monthly_forecast"],
                    "trend_direction":     predictions["trend_direction"],
                    "top_risks":           risks[:3],
                    "top_recommendations": recs["recommendations"][:3],
                    "total_savings":       recs["total_potential_savings"],
                },
            }

    except Exception as e:
        logger.error(f"[CHAT_CTRL] Context data fetch failed for intent={intent}: {e}")
    return None


# ── Chat history loader ────────────────────────────────────────────────────────

def _load_history(db: Session, limit: int = 10) -> list:
    """Load last N chat turns from DB as Gemini-compatible history."""
    logs = (
        db.query(ChatLog)
        .order_by(ChatLog.created_at.desc())
        .limit(limit)
        .all()
    )
    logs = list(reversed(logs))
    history = []
    for log in logs:
        role = "user" if log.role == "user" else "model"
        history.append({"role": role, "parts": [{"text": log.message}]})
    return history


def _run_agent_loop(goal: str, db: Session) -> dict:
    from agent_planner import generate_plan
    from agent_executor import execute_plan
    from agent_reflector import reflect_on_results
    from agent_decider import decide_next_action
    
    max_iterations = 3
    iteration = 0
    all_results = {}
    
    plan = generate_plan(goal)
    if not plan:
        # Fallback to direct context fetch
        return _get_context_data("agent_mode", db)
    
    while iteration < max_iterations:
        results = execute_plan(plan)
        all_results.update(results)
        
        reflection = reflect_on_results(goal, all_results)
        decision = decide_next_action(goal, all_results, reflection)
        
        if decision.get("goal_achieved", True):
            break
        
        next_step = decision.get("next_step", "none")
        if next_step and next_step != "none":
            plan = [{"step": 1, "action": next_step, "reason": "Additional context needed"}]
        
        iteration += 1
    
    return {
        "AGENT_MODE_WORKFLOW": True,
        "tools_used": list(all_results.keys()),
        "results": all_results,
        "reflection": reflection,
        "iterations": iteration + 1,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN CHAT FUNCTION
# ══════════════════════════════════════════════════════════════════════════════

def chat(message: str, db: Session) -> dict:
    """
    Main chat entry point.
    1. Determine intent (fast keyword match)
    2. Fetch context data from appropriate service or run agent loop
    3. Call Gemini (or fallback) via gemini_service
    """
    if not message or not message.strip():
        return {"response": "Message cannot be empty", "intent": "error", "status": "error", "mode": "error"}

    # Step 1: Fast keyword intent (no API call)
    from local_fallback import infer_intent_from_keywords
    intent = infer_intent_from_keywords(message)

    # Step 2: Override to agent_mode for complex queries
    agent_keywords = ["what if", "simulate", "optimize", "summary", "overview",
                      "reduce", "improve", "audit", "find issues", "analyze all"]
    if any(kw in message.lower() for kw in agent_keywords):
        intent = "agent_mode"

    logger.info(f"[CHAT_CTRL] message='{message[:60]}...' intent={intent}")

    # Step 3: For agent_mode, run the REAL agent loop
    if intent == "agent_mode":
        context_data = _run_agent_loop(message, db)
    else:
        context_data = _get_context_data(intent, db)

    # Step 4: Single Gemini call for final response
    history = _load_history(db)
    result = generate_response(message, history, context_data)

    return {
        "response": result["response"],
        "intent":   intent,
        "status":   result["status"],
        "mode":     result["mode"],
    }
