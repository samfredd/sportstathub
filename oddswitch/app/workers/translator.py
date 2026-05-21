"""
OddSwitch Engine — Market Translator Worker.

Step 5: Translate markets from source to target bookmaker format.
"""

from __future__ import annotations

from dataclasses import dataclass

import structlog

from app.db.repository import MappingRepository
from app.workers.matcher import EventMatch

logger = structlog.get_logger()


@dataclass
class MarketTranslation:
    """Result of translating a single market."""
    source_market: str
    target_market: str
    source_selection: str
    target_selection: str
    mapping_type: str  # exact | semantic | approximate
    confidence: float
    leg_index: int


class TranslatorWorker:
    """Translates markets between bookmakers using the mapping table."""

    def __init__(self, mapping_repo: MappingRepository) -> None:
        self._mapping_repo = mapping_repo

    async def translate_markets(
        self,
        event_matches: list[EventMatch],
        source_bookmaker: str,
        target_bookmaker: str,
    ) -> list[MarketTranslation]:
        """Translate all markets in the matched events."""
        # We need the canonical slip to get market info per leg
        # For now, return identity translations since markets are already canonical
        translations: list[MarketTranslation] = []

        for match in event_matches:
            # In production, look up the market_mappings table
            db_mapping = await self._mapping_repo.find_market_mapping(
                source_market=match.source_event,  # Placeholder
                source_bookmaker=source_bookmaker,
                target_bookmaker=target_bookmaker,
            )

            if db_mapping:
                translations.append(MarketTranslation(
                    source_market=db_mapping.source_market,
                    target_market=db_mapping.target_market,
                    source_selection="",
                    target_selection="",
                    mapping_type=db_mapping.mapping_type,
                    confidence=1.0 if db_mapping.mapping_type == "exact" else 0.85,
                    leg_index=match.leg_index,
                ))
            else:
                # Identity mapping (canonical markets are the same)
                translations.append(MarketTranslation(
                    source_market="",
                    target_market="",
                    source_selection="",
                    target_selection="",
                    mapping_type="exact",
                    confidence=0.9,
                    leg_index=match.leg_index,
                ))

        return translations
