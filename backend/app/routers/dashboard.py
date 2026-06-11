from fastapi import APIRouter, Depends

from app.dependencies import get_current_user_id
from app.models.schemas import ActivityEntry, DashboardStats
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def stats(user_id: str = Depends(get_current_user_id)) -> DashboardStats:
    return await dashboard_service.get_stats(user_id)


@router.get("/activity", response_model=list[ActivityEntry])
async def activity(user_id: str = Depends(get_current_user_id)) -> list[ActivityEntry]:
    return await dashboard_service.get_activity(user_id)
