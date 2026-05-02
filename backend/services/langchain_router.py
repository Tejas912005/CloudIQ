"""
services/langchain_router.py
----------------------------
LangChain intelligent router for query routing.
Routes between Gemini (primary) and Groq/Llama3 (secondary, cloud-native).
Groq replaces local Ollama for production cloud deployment.
"""
import logging
from typing import Iterator, Optional
from services import gemini_service
from services import groq_service
from services import rag_memory

logger = logging.getLogger("cloudiq.langchain_router")

def classify_query(message: str) -> str:
    """
    Intelligent routing logic.
    - Gemini unavailable → route to Groq (Llama3 via cloud)
    - Groq unavailable too → Gemini handles everything (it has its own fallback)
    - Mutation/execution commands → Groq (local-style agentic execution)
    - Analysis/insights queries → Gemini (more powerful reasoning)
    """
    if not gemini_service.is_gemini_active():
        return "groq"

    message_lower = message.lower()
    # Only true mutation/execution commands go to Groq (agentic)
    # Data/analysis queries go to Gemini (more powerful, better at reasoning)
    mutation_keywords = [
        "terminate", "kill", "shutdown", "execute", "action",
        "simulate", "what if", "agent",
    ]

    if any(k in message_lower for k in mutation_keywords):
        return "groq"
    return "gemini"

def stream_routed_response(
    message: str,
    history: list,
    context_data: Optional[dict] = None
) -> Iterator[str]:
    """
    1. Retrieve RAG memory
    2. Route to appropriate LLM (Gemini or Groq)
    3. Stream response
    4. Save interaction to RAG memory
    """
    # 1. RAG Memory Injection
    relevant_history = rag_memory.retrieve_relevant_history(message)
    if relevant_history:
        rag_context = "\n\n[PERSISTENT RAG MEMORY (Past Interactions)]:\n" + "\n".join(relevant_history)
        if context_data is None:
            context_data = {}
        if "results" in context_data:
            context_data["results"]["rag_memory"] = rag_context
        else:
            context_data["rag_memory"] = rag_context

        logger.info(f"[ROUTER] Injected {len(relevant_history)} past interactions from RAG memory.")

    # 2. Routing
    target_llm = classify_query(message)
    logger.info(f"[ROUTER] Routing query to: {target_llm.upper()}")

    full_response = ""

    # 3. Stream Response
    if target_llm == "groq":
        if groq_service.is_groq_active():
            stream = groq_service.stream_response(message, history, context_data)
        else:
            # Groq key not configured → fall back to Gemini gracefully
            logger.warning("[ROUTER] Groq not configured, falling back to Gemini for mutation query.")
            stream = gemini_service.stream_response(message, history, context_data)
    else:
        stream = gemini_service.stream_response(message, history, context_data)

    for chunk in stream:
        full_response += chunk
        yield chunk

    # 4. Save to RAG memory after completion
    if full_response.strip():
        rag_memory.store_interaction(message, full_response)

