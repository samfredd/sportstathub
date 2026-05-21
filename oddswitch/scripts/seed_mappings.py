"""
OddSwitch Engine — Seed Reference Data.

Populates team_aliases, market_mappings, and a dev API key.
Run after migrations:
  python scripts/seed_mappings.py
"""

import asyncio
import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.engine import get_engine, get_session_factory
from app.db.models import ApiKey, MarketMapping, TeamAlias


# ── Dev API Key ──────────────────────────────────────────────────────────────

DEV_API_KEY = "dev-key-123"
DEV_API_KEY_HASH = hashlib.sha256(DEV_API_KEY.encode()).hexdigest()

# ── Team Aliases ─────────────────────────────────────────────────────────────
# Universal aliases (bookmaker=None)

TEAM_ALIASES = [
    # English Premier League
    ("Man City", "Manchester City"),
    ("Man Utd", "Manchester United"),
    ("Man United", "Manchester United"),
    ("Spurs", "Tottenham Hotspur"),
    ("Tottenham", "Tottenham Hotspur"),
    ("Wolves", "Wolverhampton Wanderers"),
    ("Wolverhampton", "Wolverhampton Wanderers"),
    ("Newcastle", "Newcastle United"),
    ("Leicester", "Leicester City"),
    ("West Ham", "West Ham United"),
    ("Brighton", "Brighton & Hove Albion"),
    ("Nottm Forest", "Nottingham Forest"),
    ("Nott Forest", "Nottingham Forest"),
    # La Liga
    ("Barca", "Barcelona"),
    ("FC Barcelona", "Barcelona"),
    ("Atletico", "Atletico Madrid"),
    ("Atl Madrid", "Atletico Madrid"),
    ("Real Sociedad", "Real Sociedad"),
    ("Villarreal CF", "Villarreal"),
    # Serie A
    ("AC Milan", "AC Milan"),
    ("Inter", "Inter Milan"),
    ("Inter Milan", "Inter Milan"),
    ("Juventus FC", "Juventus"),
    ("AS Roma", "Roma"),
    ("SSC Napoli", "Napoli"),
    # Bundesliga
    ("Bayern", "Bayern Munich"),
    ("Bayern München", "Bayern Munich"),
    ("Dortmund", "Borussia Dortmund"),
    ("BVB", "Borussia Dortmund"),
    ("Leverkusen", "Bayer Leverkusen"),
    ("Gladbach", "Borussia Monchengladbach"),
    # Ligue 1
    ("PSG", "Paris Saint-Germain"),
    ("Paris SG", "Paris Saint-Germain"),
    ("Lyon", "Olympique Lyonnais"),
    ("Marseille", "Olympique de Marseille"),
    # Bookmaker-specific (added separately below)
]

# Sportybet-specific aliases
SPORTYBET_ALIASES = [
    ("Liverpool FC", "Liverpool"),
    ("Chelsea FC", "Chelsea"),
    ("Arsenal FC", "Arsenal"),
]

# Bet9ja-specific aliases
BET9JA_ALIASES = [
    ("Liverpool FC", "Liverpool"),
    ("Manchester City FC", "Manchester City"),
    ("FC Arsenal", "Arsenal"),
]

# ── Market Mappings (SportyBet → Bet9ja) ─────────────────────────────────────

MARKET_MAPPINGS = [
    ("Over/Under 0.5 Goals", "Over/Under 0.5 Goals", "exact"),
    ("Over/Under 1.5 Goals", "Over/Under 1.5 Goals", "exact"),
    ("Over/Under 2.5 Goals", "Over/Under 2.5 Goals", "exact"),
    ("Over/Under 3.5 Goals", "Over/Under 3.5 Goals", "exact"),
    ("Over/Under 4.5 Goals", "Over/Under 4.5 Goals", "exact"),
    ("Match Result", "Match Result", "exact"),
    ("Both Teams To Score", "Both Teams To Score", "exact"),
    ("Double Chance", "Double Chance", "exact"),
    ("Correct Score", "Correct Score", "exact"),
    ("Asian Handicap", "Asian Handicap", "exact"),
    ("Half Time Result", "Half Time Result", "exact"),
    ("Half Time/Full Time", "Half Time/Full Time", "exact"),
]


async def seed():
    """Seed the database with reference data."""
    session_factory = get_session_factory()

    async with session_factory() as session:
        # ── API Key ──────────────────────────────────────────
        existing_key = await session.get(ApiKey, "dev-key")
        if not existing_key:
            session.add(ApiKey(
                id="dev-key",
                key_hash=DEV_API_KEY_HASH,
                name="Development API Key",
                is_active=True,
            ))
            print(f"  Created dev API key: {DEV_API_KEY}")

        # ── Universal Team Aliases ───────────────────────────
        for alias, canonical in TEAM_ALIASES:
            session.add(TeamAlias(alias=alias, canonical_name=canonical))
        print(f"  Seeded {len(TEAM_ALIASES)} universal team aliases")

        # ── Sportybet Aliases ────────────────────────────────
        for alias, canonical in SPORTYBET_ALIASES:
            session.add(TeamAlias(
                alias=alias, canonical_name=canonical, bookmaker="sportybet"
            ))
        print(f"  Seeded {len(SPORTYBET_ALIASES)} sportybet aliases")

        # ── Bet9ja Aliases ───────────────────────────────────
        for alias, canonical in BET9JA_ALIASES:
            session.add(TeamAlias(
                alias=alias, canonical_name=canonical, bookmaker="bet9ja"
            ))
        print(f"  Seeded {len(BET9JA_ALIASES)} bet9ja aliases")

        # ── Market Mappings ──────────────────────────────────
        for source, target, mtype in MARKET_MAPPINGS:
            # Sportybet → Bet9ja
            session.add(MarketMapping(
                source_market=source,
                target_market=target,
                source_bookmaker="sportybet",
                target_bookmaker="bet9ja",
                mapping_type=mtype,
            ))
            # Bet9ja → Sportybet (reverse)
            session.add(MarketMapping(
                source_market=target,
                target_market=source,
                source_bookmaker="bet9ja",
                target_bookmaker="sportybet",
                mapping_type=mtype,
            ))
        print(f"  Seeded {len(MARKET_MAPPINGS) * 2} market mappings (bidirectional)")

        await session.commit()
        print("\nSeed complete!")


if __name__ == "__main__":
    print("OddSwitch Engine — Seeding reference data...")
    asyncio.run(seed())
