"""
OddSwitch Engine — Pipeline Integration Tests.

Tests for the pipeline orchestrator and adapter registry.

Browser adapter tests (SportyBet, Bet9ja) require real browsers and are
marked with @pytest.mark.integration. Skipped by default.
Run with: pytest -m integration
"""

from __future__ import annotations

import pytest

from app.browser.adapters.sportybet import SportyBetAdapter
from app.browser.adapters.bet9ja import Bet9jaAdapter


# ── SportyBet (integration — requires browser) ──────────────────────────────


@pytest.mark.asyncio
@pytest.mark.integration
async def test_sportybet_resolve_real():
    """SportyBet adapter resolves a real booking code (requires browser)."""
    adapter = SportyBetAdapter()
    try:
        slip = await adapter.resolve_booking_code("SU88SY")
        assert slip.bookmaker == "sportybet"
        assert slip.booking_code == "SU88SY"
        assert len(slip.legs) > 0
        assert slip.total_odds > 0
    finally:
        await adapter.close()


# ── Bet9ja (integration — requires browser) ──────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.integration
async def test_bet9ja_resolve_real():
    """Bet9ja adapter resolves a real booking code (requires browser)."""
    adapter = Bet9jaAdapter()
    try:
        slip = await adapter.resolve_booking_code("5CJJLLH")
        assert slip.bookmaker == "bet9ja"
        assert slip.booking_code == "5CJJLLH"
        assert len(slip.legs) > 0
        assert slip.total_odds > 0
    finally:
        await adapter.close()


# ── Adapter Registry ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_adapter_registry():
    """Adapter registry returns correct adapters."""
    from app.browser.adapters import get_adapter
    from app.core.exceptions import BookmakerNotSupported

    sportybet = await get_adapter("sportybet")
    assert isinstance(sportybet, SportyBetAdapter)

    bet9ja = await get_adapter("bet9ja")
    assert isinstance(bet9ja, Bet9jaAdapter)

    with pytest.raises(BookmakerNotSupported):
        await get_adapter("nonexistent")
