"""
core/config.py
--------------
Centralized settings for CloudIQ.
Reads from .env in the backend root directory.
"""

import os
import logging
from pathlib import Path

logger = logging.getLogger("cloudiq.config")

# ─── Load .env manually (no python-dotenv dependency) ─────────────────────────
def _load_env():
    env_path = Path(__file__).parent.parent / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        cleaned = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), cleaned)

_load_env()


# ─── Config Object ─────────────────────────────────────────────────────────────
class Settings:
    # Gemini
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "").strip()
    GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash").strip()

    # Groq (Llama 3 cloud — replaces local Ollama for production)
    GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "").strip()
    GROQ_MODEL: str = os.environ.get("GROQ_MODEL", "llama3-8b-8192").strip()

    # Database
    DB_URL: str = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{Path(__file__).parent.parent / 'cloudiq.db'}"
    )

    # App
    APP_NAME: str = "CloudIQ"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = os.environ.get("DEBUG", "true").lower() == "true"
    CORS_ORIGINS: list = [
        o.strip() for o in 
        os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    ]

    @property
    def gemini_available(self) -> bool:
        return bool(self.GEMINI_API_KEY)

    @property
    def groq_available(self) -> bool:
        return bool(self.GROQ_API_KEY)

    def log_status(self):
        if self.gemini_available:
            masked = self.GEMINI_API_KEY[:8] + "..." + self.GEMINI_API_KEY[-4:]
            logger.info(f"[CONFIG] Gemini API Key loaded: {masked}")
            logger.info(f"[CONFIG] Gemini Model: {self.GEMINI_MODEL}")
        else:
            logger.warning("[CONFIG] ⚠️  GEMINI_API_KEY not found — will use local fallback")
        if self.groq_available:
            masked_groq = self.GROQ_API_KEY[:8] + "..." + self.GROQ_API_KEY[-4:]
            logger.info(f"[CONFIG] Groq API Key loaded: {masked_groq} | Model: {self.GROQ_MODEL}")
        else:
            logger.warning("[CONFIG] ⚠️  GROQ_API_KEY not found — Groq/Llama3 routing disabled")
        logger.info(f"[CONFIG] Database: {self.DB_URL}")


settings = Settings()
