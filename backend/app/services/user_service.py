from datetime import datetime, timezone
from app.auth.clerk import TokenClaims
from app.database import get_db
from app.models.schemas import User


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def ensure_user(claims: TokenClaims) -> User:
    db = get_db()
    existing = await db.users.find_one({"id": claims.sub})
    now = _now_iso()

    if existing:
        # Always upsert name/email so real Clerk profile data syncs after JWT template changes
        update_fields = {}
        if claims.name and claims.name != "Learner":
            update_fields["name"] = claims.name
        if claims.email and "@users.clerk" not in claims.email:
            update_fields["email"] = claims.email
        if update_fields:
            await db.users.update_one({"id": claims.sub}, {"$set": update_fields})
        doc = {**dict(existing), **update_fields}
        doc.pop("_id", None)
        return User.model_validate(doc)

    doc = {
        "id": claims.sub,
        "name": claims.name or "Learner",
        "email": claims.email or f"{claims.sub}@users.clerk",
        "streak": 0,
        "joinedAt": now[:10],
    }
    await db.users.insert_one(doc)
    return User.model_validate(doc)