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

from core.config import settings

logger = logging.getLogger("cloudiq.gemini_service")

# ─── System instruction for the cloud AI agent ────────────────────────────────
SYSTEM_INSTRUCTION = (
    "You are CloudIQ — an autonomous cloud intelligence AI agent. "
    "You analyze cloud infrastructure data and provide structured, actionable responses. "
    "You respond like a senior cloud architect with deep expertise in AWS, GCP, and Azure. "
    "When given system data, always structure your response with: "
    "1. Summary 2. Key Findings 3. Recommendations (High/Medium/Low priority) 4. Estimated Impact. "
    "Be concise, precise, and data-driven. "
    "If the user says 'simple' or 'explain', provide beginner-friendly analogies. "
    "If they ask 'what if' or 'simulate', calculate theoretical savings or cascading impacts. "
    "Always respond in the same language as the user."
)


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

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        # ── Verification ping ────────────────────────────────────────────────
        logger.info(f"[GEMINI] Verifying API key with model: {settings.GEMINI_MODEL}...")
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents="Reply with exactly: CLOUDIQ_READY",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                max_output_tokens=20,
                temperature=0.0,
            ),
        )

        if response and response.text:
            logger.info(f"[GEMINI] ✅ Live API verified. Response: {response.text.strip()[:60]}")
            return client
        else:
            logger.error("[GEMINI] ❌ API ping returned empty response.")
            return None

    except Exception as e:
        err_str = str(e).lower()
        if "api_key" in err_str or "api key" in err_str or "permission" in err_str or "403" in err_str:
            logger.error(f"[GEMINI] ❌ Authentication failed: {e}")
        elif "quota" in err_str or "rate" in err_str or "limit" in err_str or "429" in err_str:
            logger.error(f"[GEMINI] ⚠️  Quota/rate limit hit: {e}")
        elif "network" in err_str or "connection" in err_str or "timeout" in err_str:
            logger.error(f"[GEMINI] ⚠️  Network error: {e}")
        else:
            logger.error(f"[GEMINI] ❌ Unexpected error during initialization: {e}")
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

def generate_response(
    message: str,
    history: list,
    context_data: Optional[dict] = None
) -> dict:
    """
    Send a message to Gemini and return the response.
    Logs every call with timing.
    Falls back to local_fallback if Gemini fails.

    Returns:
        {
          "response": str,
          "status": "ok" | "error",
          "mode": "gemini" | "local_fallback",
          "latency_ms": float
        }
    """
    client = get_client()

    if client is None:
        logger.warning("[GEMINI] Client not available — routing to local fallback")
        return _local_fallback(message, context_data)

    # Build full message with context injection
    context_prompt = _build_context_prompt(context_data)
    full_message = message + context_prompt

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
                system_instruction=SYSTEM_INSTRUCTION,
                max_output_tokens=2048,
                temperature=0.7,
            ),
        )

        latency_ms = round((time.perf_counter() - start) * 1000, 1)

        if not response or not response.text:
            raise ValueError("Empty response received from Gemini API")

        logger.info(f"[GEMINI] ✅ Response received in {latency_ms}ms ({len(response.text)} chars)")

        return {
            "response":   response.text,
            "status":     "ok",
            "mode":       "gemini",
            "latency_ms": latency_ms,
        }

    except Exception as e:
        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        err_str = str(e).lower()

        if "quota" in err_str or "rate" in err_str or "429" in err_str:
            logger.error(f"[GEMINI] ⚠️  Rate limit after {latency_ms}ms — fallback: {e}")
        elif "blocked" in err_str or "safety" in err_str:
            logger.warning(f"[GEMINI] ⚠️  Safety block after {latency_ms}ms — fallback: {e}")
        else:
            logger.error(f"[GEMINI] ❌ API call failed after {latency_ms}ms: {e}")

        # Reset client singleton to retry next time
        global _client
        _client = None

        return _local_fallback(message, context_data, error=str(e))


def stream_response(
    message: str,
    history: list,
    context_data: Optional[dict] = None
) -> Iterator[str]:
    """Stream a Gemini response chunk by chunk, with local fallback as one chunk."""
    client = get_client()

    if client is None:
        yield _local_fallback(message, context_data).get("response", "")
        return

    context_prompt = _build_context_prompt(context_data)
    full_message = message + context_prompt

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
            model=settings.GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                max_output_tokens=2048,
                temperature=0.7,
            ),
        )

        for chunk in stream:
            text = getattr(chunk, "text", None)
            if text:
                yield text
    except Exception as e:
        logger.error(f"[GEMINI] Streaming failed: {e}")
        global _client
        _client = None
        yield _local_fallback(message, context_data, error=str(e)).get("response", "")


# ══════════════════════════════════════════════════════════════════════════════
#  CONTEXT BUILDER
# ══════════════════════════════════════════════════════════════════════════════

def _build_context_prompt(context_data: Optional[dict]) -> str:
    """Build the data context string to inject into the Gemini message."""
    if not context_data:
        return ""

    if context_data.get("AGENT_MODE_WORKFLOW"):
        tools_used = ", ".join(context_data.get("tools_used", []))
        results_json = json.dumps(context_data.get('results', {}), indent=2, default=str)
        return (
            f"\n\n--- CLOUDIQ SYSTEM DATA ---\n"
            f"Analysis Results:\n{results_json}\n"
            f"Tools Used: {tools_used}\n"
            f"---------------------------\n"
            f"Based on this data, provide a structured response with:\n"
            f"1. Summary  2. Key Findings  3. Recommendations  4. Estimated Impact"
        )
    else:
        return f"\n\n[SYSTEM CONTEXT — use this data in your response]:\n{json.dumps(context_data, indent=2, default=str)}\n"


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
