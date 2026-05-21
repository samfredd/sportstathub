"""
OddSwitch Engine — v1 Router.

Mounts all v1 endpoint modules under the /v1 prefix.
"""

from fastapi import APIRouter

from app.api.v1.translate import router as translate_router

router = APIRouter(prefix="/v1")
router.include_router(translate_router)
