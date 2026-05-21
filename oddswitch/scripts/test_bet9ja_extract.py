"""
Full Bet9ja extraction test using channel='chrome' (system Chrome).
Now with REAL verified class names from live DOM.
"""
import asyncio
import random
from playwright.async_api import async_playwright

STEALTH_INIT = """
(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    window.chrome = {
        app: { isInstalled: false },
        webstore: { onInstall: {}, onDownloadProgress: {} },
        runtime: { PlatformOs: 'win', PlatformArch: 'x86-64' }
    };
})();
"""


async def main():
    print("=" * 60)
    print("Bet9ja Full Extraction (channel='chrome')")
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

        await context.add_init_script(STEALTH_INIT)
        await page.add_init_script("window.print = function() {};")

        url = "https://sports.bet9ja.com/?bookABetCode=5CJJLLH"
        print(f"  Navigating to {url}")
        await page.goto(url, timeout=30_000, wait_until="domcontentloaded")
        print(f"  Page loaded: {await page.title()}")

        await asyncio.sleep(5)

        # Get ALL real betslip classes (already verified)
        print("\n--- Betslip DOM Structure ---")

        # The real classes are betslip__match, betslip__match-item, etc.
        # Let's extract each match item's structure
        match_items = await page.query_selector_all(".betslip__match")
        print(f"  betslip__match elements: {len(match_items)}")

        match_items2 = await page.query_selector_all(".betslip__match-item")
        print(f"  betslip__match-item elements: {len(match_items2)}")

        match_rows = await page.query_selector_all(".betslip__match-row")
        print(f"  betslip__match-row elements: {len(match_rows)}")

        match_sections = await page.query_selector_all(".betslip__match-section")
        print(f"  betslip__match-section elements: {len(match_sections)}")

        match_boxes = await page.query_selector_all(".betslip__match-box")
        print(f"  betslip__match-box elements: {len(match_boxes)}")

        # Get the inner HTML of the first few match sections to understand structure
        print("\n--- First 3 match sections HTML ---")
        for i, section in enumerate(match_sections[:3]):
            outer = await section.evaluate("el => el.outerHTML")
            print(f"\n  SECTION {i+1}:")
            print(f"  {outer[:600]}")
            print(f"  ...")

        # Get the inner HTML of the first few match-items
        print("\n--- First 3 match-items HTML ---")
        for i, item in enumerate(match_items2[:3]):
            outer = await item.evaluate("el => el.outerHTML")
            print(f"\n  MATCH-ITEM {i+1}:")
            print(f"  {outer[:800]}")

        # Try to get text content from match-rows (seems most granular)
        print("\n--- First 5 match-row text ---")
        for i, row in enumerate(match_rows[:5]):
            text = await row.inner_text()
            text = " ".join(text.split())
            print(f"  ROW {i+1}: {text[:150]}")

        # Try to find the bets container with match data
        print("\n--- betslip__bets-body content ---")
        bets_body = await page.query_selector(".betslip__bets-body")
        if bets_body:
            inner = await bets_body.evaluate("el => el.innerHTML")
            print(f"  innerHTML (first 5000 chars):\n{inner[:5000]}")

        # Check for the booking code modal
        print("\n--- Modal check ---")
        modals = await page.query_selector_all("[class*='modal'], [class*='Modal']")
        for m in modals:
            vis = await m.is_visible()
            if vis:
                cls = await m.get_attribute("class")
                text = await m.inner_text()
                text = " ".join(text.split())[:200]
                print(f"  Visible modal: {cls}")
                print(f"  Text: {text}")

        await browser.close()
        print("\n  Done!")


if __name__ == "__main__":
    asyncio.run(main())
