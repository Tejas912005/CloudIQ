import json
from gemini_config import create_model, get_api_key

def reflect_on_results(goal: str, results: dict) -> dict:
    """
    Use Gemini to analyze results and output structured JSON with confidence and priority.
    """
    if not get_api_key():
        return {"confidence": "Low", "error": "Missing API Key"}

    model = create_model()
    if not model:
        return {"confidence": "Low", "error": "Model unavailable"}
    
    prompt = f"""
    The user's original goal was: "{goal}"
    
    The agent executed a series of tools. Here are the raw results:
    {json.dumps(results)}
    
    Analyze whether the problem is solved and extract insights. 
    You MUST output ONLY valid JSON containing the following structure. Do not use markdown wrappers.
    {{
       "confidence": "High/Medium/Low",
       "findings": ["finding 1", "finding 2"],
       "recommendations": [
           {{"priority": "High", "text": "action 1"}},
           {{"priority": "Medium", "text": "action 2"}}
       ],
       "estimated_impact": "impact desc based on data"
    }}
    """
    
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"): text = text[7:-3].strip()
        elif text.startswith("```"): text = text[3:-3].strip()
        return json.loads(text)
    except Exception as e:
        return {"confidence": "Low", "error": f"Reflection Error: {str(e)}"}
