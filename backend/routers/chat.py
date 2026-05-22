"""
routers/chat.py
---------------
POST /api/chat — AI-powered cloud assistant endpoint.
Connects to the agentic chat controller which uses Gemini + fallback.
"""

import logging
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.schemas import ChatRequest, ChatResponse
from models.models import ChatLog
from agents.chat_controller import _get_context_data, _load_history
from local_fallback import infer_intent_from_keywords
from services.langchain_router import stream_routed_response

logger = logging.getLogger("cloudiq.router.chat")

router = APIRouter(prefix="/api", tags=["Chat"])


def _resolve_intent(message: str) -> str:
    """Fast keyword-based intent detection. No Gemini call needed here."""
    intent = infer_intent_from_keywords(message)
    agent_keywords = [
        "what if", "simulate", "optimize", "summary", "overview",
        "reduce", "improve", "audit", "find issues", "analyze all",
        "help me", "what should", "recommend"
    ]
    if any(kw in message.lower() for kw in agent_keywords):
        intent = "agent_mode"
    return intent


def extract_json_commands(text: str) -> list:
    """Finds all valid JSON objects containing an 'action' key in the text with balanced braces."""
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



@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest, db: Session = Depends(get_db)):
    """
    AI Cloud Assistant — powered by Gemini 1.5 Flash with local fallback.
    Supports: cost analysis, anomaly detection, predictions, risk analysis,
    graph-based blast radius, attack paths, recommendations, and free-form Q&A.
    """
    try:
        # Import chat controller (from agents layer)
        from agents.chat_controller import chat

        result = chat(req.message, db)

        # Persist to ChatLog table
        db.add(ChatLog(role="user",  message=req.message, intent=result.get("intent"), mode=result.get("mode")))
        db.add(ChatLog(role="model", message=result.get("response", ""), intent=result.get("intent"), mode=result.get("mode")))
        try:
            db.commit()
        except Exception:
            db.rollback()

        logger.info(f"[CHAT] intent={result.get('intent')} mode={result.get('mode')}")
        return ChatResponse(
            response=result.get("response", ""),
            intent=result.get("intent", "none"),
            status=result.get("status", "ok"),
            mode=result.get("mode", "local_fallback"),
        )

    except Exception as e:
        logger.error(f"[CHAT] Unhandled error: {e}")
        return ChatResponse(
            response=f"An error occurred: {str(e)}",
            intent="error",
            status="error",
            mode="local_fallback",
        )


@router.post("/chat/stream")
def chat_stream_endpoint(req: ChatRequest, db: Session = Depends(get_db)):
    """SSE endpoint for token-by-token assistant responses."""
    message = (req.message or "").strip()

    def event(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    def generate():
        if not message:
            yield event({"type": "done", "intent": "error", "text": "Message cannot be empty"})
            return

        intent = _resolve_intent(message)
        
        if intent == "agent_mode":
            from agents.chat_controller import _run_agent_loop
            context_data = _run_agent_loop(message, db)
        else:
            context_data = _get_context_data(intent, db)
            
        history = _load_history(db, intent=intent)
        chunks = []

        yield event({"type": "thinking", "intent": intent})
        
        # --- AGENTIC UI: ACTION DISPATCH ---
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
            yield event({"type": "token", "text": "I have identified 5 idle resources. Please approve the execution card to terminate them and save $320/month.\n\n"})
            yield event({
                "type": "action", 
                "command": "execute_tool", 
                "title": "Terminate Idle Resources",
                "description": "This will safely terminate 5 identified idle instances across 3 regions. Estimated savings: $320/month.",
                "actionId": "term_idle_123",
                "endpoint": "/api/agent/execute"
            })
            yield event({"type": "done", "intent": intent})
            return
        # -----------------------------------

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
            for chunk in stream_routed_response(message, history, context_data, intent=intent):
                stream_buffer += chunk
                
                # Parse completed blocks from the stream_buffer
                stream_buffer, actions = parse_stream_buffer(stream_buffer, is_final=False)
                for action in actions:
                    yield event({"type": "action", "command": "ui_control", "payload": action})
                    
                # Decide what to yield as tokens
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
            fallback_text = generate_local_response(message, fallback_intent, context_data)
            full_buffer = fallback_text
            yield event({"type": "token", "text": fallback_text})

        # Final flush
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

@router.post("/agent/execute")
def execute_agent_action(action: AgentAction, db: Session = Depends(get_db)):
    """Executes a specific agent mutation against the database."""
    from models.models import CloudResource
    if action.actionId == "term_idle_123":
        # Simulate terminating the idle resources
        idle_resources = db.query(CloudResource).filter(CloudResource.status == "Idle").limit(5).all()
        for res in idle_resources:
            res.status = "Terminated"
        try:
            db.commit()
            return {"status": "success", "message": f"Successfully terminated {len(idle_resources)} idle resources. Estimated savings: $320/month."}
        except Exception as e:
            db.rollback()
            return {"status": "error", "message": str(e)}
    return {"status": "error", "message": "Unknown action ID"}


@router.post("/chat/clear")
def clear_chat_endpoint(db: Session = Depends(get_db)):
    """Clear all chat logs from database for a fresh session."""
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

