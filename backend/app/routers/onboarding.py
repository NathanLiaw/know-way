import json
import secrets
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user_id
from app.database import get_db
from app.agents.orchestrator import run_advisor_turn, get_advisor_session_output
from app.agents.schema import AdvisorQuestion

router = APIRouter(prefix="/onboarding", tags=["onboarding"])



class OnboardingStartRequest(BaseModel):
    topic: str


class OnboardingMessageRequest(BaseModel):
    session_id: str
    message: str


class OnboardingResponse(BaseModel):
    session_id: str
    complete: bool
    question: str | None = None
    default_answers: list[str] | None = None
    profile: dict | None = None


def _clean_json_text(raw_text: str) -> str:
    text = raw_text.strip()
    start_idx = text.find('{')
    end_idx = text.rfind('}')
    if start_idx != -1 and end_idx != -1:
        text = text[start_idx:end_idx+1]
    return text.strip()


@router.post("/start", response_model=OnboardingResponse)
async def start_onboarding(
    body: OnboardingStartRequest,
    user_id: str = Depends(get_current_user_id)
):
    if not body.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required")

    # Limit check: Max 3 active roadmaps
    active_count = await get_db().roadmaps.count_documents({"userId": user_id, "status": "active"})
    if active_count >= 3:
        raise HTTPException(
            status_code=400,
            detail="You have reached the limit of 3 active roadmaps. Please pause or delete an existing roadmap before starting a new onboarding session."
        )

    session_id = secrets.token_hex(8)

    initial_msg = f"I want to learn {body.topic.strip()}."

    try:
        raw_response = await run_advisor_turn(session_id, initial_msg)
        
        # Check if it somehow completed immediately (unlikely but safe)
        profile = await get_advisor_session_output(session_id)
        if profile:
            return OnboardingResponse(
                session_id=session_id,
                complete=True,
                profile=profile
            )

        cleaned = _clean_json_text(raw_response)
        try:
            parsed = AdvisorQuestion.model_validate_json(cleaned)
            return OnboardingResponse(
                session_id=session_id,
                complete=False,
                question=parsed.question,
                default_answers=parsed.default_answers
            )
        except Exception:
            # Fallback parsing
            import re
            import json
            question_text = raw_response.strip()
            question_text = re.sub(r"```json|```", "", question_text).strip()
            try:
                parsed_json = json.loads(_clean_json_text(question_text))
                q = parsed_json.get("question", question_text)
                ans = parsed_json.get("default_answers", ["Beginner", "Intermediate", "Advanced", "Expert"])
                return OnboardingResponse(
                    session_id=session_id,
                    complete=False,
                    question=q,
                    default_answers=ans
                )
            except Exception:
                pass
            return OnboardingResponse(
                session_id=session_id,
                complete=False,
                question=question_text or "What is your experience level with this topic?",
                default_answers=["Beginner", "Intermediate", "Advanced", "Expert"]
            )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start Advisor onboarding session: {str(e)}"
        )


@router.post("/message", response_model=OnboardingResponse)
async def continue_onboarding(body: OnboardingMessageRequest):
    if not body.session_id.strip():
        raise HTTPException(status_code=400, detail="Session ID is required")
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")

    try:
        raw_response = await run_advisor_turn(body.session_id, body.message)
        
        # 1. Check if complete (advisor_output exists in session state)
        profile = await get_advisor_session_output(body.session_id)
        if profile:
            return OnboardingResponse(
                session_id=body.session_id,
                complete=True,
                profile=profile
            )

        # 2. Parse next question
        cleaned = _clean_json_text(raw_response)
        try:
            parsed = AdvisorQuestion.model_validate_json(cleaned)
            return OnboardingResponse(
                session_id=body.session_id,
                complete=False,
                question=parsed.question,
                default_answers=parsed.default_answers
            )
        except Exception:
            # Fallback parsing
            import re
            import json
            question_text = raw_response.strip()
            question_text = re.sub(r"```json|```", "", question_text).strip()
            try:
                parsed_json = json.loads(_clean_json_text(question_text))
                q = parsed_json.get("question", question_text)
                ans = parsed_json.get("default_answers", [])
                return OnboardingResponse(
                    session_id=body.session_id,
                    complete=False,
                    question=q,
                    default_answers=ans
                )
            except Exception:
                pass
            return OnboardingResponse(
                session_id=body.session_id,
                complete=False,
                question=question_text or "Could you clarify that or tell me more about your experience?",
                default_answers=[]
            )
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Fallback in case parsing failed but endstage was called
        profile = await get_advisor_session_output(body.session_id)
        if profile:
            return OnboardingResponse(
                session_id=body.session_id,
                complete=True,
                profile=profile
            )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process Advisor turn: {str(e)}"
        )
