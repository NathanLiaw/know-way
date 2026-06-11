from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.brand import APP_NAME
from app.config import settings
from app.database import close_db, ensure_indexes
from app.rate_limit import configure_rate_limiting
from app.routers import assessments, dashboard, health, onboarding, roadmaps, users, planner



@asynccontextmanager
async def lifespan(_app: FastAPI):
    await ensure_indexes()
    yield
    await close_db()


_docs_url = "/docs" if settings.expose_openapi else None
_redoc_url = "/redoc" if settings.expose_openapi else None
_openapi_url = "/openapi.json" if settings.expose_openapi else None

app = FastAPI(
    title=f"{APP_NAME} API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    openapi_url=_openapi_url,
)

configure_rate_limiting(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(onboarding.router, prefix="/api")
app.include_router(roadmaps.router, prefix="/api")
app.include_router(assessments.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(planner.router, prefix="/api")

