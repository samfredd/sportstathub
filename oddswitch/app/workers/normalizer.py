"""
OddSwitch Engine — Normalizer Worker.

Step 3: Convert a RawSlip into a CanonicalSlip.

Responsibilities:
  - Resolve team names via team_aliases table
  - Normalize market names to canonical form
  - Compute slip hash (SHA-256 of canonical content)
  - Store canonical slip in database if new
"""

from __future__ import annotations

from functools import reduce

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repository import MappingRepository, SlipRepository
from app.schemas.canonical import CanonicalLeg, CanonicalSlip, RawSlip

logger = structlog.get_logger()

# ── Market Normalization Map ─────────────────────────────────────────────────
# Maps common bookmaker market variants to canonical form.
# This is a starting point — production needs a much larger map.

MARKET_NORMALIZATIONS: dict[str, str] = {
    # Over/Under variants
    "over/under 0.5": "Over/Under 0.5 Goals",
    "over/under 1.5": "Over/Under 1.5 Goals",
    "over/under 2.5": "Over/Under 2.5 Goals",
    "over/under 3.5": "Over/Under 3.5 Goals",
    "over/under 4.5": "Over/Under 4.5 Goals",
    "total goals over/under 2.5": "Over/Under 2.5 Goals",
    "o/u 2.5": "Over/Under 2.5 Goals",
    "1x2": "Match Result",
    "match result": "Match Result",
    "full time result": "Match Result",
    "ft result": "Match Result",
    "1x2 - 1up": "Match Result 1UP",
    "1x2 - 2up": "Match Result 2UP",
    # Both Teams To Score
    "btts": "Both Teams To Score",
    "both teams to score": "Both Teams To Score",
    "gg/ng": "Both Teams To Score",
    # Double Chance
    "double chance": "Double Chance",
    # Correct Score
    "correct score": "Correct Score",
    # Handicap
    "handicap": "Asian Handicap",
    "asian handicap": "Asian Handicap",
}


class NormalizerWorker:
    """Converts raw bookmaker data into canonical, bookmaker-agnostic form."""

    def __init__(
        self,
        mapping_repo: MappingRepository,
        slip_repo: SlipRepository,
        session: AsyncSession,
    ) -> None:
        self._mapping_repo = mapping_repo
        self._slip_repo = slip_repo
        self._session = session

    async def normalize(self, raw_slip: RawSlip) -> CanonicalSlip:
        """
        Convert a RawSlip to a CanonicalSlip.

        1. Normalize team names via aliases
        2. Normalize market names
        3. Build canonical legs
        4. Compute hash
        5. Store in DB if new
        """
        canonical_legs: list[CanonicalLeg] = []

        for leg in raw_slip.legs:
            # Resolve team names
            home = await self._resolve_team_name(
                leg.home_team or self._extract_home_team(leg.event_name),
                raw_slip.bookmaker,
            )
            away = await self._resolve_team_name(
                leg.away_team or self._extract_away_team(leg.event_name),
                raw_slip.bookmaker,
            )

            # Normalize market
            market = self._normalize_market(leg.market)

            # Build canonical leg
            from datetime import datetime, timezone

            canonical_legs.append(
                CanonicalLeg(
                    event_name=f"{home} vs {away}",
                    event_date=leg.event_date or datetime.now(timezone.utc),
                    league=leg.league or "Unknown",
                    sport=leg.sport or "football",
                    market=market,
                    selection=leg.selection,
                    odds=leg.odds,
                    home_team=home,
                    away_team=away,
                )
            )

        # Compute total odds
        total_odds = raw_slip.total_odds or reduce(
            lambda a, b: a * b, [leg.odds for leg in canonical_legs], 1.0
        )

        canonical = CanonicalSlip(legs=canonical_legs, total_odds=total_odds)

        # Store in DB if this is a new canonical slip
        existing = await self._slip_repo.find_by_hash(canonical.hash)
        if not existing:
            await self._slip_repo.create(
                slip_hash=canonical.hash,
                normalized_json=canonical.model_dump(mode="json"),
                source_bookmaker=raw_slip.bookmaker,
                source_code=raw_slip.booking_code,
            )
            await self._session.flush()
            logger.info("canonical_slip_created", hash=canonical.hash)

        return canonical

    async def _resolve_team_name(self, name: str, bookmaker: str) -> str:
        """Look up canonical team name from aliases. Falls back to original."""
        if not name:
            return "Unknown"

        canonical = await self._mapping_repo.find_canonical_name(name, bookmaker)
        if canonical:
            return canonical

        # Try case-insensitive lookup
        canonical = await self._mapping_repo.find_canonical_name(
            name.lower(), bookmaker
        )
        return canonical or name

    def _normalize_market(self, market: str) -> str:
        """Normalize a market name to canonical form."""
        key = market.lower().strip()
        return MARKET_NORMALIZATIONS.get(key, market)

    def _extract_home_team(self, event_name: str) -> str:
        """Extract home team from event name (assumes 'Home vs Away' format)."""
        parts = event_name.split(" vs ")
        if len(parts) >= 2:
            return parts[0].strip()
        parts = event_name.split(" - ")
        if len(parts) >= 2:
            return parts[0].strip()
        return event_name.strip()

    def _extract_away_team(self, event_name: str) -> str:
        """Extract away team from event name."""
        parts = event_name.split(" vs ")
        if len(parts) >= 2:
            return parts[1].strip()
        parts = event_name.split(" - ")
        if len(parts) >= 2:
            return parts[1].strip()
        return ""
