from fastapi import APIRouter, Depends
from app.auth.clerk import TokenClaims, get_token_claims
from app.models.schemas import User
from app.services import user_service
from app.dependencies import get_current_user_id
from app.database import get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=User)
async def get_me(claims: TokenClaims = Depends(get_token_claims)) -> User:
    return await user_service.ensure_user(claims)


@router.get("/profile")
async def get_learner_profile(user_id: str = Depends(get_current_user_id)):
    db = get_db()
    profile = await db.learner_models.find_one({"userId": user_id})
    if not profile:
        return {
            "userId": user_id,
            "compressedSummary": "No prior history profile available.",
            "roadmapSummaries": {},
            "concepts": [],
            "detailedLogs": [],
            "generalPreferences": []
        }
    
    # Strip MongoDB ObjectId to make it JSON serializable
    if "_id" in profile:
        profile["_id"] = str(profile["_id"])
    return profile
