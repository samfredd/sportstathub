"""
OddSwitch Engine — Shared Enumerations.

Single source of truth for all status values and type classifications
used across the API, database, and worker layers.
"""

from enum import StrEnum


class JobStatus(StrEnum):
    """Translation job lifecycle states."""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TranslationStatus(StrEnum):
    """Overall translation quality classification."""
    SEMANTICALLY_EQUIVALENT = "semantically_equivalent"
    APPROXIMATE = "approximate"
    PARTIAL = "partial"


class LegStatus(StrEnum):
    """Per-leg translation accuracy classification."""
    EXACT = "exact"
    APPROXIMATE = "approximate"
    MISSING = "missing"


class MappingType(StrEnum):
    """Market mapping accuracy classification."""
    EXACT = "exact"
    SEMANTIC = "semantic"
    APPROXIMATE = "approximate"


class Sport(StrEnum):
    """Supported sport types."""
    FOOTBALL = "football"
    BASKETBALL = "basketball"
    TENNIS = "tennis"
    OTHER = "other"
