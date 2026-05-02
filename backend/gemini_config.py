"""
gemini_config.py  —  LEGACY COMPATIBILITY SHIM
-----------------------------------------------
The old agent files (agent_planner.py, agent_executor.py, etc.) still import
from this module. This shim redirects them to the new services/gemini_service.py
so the old code keeps working without modification.
"""
import os
from pathlib import Path

# Keep old env loading in case old files call it
def _load_local_env():
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        cleaned_value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), cleaned_value)

_load_local_env()

DEFAULT_GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

def get_api_key():
    return os.environ.get("GEMINI_API_KEY", "").strip() or None

def get_model_name():
    return os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL

def create_model(system_instruction=None):
    """
    Legacy shim for old agent files that expect a generate_content() model.
    New code should use services.gemini_service directly.
    """
    from services.gemini_service import get_client

    client = get_client()
    if not client:
        return None

    class _ModelShim:
        def generate_content(self, prompt):
            from services.gemini_service import generate_response

            result = generate_response(prompt, [], None)

            class _Resp:
                text = result.get("response", "")

            return _Resp()

    return _ModelShim()
