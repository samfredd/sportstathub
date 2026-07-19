"""
OddSwitch Engine — Bet9ja Adapter (Real Implementation).

Browser automation for Bet9ja booking code resolution
and generation using Playwright.

Bet9ja share URL format:
  https://sports.bet9ja.com/?bookABetCode={code}

IMPORTANT: Bet9ja auto-triggers window.print() when loading a
booking code URL. We must intercept this via add_init_script()
BEFORE navigation to prevent the browser from blocking.

IMPORTANT: Bet9ja's Cloudflare blocks Playwright's bundled Chromium
at the TLS level (ERR_HTTP2_PROTOCOL_ERROR). The BrowserManager MUST
use channel="chrome" (system Chrome) to bypass this.

DOM Structure (verified 2026-04-28 via live extraction with system Chrome):

  Each match:   .betslip__match.multiple-clustering
    ├── .betslip__match-head
    │     ├── .betslip__match-item.pointer.d-grow-1
    │     │     └── span > strong  → Event name ("Team A - Team B")
    │     │         (may have <span class="txt-orange">1:0</span> for live scores)
    │     └── .betslip__match-item  → ✕ close button
    └── .betslip__match-body
          └── .betslip__match-section  (one per selection on this event)
                ├── .betslip__match-box
                │     ├── .betslip__match-row  (selection + odds)
                │     │     ├── .betslip__match-item.pointer > strong  → Selection
                │     │     └── .betslip__match-odds.txt-r > span      → Odds
                │     └── .betslip__match-row  (market + league)
                │           └── div
                │                 ├── .betslip__match-item  → Market ("1X2", "Handicap")
                │                 └── .betslip__match-item  → League ("Saudi Professional League")
                └── i.icon.close (optional per-selection remove)

  Booking code input:
    .betslip__reservation-container input[type="text"]  → Code input
    .betslip__reservation-container button               → "Book" button

  Total odds / stake area:
    .betslip__bets-footer  → Contains total odds, stake input, "Book a Bet" button
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import structlog

from app.browser.adapters.base import BookmakerAdapter
from app.browser.stealth import random_delay
from app.core.redaction import sensitive_fingerprint
from app.schemas.canonical import RawLeg, RawSlip

logger = structlog.get_logger()

# ── Constants ────────────────────────────────────────────────────────────────

BET9JA_BASE = "https://sports.bet9ja.com"
BET9JA_BOOKING_URL = f"{BET9JA_BASE}/?bookABetCode={{code}}"

# Selectors (verified against live DOM via system Chrome extraction 2026-04-28)
SEL_MATCH = ".betslip__match"
SEL_MATCH_HEAD = ".betslip__match-head"
SEL_MATCH_BODY = ".betslip__match-body"
SEL_MATCH_SECTION = ".betslip__match-section"
SEL_MATCH_BOX = ".betslip__match-box"
SEL_MATCH_ROW = ".betslip__match-row"
SEL_MATCH_ITEM = ".betslip__match-item"
SEL_MATCH_ODDS = ".betslip__match-odds"
SEL_BETSLIP_BODY = ".betslip__body"

# Accept changes button (appears when odds change)
SEL_ACCEPT_CHANGES = "#betslip_head_acceptoddschange, button:has-text('Accept'), button:has-text('accept')"

# Book a Bet button
SEL_BOOK_A_BET = "button:has-text('Book a Bet'), a:has-text('Book a Bet'), [class*='book']:has-text('Book')"

# Modal close
SEL_MODAL_CLOSE = "[class*='modal'] button:has-text('×'), [class*='modal'] .close, [class*='Modal'] .close"

# Script to suppress window.print() — injected before page load
SUPPRESS_PRINT_SCRIPT = """
    window.print = function() {
        console.log('[OddSwitch] window.print() suppressed');
    };
"""

# Timeout (ms) for page operations
PAGE_TIMEOUT = 15_000
NAV_TIMEOUT = 30_000
BETSLIP_LOAD_TIMEOUT = 20_000


class Bet9jaAdapter(BookmakerAdapter):
    """
    Bet9ja browser adapter — real Playwright implementation.

    Resolves booking codes by loading the bookABetCode URL and
    extracting all selection items from the betslip sidebar.

    CRITICAL: Bet9ja's Cloudflare blocks Playwright's bundled Chromium
    at the TLS/network level. The BrowserManager MUST launch with
    channel="chrome" (system Chrome) to bypass this detection.

    CRITICAL: Bet9ja auto-triggers window.print() on booking code
    pages. We intercept this via add_init_script() before navigation.
    """

    bookmaker_id = "bet9ja"

    def __init__(self) -> None:
        self._page: Any = None
        self._context: Any = None

    async def _get_page(self) -> Any:
        """Acquire a browser page from the pool with print suppression."""
        if self._page is None:
            from app.browser.manager import BrowserManager

            manager = await BrowserManager.create()
            self._context = await manager.acquire()
            self._page = await self._context.new_page()
            self._page.set_default_timeout(PAGE_TIMEOUT)

            # CRITICAL: Suppress window.print() BEFORE any navigation
            # This prevents the print dialog from blocking the browser
            await self._page.add_init_script(SUPPRESS_PRINT_SCRIPT)

        return self._page

    # ── resolve_booking_code ─────────────────────────────────────────────

    async def resolve_booking_code(self, code: str) -> RawSlip:
        """
        Load a Bet9ja booking code URL and extract all selections.

        Flow:
          1. Suppress window.print() via init script
          2. Navigate to booking code URL
          3. Wait for betslip items to populate (~4 seconds)
          4. Extract each match: event, selection(s), market, odds, league
          5. Return RawSlip

        DOM verified: .betslip__match contains .betslip__match-head (event name)
        and .betslip__match-body with .betslip__match-section per selection.
        """
        logger.info("bet9ja_resolve_start", code_ref=sensitive_fingerprint(code))
        page = await self._get_page()

        # Step 1: Navigate (print is already suppressed via init script)
        url = BET9JA_BOOKING_URL.format(code=code)
        await page.goto(url, timeout=NAV_TIMEOUT, wait_until="domcontentloaded")
        logger.info("bet9ja_navigated", url=url)

        # Step 2: Wait for betslip match items to appear
        # The bookABetCode URL param works but takes ~4s to populate
        await random_delay(3000, 5000)

        try:
            await page.wait_for_selector(SEL_MATCH, timeout=BETSLIP_LOAD_TIMEOUT)
        except Exception:
            logger.warning("bet9ja_no_matches_initial", code_ref=sensitive_fingerprint(code))
            # Retry: reload the page
            await page.reload(timeout=NAV_TIMEOUT)
            await random_delay(3000, 5000)
            try:
                await page.wait_for_selector(SEL_MATCH, timeout=BETSLIP_LOAD_TIMEOUT)
            except Exception:
                logger.error("bet9ja_no_matches_after_retry", code_ref=sensitive_fingerprint(code))
                return RawSlip(
                    bookmaker="bet9ja",
                    booking_code=code,
                    total_odds=0.0,
                    legs=[],
                )

        # Step 3: Dismiss popups
        await self._dismiss_popups(page)
        await random_delay(500, 1500)

        # Step 4: Extract all betslip match elements
        matches = await page.query_selector_all(SEL_MATCH)
        logger.info("bet9ja_matches_found", count=len(matches))

        legs: list[RawLeg] = []
        for match_el in matches:
            match_legs = await self._extract_match_legs(match_el)
            legs.extend(match_legs)

        total_odds = 1.0
        for leg in legs:
            total_odds *= leg.odds

        logger.info(
            "bet9ja_resolve_complete",
            code=code,
            legs=len(legs),
            total_odds=round(total_odds, 2),
        )

        return RawSlip(
            bookmaker="bet9ja",
            booking_code=code,
            total_odds=round(total_odds, 2),
            legs=legs,
        )

    async def _extract_match_legs(self, match_el: Any) -> list[RawLeg]:
        """
        Extract all legs from a single .betslip__match element.

        A single match can have multiple selections (sections) if the user
        placed multiple bets on the same event (e.g. 1X2 + Over/Under).

        Structure:
          .betslip__match-head > .betslip__match-item > span > strong  → Event name
          .betslip__match-body > .betslip__match-section (per selection)
            .betslip__match-row[0]:
              .betslip__match-item.pointer > strong  → Selection
              .betslip__match-odds > span            → Odds
            .betslip__match-row[1]:
              .betslip__match-item[0]                → Market
              .betslip__match-item[1]                → League
        """
        legs = []

        try:
            # Extract event name from head
            event_name = ""
            head = await match_el.query_selector(SEL_MATCH_HEAD)
            if head:
                # The event name is in: .betslip__match-item.pointer > span > strong
                name_item = await head.query_selector(
                    ".betslip__match-item.pointer strong, "
                    ".betslip__match-item.d-grow-1 strong"
                )
                if name_item:
                    event_name = (await name_item.inner_text()).strip()

            # Remove live score prefix if present (e.g. "1:0 " before event name)
            # Live scores appear as <span class="txt-orange">1:0</span> before the strong tag
            # but inner_text() of strong should not include it since it's a sibling
            event_name = re.sub(r"^\d+:\d+\s*", "", event_name).strip()

            # Parse teams
            home_team, away_team = self._parse_teams(event_name)

            # Extract each selection section from the body
            body = await match_el.query_selector(SEL_MATCH_BODY)
            if not body:
                return legs

            sections = await body.query_selector_all(SEL_MATCH_SECTION)

            for section in sections:
                try:
                    leg = await self._extract_section_leg(
                        section, event_name, home_team, away_team
                    )
                    if leg:
                        legs.append(leg)
                except Exception as e:
                    logger.warning(
                        "bet9ja_section_extract_failed",
                        event=event_name,
                        error=str(e),
                    )

        except Exception as e:
            logger.warning("bet9ja_match_extract_failed", error=str(e))

        return legs

    async def _extract_section_leg(
        self,
        section: Any,
        event_name: str,
        home_team: str,
        away_team: str,
    ) -> RawLeg | None:
        """Extract a single leg from a .betslip__match-section element."""
        box = await section.query_selector(SEL_MATCH_BOX)
        if not box:
            return None

        rows = await box.query_selector_all(SEL_MATCH_ROW)
        if len(rows) < 1:
            return None

        # Row 0: Selection + Odds
        selection = ""
        odds = 1.0

        sel_el = await rows[0].query_selector(f"{SEL_MATCH_ITEM}.pointer strong, {SEL_MATCH_ITEM} strong")
        if sel_el:
            selection = (await sel_el.inner_text()).strip()

        odds_el = await rows[0].query_selector(f"{SEL_MATCH_ODDS} span")
        if odds_el:
            odds_text = (await odds_el.inner_text()).strip()
            odds = self._parse_odds(odds_text)

        # Row 1: Market + League (if present)
        market = ""
        league = ""

        if len(rows) >= 2:
            items = await rows[1].query_selector_all(SEL_MATCH_ITEM)
            if len(items) >= 1:
                market = (await items[0].inner_text()).strip()
            if len(items) >= 2:
                league = (await items[1].inner_text()).strip()

        # Infer sport from league name
        sport = self._infer_sport(league, market)

        return RawLeg(
            event_name=event_name,
            event_date=datetime.now(timezone.utc),
            league=league,
            sport=sport,
            market=market,
            selection=selection,
            odds=odds,
            home_team=home_team,
            away_team=away_team,
        )

    def _parse_teams(self, event_name: str) -> tuple[str, str]:
        """
        Parse home and away team from event name.

        Bet9ja uses:
          "Team A - Team B"     (dash separator)
          "Player A - Player B"

        Note: Some team names contain hyphens (e.g. "Al-Ahli"),
        so we split on " - " (with spaces).
        """
        if " - " in event_name:
            parts = event_name.split(" - ", 1)
            return parts[0].strip(), parts[1].strip()

        # Fallback separators
        for sep in [" v ", " vs ", " VS "]:
            if sep in event_name:
                parts = event_name.split(sep, 1)
                return parts[0].strip(), parts[1].strip()

        return event_name, ""

    def _parse_odds(self, text: str) -> float:
        """Parse odds text to float, handling arrows and formatting."""
        # Remove up/down arrow indicators and whitespace
        cleaned = re.sub(r"[↑↓▲▼⬆⬇\s]", "", text)
        cleaned = cleaned.replace(",", "")
        try:
            return float(cleaned)
        except ValueError:
            logger.warning("bet9ja_odds_parse_failed", text=text)
            return 1.0

    def _infer_sport(self, league: str, market: str) -> str:
        """
        Infer sport type from league name and market type.

        Bet9ja doesn't have sport icons in the betslip,
        so we infer from context.
        """
        league_lower = league.lower()
        market_lower = market.lower()

        # Basketball indicators
        if any(kw in league_lower for kw in [
            "nba", "kbl", "korisliiga", "euroleague", "basket",
            "ncaa", "cba", "lnb", "acb", "a skl",
        ]):
            return "basketball"

        # Ice hockey indicators
        if any(kw in league_lower for kw in [
            "nhl", "vhl", "khl", "shl", "liiga", "hockey",
            "extraliga", "del", "2. liga",
        ]):
            return "ice_hockey"

        # Tennis indicators
        if any(kw in league_lower for kw in [
            "atp", "wta", "itf", "wimbledon", "roland garros",
            "us open", "australian open",
        ]):
            return "tennis"

        # Handball
        if "handball" in league_lower:
            return "handball"

        # Cricket
        if any(kw in league_lower for kw in ["ipl", "t20", "odi", "test", "cricket"]):
            return "cricket"

        # Table tennis
        if "table tennis" in league_lower or "tt cup" in league_lower:
            return "table_tennis"

        # Points spread / handicap with .5 numbers suggest basketball
        if "points" in market_lower:
            return "basketball"

        # Default to football (most common on Bet9ja)
        return "football"

    # ── generate_booking_code ────────────────────────────────────────────

    async def generate_booking_code(self, slip_data: dict) -> str:
        """
        Generate a booking code via the BookABetV2 API inside Playwright.
        """
        logger.info("bet9ja_generate_start", legs=len(slip_data.get("legs", [])))
        page = await self._get_page()

        # Step 1: Navigate to clear Cloudflare
        await page.goto(BET9JA_BASE, timeout=NAV_TIMEOUT, wait_until="domcontentloaded")
        await random_delay(1000, 2000)

        # Step 2: Fetch all events
        all_events = await self._fetch_all_events(page)

        # Step 3: Resolve legs
        selections = {}
        evs = {}

        for i, leg in enumerate(slip_data.get("legs", [])):
            try:
                sel = await self._build_leg_selection(leg, all_events)
                if sel:
                    key = sel["key"]
                    selections[key] = sel["oddValue"]
                    evs[key] = sel["evs_entry"]
            except Exception as e:
                logger.warning("bet9ja_generate_leg_failed", index=i, error=str(e))

        if not selections:
            raise RuntimeError("Could not resolve any legs to Bet9ja internal IDs")

        # Step 4: Construct payload
        import json
        import urllib.parse

        betslip_json = {
            "BETS": [{
                "BSTYPE": 3,
                "TAB": 3,
                "NUMLINES": 1,
                "COMB": 1,
                "TYPE": 1,
                "STAKE": 0,
                "POTWINMIN": 0,
                "POTWINMAX": 0,
                "BONUSMIN": "0",
                "BONUSMAX": "0",
                "ODDMIN": 2.0,
                "ODDMAX": 2.0,
                "ODDS": selections,
                "FIXED": {}
            }],
            "EVS": evs,
            "IMPERSONIZE": 0
        }

        payload_str = "BETSLIP=" + urllib.parse.quote(json.dumps(betslip_json, separators=(',', ':'))) + "&IS_PASSBET=0"

        # Step 5: Execute POST
        result = await page.evaluate("""async (payload) => {
            try {
                const res = await fetch('https://apigw.bet9ja.com/sportsbook/placebet/BookABetV2?source=desktop', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Accept': 'application/json, text/javascript, */*; q=0.01'
                    },
                    body: payload
                });
                return await res.json();
            } catch(e) {
                return e.toString();
            }
        }""", payload_str)

        if isinstance(result, str) or result.get("status") != 1:
            raise RuntimeError(f"Bet9ja API generation failed: {result}")

        code = result.get("data", [{}])[0].get("RIS")
        if not code:
            raise RuntimeError("Bet9ja API did not return a RIS code")

        logger.info("bet9ja_code_generated", code_ref=sensitive_fingerprint(code))
        return code

    async def _fetch_all_events(self, page: Any) -> list[dict]:
        """Fetch daily events via internal API to resolve canonical names."""
        res = await page.evaluate("""async () => {
            let r = await fetch('https://sports.bet9ja.com/desktop/feapi/PalimpsestAjax/GetEventsInDailyBundleV3?DISP=1000&DISPH=0&SPORTID=1&LIMIT=1000&v_cache_version=1');
            return await r.json();
        }""")
        return res.get('D', {}).get('E', [])

    async def _build_leg_selection(self, leg: dict, all_events: list[dict]) -> dict | None:
        """Find the matching event and market ID for a leg."""
        from difflib import SequenceMatcher

        target_event_name = leg.get("event_name") or leg.get("event", "")
        home_team = leg.get("home_team", "")
        away_team = leg.get("away_team", "")

        best_match = None
        best_score = 0
        for ev in all_events:
            ev_name = ev.get("N", "")
            # Bet9ja uses "Home - Away"
            parts = ev_name.split(" - ")
            if len(parts) == 2:
                ev_home, ev_away = parts
            else:
                ev_home, ev_away = ev_name, ev_name

            h_score = SequenceMatcher(None, home_team.lower(), ev_home.lower()).ratio()
            a_score = SequenceMatcher(None, away_team.lower(), ev_away.lower()).ratio()
            score = (h_score + a_score) / 2

            if score > best_score and score > 0.6:
                best_score = score
                best_match = ev

        if not best_match:
            logger.warning("bet9ja_generate_event_not_found", event_name=target_event_name)
            return None

        event_id = best_match["ID"]
        event_code = best_match["C"]
        event_name = best_match["N"]
        startdate = best_match["D"]

        market_name = leg.get("market", "").lower()
        selection_name = leg.get("selection", "").lower()

        b9_market_id = None
        b9_outcome_id = None

        # Basic 1X2
        if market_name in ["match result", "1x2"]:
            b9_market_id = "1X2"
            if "home" in selection_name or "1" in selection_name: b9_outcome_id = "1"
            elif "draw" in selection_name or "x" in selection_name: b9_outcome_id = "X"
            elif "away" in selection_name or "2" in selection_name: b9_outcome_id = "2"
        # Over/Under
        elif "over/under" in market_name or "o/u" in market_name:
            import re
            m = re.search(r'(\d+\.5)', market_name)
            total = m.group(1) if m else "2.5"
            b9_market_id = f"OU@{total}"
            if "over" in selection_name: b9_outcome_id = "O"
            elif "under" in selection_name: b9_outcome_id = "U"
        # Double Chance
        elif "double chance" in market_name:
            b9_market_id = "DC"
            if "1x" in selection_name: b9_outcome_id = "1X"
            elif "12" in selection_name: b9_outcome_id = "12"
            elif "x2" in selection_name: b9_outcome_id = "X2"

        if not b9_market_id or not b9_outcome_id:
            logger.warning("bet9ja_generate_market_unmapped", market=market_name, selection=selection_name)
            return None

        key = f"{event_id}$S_{b9_market_id}_{b9_outcome_id}"

        # Check if odds exist in the API response
        odds_dict = best_match.get("O", {})
        odd_str = odds_dict.get(f"S_{b9_market_id}_{b9_outcome_id}")
        if not odd_str:
            logger.warning("bet9ja_odds_not_found_for_market", event_id=event_id, market=b9_market_id)
            return None

        odd_value = float(odd_str)

        return {
            "key": key,
            "oddValue": odd_value,
            "evs_entry": {
                "id": key,
                "eventId": event_id,
                "eventCode": event_code,
                "eventName": event_name,
                "market": b9_market_id,
                "sid": f"S_{b9_market_id}_{b9_outcome_id}",
                "sign": b9_outcome_id,
                "GN": "undefined - undefined",
                "leagueName": "undefined - undefined",
                "startdate": startdate,
                "oddValue": odd_value,
                "hnd": ""
            }
        }

    async def _dismiss_booking_modal(self, page: Any) -> None:
        """Close the 'My Booking Code' modal if it's visible."""
        close_selectors = [
            SEL_MODAL_CLOSE,
            "[class*='modal'] [class*='close']",
            "[class*='Modal'] [class*='close']",
            "button[aria-label='Close']",
            ".modal .close",
        ]

        for selector in close_selectors:
            try:
                el = await page.query_selector(selector)
                if el and await el.is_visible():
                    await el.click()
                    logger.debug("bet9ja_modal_dismissed", selector=selector)
                    await random_delay(500, 1000)
                    return
            except Exception:
                continue

        # Fallback: press Escape key
        try:
            await page.keyboard.press("Escape")
            await random_delay(500, 1000)
        except Exception:
            pass

    async def _dismiss_popups(self, page: Any) -> None:
        """Close any popups/overlays that might block interaction."""
        popup_selectors = [
            "[class*='cookie'] [class*='close']",
            "[class*='cookie'] [class*='accept']",
            "[class*='banner'] [class*='close']",
            "[class*='popup'] [class*='close']",
            "[class*='overlay'] [class*='close']",
            "[class*='consent'] button",
        ]

        for selector in popup_selectors:
            try:
                el = await page.query_selector(selector)
                if el and await el.is_visible():
                    await el.click()
                    logger.debug("bet9ja_popup_dismissed", selector=selector)
                    await random_delay(300, 600)
            except Exception:
                pass

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
