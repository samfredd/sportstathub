"""
OddSwitch Engine — Celery Application.

Redis-backed task queue with two separate queues:
  - translate: standard translation pipeline tasks
  - browser:   isolated browser automation tasks

Workers are started per-queue for resource isolation.
"""

from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "oddswitch",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    # ── Serialization ────────────────────────────────────────
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # ── Task Routing ─────────────────────────────────────────
    task_routes={
        "app.queue.tasks.execute_translation_pipeline": {"queue": "translate"},
        "app.queue.tasks.resolve_booking_code": {"queue": "browser"},
        "app.queue.tasks.generate_booking_code": {"queue": "browser"},
    },

    # ── Default Queue ────────────────────────────────────────
    task_default_queue="translate",

    # ── Reliability ──────────────────────────────────────────
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,

    # ── Time Limits ──────────────────────────────────────────
    task_soft_time_limit=120,    # 2 min soft limit
    task_time_limit=180,         # 3 min hard kill

    # ── Result Expiry ────────────────────────────────────────
    result_expires=3600,         # 1 hour

    # ── Timezone ─────────────────────────────────────────────
    timezone="UTC",
    enable_utc=True,
)

# Auto-discover tasks in app.queue.tasks
celery_app.autodiscover_tasks(["app.queue"])
