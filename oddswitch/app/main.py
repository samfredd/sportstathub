"""
OddSwitch Engine — FastAPI Application.

Stateless API service. All state lives in PostgreSQL and Redis.
Lifespan manages connection pools for DB and Redis.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.api.v1.router import router as v1_router
from app.api.v1.schemas import HealthResponse
from app.cache.redis_client import RedisCache
from app.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.db.engine import dispose_engine, get_engine

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan: startup and shutdown hooks.

    Startup:  Initialize DB engine + Redis connection
    Shutdown: Close DB pool + Redis connection
    """
    settings = get_settings()
    if not settings.debug and not settings.webhook_signing_secret:
        raise RuntimeError("WEBHOOK_SIGNING_SECRET is required outside debug mode")

    # ── Startup ──────────────────────────────────────────────
    logger.info("starting", app=settings.app_name, version=settings.app_version)

    # Initialize database engine (validates connection)
    get_engine()

    # Initialize Redis
    redis = await RedisCache.create(settings.redis_url)
    app.state.redis = redis

    logger.info("started", app=settings.app_name)

    yield

    # ── Shutdown ─────────────────────────────────────────────
    logger.info("shutting_down")
    await redis.close()
    await dispose_engine()
    logger.info("shutdown_complete")


def create_app() -> FastAPI:
    """Factory function for the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Distributed booking code translation engine for sports bookmakers",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else [
            origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()
        ],
        allow_methods=["GET", "POST"],
        allow_headers=[settings.api_key_header, "Content-Type"],
    )

    # ── Exception Handlers ───────────────────────────────────
    register_exception_handlers(app)

    # ── Routes ───────────────────────────────────────────────
    app.include_router(v1_router)

    @app.get("/health", response_model=HealthResponse, tags=["system"])
    async def health_check() -> HealthResponse:
        """System health check — verifies connectivity to backing services."""
        redis: RedisCache = app.state.redis
        redis_ok = await redis.ping()

        # DB health is implicit — if the engine created, pool is alive
        db_ok = get_engine() is not None

        return HealthResponse(
            status="ok" if (redis_ok and db_ok) else "degraded",
            version=settings.app_version,
            services={
                "postgres": db_ok,
                "redis": redis_ok,
            },
        )

    @app.get("/metrics", include_in_schema=False)
    async def metrics(request: Request) -> Response:
        supplied = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
        if not settings.debug and (not settings.metrics_token or supplied != settings.metrics_token):
            raise HTTPException(status_code=401, detail="Unauthorized")
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    return app


# Uvicorn entrypoint
app = create_app()
