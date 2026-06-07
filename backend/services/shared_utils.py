"""
services/shared_utils.py
------------------------
Shared utility functions used by both gemini_service and groq_service.
Centralising here eliminates the duplicate _build_context_prompt that
previously existed in both service files.
"""
import json
from typing import Optional


def build_context_prompt(context_data: Optional[dict]) -> str:
    """
    Build the data-context string injected into every LLM prompt.
    Handles both agent-mode (structured plan results) and simple
    dashboard-data contexts.
    """
    if not context_data:
        return ""

    if context_data.get("AGENT_MODE_WORKFLOW"):
        tools_used   = ", ".join(context_data.get("tools_used", []))
        results_json = json.dumps(context_data.get("results", {}), indent=2, default=str)
        return (
            f"\n\n--- CLOUDIQ SYSTEM DATA ---\n"
            f"Analysis Results:\n{results_json}\n"
            f"Tools Used: {tools_used}\n"
            f"---------------------------\n"
            f"Based on this data, provide a structured response with:\n"
            f"1. Summary  2. Key Findings  3. Recommendations  4. Estimated Impact"
        )

    return (
        f"\n\n[SYSTEM CONTEXT — use this data in your response]:\n"
        f"{json.dumps(context_data, indent=2, default=str)}\n"
    )
