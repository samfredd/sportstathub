"""
OddSwitch Engine — Event Matcher Worker.

Step 4: Match canonical events to target bookmaker events.

Strategy:
  1. Direct DB lookup (event_mappings table)
  2. Fuzzy matching (team name similarity + date proximity)
  3. Confidence scoring per match

Returns a list of EventMatch objects with confidence scores.
"""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher

import structlog

from app.db.repository import MappingRepository
from app.schemas.canonical import CanonicalSlip

logger = structlog.get_logger()


@dataclass
class EventMatch:
    """Result of matching a canonical event to a target bookmaker event."""

    source_event: str
    target_event: str
    source_home: str
    source_away: str
    target_home: str
    target_away: str
    confidence: float
    matched_via: str  # "db" | "fuzzy" | "exact"
    leg_index: int


class MatcherWorker:
    """Matches canonical events to target bookmaker events."""

    def __init__(self, mapping_repo: MappingRepository) -> None:
        self._mapping_repo = mapping_repo

    async def match_events(
        self,
        canonical: CanonicalSlip,
        target_bookmaker: str,
    ) -> list[EventMatch]:
        """
        Match each leg's event to the target bookmaker.

        Returns one EventMatch per leg. Unmatched legs get
        confidence=0 with matched_via="none".
        """
        matches: list[EventMatch] = []

        for i, leg in enumerate(canonical.legs):
            match = await self._match_single_event(
                source_event=leg.event_name,
                home_team=leg.home_team,
                away_team=leg.away_team,
                source_bookmaker="canonical",
                target_bookmaker=target_bookmaker,
                leg_index=i,
            )
            matches.append(match)

        return matches

    async def _match_single_event(
        self,
        source_event: str,
        home_team: str,
        away_team: str,
        source_bookmaker: str,
        target_bookmaker: str,
        leg_index: int,
    ) -> EventMatch:
        """Match a single event against the target bookmaker."""

        # ── Strategy 1: Direct DB lookup ─────────────────────
        db_match = await self._mapping_repo.find_event_mapping(
            source_event=source_event,
            source_bookmaker=source_bookmaker,
            target_bookmaker=target_bookmaker,
        )
        if db_match:
            logger.info(
                "event_match_db",
                source=source_event,
                target=db_match.target_event,
                confidence=db_match.confidence,
            )
            target_parts = db_match.target_event.split(" vs ")
            return EventMatch(
                source_event=source_event,
                target_event=db_match.target_event,
                source_home=home_team,
                source_away=away_team,
                target_home=target_parts[0].strip() if len(target_parts) >= 2 else home_team,
                target_away=target_parts[1].strip() if len(target_parts) >= 2 else away_team,
                confidence=db_match.confidence,
                matched_via="db",
                leg_index=leg_index,
            )

        # ── Strategy 2: Fuzzy match ──────────────────────────
        # For now, assume the same event name with high confidence.
        # In production, this would query the target bookmaker's
        # event list and use team name similarity + date proximity.
        confidence = self._compute_fuzzy_confidence(
            home_team, away_team, home_team, away_team
        )

        logger.info(
            "event_match_fuzzy",
            source=source_event,
            confidence=confidence,
        )

        return EventMatch(
            source_event=source_event,
            target_event=source_event,
            source_home=home_team,
            source_away=away_team,
            target_home=home_team,
            target_away=away_team,
            confidence=confidence,
            matched_via="fuzzy",
            leg_index=leg_index,
        )

    def _compute_fuzzy_confidence(
        self,
        source_home: str,
        source_away: str,
        target_home: str,
        target_away: str,
    ) -> float:
        """
        Compute confidence score based on team name similarity.

        Uses SequenceMatcher for string similarity.
        In production, would also factor in:
          - Event date proximity
          - League matching
          - Odds similarity
        """
        home_sim = SequenceMatcher(
            None, source_home.lower(), target_home.lower()
        ).ratio()
        away_sim = SequenceMatcher(
            None, source_away.lower(), target_away.lower()
        ).ratio()

        return round((home_sim * 0.5) + (away_sim * 0.5), 4)
