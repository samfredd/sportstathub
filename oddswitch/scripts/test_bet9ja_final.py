"""
Full end-to-end test: Bet9ja adapter with real system Chrome.
Tests the exact extraction logic from bet9ja.py against the live site.
"""
import asyncio
import re
from datetime import datetime, timezone
from playwright.async_api import async_playwright


# ── Inline the extraction logic from the adapter ─────────────────────────

SEL_MATCH = ".betslip__match"
SEL_MATCH_HEAD = ".betslip__match-head"
SEL_MATCH_BODY = ".betslip__match-body"
SEL_MATCH_SECTION = ".betslip__match-section"
SEL_MATCH_BOX = ".betslip__match-box"
SEL_MATCH_ROW = ".betslip__match-row"
SEL_MATCH_ITEM = ".betslip__match-item"
SEL_MATCH_ODDS = ".betslip__match-odds"


def parse_teams(event_name: str) -> tuple[str, str]:
    if " - " in event_name:
        parts = event_name.split(" - ", 1)
        return parts[0].strip(), parts[1].strip()
    for sep in [" v ", " vs ", " VS "]:
        if sep in event_name:
            parts = event_name.split(sep, 1)
            return parts[0].strip(), parts[1].strip()
    return event_name, ""


def parse_odds(text: str) -> float:
    cleaned = re.sub(r"[↑↓▲▼⬆⬇\s]", "", text)
    cleaned = cleaned.replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return 1.0


async def extract_match_legs(match_el):
    """Extract all legs from a single .betslip__match element."""
    legs = []

    # Event name from head
    event_name = ""
    head = await match_el.query_selector(SEL_MATCH_HEAD)
    if head:
        name_item = await head.query_selector(
            ".betslip__match-item.pointer strong, "
            ".betslip__match-item.d-grow-1 strong"
        )
        if name_item:
            event_name = (await name_item.inner_text()).strip()

    # Remove live score prefix
    event_name = re.sub(r"^\d+:\d+\s*", "", event_name).strip()
    home_team, away_team = parse_teams(event_name)

    # Extract sections from body
    body = await match_el.query_selector(SEL_MATCH_BODY)
    if not body:
        return legs

    sections = await body.query_selector_all(SEL_MATCH_SECTION)

    for section in sections:
        box = await section.query_selector(SEL_MATCH_BOX)
        if not box:
            continue

        rows = await box.query_selector_all(SEL_MATCH_ROW)
        if len(rows) < 1:
            continue

        # Row 0: Selection + Odds
        selection = ""
        odds = 1.0

        sel_el = await rows[0].query_selector(f"{SEL_MATCH_ITEM}.pointer strong, {SEL_MATCH_ITEM} strong")
        if sel_el:
            selection = (await sel_el.inner_text()).strip()

        odds_el = await rows[0].query_selector(f"{SEL_MATCH_ODDS} span")
        if odds_el:
            odds_text = (await odds_el.inner_text()).strip()
            odds = parse_odds(odds_text)

        # Row 1: Market + League
        market = ""
        league = ""

        if len(rows) >= 2:
            items = await rows[1].query_selector_all(SEL_MATCH_ITEM)
            if len(items) >= 1:
                market = (await items[0].inner_text()).strip()
            if len(items) >= 2:
                league = (await items[1].inner_text()).strip()

        legs.append({
            "event_name": event_name,
            "home_team": home_team,
            "away_team": away_team,
            "selection": selection,
            "odds": odds,
            "market": market,
            "league": league,
        })

    return legs


async def main():
    print("=" * 60)
    print("Bet9ja Full Adapter Test (channel='chrome')")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="chrome",
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-infobars",
                "--disable-webrtc",
            ],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-NG",
            timezone_id="Africa/Lagos",
        )
        page = await context.new_page()
        page.set_default_timeout(25_000)

        # Stealth + print suppression
        await context.add_init_script("""
            (() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.chrome = { app: { isInstalled: false }, runtime: {} };
            })();
        """)
        await page.add_init_script("window.print = function() {};")

        code = "5CJJLLH"
        url = f"https://sports.bet9ja.com/?bookABetCode={code}"
        print(f"\n  Navigating to {url}")
        await page.goto(url, timeout=30_000, wait_until="domcontentloaded")
        print(f"  Title: {await page.title()}")

        # Wait for betslip items
        print("  Waiting for betslip to load...")
        await asyncio.sleep(5)

        try:
            await page.wait_for_selector(SEL_MATCH, timeout=20_000)
            print("  ✅ Betslip items detected")
        except Exception:
            print("  ❌ No betslip items found")
            await browser.close()
            return

        # Extract all matches
        matches = await page.query_selector_all(SEL_MATCH)
        print(f"  Found {len(matches)} match elements")

        all_legs = []
        for i, match_el in enumerate(matches):
            legs = await extract_match_legs(match_el)
            all_legs.extend(legs)

        # Print results
        print(f"\n  {'='*60}")
        print(f"  EXTRACTED {len(all_legs)} LEGS")
        print(f"  {'='*60}")

        total_odds = 1.0
        for j, leg in enumerate(all_legs):
            total_odds *= leg["odds"]
            print(f"\n  [{j+1}] {leg['event_name']}")
            print(f"      Selection: {leg['selection']}")
            print(f"      Market:    {leg['market']}")
            print(f"      Odds:      {leg['odds']}")
            print(f"      League:    {leg['league']}")
            print(f"      Home:      {leg['home_team']}")
            print(f"      Away:      {leg['away_team']}")

        print(f"\n  Total Odds: {round(total_odds, 2)}")
        print(f"  Booking Code: {code}")

        # Take screenshot
        await page.screenshot(
            path="/home/whoami/tools/Gemini/Work/OddSwitch/scripts/bet9ja_final_test.png",
            full_page=False,
        )

        await browser.close()
        print(f"\n  ✅ Test complete!")


if __name__ == "__main__":
    asyncio.run(main())
