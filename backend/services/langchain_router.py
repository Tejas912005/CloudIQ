"""
services/langchain_router.py
----------------------------
Intelligent AI router with FULL bidirectional failover:
  1. Try PRIMARY model (Gemini by default)
  2. If PRIMARY fails (quota/error) → switch to SECONDARY (Groq)
  3. If SECONDARY also fails → fall back to local analytics engine
  4. NEVER crash the stream — always yield something useful

This means the chat will ALWAYS respond, regardless of which API is down.
"""
import logging
from typing import Iterator, Optional
from sqlalchemy.orm import Session
from services import gemini_service
from services import groq_service
from services import rag_memory
from core.intent_utils import GREETING_PHRASES, IDENTITY_PHRASES

logger = logging.getLogger("cloudiq.langchain_router")


def _stream_gemini(message: str, history: list, context_data: Optional[dict], system_prompt: str, rag_history: Optional[str] = None) -> Iterator[str]:
    """Stream from Gemini, raises on failure so caller can failover."""
    client = gemini_service.get_client()
    if client is None:
        raise Exception("Gemini client not available")

    context_prompt = gemini_service._build_context_prompt(context_data)
    rag_prompt = ""
    if rag_history:
        rag_prompt = (
            f"\n\n=== HISTORICAL REFERENCE ONLY ===\n"
            f"The following are relevant snippets from past conversations or previous sessions. "
            f"Use them ONLY if the user is asking about past decisions, previous calculations, "
            f"or context from earlier conversations. Otherwise, IGNORE this historical reference "
            f"and focus 100% on answering the user's current request.\n"
            f"{rag_history.strip()}\n"
            f"=== END HISTORICAL REFERENCE ==="
        )
    full_message = message + context_prompt + rag_prompt

    try:
        from google.genai import types
        contents = []
        for h in history[-10:]:
            role = "user" if h.get("role") == "user" else "model"
            parts_list = h.get("parts", [{"text": ""}])
            text = parts_list[0].get("text", "") if parts_list else ""
            if text:
                contents.append(types.Content(role=role, parts=[types.Part(text=text)]))
        contents.append(types.Content(role="user", parts=[types.Part(text=full_message)]))

        stream = client.models.generate_content_stream(
            model=gemini_service.settings.GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=2048,
                temperature=0.7,
            ),
        )
        for chunk in stream:
            text = getattr(chunk, "text", None)
            if text:
                yield text
    except Exception as e:
        # Reset client so next call tries to re-initialize
        gemini_service._client = None
        raise Exception(f"Gemini stream error: {e}") from e


def _stream_groq(message: str, history: list, context_data: Optional[dict], system_prompt: str, rag_history: Optional[str] = None) -> Iterator[str]:
    """Stream from Groq, raises on failure so caller can failover."""
    if not groq_service.is_groq_active():
        raise Exception("Groq API key not configured")

    chunks_received = []
    for chunk in groq_service.stream_response(message, history, context_data, system_prompt=system_prompt, rag_history=rag_history):
        if "⚠️ Groq API error:" in chunk or "Groq API error" in chunk:
            raise Exception(chunk.strip())
        chunks_received.append(chunk)
        yield chunk

    if not chunks_received:
        raise Exception("Groq returned empty response")


def _stream_local_fallback(message: str, context_data: Optional[dict], db: Session = None) -> Iterator[str]:
    """Always succeeds — uses local rule-based analytics engine."""
    try:
        from local_fallback import generate_local_response, infer_intent_from_keywords
        intent = infer_intent_from_keywords(message)
        response = generate_local_response(message, intent, context_data, db=db)
        yield response
    except Exception as e:
        yield f"CloudIQ is running. Ask about resource usage, cost analysis, or optimization recommendations."


def stream_routed_response(
    message: str,
    history: list,
    context_data: Optional[dict] = None,
    intent: str = "none",
    db: Session = None
) -> Iterator[str]:
    """
    Full bidirectional failover routing:
      Gemini → Groq → Local Fallback
    Each level is tried in order. On failure, the next level is used.
    The stream NEVER crashes — it always yields a response.
    """
    # 0. Fast-path check for basic greetings, identity, math, and help
    from local_fallback import infer_intent_from_keywords, generate_local_response
    message_lower = message.strip().lower()
    full_response = ""
    
    is_greeting = message_lower in GREETING_PHRASES
    is_identity = any(q in message_lower for q in IDENTITY_PHRASES)
    is_help = any(q in message_lower for q in ["capabilities", "what can you do", "features"])
    
    import re
    is_math = False
    math_match = re.search(r'(?:what\s+is\s+)?([0-9\s+\-*/().]+)(?:\?)?$', message_lower)
    if math_match:
        expr = math_match.group(1).replace(" ", "")
        if any(op in expr for op in ["+", "-", "*", "/"]):
            allowed_chars = set("0123456789+-*/().")
            if all(c in allowed_chars for c in expr):
                is_math = True
                
    if is_greeting or is_identity or is_help or is_math:
        logger.info(f"[ROUTER] Fast-path local match for: '{message}'")
        fallback_intent = infer_intent_from_keywords(message)
        response = generate_local_response(message, fallback_intent, context_data, db=db)
        yield response
        if response.strip():
            rag_memory.store_interaction(message, response)
        return
    # 1. RAG Memory Retrieval
    data_intents = {"analyze_resources", "detect_anomalies", "predict_costs", "predict_resource_risk", "agent_mode"}
    relevant_history = rag_memory.retrieve_relevant_history(message) if intent in data_intents else []
    rag_history_text = ""
    if relevant_history:
        rag_history_text = "\n\n[PERSISTENT RAG MEMORY (Past Interactions)]:\n" + "\n".join(relevant_history)
        logger.info(f"[ROUTER] Retrieved {len(relevant_history)} past interactions from RAG memory.")

    from core.prompts import CLOUDIQ_SYSTEM_PROMPT, GENERAL_SYSTEM_PROMPT, UI_CONTROL_SYSTEM_PROMPT
    if intent == "ui_theme_control":
        system_prompt = UI_CONTROL_SYSTEM_PROMPT
    elif intent == "none":
        system_prompt = GENERAL_SYSTEM_PROMPT
    else:
        system_prompt = CLOUDIQ_SYSTEM_PROMPT

    # 2. Try Gemini first
    gemini_ok = gemini_service.is_gemini_active()
    if gemini_ok:
        logger.info("[ROUTER] PRIMARY: Attempting Gemini stream...")
        try:
            for chunk in _stream_gemini(message, history, context_data, system_prompt, rag_history=rag_history_text):
                full_response += chunk
                yield chunk
            # Gemini succeeded — save and return
            if full_response.strip():
                rag_memory.store_interaction(message, full_response)
            return
        except Exception as e:
            logger.warning(f"[ROUTER] Gemini failed → switching to Groq. Error: {e}")
            full_response = ""  # Reset for next attempt

    # 3. Try Groq as fallback (or primary if Gemini unavailable)
    logger.info("[ROUTER] SECONDARY: Attempting Groq stream...")
    try:
        for chunk in _stream_groq(message, history, context_data, system_prompt, rag_history=rag_history_text):
            full_response += chunk
            yield chunk
        # Groq succeeded — save and return
        if full_response.strip():
            rag_memory.store_interaction(message, full_response)
        return
    except Exception as e:
        logger.warning(f"[ROUTER] Groq also failed → using local fallback. Error: {e}")
        full_response = ""

    # 4. Last resort: local analytics fallback (never fails)
    logger.info("[ROUTER] FALLBACK: Using local analytics engine.")
    for chunk in _stream_local_fallback(message, context_data, db=db):
        full_response += chunk
        yield chunk

    if full_response.strip():
        rag_memory.store_interaction(message, full_response)
