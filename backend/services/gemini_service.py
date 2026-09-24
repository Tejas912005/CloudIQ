
import logging
import json
import time
from typing import Iterator, Optional
from services.shared_utils import build_context_prompt as _build_context_prompt

from core.config import settings

logger = logging.getLogger("cloudiq.gemini_service")

from core.prompts import CLOUDIQ_SYSTEM_PROMPT
SYSTEM_INSTRUCTION = CLOUDIQ_SYSTEM_PROMPT

_client = None

def _initialize_client():
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
    global _client
    if _client is None:
        _client = _initialize_client()
    return _client

def is_gemini_active() -> bool:
    return get_client() is not None

def _groq_fallback(
    message: str,
    history: list,
    context_data: Optional[dict] = None,
    system_prompt: Optional[str] = None,
) -> dict:
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
    client = get_client()

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

        contents = []
        for h in history[-10:]:
            role = "user" if h.get("role") == "user" else "model"
            parts_list = h.get("parts", [{"text": ""}])
            text = parts_list[0].get("text", "") if parts_list else ""
            if text:
                contents.append(types.Content(role=role, parts=[types.Part(text=text)]))

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

def _local_fallback(
    message: str,
    context_data: Optional[dict] = None,
    error: Optional[str] = None
) -> dict:
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
