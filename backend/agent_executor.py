from tools import get_tool_data
from sqlalchemy.orm import Session

def execute_plan(plan: list, db: Session) -> dict:
    results = {}
    
    for item in plan:
        try:
            step_num = item.get("step", "unknown")
            action = item.get("action", "")
            
            if not action:
                continue
                
            data = get_tool_data(action, db)
            
            if not data or "error" in data:
                results[f"step_{step_num}_{action}"] = {"status": "failed or empty", "data": data}
            else:
                results[f"step_{step_num}_{action}"] = {
                    "status": "success", 
                    "data": data, 
                    "reasoning": item.get("reason", "")
                }
                
        except Exception as e:
            step_key = f"step_{item.get('step', 'unknown')}_{item.get('action', 'unknown')}"
            results[step_key] = {"error": f"Failed executing step: {str(e)}"}
            continue
            
    return results
