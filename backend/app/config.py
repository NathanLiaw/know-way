from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.brand import DEFAULT_DB_NAME

_BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mongodb_uri: str
    mongodb_db_name: str = DEFAULT_DB_NAME
    demo_user_id: str = "user_01"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    port: int = 8000
    rate_limit_enabled: bool = True
    rate_limit_default: str = "120/minute"
    expose_openapi: bool = True

    clerk_jwt_issuer: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def auth_enabled(self) -> bool:
        return bool(self.clerk_jwt_issuer and self.clerk_jwt_issuer.strip())


settings = Settings()
