"""
OddSwitch Engine — Prometheus Metrics.

Exposes counters, histograms, and gauges for observability:
  - Job lifecycle (created, completed, failed)
  - Cache performance (hits, misses)
  - Pipeline step latency
  - Queue depth
  - Bookmaker failure rate
"""

from prometheus_client import Counter, Gauge, Histogram

# ── Job Lifecycle ────────────────────────────────────────────────────────────

JOBS_CREATED = Counter(
    "oddswitch_jobs_created_total",
    "Total translation jobs created",
    ["source_bookmaker", "target_bookmaker"],
)

JOBS_COMPLETED = Counter(
    "oddswitch_jobs_completed_total",
    "Total translation jobs completed successfully",
    ["source_bookmaker", "target_bookmaker"],
)

JOBS_FAILED = Counter(
    "oddswitch_jobs_failed_total",
    "Total translation jobs that failed",
    ["source_bookmaker", "target_bookmaker", "error_code"],
)

# ── Cache Performance ────────────────────────────────────────────────────────

CACHE_HITS = Counter(
    "oddswitch_cache_hits_total",
    "Total cache hits",
    ["cache_type"],  # booking_code, translation, slip, dedup
)

CACHE_MISSES = Counter(
    "oddswitch_cache_misses_total",
    "Total cache misses",
    ["cache_type"],
)

# ── Pipeline Latency ─────────────────────────────────────────────────────────

JOB_DURATION = Histogram(
    "oddswitch_job_duration_seconds",
    "Time from job creation to completion",
    ["source_bookmaker", "target_bookmaker"],
    buckets=[0.5, 1, 2, 5, 10, 30, 60, 120, 300],
)

PIPELINE_STEP_DURATION = Histogram(
    "oddswitch_pipeline_step_duration_seconds",
    "Duration of individual pipeline steps",
    ["step"],  # resolve, normalize, match, translate, score, rebuild, generate
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30],
)

# ── Queue ────────────────────────────────────────────────────────────────────

QUEUE_DEPTH = Gauge(
    "oddswitch_queue_depth",
    "Current number of jobs in the queue",
    ["queue"],  # translate, browser
)

ACTIVE_WORKERS = Gauge(
    "oddswitch_active_workers",
    "Current number of active workers",
    ["worker_type"],  # translate, browser
)

# ── Bookmaker Health ─────────────────────────────────────────────────────────

BOOKMAKER_REQUESTS = Counter(
    "oddswitch_bookmaker_requests_total",
    "Total requests to bookmaker sites",
    ["bookmaker", "operation"],  # resolve, generate
)

BOOKMAKER_FAILURES = Counter(
    "oddswitch_bookmaker_failures_total",
    "Total failed bookmaker interactions",
    ["bookmaker", "operation", "error_type"],
)

# ── Translation Quality ─────────────────────────────────────────────────────

TRANSLATION_CONFIDENCE = Histogram(
    "oddswitch_translation_confidence",
    "Distribution of translation confidence scores",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0],
)
