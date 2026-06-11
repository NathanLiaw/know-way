from datetime import datetime, timezone

from app.auth.clerk import TokenClaims
from app.database import get_db
from app.models.schemas import User


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def ensure_user(claims: TokenClaims) -> User:
    db = get_db()
    existing = await db.users.find_one({"id": claims.sub})

    if existing:
        doc = dict(existing)
        doc.pop("_id", None)
        return User.model_validate(doc)

    now = _now_iso()
    doc = {
        "id": claims.sub,
        "name": claims.name or "Learner",
        "email": claims.email or f"{claims.sub}@users.clerk",
        "streak": 0,
        "joinedAt": now[:10],
    }
    await db.users.insert_one(doc)
    return User.model_validate(doc)
