from fastapi import HTTPException, status

from app.config import settings


async def require_seed_allowed() -> None:
    if settings.auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Database seeding is disabled when Clerk authentication is enabled",
        )
    if not settings.allow_seed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seeding is disabled. Set ALLOW_SEED=true in development only",
        )
