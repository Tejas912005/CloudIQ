import json
from gemini_config import create_model, get_api_key

def decide_next_action(goal: str, results: dict, reflection: dict) -> dict:
    """
    Decide if the goal is achieved or if we need to refine the plan with more data.
    """
    if not get_api_key():
        return {"goal_achieved": True, "next_step": "none"}

    model = create_model()
    if not model:
        return {"goal_achieved": True, "next_step": "none"}
    
    prompt = f"""
    Goal: "{goal}"
    Results: {json.dumps(results)}
    Reflection: {json.dumps(reflection)}
    
    1. Is the goal comprehensively achieved based on the retrieved data and reflection insights? (yes/no)
    2. Should additional steps be executed to gather missing context?
    If yes, you MUST pick exactly ONE from the available backend tools: [analyze_resources, detect_anomalies, predict_costs, predict_resource_risk].
    
    Output ONLY valid JSON. Do not use markdown wrappers. Format:
    {{
        "goal_achieved": true,
        "next_step": "none"
    }}
    or
    {{
        "goal_achieved": false,
        "next_step": "predict_costs"
    }}
    """
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean markdown
        if text.startswith("```json"): text = text[7:-3].strip()
        elif text.startswith("```"): text = text[3:-3].strip()
        
        return json.loads(text)
    except Exception:
        # Failsafe: terminate the loop
        return {"goal_achieved": True, "next_step": "none"}
