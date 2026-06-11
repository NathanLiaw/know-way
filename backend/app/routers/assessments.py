from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.dependencies import get_current_user_id
from app.models.schemas import Assessment, AssessmentScoreUpdate
from app.services import assessment_service

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.get("", response_model=list[Assessment])
async def list_assessments(user_id: str = Depends(get_current_user_id)) -> list[Assessment]:
    return await assessment_service.list_assessments(user_id)


@router.get("/{assessment_id}", response_model=Assessment)
async def get_assessment(
    assessment_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Assessment:
    a = await assessment_service.get_assessment(user_id, assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return a


@router.patch("/{assessment_id}", response_model=Assessment)
async def patch_assessment(
    assessment_id: str,
    body: AssessmentScoreUpdate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
) -> Assessment:
    a = await assessment_service.update_score(user_id, assessment_id, body)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    from app.services.roadmap_service import enrich_roadmap_background
    background_tasks.add_task(enrich_roadmap_background, user_id, a.roadmapId)
    return a


class AssessmentGenerateRequest(BaseModel):
    roadmap_id: str
    node_id: str
    task_id: str
    bypass_timer: bool = False


@router.post("/generate", response_model=Assessment)
async def generate_assessment(
    body: AssessmentGenerateRequest,
    user_id: str = Depends(get_current_user_id),
) -> Assessment:
    ast = await assessment_service.generate_assessment_service(
        user_id=user_id,
        roadmap_id=body.roadmap_id,
        node_id=body.node_id,
        task_id=body.task_id,
        bypass_timer=body.bypass_timer
    )
    if not ast:
        raise HTTPException(
            status_code=400,
            detail="Learning contract timer not complete, task not found, or node locked."
        )
    return ast


@router.post("/roadmap/{roadmap_id}/generate", response_model=Assessment)
async def generate_roadmap_assessment(
    roadmap_id: str,
    user_id: str = Depends(get_current_user_id)
) -> Assessment:
    try:
        ast = await assessment_service.generate_roadmap_assessment_service(
            user_id=user_id,
            roadmap_id=roadmap_id
        )
        if not ast:
            raise HTTPException(
                status_code=400,
                detail="No completed nodes found for this roadmap, or roadmap not found."
            )
        return ast
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
