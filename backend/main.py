
import os
import sys
import logging

os.environ["PYTHONIOENCODING"] = "utf-8"
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

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

import models.models

Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("  CloudIQ v2 — Starting Up")
    logger.info("=" * 60)

    settings.log_status()

    try:
        from services.gemini_service import get_client
        model = get_client()
        if model:
            logger.info("[STARTUP] ✅ Gemini AI: LIVE and verified")
        else:
            logger.warning("[STARTUP] ⚠️  Gemini AI: Not available — local fallback active")
    except Exception as e:
        logger.error(f"[STARTUP] Gemini check failed: {e}")

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
    
    yield
    
    logger.info("[SHUTDOWN] CloudIQ shutting down")

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

from routers import chat, analyze, predict, recommend, graph, health, upload, exports

app.include_router(chat.router)
app.include_router(analyze.router)
app.include_router(predict.router)
app.include_router(recommend.router)
app.include_router(graph.router)
app.include_router(health.router)
app.include_router(upload.router)
app.include_router(exports.router)

from routers import legacy
app.include_router(legacy.router)

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
