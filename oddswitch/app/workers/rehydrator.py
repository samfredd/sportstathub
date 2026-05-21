"""
OddSwitch Engine — Rehydrator Worker.

Steps 7-8: Rebuild the target slip and generate a booking code.

Step 7: Construct a target-bookmaker-formatted slip from canonical data
Step 8: Call browser adapter to generate the booking code
"""

from __future__ import annotations

import structlog

from app.cache.redis_client import RedisCache
from app.schemas.canonical import CanonicalSlip
from app.workers.matcher import EventMatch
from app.workers.translator import MarketTranslation

logger = structlog.get_logger()


class RehydratorWorker:
    """Rebuilds translated slips and generates booking codes."""

    def __init__(self, redis: RedisCache) -> None:
        self._redis = redis

    def rebuild(
        self,
        target_bookmaker: str,
        canonical: CanonicalSlip,
        event_matches: list[EventMatch],
        market_translations: list[MarketTranslation],
        confidence_report: dict,
    ) -> dict:
        """
        Step 7: Rebuild the slip in target bookmaker format.

        Returns a dict representing the target slip with
        translated events, markets, and confidence per leg.
        """
        legs = []
        total_odds = 1.0

        for i, canonical_leg in enumerate(canonical.legs):
            event_match = next(
                (m for m in event_matches if m.leg_index == i), None
            )
            market_tx = next(
                (m for m in market_translations if m.leg_index == i), None
            )
            leg_confidence = next(
                (l for l in confidence_report.get("legs", []) if l["leg_index"] == i),
                None,
            )

            target_event = (
                event_match.target_event if event_match else canonical_leg.event_name
            )
            target_market = (
                market_tx.target_market if market_tx and market_tx.target_market
                else canonical_leg.market
            )
            target_selection = (
                market_tx.target_selection if market_tx and market_tx.target_selection
                else canonical_leg.selection
            )

            # Odds may differ on target — for now use source odds
            # In production, we'd fetch live odds from the target bookmaker
            target_odds = canonical_leg.odds

            legs.append({
                "event": target_event,
                "market": target_market,
                "selection": target_selection,
                "odds": target_odds,
                "confidence": leg_confidence["combined_confidence"] if leg_confidence else 0,
                "status": leg_confidence["status"] if leg_confidence else "missing",
                "home_team": event_match.target_home if event_match else canonical_leg.home_team,
                "away_team": event_match.target_away if event_match else canonical_leg.away_team,
            })

            total_odds *= target_odds

        return {
            "bookmaker": target_bookmaker,
            "legs": legs,
            "total_odds": round(total_odds, 4),
        }

    async def generate_code(
        self,
        target_bookmaker: str,
        translated_slip: dict,
    ) -> str:
        """
        Step 8: Generate a booking code on the target bookmaker.

        Calls the browser adapter to place the selections and get a code.
        """
        logger.info("rehydrator_generate", bookmaker=target_bookmaker)

        from app.browser.adapters import get_adapter

        adapter = await get_adapter(target_bookmaker)
        try:
            code = await adapter.generate_booking_code(translated_slip)
            return code
        finally:
            await adapter.close()
