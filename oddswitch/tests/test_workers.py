"""
OddSwitch Engine — Worker Unit Tests.

Tests for individual worker components:
  - Normalizer (market normalization, team extraction)
  - Confidence scorer (threshold classification)
  - Canonical slip (hash computation)
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.canonical import CanonicalLeg, CanonicalSlip
from app.schemas.enums import TranslationStatus
from app.workers.confidence import ConfidenceScorer
from app.workers.matcher import EventMatch
from app.workers.normalizer import MARKET_NORMALIZATIONS, NormalizerWorker
from app.workers.translator import MarketTranslation

# ── Market Normalization ─────────────────────────────────────────────────────


def test_market_normalization_over_under():
    """Common over/under variants normalize correctly."""
    assert MARKET_NORMALIZATIONS.get("over/under 2.5") == "Over/Under 2.5 Goals"
    assert MARKET_NORMALIZATIONS.get("o/u 2.5") == "Over/Under 2.5 Goals"
    assert MARKET_NORMALIZATIONS.get("total goals over/under 2.5") == "Over/Under 2.5 Goals"


def test_market_normalization_match_result():
    """1X2 variants normalize to Match Result."""
    assert MARKET_NORMALIZATIONS.get("1x2") == "Match Result"
    assert MARKET_NORMALIZATIONS.get("full time result") == "Match Result"
    assert MARKET_NORMALIZATIONS.get("ft result") == "Match Result"


def test_market_normalization_btts():
    """BTTS variants normalize correctly."""
    assert MARKET_NORMALIZATIONS.get("btts") == "Both Teams To Score"
    assert MARKET_NORMALIZATIONS.get("gg/ng") == "Both Teams To Score"


# ── Team Name Extraction ─────────────────────────────────────────────────────


def test_extract_home_team_vs():
    """Extracts home team from 'Home vs Away' format."""
    normalizer = NormalizerWorker.__new__(NormalizerWorker)
    assert normalizer._extract_home_team("Arsenal vs Chelsea") == "Arsenal"


def test_extract_away_team_vs():
    """Extracts away team from 'Home vs Away' format."""
    normalizer = NormalizerWorker.__new__(NormalizerWorker)
    assert normalizer._extract_away_team("Arsenal vs Chelsea") == "Chelsea"


def test_extract_home_team_dash():
    """Extracts home team from 'Home - Away' format."""
    normalizer = NormalizerWorker.__new__(NormalizerWorker)
    assert normalizer._extract_home_team("Arsenal - Chelsea") == "Arsenal"


def test_extract_away_team_dash():
    """Extracts away team from 'Home - Away' format."""
    normalizer = NormalizerWorker.__new__(NormalizerWorker)
    assert normalizer._extract_away_team("Arsenal - Chelsea") == "Chelsea"


# ── Canonical Slip Hash ──────────────────────────────────────────────────────


def test_canonical_hash_deterministic():
    """Same canonical content produces the same hash."""
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    slip1 = CanonicalSlip(
        legs=[
            CanonicalLeg(
                event_name="Arsenal vs Chelsea",
                event_date=now,
                league="EPL",
                sport="football",
                market="Over 2.5",
                selection="Over",
                odds=1.82,
                home_team="Arsenal",
                away_team="Chelsea",
            )
        ],
        total_odds=1.82,
    )
    slip2 = CanonicalSlip(
        legs=[
            CanonicalLeg(
                event_name="Arsenal vs Chelsea",
                event_date=now,
                league="EPL",
                sport="football",
                market="Over 2.5",
                selection="Over",
                odds=1.90,  # Different odds
                home_team="Arsenal",
                away_team="Chelsea",
            )
        ],
        total_odds=1.90,
    )
    # Hash should be the same (odds excluded from hash)
    assert slip1.hash == slip2.hash


def test_canonical_hash_different_events():
    """Different events produce different hashes."""
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    slip1 = CanonicalSlip(
        legs=[
            CanonicalLeg(
                event_name="Arsenal vs Chelsea",
                event_date=now, league="EPL", sport="football",
                market="Over 2.5", selection="Over",
                odds=1.82, home_team="Arsenal", away_team="Chelsea",
            )
        ],
        total_odds=1.82,
    )
    slip2 = CanonicalSlip(
        legs=[
            CanonicalLeg(
                event_name="Liverpool vs Man City",
                event_date=now, league="EPL", sport="football",
                market="Over 2.5", selection="Over",
                odds=1.82, home_team="Liverpool", away_team="Man City",
            )
        ],
        total_odds=1.82,
    )
    assert slip1.hash != slip2.hash


# ── Confidence Scoring ───────────────────────────────────────────────────────


def test_confidence_high_exact():
    """High confidence events + markets → semantically_equivalent."""
    scorer = ConfidenceScorer()
    matches = [
        EventMatch("A vs B", "A vs B", "A", "B", "A", "B", 1.0, "db", 0),
    ]
    translations = [
        MarketTranslation("Over 2.5", "Over 2.5", "Over", "Over", "exact", 1.0, 0),
    ]
    result = scorer.score(matches, translations)
    assert result["confidence"] >= 0.9
    assert result["status"] == TranslationStatus.SEMANTICALLY_EQUIVALENT


def test_confidence_medium_approximate():
    """Medium confidence → approximate."""
    scorer = ConfidenceScorer()
    matches = [
        EventMatch("A vs B", "A vs B", "A", "B", "A", "B", 0.85, "fuzzy", 0),
    ]
    translations = [
        MarketTranslation("Over 2.5", "Over 2.5", "Over", "Over", "semantic", 0.9, 0),
    ]
    result = scorer.score(matches, translations)
    assert 0.7 <= result["confidence"] < 0.9
    assert result["status"] == TranslationStatus.APPROXIMATE


def test_confidence_low_partial():
    """Low confidence → partial."""
    scorer = ConfidenceScorer()
    matches = [
        EventMatch("A vs B", "X vs Y", "A", "B", "X", "Y", 0.5, "fuzzy", 0),
    ]
    translations = [
        MarketTranslation("Over 2.5", "Goals O/U", "Over", "Over", "approximate", 0.8, 0),
    ]
    result = scorer.score(matches, translations)
    assert result["confidence"] < 0.7
    assert result["status"] == TranslationStatus.PARTIAL


def test_confidence_multiple_legs():
    """Multiple legs averaged correctly."""
    scorer = ConfidenceScorer()
    matches = [
        EventMatch("A vs B", "A vs B", "A", "B", "A", "B", 1.0, "db", 0),
        EventMatch("C vs D", "C vs D", "C", "D", "C", "D", 0.5, "fuzzy", 1),
    ]
    translations = [
        MarketTranslation("Over 2.5", "Over 2.5", "Over", "Over", "exact", 1.0, 0),
        MarketTranslation("1X2", "1X2", "1", "1", "exact", 1.0, 1),
    ]
    result = scorer.score(matches, translations)
    # (1.0*1.0 + 0.5*1.0) / 2 = 0.75
    assert 0.7 <= result["confidence"] <= 0.8
