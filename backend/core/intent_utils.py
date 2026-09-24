
AGENT_KEYWORDS = [
    "what if", "simulate", "optimize", "optimize all", "run agent",
    "full analysis", "agent mode", "deep dive", "comprehensive",
    "complete analysis", "audit", "diagnose all",
]

DATA_KEYWORDS = [
    "cost", "spending", "anomal", "predict", "forecast", "risk",
    "resource", "usage", "cpu", "memory", "utilization", "recommend",
    "saving", "efficient", "idle", "over-utilized", "health",
    "security", "graph", "topology", "blast radius", "attack",
]

GREETING_PHRASES = {
    "hi", "hello", "hey", "hii", "hey there",
    "good morning", "good afternoon", "good evening", "yo",
}

IDENTITY_PHRASES = [
    "who are you", "what is your name", "what is cloudiq",
    "introduce yourself", "what can you do", "help",
]

def resolve_intent(message: str) -> str:
    lower = message.lower().strip()

    if any(kw in lower for kw in ["terminate", "kill", "shut down", "delete"]) and "idle" in lower:
        return "terminate_idle"
    if "stage action" in lower and ("terminate" in lower or "stop" in lower):
        return "terminate_idle"
    if any(kw in lower for kw in ["stop", "terminate", "kill", "shut down", "disable"]) and any(kw in lower for kw in ["risky", "unhealthy", "overutilized", "over-utilized", "over utilized"]):
        return "stop_risky_resources"
    if "globe" in lower or "map" in lower:
        return "navigate_globe"
    if "graph" in lower or "network" in lower:
        return "navigate_graph"

    if any(kw in lower for kw in AGENT_KEYWORDS):
        return "agent_mode"

    if "theme" in lower or "dark mode" in lower or "light mode" in lower:
        return "ui_theme_control"

    if any(kw in lower for kw in ["anomal", "spike", "unusual", "alert"]):
        return "detect_anomalies"

    if any(kw in lower for kw in ["predict", "forecast", "next month", "future cost"]):
        return "predict_costs"

    if any(kw in lower for kw in ["risk", "blast radius", "attack path", "security"]):
        return "predict_resource_risk"

    if any(kw in lower for kw in ["resource", "cpu", "memory", "idle", "usage", "utiliz"]):
        return "analyze_resources"

    if any(kw in lower for kw in DATA_KEYWORDS):
        return "analyze_resources"

    return "none"
