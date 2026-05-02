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

logger = logging.getLogger("cloudiq.groq_service")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama3-8b-8192"   # Free tier — Llama 3 8B via Groq


def _build_context_prompt(context_data: Optional[dict]) -> str:
    """Build the data context string to inject into the LLM message."""
    if not context_data:
        return ""

    if context_data.get("AGENT_MODE_WORKFLOW"):
        tools_used = ", ".join(context_data.get("tools_used", []))
        results_json = json.dumps(context_data.get("results", {}), indent=2, default=str)
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


def is_groq_active() -> bool:
    """Returns True if a Groq API key is configured."""
    return bool(settings.GROQ_API_KEY)


def stream_response(
    message: str,
    history: list,
    context_data: Optional[dict] = None,
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

    # Build structured message array
    messages = [{"role": "system", "content": CLOUDIQ_SYSTEM_PROMPT}]

    # Inject the last 10 conversation turns
    for h in history[-10:]:
        role = "user" if h.get("role") == "user" else "assistant"
        parts = h.get("parts", [{"text": ""}])
        text = parts[0].get("text", "") if parts else ""
        if text:
            messages.append({"role": role, "content": text})

    # Append context to the current user message
    full_message = message + context_prompt
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
