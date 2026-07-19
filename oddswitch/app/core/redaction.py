"""Stable, non-reversible identifiers for sensitive values in logs."""

from __future__ import annotations

import hashlib


def sensitive_fingerprint(value: str | None) -> str:
    if not value:
        return "none"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]
