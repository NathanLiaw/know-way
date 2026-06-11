from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks

from app.database import get_db
from app.dependencies import get_current_user_id
from app.models.schemas import NodeStatusUpdate, Roadmap, RoadmapCreate, RoadmapGenerateRequest, RoadmapExpandRequest, RoadmapStatusUpdate
from app.services import roadmap_service



router = APIRouter(prefix="/roadmaps", tags=["roadmaps"])


@router.get("", response_model=list[Roadmap])
async def list_roadmaps(user_id: str = Depends(get_current_user_id)) -> list[Roadmap]:
    return await roadmap_service.list_roadmaps(user_id)


@router.get("/{roadmap_id}", response_model=Roadmap)
async def get_roadmap(
    roadmap_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    rm = await roadmap_service.get_roadmap(user_id, roadmap_id)
    if not rm:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    return rm


@router.post("", response_model=Roadmap, status_code=201)
async def create_roadmap(
    body: RoadmapCreate,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    try:
        return await roadmap_service.create_roadmap(user_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/generate", response_model=Roadmap, status_code=201)
async def generate_roadmap(
    body: RoadmapGenerateRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    if not body.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required")
    try:
        rm = await roadmap_service.generate_roadmap(user_id, body)
        background_tasks.add_task(roadmap_service.enrich_roadmap_background, user_id, rm.id)
        return rm
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.patch("/{roadmap_id}/nodes/{node_id}", response_model=Roadmap)
async def patch_node(
    roadmap_id: str,
    node_id: str,
    body: NodeStatusUpdate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    rm = await roadmap_service.update_node_status(user_id, roadmap_id, node_id, body)
    if not rm:
        raise HTTPException(status_code=404, detail="Roadmap or node not found")
    background_tasks.add_task(roadmap_service.enrich_roadmap_background, user_id, rm.id)
    return rm


@router.post("/{roadmap_id}/nodes/{node_id}/enrich", response_model=Roadmap)
async def enrich_node(
    roadmap_id: str,
    node_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    rm = await roadmap_service.enrich_node_explicit(user_id, roadmap_id, node_id)
    if not rm:
        raise HTTPException(status_code=404, detail="Roadmap or node not found")
    return rm


@router.post("/{roadmap_id}/generate_sub", response_model=Roadmap)
async def generate_sub_nodes(
    roadmap_id: str,
    body: RoadmapExpandRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    rm = await roadmap_service.generate_sub_nodes_service(user_id, roadmap_id, body)
    if not rm:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    background_tasks.add_task(roadmap_service.enrich_roadmap_background, user_id, rm.id)
    return rm


@router.post("/{roadmap_id}/generate_sub_sub", response_model=Roadmap)
async def generate_sub_sub_nodes(
    roadmap_id: str,
    body: RoadmapExpandRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    rm = await roadmap_service.generate_sub_sub_nodes_service(user_id, roadmap_id, body)
    if not rm:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    background_tasks.add_task(roadmap_service.enrich_roadmap_background, user_id, rm.id)
    return rm


@router.patch("/{roadmap_id}", response_model=Roadmap)
async def update_roadmap_status(
    roadmap_id: str,
    body: RoadmapStatusUpdate,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    try:
        rm = await roadmap_service.update_roadmap_status(user_id, roadmap_id, body.status)
        if not rm:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        return rm
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{roadmap_id}", status_code=204)
async def delete_roadmap(
    roadmap_id: str,
    user_id: str = Depends(get_current_user_id),
) -> None:
    success = await roadmap_service.delete_roadmap(user_id, roadmap_id)
    if not success:
        raise HTTPException(status_code=404, detail="Roadmap not found")


from pydantic import BaseModel

class TaskChatRequest(BaseModel):
    message: str


@router.post("/{roadmap_id}/nodes/{node_id}/tasks/{task_id}/session/start", response_model=Roadmap)
async def start_task_session(
    roadmap_id: str,
    node_id: str,
    task_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    try:
        rm = await roadmap_service.start_task_session(user_id, roadmap_id, node_id, task_id)
        if not rm:
            raise HTTPException(status_code=404, detail="Roadmap, node, or task not found")
        return rm
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{roadmap_id}/nodes/{node_id}/tasks/{task_id}/session/extend", response_model=Roadmap)
async def extend_task_session(
    roadmap_id: str,
    node_id: str,
    task_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    rm = await roadmap_service.extend_task_session(user_id, roadmap_id, node_id, task_id)
    if not rm:
        raise HTTPException(status_code=404, detail="Roadmap, node, or task not found")
    return rm


@router.post("/{roadmap_id}/nodes/{node_id}/tasks/{task_id}/session/chat")
async def chat_task_session(
    roadmap_id: str,
    node_id: str,
    task_id: str,
    body: TaskChatRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    resp = await roadmap_service.chat_task_session(user_id, roadmap_id, node_id, task_id, body.message)
    if resp is None:
        raise HTTPException(status_code=404, detail="Roadmap, node, or task not found")
    return {"response": resp}


@router.get("/{roadmap_id}/nodes/{node_id}/tasks/{task_id}/session")
async def get_task_session(
    roadmap_id: str,
    node_id: str,
    task_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    db = get_db()
    contract_id = f"contract_{roadmap_id}_{node_id}_{task_id}"
    contract = await db.contracts.find_one({"id": contract_id, "userId": user_id})
    if not contract:
        return {"messages": []}
    return {"messages": contract.get("messages", [])}


@router.post("/{roadmap_id}/nodes/{node_id}/tasks/{task_id}/session/pause", response_model=Roadmap)
async def pause_task_session(
    roadmap_id: str,
    node_id: str,
    task_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    rm = await roadmap_service.pause_task_session(user_id, roadmap_id, node_id, task_id)
    if not rm:
        raise HTTPException(status_code=404, detail="Roadmap, node, or task not found")
    return rm


@router.post("/{roadmap_id}/nodes/{node_id}/tasks/{task_id}/session/resume", response_model=Roadmap)
async def resume_task_session(
    roadmap_id: str,
    node_id: str,
    task_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    rm = await roadmap_service.resume_task_session(user_id, roadmap_id, node_id, task_id)
    if not rm:
        raise HTTPException(status_code=404, detail="Roadmap, node, or task not found")
    return rm


@router.post("/{roadmap_id}/nodes/{node_id}/fork", response_model=Roadmap)
async def fork_node(
    roadmap_id: str,
    node_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
) -> Roadmap:
    rm = await roadmap_service.fork_node(user_id, roadmap_id, node_id)
    if not rm:
        raise HTTPException(status_code=404, detail="Roadmap or node not found")
    background_tasks.add_task(roadmap_service.enrich_roadmap_background, user_id, rm.id)
    return rm



