
from fastapi import APIRouter
from schemas.schemas import HealthResponse
from core.config import settings
from services.gemini_service import is_gemini_active

router = APIRouter(prefix="/api", tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def health():
    gemini_ok = is_gemini_active()
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        gemini_active=gemini_ok,
        message=(
            f"CloudIQ v{settings.APP_VERSION} running. "
            f"Gemini AI: {'✅ Active' if gemini_ok else '⚠️ Fallback mode'}"
        ),
    )
