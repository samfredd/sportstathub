"""
OddSwitch Engine — SportyBet Adapter (Real Implementation).

Browser automation for SportyBet booking code resolution
and generation using Playwright.

SportyBet share URL format:
  https://www.sportybet.com/?shareCode={code}&c=ng

DOM Structure (verified 2026-04-28):
  Betslip container: #j_betslip
  Item list:         .m-list
  Each item:         .m-item
    ├── Selection:   .m-item-play span (e.g. "Home", "Away", "Over")
    ├── Event:       .m-item-team [title attr has full name]
    ├── Market:      .m-item-market (e.g. "Over/Under", "Winner")
    ├── Odds:        .m-item-odds .m-text-main
    └── Sport icon:  .m-lay-left i [class indicates sport]

  Accept Changes:    button text "Accept Changes" (green button)
  Book Bet:          .m-share--wrapper a (text "Book Bet")
  Booking Modal:     appears after clicking Book Bet with code text

  Tabs:              "Betslip" / "Cashout"
  Sub-tabs:          "Single" / "Multiple"
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import structlog

from app.browser.adapters.base import BookmakerAdapter
from app.browser.stealth import random_delay
from app.schemas.canonical import RawLeg, RawSlip

logger = structlog.get_logger()

# ── Constants ────────────────────────────────────────────────────────────────

SPORTYBET_BASE = "https://www.sportybet.com"
SPORTYBET_SHARE_URL = f"{SPORTYBET_BASE}/?shareCode={{code}}&c=ng"

# Selectors (verified against live DOM)
SEL_BETSLIP = "#j_betslip"
SEL_ITEM_LIST = f"{SEL_BETSLIP} .m-list"

# API Headers
API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Content-Type": "application/json",
    "Origin": SPORTYBET_BASE,
    "Referer": f"{SPORTYBET_BASE}/ng/",
}
SEL_ITEM = f"{SEL_ITEM_LIST} .m-item"
SEL_ITEM_SELECTION = ".m-item-play span"
SEL_ITEM_EVENT = ".m-item-team"
SEL_ITEM_MARKET = ".m-item-market"
SEL_ITEM_ODDS = ".m-item-odds .m-text-main"
SEL_SPORT_ICON = ".m-lay-left i"
SEL_ACCEPT_CHANGES = "button:has-text('Accept Changes')"
SEL_BOOK_BET = ".m-share--wrapper a:has-text('Book Bet')"
SEL_REMOVE_BUTTON = ".m-item-close"

# Sport detection from icon class names
SPORT_ICON_MAP = {
    "sporty-icon-football": "football",
    "sporty-icon-basketball": "basketball",
    "sporty-icon-tennis": "tennis",
    "sporty-icon-table-tennis": "table_tennis",
    "sporty-icon-ice-hockey": "ice_hockey",
    "sporty-icon-handball": "handball",
    "sporty-icon-esport": "esports",
    "sporty-icon-ebasketball": "ebasketball",
    "sporty-icon-efootball": "efootball",
    "sporty-icon-vfootball": "vfootball",
    "sporty-icon-cricket": "cricket",
    "sporty-icon-boxing": "boxing",
    "sporty-icon-mma": "mma",
    "sporty-icon-volleyball": "volleyball",
    "sporty-icon-baseball": "baseball",
    "sporty-icon-rugby": "rugby",
    "sporty-icon-darts": "darts",
    "sporty-icon-snooker": "snooker",
}

# Timeout (ms) for page operations
PAGE_TIMEOUT = 15_000
NAV_TIMEOUT = 30_000


class SportyBetAdapter(BookmakerAdapter):
    """
    SportyBet browser adapter — real Playwright implementation.

    Resolves booking codes by loading the share URL and
    extracting all selection items from the betslip sidebar.

    Generates booking codes by loading selections, clicking
    "Accept Changes" if needed, then "Book Bet".
    """

    bookmaker_id = "sportybet"

    def __init__(self) -> None:
        self._page: Any = None
        self._context: Any = None

    async def _get_page(self) -> Any:
        """Acquire a browser page from the pool."""
        if self._page is None:
            from app.browser.manager import BrowserManager

            manager = await BrowserManager.create()
            self._context = await manager.acquire()
            self._page = await self._context.new_page()
            self._page.set_default_timeout(PAGE_TIMEOUT)
        return self._page

    # ── resolve_booking_code ─────────────────────────────────────────────

    async def resolve_booking_code(self, code: str) -> RawSlip:
        """
        Resolve a SportyBet booking code via internal API.

        Flow:
          1. GET /api/ng/orders/share/{code}
          2. Parse the JSON response
          3. Build RawSlip and RawLeg objects
        """
        import httpx
        from datetime import datetime, timezone

        logger.info("sportybet_resolve_start", code=code)

        async with httpx.AsyncClient(headers=API_HEADERS, timeout=15.0) as client:
            resp = await client.get(f"{SPORTYBET_BASE}/api/ng/orders/share/{code}", params={"_t": "1"})
            if resp.status_code != 200:
                raise RuntimeError(f"SportyBet API extraction failed: {resp.status_code}")

            data = resp.json().get("data") or {}
            outcomes = data.get("outcomes", [])

        logger.info("sportybet_items_found", count=len(outcomes))

        legs: list[RawLeg] = []
        total_odds = 1.0

        for item in outcomes:
            try:
                home_team = item.get("homeTeamName", "")
                away_team = item.get("awayTeamName", "")
                event_name = f"{home_team} vs {away_team}"
                sport = item.get("sport", {}).get("name", "football").lower()

                markets = item.get("markets", [])
                if not markets:
                    continue

                m = markets[0]
                market_name = m.get("desc", m.get("name", "Unknown"))

                sel_outcomes = m.get("outcomes", [])
                if not sel_outcomes:
                    continue

                o = sel_outcomes[0]
                selection = o.get("desc", "Unknown")
                odds = float(o.get("odds", 1.0))

                legs.append(RawLeg(
                    event_name=event_name,
                    event_date=datetime.now(timezone.utc),
                    league="",
                    sport=sport,
                    market=market_name,
                    selection=selection,
                    odds=odds,
                    home_team=home_team,
                    away_team=away_team,
                ))
                total_odds *= odds
            except Exception as e:
                logger.warning("sportybet_leg_extract_failed", error=str(e))

        logger.info(
            "sportybet_resolve_complete",
            code=code,
            legs=len(legs),
            total_odds=round(total_odds, 2),
        )

        return RawSlip(
            bookmaker="sportybet",
            booking_code=code,
            total_odds=round(total_odds, 2),
            legs=legs,
        )



    async def generate_booking_code(self, slip_data: dict) -> str:
        """
        Generate a booking code by directly calling SportyBet's internal API.
        This bypasses the UI completely for maximum speed and reliability.
        """
        logger.info("sportybet_generate_start", legs=len(slip_data.get("legs", [])))

        # 1. Fetch all events from API
        all_events = await self._fetch_all_events()

        # 2. Resolve IDs and build selections payload
        selections = []
        for i, leg in enumerate(slip_data.get("legs", [])):
            try:
                selection = await self._build_leg_selection(leg, all_events)
                if selection:
                    selections.append(selection)
            except Exception as e:
                logger.warning("sportybet_generate_leg_failed", index=i, event_name=leg.get("event"), error=str(e))

        if not selections:
            raise RuntimeError("Could not resolve any legs to SportyBet internal IDs")

        # 3. Create the share code
        return await self._create_share_code(selections)

    async def _fetch_all_events(self) -> list[dict]:
        """Fetch all live and prematch football events to resolve IDs."""
        import httpx
        events = []

        async with httpx.AsyncClient(headers=API_HEADERS, timeout=10.0) as client:
            # Live & Prematch (minimal info)
            resp = await client.get(f"{SPORTYBET_BASE}/api/ng/factsCenter/liveOrPrematchEvents", params={"sportId": "sr:sport:1", "_t": "1"})
            if resp.status_code == 200:
                data = resp.json()
                for t in data.get("data", []):
                    for e in t.get("events", []):
                        events.append(e)

            # Important / Prematch
            resp = await client.get(f"{SPORTYBET_BASE}/api/ng/factsCenter/importantEvents", params={"sportId": "sr:sport:1", "_t": "1"})
            if resp.status_code == 200:
                data = resp.json()
                seen = {e["eventId"] for e in events}
                for t in data.get("data", []):
                    for e in t.get("events", []):
                        if e["eventId"] not in seen:
                            events.append(e)

        return events

    async def _build_leg_selection(self, leg: dict, all_events: list[dict]) -> dict | None:
        """Find the matching event and market/outcome IDs for a leg."""
        from difflib import SequenceMatcher
        import httpx

        target_event_name = leg.get("event_name") or leg.get("event", "")
        home_team = leg.get("home_team", "")
        away_team = leg.get("away_team", "")

        if not home_team or not away_team:
            # Fallback parsing
            parts = target_event_name.split(" vs ")
            if len(parts) == 2:
                home_team, away_team = parts
            else:
                home_team, away_team = target_event_name, target_event_name

        # Fuzzy match event
        best_match = None
        best_score = 0
        for ev in all_events:
            ev_home = ev.get("homeTeamName", "")
            ev_away = ev.get("awayTeamName", "")

            h_score = SequenceMatcher(None, home_team.lower(), ev_home.lower()).ratio()
            a_score = SequenceMatcher(None, away_team.lower(), ev_away.lower()).ratio()
            score = (h_score + a_score) / 2

            if score > best_score and score > 0.6:
                best_score = score
                best_match = ev

        if not best_match:
            logger.warning("sportybet_generate_event_not_found", event_name=target_event_name)
            return None

        event_id = best_match["eventId"]

        # Fetch event markets
        async with httpx.AsyncClient(headers=API_HEADERS, timeout=10.0) as client:
            resp = await client.get(f"{SPORTYBET_BASE}/api/ng/factsCenter/event", params={"eventId": event_id, "_t": "1"})
            if resp.status_code != 200:
                logger.warning("sportybet_fetch_markets_failed", status=resp.status_code, event_id=event_id)
                return None

            mdata = resp.json().get("data", {})
            markets = mdata.get("markets", [])

        if not markets:
            logger.warning("sportybet_no_markets_found", event_id=event_id)
            return None

        # Map Canonical Market -> SportyBet Market ID
        market_name = leg.get("market", "")
        selection_name = leg.get("selection", "")

        # Hardcoded mapping for MVP (Production uses DB)
        sb_market_id = None
        sb_outcome_id = None
        specifier = ""

        m_lower = market_name.lower()
        s_lower = selection_name.lower()

        # Basic 1X2 Market Mapping
        if m_lower in ["match result", "1x2"]:
            sb_market_id = 1
            if "home" in s_lower or "1" in s_lower or (home_team.lower() in s_lower):
                sb_outcome_id = 1
            elif "draw" in s_lower or "x" in s_lower:
                sb_outcome_id = 2
            elif "away" in s_lower or "2" in s_lower or (away_team.lower() in s_lower):
                sb_outcome_id = 3
        # Match Result 1UP
        elif "1up" in m_lower:
            sb_market_id = 60200
            if "home" in s_lower or (home_team.lower() in s_lower): sb_outcome_id = 1
            elif "draw" in s_lower: sb_outcome_id = 2
            elif "away" in s_lower or (away_team.lower() in s_lower): sb_outcome_id = 3
        # Match Result 2UP
        elif "2up" in m_lower:
            sb_market_id = 60100
            if "home" in s_lower or (home_team.lower() in s_lower): sb_outcome_id = 1
            elif "draw" in s_lower: sb_outcome_id = 2
            elif "away" in s_lower or (away_team.lower() in s_lower): sb_outcome_id = 3
        # Double Chance
        elif "double chance" in m_lower:
            sb_market_id = 10
            if "1x" in s_lower or "home or draw" in s_lower: sb_outcome_id = 9
            elif "12" in s_lower or "home or away" in s_lower: sb_outcome_id = 10
            elif "x2" in s_lower or "draw or away" in s_lower: sb_outcome_id = 11
        # Over/Under (default 2.5)
        elif "over/under" in m_lower or "o/u" in m_lower:
            sb_market_id = 18
            # Parse total from market string if possible
            import re
            m = re.search(r'(\d+\.5)', m_lower)
            total = m.group(1) if m else "2.5"
            specifier = f"total={total}"
            if "over" in s_lower: sb_outcome_id = 12
            elif "under" in s_lower: sb_outcome_id = 13
        # Asian Handicap / Moneyline fallback
        else:
            # Fallback: try to find exact string match in API response
            for m in markets:
                if m.get("name", "").lower() == m_lower or m_lower in m.get("name", "").lower():
                    sb_market_id = m.get("id")
                    specifier = m.get("specifier", "")
                    for o in m.get("outcomes", []):
                        if o.get("name", "").lower() == s_lower or s_lower in o.get("name", "").lower() or (s_lower and str(o.get("id", "")) == s_lower):
                            sb_outcome_id = o.get("id")
                            break
                    if sb_outcome_id is not None:
                        break

        if sb_market_id is None or sb_outcome_id is None:
            logger.warning("sportybet_generate_market_unmapped", market=market_name, selection=selection_name)
            return None

        sb_market_id_str = str(sb_market_id)
        sb_outcome_id_str = str(sb_outcome_id)

        # Verify the market and outcome actually exist and are active
        target_m = next((m for m in markets if str(m.get("id", "")) == sb_market_id_str and m.get("specifier", "") == specifier), None)
        if not target_m:
            logger.warning("sportybet_market_not_found_in_event", event_id=event_id, market_id=sb_market_id_str, specifier=specifier)
            return None

        target_o = next((o for o in target_m.get("outcomes", []) if str(o.get("id", "")) == sb_outcome_id_str), None)
        if not target_o:
            logger.warning("sportybet_outcome_not_found_in_market", event_id=event_id, market_id=sb_market_id_str, outcome_id=sb_outcome_id_str)
            return None
        if target_o.get("isActive") != 1:
            logger.warning("sportybet_outcome_inactive", event_id=event_id, market_id=sb_market_id_str, outcome_id=sb_outcome_id_str)
            return None

        return {
            "eventId": event_id,
            "marketId": sb_market_id_str,
            "specifier": specifier,
            "outcomeId": sb_outcome_id_str,
        }

    async def _create_share_code(self, selections: list[dict]) -> str:
        """Call the API to generate the booking code."""
        import httpx
        payload = {"selections": selections}

        async with httpx.AsyncClient(headers=API_HEADERS, timeout=15.0) as client:
            resp = await client.post(f"{SPORTYBET_BASE}/api/ng/orders/share", json=payload)
            if resp.status_code == 200:
                result = resp.json()
                if result.get("bizCode") == 10000:
                    code = result.get("data", {}).get("shareCode")
                    if code:
                        logger.info("sportybet_code_generated", code=code)
                        return code

            raise RuntimeError(f"SportyBet API code generation failed: {resp.text}")

    # ── Cleanup ──────────────────────────────────────────────────────────

    async def close(self) -> None:
        """Close the browser page and context."""
        if self._page:
            try:
                await self._page.close()
            except Exception:
                pass
            self._page = None
        if self._context:
            try:
                await self._context.close()
            except Exception:
                pass
            self._context = None
