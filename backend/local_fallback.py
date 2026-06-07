from tools import get_tool_data


def infer_intent_from_keywords(message: str) -> str:
    text = message.lower()

    # --- AGENTIC MUTATION INTENTS (High Specificity) ---
    if any(keyword in text for keyword in ["terminate", "kill", "shut down", "delete"]) and "idle" in text:
        return "terminate_idle"
        
    # --- AGENTIC UI INTENTS (High Specificity) ---
    if "globe" in text or "map" in text:
        return "navigate_globe"
    if "graph" in text or "network" in text:
        return "navigate_graph"
    if any(keyword in text for keyword in ["theme", "accent", "color", "font", "style", "appearance", "dark mode", "light mode", "layout", "css", "background"]):
        return "ui_theme_control"

    # --- AGENTIC EXECUTION INTENTS (High Specificity) ---
    # Stop unhealthy / risky / over-utilized resources -> simulated over-utilized mitigation
    if any(keyword in text for keyword in ["stop", "terminate", "kill", "shut down", "disable"]) and any(keyword in text for keyword in ["risky", "unhealthy", "overutilized", "over-utilized", "over utilized", "over-utilized"]):
        return "stop_risky_resources"

    if any(keyword in text for keyword in ["stop", "terminate", "kill", "shut down", "disable"]) and any(keyword in text for keyword in ["overutilized", "over-utilized", "over utilized"]):
        return "stop_overutilized_resources"


    # --- GENERAL ANALYSIS INTENTS ---
    if any(keyword in text for keyword in ["summary", "overview", "status"]) and any(keyword in text for keyword in ["cloud", "system", "cost", "resource", "infrastructure"]):
        return "agent_mode"
    if any(keyword in text for keyword in ["optimize", "improve", "save", "recommend", "action", "security", "audit", "what if", "simulate"]):
        return "agent_mode"
    if any(keyword in text for keyword in ["anomaly", "spike", "unexpected", "surge", "weird spend"]):
        return "detect_anomalies"
    if any(keyword in text for keyword in ["cost", "spend", "billing"]):
        return "predict_costs"
    if any(keyword in text for keyword in ["forecast", "predict", "trend", "future cost", "next month", "budget"]):
        return "predict_costs"
    if any(keyword in text for keyword in ["risk", "failure", "downtime", "unstable", "crash"]):
        return "predict_resource_risk"
    if any(keyword in text for keyword in ["resource", "instance", "server", "idle", "utilization", "cpu", "memory"]):
        return "analyze_resources"

    # --------------------------
    
    return "none"


def _format_currency(amount):
    return f"${amount:,.2f}"


def _format_resource_analysis(data):
    return (
        "Summary\n"
        f"- Total resources: {data['total_resources']}\n"
        f"- Idle resources: {data['idle_count']}\n"
        f"- Over-utilized resources: {data['over_utilized_count']}\n"
        f"- Healthy resources: {data['healthy_count']}\n"
        f"- Estimated monthly cost: {_format_currency(data['total_monthly_cost'])}\n\n"
        "Recommended next step\n"
        "- Review idle instances first, then right-size any over-utilized workloads."
    )


def _format_anomalies(data):
    if not data["anomalies"]:
        return (
            "Summary\n"
            "- No strong cost anomalies were detected in the current dataset.\n\n"
            "Recommended next step\n"
            "- Keep monitoring the daily cost trend and validate recent configuration changes."
        )

    lines = [
        "Summary",
        f"- Detected {data['total_anomaly_days']} anomaly days.",
        f"- Baseline daily cost: {_format_currency(data['mean_cost'])}",
        "",
        "Top anomaly days",
    ]
    for item in data["anomalies"][:3]:
        lines.append(
            f"- {item['date']}: {_format_currency(item['daily_cost'])} "
            f"(deviation {_format_currency(item['deviation'])}, z-score {item['z_score']})"
        )
    lines.extend([
        "",
        "Recommended next step",
        "- Investigate deployments, traffic spikes, or one-time jobs on the flagged dates.",
    ])
    return "\n".join(lines)


def _format_cost_forecast(data):
    forecast_points = data["forecast"][:3]
    lines = [
        "Summary",
        f"- Cost trend: {data['trend_direction']}",
        f"- Forecast for next 30 days: {_format_currency(data['monthly_forecast'])}",
        f"- Trend slope: {data['trend_slope']}",
        "",
        "Next forecast points",
    ]
    for item in forecast_points:
        lines.append(f"- {item['date']}: {_format_currency(item['predicted'])}")
    lines.extend([
        "",
        "Recommended next step",
        "- Compare the forecast against current budget thresholds and anomaly dates.",
    ])
    return "\n".join(lines)


def _format_risks(data):
    if not data:
        return (
            "Summary\n"
            "- No immediate high-risk resources were detected.\n\n"
            "Recommended next step\n"
            "- Continue tracking CPU, memory, uptime, and efficiency for early warning signals."
        )

    lines = [
        "Summary",
        f"- Identified {len(data)} resources with elevated operational risk.",
        "",
        "Top risk items",
    ]
    for item in data[:3]:
        reasons = ", ".join(item["reasons"])
        lines.append(
            f"- {item['name']} ({item['type']}): {item['risk_level']} risk "
            f"with score {item['risk_score']} because of {reasons}"
        )
    lines.extend([
        "",
        "Recommended next step",
        "- Scale or restart the highest-risk resources before they become performance incidents.",
    ])
    return "\n".join(lines)


def _format_agent_summary():
    analysis = get_tool_data("analyze_resources") or {}
    anomalies = get_tool_data("detect_anomalies") or {}
    forecast = get_tool_data("predict_costs") or {}
    risks = (get_tool_data("predict_resource_risk") or {}).get("high_risk_resources", [])
    recommendations = get_tool_data("generate_recommendations") or {}
    cost_anomalies = anomalies.get("cost_anomalies", anomalies)

    lines = [
        "Summary",
        f"- Total resources: {analysis.get('total_resources', 0)}",
        f"- Estimated monthly cost: {_format_currency(analysis.get('total_monthly_cost', 0))}",
        f"- Idle resources: {analysis.get('idle_count', 0)}",
        f"- Over-utilized resources: {analysis.get('over_utilized_count', 0)}",
        f"- Cost anomaly days: {cost_anomalies.get('total_anomaly_days', 0)}",
        f"- 30-day forecast: {_format_currency(forecast.get('monthly_forecast', 0))}",
        f"- Potential savings: {_format_currency(recommendations.get('total_potential_savings', 0))}",
        "",
        "Key findings",
    ]

    if analysis.get("idle_count"):
        lines.append(f"- {analysis['idle_count']} idle resources are the fastest savings opportunity.")
    if analysis.get("over_utilized_count"):
        lines.append(f"- {analysis['over_utilized_count']} resources are under pressure and may need scaling.")
    if cost_anomalies.get("total_anomaly_days"):
        lines.append(f"- {cost_anomalies['total_anomaly_days']} cost spikes need investigation.")
    if risks:
        lines.append(f"- Highest risk resource: {risks[0]['name']} with score {risks[0]['risk_score']}.")

    lines.extend([
        "",
        "Recommended actions",
    ])
    for rec in recommendations.get("recommendations", [])[:3]:
        lines.append(
            f"- [{rec['priority']}] {rec['action']} for {rec['resource_name']} "
            f"(impact {_format_currency(rec['estimated_savings'])})"
        )

    lines.extend([
        "",
        "Note",
        "- This response used CloudIQ local analytics because the Gemini service is currently unavailable.",
    ])
    return "\n".join(lines)


def generate_local_response(message: str, intent: str, context_data=None) -> str:
    """
    Generate a smart, friendly local response when LLMs (Gemini & Groq) are offline.
    Handles conversational greetings, basic math, and intent routing seamlessly.
    """
    message_lower = message.strip().lower()

    # 1. Handle Greetings & Basic Interaction
    if message_lower in ["hi", "hello", "hey", "hii", "hey there", "good morning", "good afternoon", "yo"]:
        return (
            "Hello! I am CloudIQ, your AI-powered cloud intelligence assistant. "
            "Although my primary AI connection is temporarily offline, I can still help you analyze your cloud infrastructure! "
            "How can I help you today? You can ask me to:\n"
            "- Analyze cloud resource utilization\n"
            "- Detect cost anomalies or spikes\n"
            "- Predict next 30 days costs\n"
            "- Identify operational risks and failing instances"
        )

    # 2. Handle Identity / Capability Questions
    if any(q in message_lower for q in ["who are you", "what is your name", "what is cloudiq", "introduce yourself"]):
        return (
            "I am CloudIQ, your intelligent cloud architect and cost optimization assistant. "
            "I am designed to monitor cloud resources, track and forecast spending, detect operational risks, "
            "and suggest actionable optimizations to save money and improve efficiency."
        )

    if any(q in message_lower for q in ["help", "capabilities", "what can you do", "features"]):
        return (
            "I can help you monitor and optimize your cloud infrastructure. Here are the core analyses I can perform:\n\n"
            "1. **Resource Analysis**: Ask about 'resource usage' or 'idle servers'.\n"
            "2. **Anomaly Detection**: Ask about 'cost spikes' or 'unexpected spend'.\n"
            "3. **Cost Forecasting**: Ask to 'predict next 30 days cost'.\n"
            "4. **Risk Assessment**: Ask about 'system risks' or 'downtime factors'.\n"
            "5. **Optimization**: Ask for 'recommendations' or 'how to save money'."
        )

    # 3. Handle Math Questions (e.g., "1+1", "what is 1+1") exactly like ChatGPT
    import re
    # Extract expressions like "what is 1 + 1" or "2*3"
    math_match = re.search(r'(?:what\s+is\s+)?([0-9\s+\-*/().]+)(?:\?)?$', message_lower)
    if math_match:
        expr = math_match.group(1).replace(" ", "")
        # Ensure it contains at least one operator to avoid treating plain numbers as math
        if any(op in expr for op in ["+", "-", "*", "/"]):
            try:
                # Safe evaluation of basic math expressions
                allowed_chars = set("0123456789+-*/().")
                if all(c in allowed_chars for c in expr):
                    result = eval(expr, {"__builtins__": None}, {})
                    # Return direct clean result like '2'
                    return str(result)
            except Exception:
                pass

    # 4. Route standard intent-based responses
    if intent == "analyze_resources":
        return _format_resource_analysis(context_data or get_tool_data("analyze_resources"))
    if intent == "detect_anomalies":
        return _format_anomalies(context_data or get_tool_data("detect_anomalies"))
    if intent == "predict_costs":
        return _format_cost_forecast(context_data or get_tool_data("predict_costs"))
    if intent == "predict_resource_risk":
        # Extract high risk resources
        risk_data = context_data or get_tool_data("predict_resource_risk") or {}
        high_risks = risk_data.get("high_risk_resources", risk_data) if isinstance(risk_data, dict) else risk_data
        return _format_risks(high_risks)
    if intent == "agent_mode":
        return _format_agent_summary()

    # 5. Default conversational response for other general questions
    return (
        f"I received your message: \"{message}\"\n\n"
        "Currently, our cloud AI connection (Gemini/Groq) is undergoing maintenance or rate limiting. "
        "However, I can still perform complete local analytics on your cloud database! "
        "Try asking me one of the following:\n"
        "- *\"Show me resource usage statistics\"*\n"
        "- *\"Predict my next 30 days cost\"*\n"
        "- *\"Are there any cost anomalies or spikes?\"*\n"
        "- *\"Give me cost optimization recommendations\"*"
    )




