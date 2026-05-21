"""
OddSwitch Engine — Adapter Registry.

Central registry for all bookmaker adapters.
To add a new bookmaker, register it in ADAPTER_REGISTRY.
"""

from __future__ import annotations

from app.browser.adapters.base import BookmakerAdapter
from app.browser.adapters.sportybet import SportyBetAdapter
from app.browser.adapters.bet9ja import Bet9jaAdapter
from app.core.exceptions import BookmakerNotSupported

# ── Adapter Registry ─────────────────────────────────────────────────────────
# Add new bookmaker adapters here.
# Key: bookmaker ID (lowercase), Value: adapter class

ADAPTER_REGISTRY: dict[str, type[BookmakerAdapter]] = {
    "sportybet": SportyBetAdapter,
    "bet9ja": Bet9jaAdapter,
}


async def get_adapter(bookmaker: str) -> BookmakerAdapter:
    """
    Factory: get an adapter instance for the given bookmaker.

    Raises BookmakerNotSupported if not registered.
    """
    adapter_cls = ADAPTER_REGISTRY.get(bookmaker.lower())
    if not adapter_cls:
        raise BookmakerNotSupported(bookmaker)
    return adapter_cls()
