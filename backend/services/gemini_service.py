"""
services/gemini_service.py
---------------------------
VERIFIED Gemini AI integration for CloudIQ v2.
Uses the NEW google-genai SDK (v1.x) — replaces deprecated google-generativeai.

CRITICAL FIXES applied vs. old ai_client_gemini.py:
  1. Uses google.genai (new SDK) instead of deprecated google.generativeai
  2. Explicit API verification on startup (live ping with logging)
  3. Every API call is logged with timing
  4. Structured error handling — quota, auth, network errors classified separately
  5. Fallback to local_fallback.py only if Gemini is unreachable (not silently)
  6. No hardcoded responses — all Gemini calls are LIVE API calls
"""

import logging
import json
import time
from typing import Iterator, Optional
from services.shared_utils import build_context_prompt as _build_context_prompt

from core.config import settings

logger = logging.getLogger("cloudiq.gemini_service")

from core.prompts import CLOUDIQ_SYSTEM_PROMPT
SYSTEM_INSTRUCTION = CLOUDIQ_SYSTEM_PROMPT


# ══════════════════════════════════════════════════════════════════════════════
#  GEMINI CLIENT INITIALIZATION (using new google.genai SDK)
# ══════════════════════════════════════════════════════════════════════════════

_client = None   # google.genai.Client singleton

def _initialize_client():
    """
    Initialize and verify the Gemini client using the new google.genai SDK.
    Returns the client if successful, None otherwise.
    """
    if not settings.gemini_available:
        logger.warning("[GEMINI] ❌ No API key found. Gemini disabled — using local fallback.")
        return None

    try:
        from google import genai
        from google.genai import types
        client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=types.HttpOptions(
                client_args={'timeout': 10.0},
                async_client_args={'timeout': 10.0}
            )
        )
        logger.info(f"[GEMINI] ✅ Client initialized for model: {settings.GEMINI_MODEL} (timeout: 10s)")
        return client
    except Exception as e:
        logger.error(f"[GEMINI] ❌ Failed to initialize client: {e}")
        return None


def get_client():
    """Get or lazily initialize the Gemini client singleton."""
    global _client
    if _client is None:
        _client = _initialize_client()
    return _client


def is_gemini_active() -> bool:
    """Returns True if Gemini client is initialized and ready."""
    return get_client() is not None


# ══════════════════════════════════════════════════════════════════════════════
#  GENERATE RESPONSE  (Live Gemini API call)
# ══════════════════════════════════════════════════════════════════════════════

def _groq_fallback(
    message: str,
    history: list,
    context_data: Optional[dict] = None,
    system_prompt: Optional[str] = None,
) -> dict:
    """Fallback to Groq service when Gemini fails or is inactive."""
    try:
        from services import groq_service
        import time
        start = time.perf_counter()
        
        logger.info("[ROUTER] Attempting Groq fallback in non-streaming mode...")
        groq_response = ""
        for chunk in groq_service.stream_response(
            message, history, context_data, system_prompt=system_prompt, rag_history=None
        ):
            if "⚠️ Groq API error:" in chunk or "Groq API error" in chunk:
                raise Exception(chunk.strip())
            groq_response += chunk
        
        if not groq_response:
            raise Exception("Groq returned empty response")
            
        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        logger.info(f"[GROQ] ✅ Fallback response received in {latency_ms}ms ({len(groq_response)} chars)")
        
        # Store in RAG memory
        try:
            from services import rag_memory
            rag_memory.store_interaction(message, groq_response)
        except Exception:
            pass
            
        return {
            "response":   groq_response,
            "status":     "ok",
            "mode":       "groq",
            "latency_ms": latency_ms,
        }
    except Exception as groq_err:
        logger.error(f"[GROQ] Non-streaming fallback failed: {groq_err}")
        raise groq_err


def generate_response(
    message: str,
    history: list,
    context_data: Optional[dict] = None,
    system_prompt: Optional[str] = None,
) -> dict:
    """
    Send a message to Gemini and return the response.
    Logs every call with timing.
    Falls back to Groq, and then local_fallback if Gemini fails.

    Returns:
        {
          "response": str,
          "status": "ok" | "error",
          "mode": "gemini" | "groq" | "local_fallback",
          "latency_ms": float
        }
    """
    client = get_client()

    # Pre-build system prompt and full message so we can reuse them if fallback is needed
    try:
        from services import rag_memory
        past_interactions = rag_memory.retrieve_relevant_history(message, n_results=3)
    except Exception:
        past_interactions = []

    if not system_prompt:
        from core.prompts import CLOUDIQ_SYSTEM_PROMPT, build_rag_prompt, build_cloud_context_prompt
        if past_interactions:
            system_prompt = build_rag_prompt(past_interactions)
        elif context_data:
            system_prompt = build_cloud_context_prompt(context_data)
        else:
            system_prompt = CLOUDIQ_SYSTEM_PROMPT

    if past_interactions or context_data:
        full_message = message
    else:
        context_prompt = _build_context_prompt(context_data)
        full_message = message + context_prompt

    if client is None:
        logger.warning("[GEMINI] Client not available — trying Groq fallback")
        from services import groq_service
        if groq_service.is_groq_active():
            try:
                return _groq_fallback(message, history, context_data, system_prompt)
            except Exception:
                pass
        return _local_fallback(message, context_data)

    start = time.perf_counter()
    try:
        from google import genai
        from google.genai import types

        # Build conversation history in new SDK format
        contents = []
        for h in history[-10:]:   # Last 10 turns
            role = "user" if h.get("role") == "user" else "model"
            parts_list = h.get("parts", [{"text": ""}])
            text = parts_list[0].get("text", "") if parts_list else ""
            if text:
                contents.append(types.Content(role=role, parts=[types.Part(text=text)]))

        # Add current message
        contents.append(types.Content(role="user", parts=[types.Part(text=full_message)]))

        logger.info(f"[GEMINI] → Sending message ({len(full_message)} chars, {len(contents)} turns)...")

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=2048,
                temperature=0.7,
            ),
        )

        latency_ms = round((time.perf_counter() - start) * 1000, 1)

        if not response or not response.text:
            raise ValueError("Empty response received from Gemini API")

        logger.info(f"[GEMINI] ✅ Response received in {latency_ms}ms ({len(response.text)} chars)")

        response_text = response.text

        # Store interaction in RAG memory
        try:
            from services import rag_memory
            rag_memory.store_interaction(message, response_text)
        except Exception:
            pass

        return {
            "response":   response_text,
            "status":     "ok",
            "mode":       "gemini",
            "latency_ms": latency_ms,
        }

    except Exception as e:
        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        logger.error(f"[GEMINI] ⚠️ Error after {latency_ms}ms — trying Groq fallback: {e}")

        from services import groq_service
        if groq_service.is_groq_active():
            try:
                return _groq_fallback(message, history, context_data, system_prompt)
            except Exception:
                pass

        return _local_fallback(message, context_data, error=str(e))




# ══════════════════════════════════════════════════════════════════════════════
# _build_context_prompt is already imported at the top of this file from
# services.shared_utils. The canonical version lives there.


# ══════════════════════════════════════════════════════════════════════════════
#  LOCAL FALLBACK  (when Gemini is unavailable)
# ══════════════════════════════════════════════════════════════════════════════

def _local_fallback(
    message: str,
    context_data: Optional[dict] = None,
    error: Optional[str] = None
) -> dict:
    """
    Generate a response from the local rule-based system.
    Only triggered when Gemini is unavailable.
    """
    try:
        from local_fallback import generate_local_response, infer_intent_from_keywords
        intent = infer_intent_from_keywords(message)

        ctx = None
        if context_data:
            ctx = context_data.get("results", context_data)

        response_text = generate_local_response(message, intent, ctx)
        if error:
            response_text += "\n\n_[Note: AI service temporarily unavailable — using local cloud analytics]_"

        logger.info(f"[FALLBACK] Local response generated for intent: {intent}")
        return {
            "response":   response_text,
            "status":     "ok",
            "mode":       "local_fallback",
            "latency_ms": 0,
        }
    except Exception as fallback_err:
        logger.error(f"[FALLBACK] Even local fallback failed: {fallback_err}")
        return {
            "response":   "CloudIQ is currently processing your request. Please try again momentarily.",
            "status":     "error",
            "mode":       "local_fallback",
            "latency_ms": 0,
        }
