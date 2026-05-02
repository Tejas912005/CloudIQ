"""
main.py — CloudIQ v2 FastAPI Application
==========================================
Replaces the old Flask app.py.

Changes:
  - FastAPI with async support and OpenAPI docs at /docs
  - SQLAlchemy ORM (auto-creates all tables on startup)
  - Modular routers: /api/chat, /api/analyze, /api/predict, /api/recommend, /api/graph
  - Data seeded on startup via simulator
  - Gemini API verified on startup
  - CORS for React dev server (localhost:5173 + 3000)

Run with:
    uvicorn main:app --reload --port 8000
"""

import os
import sys
import logging

# ── Ensure UTF-8 output on Windows ───────────────────────────────────────────
os.environ["PYTHONIOENCODING"] = "utf-8"
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("cloudiq.main")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.config import settings
from core.database import engine, SessionLocal, Base

# ── Import all models so SQLAlchemy can create their tables ───────────────────
import models.models  # noqa: F401

# ── Create all tables ─────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ══════════════════════════════════════════════════════════════════════════════
#  LIFESPAN EVENT
# ══════════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    On startup:
    1. Verify Gemini API key (live ping)
    2. Seed the database with simulated cloud data
    3. Log system status
    """
    logger.info("=" * 60)
    logger.info("  CloudIQ v2 — Starting Up")
    logger.info("=" * 60)

    # ── Config status ─────────────────────────────────────────────────────────
    settings.log_status()

    # ── Gemini verification ───────────────────────────────────────────────────
    try:
        from services.gemini_service import get_client
        model = get_client()
        if model:
            logger.info("[STARTUP] ✅ Gemini AI: LIVE and verified")
        else:
            logger.warning("[STARTUP] ⚠️  Gemini AI: Not available — local fallback active")
    except Exception as e:
        logger.error(f"[STARTUP] Gemini check failed: {e}")

    # ── Database seeding ──────────────────────────────────────────────────────
    db = SessionLocal()
    try:
        from models.models import CloudResource
        from data.simulator import run_full_seed
        existing_count = db.query(CloudResource).count()
        if existing_count == 0:
            result = run_full_seed(db)
            logger.info(
                f"[STARTUP] ✅ Database seeded: "
                f"{result['resources_seeded']} resources, "
                f"{result['connections_seeded']} edges, "
                f"{result['cost_days_seeded']} cost history days"
            )
        else:
            logger.info(f"[STARTUP] ✅ DB already has {existing_count} resources — skipping reseed")
    except Exception as e:
        logger.error(f"[STARTUP] Seeding failed: {e}")
    finally:
        db.close()

    logger.info("=" * 60)
    logger.info("  CloudIQ API ready at http://localhost:8000")
    logger.info("  Swagger docs:       http://localhost:8000/docs")
    logger.info("=" * 60)
    
    yield  # App runs here
    
    logger.info("[SHUTDOWN] CloudIQ shutting down")

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="CloudIQ API",
    description=(
        "CloudIQ v2 — AI-powered Cloud Intelligence Platform. "
        "Combines anomaly detection, cost forecasting, graph-based risk analysis, "
        "and Gemini AI chatbot into a single production-ready API."
    ),
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# ── Include Routers ───────────────────────────────────────────────────────────
from routers import chat, analyze, predict, recommend, graph, health

app.include_router(chat.router)
app.include_router(analyze.router)
app.include_router(predict.router)
app.include_router(recommend.router)
app.include_router(graph.router)
app.include_router(health.router)

# Keep backward-compat routes for old Flask endpoints
from routers import legacy
app.include_router(legacy.router)




# ══════════════════════════════════════════════════════════════════════════════
#  ROOT
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/", tags=["Root"])
def root():
    return {
        "service": "CloudIQ AI Cloud Intelligence Platform",
        "version": settings.APP_VERSION,
        "status":  "running",
        "docs":    "/docs",
        "endpoints": {
            "chat":      "/api/chat",
            "analyze":   "/api/analyze",
            "predict":   "/api/predict",
            "recommend": "/api/recommend",
            "graph":     "/api/graph",
            "health":    "/api/health",
        },
    }
