
import logging
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.auth import verify_api_key
from core.database import get_db
from schemas.schemas import ChatRequest, ChatResponse
from models.models import ChatLog
from agents.chat_controller import _get_context_data, _load_history
from core.intent_utils import resolve_intent as _resolve_intent
from services.langchain_router import stream_routed_response

logger = logging.getLogger("cloudiq.router.chat")

router = APIRouter(prefix="/api", tags=["Chat"])

def check_resource_action(message: str, db: Session):
    from models.models import CloudResource
    lower = message.lower()
    
    is_terminate = any(kw in lower for kw in ["terminate", "stop", "kill", "shut down", "delete"])
    is_scale = any(kw in lower for kw in ["scale", "upgrade", "downsize", "resize"])
    is_disable_public = any(kw in lower for kw in ["disable public", "restrict public", "block public", "remove public"])
    
    if not (is_terminate or is_scale or is_disable_public):
        return None
        
    resources = db.query(CloudResource).all()
    for r in resources:
        if r.name.lower() in lower:
            if is_terminate:
                cost_saving = r.monthly_cost or 0.0
                return {
                    "type": "terminate",
                    "resource": r,
                    "title": f"Terminate {r.name}",
                    "description": f"This will safely terminate the single idle resource '{r.name}' in {r.region}. Estimated savings: ${cost_saving:,.2f}/month.",
                    "actionId": f"term_res_{r.id}",
                    "text": f"I found the idle resource '{r.name}'. Please approve the execution card to terminate it and save ${cost_saving:,.2f}/month."
                }
            elif is_scale:
                return {
                    "type": "scale",
                    "resource": r,
                    "title": f"Scale / Resize {r.name}",
                    "description": f"This will resize or scale '{r.name}' to optimize cost and prevent performance saturation.",
                    "actionId": f"scale_res_{r.id}",
                    "text": f"I analyzed '{r.name}'. Please approve the execution card to scale/resize it."
                }
            elif is_disable_public:
                return {
                    "type": "disable_public",
                    "resource": r,
                    "title": f"Disable Public Access for {r.name}",
                    "description": f"This will restrict public network access for '{r.name}' and move it to a private subnet.",
                    "actionId": f"secure_res_{r.id}",
                    "text": f"I identified public access exposure on '{r.name}'. Please approve the execution card to secure it."
                }
    return None

def extract_json_commands(text: str) -> list:
    results = []
    n = len(text)
    i = 0
    while i < n:
        if text[i] == '{':
            brace_count = 0
            in_string = False
            escape = False
            j = i
            while j < n:
                char = text[j]
                if in_string:
                    if escape:
                        escape = False
                    elif char == '\\':
                        escape = True
                    elif char == '"':
                        in_string = False
                else:
                    if char == '"':
                        in_string = True
                    elif char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            block = text[i:j+1]
                            try:
                                parsed = json.loads(block)
                                if isinstance(parsed, dict) and "action" in parsed:
                                    results.append((block, parsed))
                                    i = j
                                    break
                            except Exception:
                                pass
                j += 1
        i += 1
    return results

@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_api_key)])
def chat_endpoint(req: ChatRequest, db: Session = Depends(get_db)):
    try:
        message = req.message.strip()
        intent = _resolve_intent(message)

        res_action = check_resource_action(message, db)
        if res_action:
            full_response = res_action["text"]
        elif intent == "navigate_globe":
            full_response = "Initiating Agentic UI Control... Navigating to Globe View."
        elif intent == "navigate_graph":
            full_response = "Initiating Agentic UI Control... Navigating to Graph View."
        elif intent == "terminate_idle":
            idle_resources = db.query(CloudResource).filter(CloudResource.status == "Idle").all()
            idle_count = len(idle_resources)
            real_savings = round(sum((r.monthly_cost or 0) * 0.95 for r in idle_resources), 2)
            full_response = f"I have identified {idle_count} idle resources. Please approve the execution card to terminate them and save ${real_savings:,.2f}/month."
        elif intent in ["stop_risky_resources", "stop_overutilized_resources"]:
            full_response = "I found 5 high-risk over-utilized resources. Please approve the execution card to stop them and reduce risk."
        else:
            if intent == "agent_mode":
                from agents.chat_controller import _run_agent_loop
                context_data = _run_agent_loop(message, db)
            else:
                context_data = _get_context_data(intent, db)
                
            history = _load_history(db, intent=intent)
            
            from services.langchain_router import stream_routed_response
            full_response = ""
            try:
                for chunk in stream_routed_response(message, history, context_data, intent=intent, db=db):
                    full_response += chunk
            except Exception as stream_err:
                logger.error(f"[CHAT] stream failed, using local fallback: {stream_err}")
                from local_fallback import generate_local_response, infer_intent_from_keywords
                fallback_intent = infer_intent_from_keywords(message)
                full_response = generate_local_response(message, fallback_intent, context_data, db=db)

        db.add(ChatLog(role="user",  message=message, intent=intent, mode="gemini"))
        db.add(ChatLog(role="model", message=full_response, intent=intent, mode="gemini"))
        try:
            db.commit()
        except Exception:
            db.rollback()

        logger.info(f"[CHAT] intent={intent} mode=gemini")
        return ChatResponse(
            response=full_response,
            intent=intent,
            status="ok",
            mode="gemini",
        )

    except Exception as e:
        logger.error(f"[CHAT] Unhandled error: {e}")
        return ChatResponse(
            response=f"An error occurred: {str(e)}",
            intent="error",
            status="error",
            mode="local_fallback",
        )

@router.post("/chat/stream", dependencies=[Depends(verify_api_key)])
def chat_stream_endpoint(req: ChatRequest, db: Session = Depends(get_db)):
    message = (req.message or "").strip()

    def event(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    def generate():
        if not message:
            yield event({"type": "done", "intent": "error", "text": "Message cannot be empty"})
            return

        intent = _resolve_intent(message)
        
        res_action = check_resource_action(message, db)
        if res_action:
            yield event({"type": "thinking", "intent": intent})
            yield event({"type": "token", "text": res_action["text"] + "\n\n"})
            yield event({
                "type": "action", 
                "command": "execute_tool", 
                "title": res_action["title"],
                "description": res_action["description"],
                "actionId": res_action["actionId"],
                "endpoint": "/api/agent/execute"
            })
            yield event({"type": "done", "intent": intent})
            return
        
        if intent == "agent_mode":
            from agents.chat_controller import _run_agent_loop
            context_data = _run_agent_loop(message, db)
        else:
            context_data = _get_context_data(intent, db)
            
        history = _load_history(db, intent=intent)
        chunks = []

        yield event({"type": "thinking", "intent": intent})
        
        if intent == "navigate_globe":
            yield event({"type": "action", "command": "navigate", "target": "/globe"})
            yield event({"type": "token", "text": "Initiating Agentic UI Control... Navigating to Globe View."})
            yield event({"type": "done", "intent": intent})
            return
        elif intent == "navigate_graph":
            yield event({"type": "action", "command": "navigate", "target": "/graph"})
            yield event({"type": "token", "text": "Initiating Agentic UI Control... Navigating to Graph View."})
            yield event({"type": "done", "intent": intent})
            return

        elif intent == "terminate_idle":
            idle_resources = db.query(CloudResource).filter(CloudResource.status == "Idle").all()
            idle_count = len(idle_resources)
            real_savings = round(sum((r.monthly_cost or 0) * 0.95 for r in idle_resources), 2)
            regions = list({r.region for r in idle_resources})
            region_str = f"{len(regions)} region{'s' if len(regions) != 1 else ''}"
            yield event({"type": "token", "text": f"I have identified {idle_count} idle resources. Please approve the execution card to terminate them and save ${real_savings:,.2f}/month.\n\n"})
            yield event({
                "type": "action", 
                "command": "execute_tool", 
                "title": "Terminate Idle Resources",
                "description": f"This will safely terminate {idle_count} identified idle instances across {region_str}. Estimated savings: ${real_savings:,.2f}/month.",
                "actionId": "term_idle_123",
                "endpoint": "/api/agent/execute"
            })
            yield event({"type": "done", "intent": intent})
            return

        elif intent in ["stop_risky_resources", "stop_overutilized_resources"]:
            yield event({"type": "token", "text": "I found 5 high-risk over-utilized resources. Please approve the execution card to stop them and reduce risk.\n\n"})
            yield event({
                "type": "action",
                "command": "execute_tool",
                "title": "Stop Risky / Over-Utilized Resources",
                "description": "Stops 5 over-utilized demo resources (demo simulation). No real cloud operations will be performed.",
                "actionId": "stop_overutilized_123",
                "endpoint": "/api/agent/execute"
            })
            yield event({"type": "done", "intent": intent})
            return

        import re as _re

        def parse_stream_buffer(buf: str, is_final: bool = False):
            actions = []
            while True:
                json_blocks = extract_json_commands(buf)
                if not json_blocks:
                    break
                block_str, parsed_dict = json_blocks[0]
                start_idx = buf.find(block_str)
                if start_idx == -1:
                    break
                end_idx = start_idx + len(block_str)
                
                prefix = buf[:start_idx]
                suffix = buf[end_idx:]
                
                prefix_match = _re.search(r"```ui_command\s*$", prefix)
                suffix_match = _re.match(r"^\s*```", suffix)
                
                if prefix_match and not suffix_match and not is_final:
                    break
                    
                del_start = start_idx
                del_end = end_idx
                
                if prefix_match:
                    del_start = prefix_match.start()
                if suffix_match:
                    del_end = end_idx + suffix_match.end()
                    
                actions.append(parsed_dict)
                buf = buf[:del_start] + buf[del_end:]
            return buf, actions

        full_buffer = ""
        stream_buffer = ""
        try:
            for chunk in stream_routed_response(message, history, context_data, intent=intent, db=db):
                stream_buffer += chunk
                
                stream_buffer, actions = parse_stream_buffer(stream_buffer, is_final=False)
                for action in actions:
                    yield event({"type": "action", "command": "ui_control", "payload": action})
                    
                idx_backtick = stream_buffer.find('`')
                idx_brace = stream_buffer.find('{')
                
                earliest = -1
                if idx_backtick != -1 and idx_brace != -1:
                    earliest = min(idx_backtick, idx_brace)
                elif idx_backtick != -1:
                    earliest = idx_backtick
                elif idx_brace != -1:
                    earliest = idx_brace
                    
                if earliest == -1:
                    if stream_buffer:
                        yield event({"type": "token", "text": stream_buffer})
                        full_buffer += stream_buffer
                        stream_buffer = ""
                else:
                    to_yield = stream_buffer[:earliest]
                    if to_yield:
                        yield event({"type": "token", "text": to_yield})
                        full_buffer += to_yield
                        stream_buffer = stream_buffer[earliest:]
                        
                    if len(stream_buffer) > 1500:
                        flush_chunk = stream_buffer[:1000]
                        stream_buffer = stream_buffer[1000:]
                        yield event({"type": "token", "text": flush_chunk})
                        full_buffer += flush_chunk

        except Exception as stream_err:
            logger.error(f"[CHAT/STREAM] AI stream failed, using local fallback: {stream_err}")
            from local_fallback import generate_local_response, infer_intent_from_keywords
            fallback_intent = infer_intent_from_keywords(message)
            fallback_text = generate_local_response(message, fallback_intent, context_data, db=db)
            full_buffer = fallback_text
            yield event({"type": "token", "text": fallback_text})

        if stream_buffer:
            stream_buffer, final_actions = parse_stream_buffer(stream_buffer, is_final=True)
            for action in final_actions:
                yield event({"type": "action", "command": "ui_control", "payload": action})
            if stream_buffer:
                yield event({"type": "token", "text": stream_buffer})
                full_buffer += stream_buffer

        response_text = full_buffer.strip()

        db.add(ChatLog(role="user", message=message, intent=intent, mode="gemini"))
        db.add(ChatLog(role="model", message=response_text, intent=intent, mode="gemini"))
        try:
            db.commit()
        except Exception:
            db.rollback()

        yield event({"type": "done", "intent": intent})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

from pydantic import BaseModel
class AgentAction(BaseModel):
    actionId: str

@router.post("/agent/execute", dependencies=[Depends(verify_api_key)])
def execute_agent_action(action: AgentAction, db: Session = Depends(get_db)):
    from models.models import CloudResource

    allowed_action_ids = {
        "term_idle_123",
        "stop_overutilized_123",
        "mark_high_risk_review_123",
    }

    is_dynamic = action.actionId.startswith("term_res_") or action.actionId.startswith("scale_res_") or action.actionId.startswith("secure_res_")

    if action.actionId not in allowed_action_ids and not is_dynamic:
        return {
            "status": "error",
            "message": (
                "Action not supported in CloudIQ simulation. "
                "Only simulated actionIds are allowed: "
                f"{sorted(list(allowed_action_ids))}."
            )
        }

    if action.actionId.startswith("term_res_") or action.actionId.startswith("scale_res_") or action.actionId.startswith("secure_res_"):
        parts = action.actionId.split("_")
        try:
            res_id = int(parts[-1])
        except ValueError:
            return {"status": "error", "message": "Invalid resource ID in action ID"}
            
        res = db.query(CloudResource).filter(CloudResource.id == res_id).first()
        if not res:
            return {"status": "error", "message": f"Resource with ID {res_id} not found"}
            
        if action.actionId.startswith("term_res_"):
            res.status = "Terminated"
            try:
                db.commit()
                return {
                    "status": "success",
                    "message": f"Successfully terminated the single idle resource '{res.name}' (saved ${res.monthly_cost:,.2f}/mo)."
                }
            except Exception as e:
                db.rollback()
                return {"status": "error", "message": str(e)}
                
        elif action.actionId.startswith("scale_res_"):
            res.status = "Healthy"
            res.cpu_usage = 45.0
            res.memory_usage = 50.0
            try:
                db.commit()
                return {
                    "status": "success",
                    "message": f"Successfully scaled and right-sized resource '{res.name}' to optimized CPU and memory tiers."
                }
            except Exception as e:
                db.rollback()
                return {"status": "error", "message": str(e)}
                
        elif action.actionId.startswith("secure_res_"):
            res.public_access = False
            try:
                db.commit()
                return {
                    "status": "success",
                    "message": f"Successfully disabled public access for '{res.name}'. VPC security groups updated."
                }
            except Exception as e:
                db.rollback()
                return {"status": "error", "message": str(e)}

    if action.actionId == "term_idle_123":
        idle_resources = db.query(CloudResource).filter(CloudResource.status == "Idle").all()
        real_savings = round(sum((r.monthly_cost or 0) * 0.95 for r in idle_resources), 2)
        for res in idle_resources:
            res.status = "Terminated"
        try:
            db.commit()
            return {
                "status": "success",
                "message": f"Successfully terminated {len(idle_resources)} idle resources. Estimated savings: ${real_savings:,.2f}/month."
            }
        except Exception as e:
            db.rollback()
            return {"status": "error", "message": str(e)}

    if action.actionId == "stop_overutilized_123":
        over_resources = (
            db.query(CloudResource)
            .filter(CloudResource.status == "Over-Utilized")
            .limit(5)
            .all()
        )
        for res in over_resources:
            res.status = "Terminated"
        try:
            db.commit()
            return {
                "status": "success",
                "message": (
                    f"Successfully stopped {len(over_resources)} over-utilized resources (demo simulation). "
                    "This reduces risk and prevents further simulated load."
                )
            }
        except Exception as e:
            db.rollback()
            return {"status": "error", "message": str(e)}

    if action.actionId == "mark_high_risk_review_123":
        review_resources = (
            db.query(CloudResource)
            .filter(CloudResource.status.in_(["Over-Utilized", "Idle"]))
            .limit(5)
            .all()
        )
        for res in review_resources:
            res.status = "Investigating"
        try:
            db.commit()
            return {
                "status": "success",
                "message": f"Marked {len(review_resources)} resources as Investigating (demo simulation)."
            }
        except Exception as e:
            db.rollback()
            return {"status": "error", "message": str(e)}

    return {"status": "error", "message": "Unknown action ID"}

@router.post("/chat/clear", dependencies=[Depends(verify_api_key)])
def clear_chat_endpoint(db: Session = Depends(get_db)):
    try:
        db.query(ChatLog).delete()
        db.commit()
        try:
            from services.rag_memory import clear_memory
            clear_memory()
        except Exception as rag_err:
            logger.error(f"[CHAT/CLEAR] Failed to clear RAG memory: {rag_err}")
        return {"status": "success", "message": "Chat history cleared successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"[CHAT/CLEAR] Failed to clear history: {e}")
        return {"status": "error", "message": str(e)}

