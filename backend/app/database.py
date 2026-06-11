from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.mongodb_db_name]


async def ensure_indexes() -> None:
    db = get_db()
    await db.users.create_index("id", unique=True)
    await db.roadmaps.create_index([("userId", 1), ("id", 1)], unique=True)
    await db.assessments.create_index([("userId", 1), ("id", 1)], unique=True)
    await db.activity_entries.create_index([("userId", 1), ("createdAt", -1)])
    await db.learner_models.create_index("userId", unique=True)
    await db.calendar_commitments.create_index([("userId", 1), ("eventId", 1)], unique=True)


async def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
