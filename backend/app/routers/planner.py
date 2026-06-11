from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from app.dependencies import get_current_user_id
from app.services import planner_service

router = APIRouter(prefix="/planner", tags=["planner"])

class CommitmentPayload(BaseModel):
    eventId: str
    date: str
    pinned: bool

@router.get("", response_model=list[dict])
async def get_schedule(
    roadmap_id: str | None = Query(None),
    user_id: str = Depends(get_current_user_id)
) -> list[dict]:
    return await planner_service.get_daily_schedule(user_id, roadmap_id)

@router.get("/commitments", response_model=list[dict])
async def get_commitments(
    user_id: str = Depends(get_current_user_id)
) -> list[dict]:
    return await planner_service.get_commitments(user_id)

@router.post("/commitments", response_model=dict)
async def update_commitment(
    body: CommitmentPayload,
    user_id: str = Depends(get_current_user_id)
) -> dict:
    return await planner_service.add_or_update_commitment(user_id, body.eventId, body.date, body.pinned)

@router.delete("/commitments/{event_id}")
async def delete_commitment(
    event_id: str,
    user_id: str = Depends(get_current_user_id)
) -> dict:
    success = await planner_service.delete_commitment(user_id, event_id)
    return {"success": success}

