"""
services/groq_service.py
------------------------
Groq API replaces local Ollama for production cloud deployment.
Groq hosts Llama 3 on ultra-fast inference hardware (500+ tokens/sec).
Completely free tier available — no credit card needed.

DEPLOYMENT FIX: Ollama required localhost:11434 which is unavailable on
Render/cloud servers. Groq provides the same Llama 3 model via a real
cloud API endpoint, making the project 100% cloud-native.

Get your free API key at: https://console.groq.com
"""

import json
import urllib.request
import logging
from typing import Iterator, Optional

from core.config import settings
from core.prompts import CLOUDIQ_SYSTEM_PROMPT
from services.shared_utils import build_context_prompt as _build_context_prompt

logger = logging.getLogger("cloudiq.groq_service")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = settings.GROQ_MODEL if settings.GROQ_MODEL else "llama-3.3-70b-versatile"


# _build_context_prompt is imported above from services.shared_utils


def is_groq_active() -> bool:
    """Returns True if a Groq API key is configured."""
    return bool(settings.GROQ_API_KEY)


def stream_response(
    message: str,
    history: list,
    context_data: Optional[dict] = None,
    system_prompt: Optional[str] = None,
    rag_history: Optional[str] = None,
) -> Iterator[str]:
    """
    Stream response from Groq's Llama 3 model chunk by chunk.
    Uses OpenAI-compatible streaming API (Groq is OpenAI-compatible).
    """
    if not is_groq_active():
        logger.warning("[GROQ] No API key — falling back to local rule-based engine.")
        yield "⚠️ Groq API key not configured. Please add GROQ_API_KEY to your .env file."
        return

    context_prompt = _build_context_prompt(context_data)
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

    # Build structured message array
    active_prompt = system_prompt if system_prompt else CLOUDIQ_SYSTEM_PROMPT
    messages = [{"role": "system", "content": active_prompt}]

    # Inject the last 10 conversation turns
    for h in history[-10:]:
        role = "user" if h.get("role") == "user" else "assistant"
        parts = h.get("parts", [{"text": ""}])
        text = parts[0].get("text", "") if parts else ""
        if text:
            messages.append({"role": role, "content": text})

    # Append context to the current user message
    full_message = message + context_prompt + rag_prompt
    messages.append({"role": "user", "content": full_message})

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "stream": True,
        "temperature": 0.7,
        "max_tokens": 1024,
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        GROQ_API_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8").strip()
                if not line or not line.startswith("data: "):
                    continue
                payload_str = line[6:]
                if payload_str == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        logger.error(f"[GROQ] Error calling Groq API: {e}")
        yield f"\n\n⚠️ Groq API error: {str(e)}"
