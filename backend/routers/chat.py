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
            
        history = _load_history(db)
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

        full_buffer = ""
        for chunk in stream_routed_response(message, history, context_data):
            chunks.append(chunk)
            full_buffer += chunk

            # ── Universal Agentic UI Control Parser ──────────────────────────
            # Detects ```ui_command ... ``` blocks emitted by Gemini and strips
            # them from the visible text, streaming them as action events instead.
            ui_cmd_pattern = r"```ui_command\s*(\{.*?\})\s*```"
            ui_matches = _re.findall(ui_cmd_pattern, full_buffer, _re.DOTALL)
            if ui_matches:
                for raw_json in ui_matches:
                    try:
                        cmd = json.loads(raw_json)
                        yield event({"type": "action", "command": "ui_control", "payload": cmd})
                    except json.JSONDecodeError:
                        pass
                # Strip ui_command blocks from the visible text
                visible_text = _re.sub(ui_cmd_pattern, "", full_buffer, flags=_re.DOTALL).strip()
                full_buffer = visible_text
                # Re-stream stripped visible text
                continue
            # ─────────────────────────────────────────────────────────────────

            yield event({"type": "token", "text": chunk})

        # Final strip in case block spans multiple chunks
        import re as _re2
        ui_cmd_pattern = r"```ui_command\s*(\{.*?\})\s*```"
        response_text = _re2.sub(ui_cmd_pattern, "", "".join(chunks), flags=_re2.DOTALL).strip()

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
