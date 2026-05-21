"""
OddSwitch Engine — Canonical Slip Schema.

The canonical schema is the bookmaker-agnostic intermediate representation.
All source slips are normalized into this form before translation.
The hash of the canonical slip is used for deduplication and caching.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime

from pydantic import BaseModel, Field, computed_field


class CanonicalLeg(BaseModel):
    """A single selection within a betting slip, normalized to canonical form."""

    event_name: str = Field(..., description="Canonical event name, e.g. 'Arsenal vs Chelsea'")
    event_date: datetime = Field(..., description="Event kickoff / start time (UTC)")
    league: str = Field(..., description="Canonical league name, e.g. 'English Premier League'")
    sport: str = Field(default="football", description="Sport type")
    market: str = Field(..., description="Canonical market, e.g. 'Over 2.5 Goals'")
    selection: str = Field(..., description="Canonical selection, e.g. 'Over'")
    odds: float = Field(..., gt=0, description="Decimal odds from source bookmaker")
    home_team: str = Field(..., description="Canonical home team name")
    away_team: str = Field(..., description="Canonical away team name")

    def to_sortable_dict(self) -> dict:
        """Return a deterministic dictionary for hashing."""
        return {
            "event_name": self.event_name,
            "event_date": self.event_date.isoformat(),
            "league": self.league,
            "sport": self.sport,
            "market": self.market,
            "selection": self.selection,
            "home_team": self.home_team,
            "away_team": self.away_team,
        }


class CanonicalSlip(BaseModel):
    """
    A complete betting slip in canonical (bookmaker-agnostic) form.

    The hash is computed from the sorted canonical JSON of all legs,
    excluding odds (which vary by bookmaker and time).
    """

    legs: list[CanonicalLeg] = Field(..., min_length=1)
    total_odds: float = Field(..., gt=0)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def hash(self) -> str:
        """SHA-256 hash of the canonical slip content (odds-independent)."""
        sortable = sorted(
            [leg.to_sortable_dict() for leg in self.legs],
            key=lambda d: json.dumps(d, sort_keys=True),
        )
        payload = json.dumps(sortable, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(payload.encode()).hexdigest()


class RawSlip(BaseModel):
    """
    Raw slip data as extracted directly from a bookmaker.

    This is the pre-normalization format. Field names and structures
    may vary per bookmaker — this schema captures the common superset.
    """

    bookmaker: str
    booking_code: str
    legs: list[RawLeg]
    total_odds: float | None = None
    raw_data: dict | None = Field(default=None, description="Full raw response for debugging")


class RawLeg(BaseModel):
    """A single leg as extracted from a bookmaker before normalization."""

    event_name: str
    event_date: datetime | None = None
    league: str | None = None
    sport: str | None = None
    market: str
    selection: str
    odds: float
    home_team: str | None = None
    away_team: str | None = None
    raw_data: dict | None = None
