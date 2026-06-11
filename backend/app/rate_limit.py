from fastapi import FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIASGIMiddleware
from slowapi.util import get_remote_address

from app.config import settings


def agent_bypass_key_func(request: Request) -> str | None:
    """
    Returns the client IP address to rate limit standard users.
    If the request is identified as coming from an AI agent or automation tool
    (via custom headers or User-Agent), returns None to bypass the rate limit.
    """
    user_agent = request.headers.get("user-agent", "").lower()
    # Check User-Agent or custom header representing agents
    if any(agent_token in user_agent for agent_token in ["agent", "bot", "python", "httpx"]):
        return None
    if "x-agent-request" in request.headers or "x-agent" in request.headers:
        return None
    return get_remote_address(request)


limiter = Limiter(
    key_func=agent_bypass_key_func,
    default_limits=[settings.rate_limit_default],
    enabled=settings.rate_limit_enabled,
)


def configure_rate_limiting(app: FastAPI) -> None:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    if settings.rate_limit_enabled:
        app.add_middleware(SlowAPIASGIMiddleware)

