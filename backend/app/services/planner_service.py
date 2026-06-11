from datetime import datetime, timedelta, timezone
import math
from app.database import get_db
from app.models.schemas import Roadmap, RoadmapNode

def _now_date() -> datetime:
    return datetime.now(timezone.utc)

def topological_sort(nodes: list[dict]) -> list[dict]:
    """Sort uncompleted nodes topologically according to their prerequisites."""
    nodes_by_id = {n["id"]: n for n in nodes}
    in_degree = {nid: 0 for nid in nodes_by_id}
    adj = {nid: [] for nid in nodes_by_id}
    
    for n in nodes:
        nid = n["id"]
        for prereq in n.get("prerequisites", []):
            if prereq in nodes_by_id:
                adj[prereq].append(nid)
                in_degree[nid] += 1
                
    # Start with nodes having 0 in-degree. Sort by ID to ensure stable ordering.
    queue = sorted([nid for nid, deg in in_degree.items() if deg == 0])
    ordered_ids = []
    
    while queue:
        queue.sort()
        curr = queue.pop(0)
        ordered_ids.append(curr)
        for neighbor in adj[curr]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
                
    return [nodes_by_id[nid] for nid in ordered_ids if nid in nodes_by_id]

async def get_daily_schedule(user_id: str, roadmap_id: str | None = None) -> list[dict]:
    db = get_db()
    
    # 1. Fetch relevant roadmaps
    query = {"userId": user_id}
    if roadmap_id:
        query["id"] = roadmap_id
    else:
        query["status"] = "active"
        
    roadmaps_cursor = db.roadmaps.find(query)
    roadmaps = [doc async for doc in roadmaps_cursor]
    
    if not roadmaps:
        return []

    # 1b. Fetch commitments
    commitments_cursor = db.calendar_commitments.find({"userId": user_id})
    commitments = {doc["eventId"]: doc async for doc in commitments_cursor}

    # 1c. Fetch learner model for historical completed tasks
    learner_model = await db.learner_models.find_one({"userId": user_id})
    completed_tasks_history = {}
    if learner_model:
        for log in learner_model.get("detailedLogs", []):
            if log.get("completedAt") and log.get("roadmapId") and log.get("nodeId") and log.get("taskId"):
                date_str = log["completedAt"].split("T")[0]
                completed_key = f"task_{log['roadmapId']}_{log['nodeId']}_{log['taskId']}"
                completed_tasks_history[completed_key] = date_str

    # 2. Build queues of work items per roadmap
    roadmap_queues = {}
    pinned_events = []
    
    for rm in roadmaps:
        rm_id = rm["id"]
        rm_topic = rm["topic"]
        
        # Sort uncompleted nodes topologically
        uncompleted_nodes = [n for n in rm.get("nodes", []) if n.get("status") not in ["completed", "success"]]
        sorted_nodes = topological_sort(uncompleted_nodes)
        
        work_queue = []
        for n in sorted_nodes:
            nid = n["id"]
            title = n["title"]
            is_skill_check = n.get("isSkillCheck", False)
            status = n.get("status", "locked")
            
            # If the node is a skill check, it only has a single quiz event
            if is_skill_check:
                ev_id = f"sc_{rm_id}_{nid}"
                event_item = {
                    "id": ev_id,
                    "roadmapId": rm_id,
                    "roadmapTopic": rm_topic,
                    "nodeId": nid,
                    "nodeTitle": title,
                    "type": "skill_check",
                    "title": title,
                    "description": n.get("description", ""),
                    "durationMins": 30,
                    "completed": False
                }
                
                if ev_id in commitments and commitments[ev_id].get("pinned"):
                    event_item["date"] = commitments[ev_id]["date"]
                    event_item["pinned"] = True
                    pinned_events.append(event_item)
                else:
                    work_queue.append(event_item)
                continue
                
            # If the node is unlocked/in_progress, schedule its tasks
            if status in ["not_started", "unlocked", "in_progress", "failed"] and n.get("tasks"):
                for t in n["tasks"]:
                    t_id = t.get("id", "1")
                    ev_id = f"task_{rm_id}_{nid}_{t_id}"
                    
                    # Check if already completed
                    if t.get("completed", False) or t.get("status") == "success" or ev_id in completed_tasks_history:
                        comp_date = completed_tasks_history.get(ev_id)

                        if not comp_date:
                            comp_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                            
                        pinned_events.append({
                            "id": ev_id,
                            "roadmapId": rm_id,
                            "roadmapTopic": rm_topic,
                            "nodeId": nid,
                            "nodeTitle": title,
                            "type": "task",
                            "title": t.get('name', 'Practical Task'),
                            "description": t.get("description", ""),
                            "durationMins": t.get("durationMins", 45),
                            "completed": True,
                            "date": comp_date,
                            "inProgress": False,
                            "status": "success",
                            "score": t.get("score")
                        })
                        continue
                        
                    event_item = {
                        "id": ev_id,
                        "roadmapId": rm_id,
                        "roadmapTopic": rm_topic,
                        "nodeId": nid,
                        "nodeTitle": title,
                        "type": "task",
                        "title": t.get('name', 'Practical Task'),
                        "description": t.get("description", ""),
                        "durationMins": t.get("durationMins", 45),
                        "completed": False,
                        "inProgress": bool(t.get("sessionStartedAt") and not t.get("completed", False)),
                        "status": t.get("status", "not_started"),
                        "score": t.get("score")
                    }
                    
                    if ev_id in commitments and commitments[ev_id].get("pinned"):
                        event_item["date"] = commitments[ev_id]["date"]
                        event_item["pinned"] = True
                        pinned_events.append(event_item)
                    else:
                        work_queue.append(event_item)

                    
        if work_queue:
            roadmap_queues[rm_id] = work_queue

    # 3. Collect unpinned items as unassigned (date = None)
    events = list(pinned_events)
    
    for rm_id, queue in roadmap_queues.items():
        for item in queue:
            unassigned_item = dict(item)
            unassigned_item["date"] = None
            unassigned_item["pinned"] = False
            events.append(unassigned_item)
            
    return events


async def get_commitments(user_id: str) -> list[dict]:
    db = get_db()
    cursor = db.calendar_commitments.find({"userId": user_id})
    return [{k: v for k, v in doc.items() if k != "_id"} async for doc in cursor]


async def add_or_update_commitment(user_id: str, event_id: str, date: str, pinned: bool) -> dict:
    db = get_db()
    now_str = datetime.now(timezone.utc).isoformat()
    doc = {
        "userId": user_id,
        "eventId": event_id,
        "date": date,
        "pinned": pinned,
        "updatedAt": now_str
    }
    await db.calendar_commitments.update_one(
        {"userId": user_id, "eventId": event_id},
        {"$set": doc},
        upsert=True
    )
    return doc


async def delete_commitment(user_id: str, event_id: str) -> bool:
    db = get_db()
    res = await db.calendar_commitments.delete_one({"userId": user_id, "eventId": event_id})
    return res.deleted_count > 0

