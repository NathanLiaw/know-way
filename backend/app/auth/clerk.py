from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import settings

_bearer = HTTPBearer(auto_error=False)
_jwks_client_instance: PyJWKClient | None = None


@dataclass(frozen=True)
class TokenClaims:
    sub: str
    email: str | None = None
    name: str | None = None


def _jwks_client() -> PyJWKClient:
    global _jwks_client_instance
    if _jwks_client_instance is None:
        issuer = settings.clerk_jwt_issuer.rstrip("/")
        _jwks_client_instance = PyJWKClient(f"{issuer}/.well-known/jwks.json")
    return _jwks_client_instance


def _verify_token(token: str) -> TokenClaims:
    if not settings.auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth misconfiguration",
        )

    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_jwt_issuer.rstrip("/"),
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        ) from exc

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    email = payload.get("email")
    if not email and isinstance(payload.get("primary_email_address"), str):
        email = payload["primary_email_address"]

    name = payload.get("name")
    if not name:
        first = payload.get("first_name") or ""
        last = payload.get("last_name") or ""
        combined = f"{first} {last}".strip()
        name = combined or None

    return TokenClaims(sub=sub, email=email, name=name)


async def get_token_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> TokenClaims:
    if not settings.auth_enabled:
        return TokenClaims(sub=settings.demo_user_id, email=None, name="Demo User")

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _verify_token(credentials.credentials)


async def get_current_user_id(claims: TokenClaims = Depends(get_token_claims)) -> str:
    return claims.sub
