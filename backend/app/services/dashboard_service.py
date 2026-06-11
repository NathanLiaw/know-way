import secrets
from datetime import datetime, timezone
from app.database import get_db
from app.models.schemas import ActivityEntry, DashboardStats, User


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_user(user_id: str) -> User | None:
    doc = await get_db().users.find_one({"id": user_id})
    if not doc:
        return None
    doc = dict(doc)
    doc.pop("_id", None)
    return User.model_validate(doc)


async def get_stats(user_id: str) -> DashboardStats:
    roadmaps = await get_db().roadmaps.find({"userId": user_id}).to_list(length=500)
    user = await get_db().users.find_one({"id": user_id})

    active = sum(1 for r in roadmaps if r.get("status") == "active")
    completed_nodes = 0
    confidence_sum = 0
    confidence_count = 0

    for rm in roadmaps:
        for node in rm.get("nodes", []):
            if node.get("status") == "completed":
                completed_nodes += 1
            conf = node.get("confidence", 0)
            if conf > 0:
                confidence_sum += conf
                confidence_count += 1

    avg = round(confidence_sum / confidence_count) if confidence_count else 0
    
    joined_at_str = user.get("joinedAt") if user else None
    if joined_at_str:
        try:
            joined_dt = datetime.fromisoformat(joined_at_str.replace("Z", "+00:00"))
            now_dt = datetime.now(timezone.utc)
            delta = now_dt - joined_dt
            streak = max(1, delta.days + 1)
        except Exception:
            streak = user.get("streak", 0) if user else 0
    else:
        streak = user.get("streak", 0) if user else 0

    return DashboardStats(
        activeRoadmaps=active,
        nodesCompleted=completed_nodes,
        avgConfidence=avg,
        streak=streak,
    )


async def get_activity(user_id: str, limit: int = 10) -> list[ActivityEntry]:
    cursor = (
        get_db()
        .activity_entries.find({"userId": user_id})
        .sort("timestamp", -1)
        .limit(limit)
    )
    entries = []
    async for doc in cursor:
        doc = dict(doc)
        doc.pop("_id", None)
        doc.pop("userId", None)
        doc.pop("sortOrder", None)
        entries.append(ActivityEntry.model_validate(doc))
    return entries


async def log_activity(
    user_id: str,
    activity_type: str,
    label: str,
    sub_label: str,
    roadmap_id: str | None = None
) -> None:
    db = get_db()
    activity_id = f"act_{secrets.token_hex(6)}"
    doc = {
        "id": activity_id,
        "userId": user_id,
        "type": activity_type,
        "label": label,
        "subLabel": sub_label,
        "timestamp": _now_iso(),
        "roadmapId": roadmap_id
    }
    await db.activity_entries.insert_one(doc)
