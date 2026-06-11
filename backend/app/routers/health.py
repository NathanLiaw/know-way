from fastapi import APIRouter, Request

from app.database import get_db
from app.models.schemas import HealthResponse
from app.rate_limit import limiter

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
@limiter.exempt
async def health(request: Request) -> HealthResponse:
    try:
        await get_db().command("ping")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return HealthResponse(status="ok", database=db_status)
