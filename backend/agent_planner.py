import json
from gemini_config import create_model, get_api_key

def generate_plan(goal: str) -> list:
    """Uses Gemini to decide the best sequence of tools, returning a structured JSON plan."""
    if not get_api_key():
        return []

    model = create_model()
    if not model:
        return []
    
    prompt = f"""
    The user has given a complex goal: "{goal}"
    Break this goal into a step-by-step plan using ONLY these available tools:
    - analyze_resources
    - detect_anomalies
    - predict_costs
    - predict_resource_risk
    
    You MUST return ONLY a valid JSON array of objects. Do not use markdown wrapping like ```json.
    Format exactly like this:
    [
      {{
        "step": 1,
        "action": "analyze_resources",
        "reason": "Identify idle and over-utilized resources"
      }}
    ]
    """
    
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean markdown wrappers if hallucinated
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        plan = json.loads(text)
        
        # Ensure it's a list
        if isinstance(plan, list):
            return plan
        return []
    except Exception as e:
        print(f"Planner Error: {e}")
        return []
