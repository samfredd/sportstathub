"""
SportyBet Site Research — Understanding the event search & selection flow.

We need to figure out:
  1. How event search works (search bar? URL params? API?)
  2. How to navigate to a specific event page
  3. How markets are displayed on the event page
  4. How to click a selection to add it to the betslip
  5. How to trigger "Book Bet" and extract the code
  6. Whether there's an internal API we can intercept
"""
import asyncio
import json
from playwright.async_api import async_playwright


async def main():
    print("=" * 70)
    print("  SportyBet Site Research: Event Search & Selection Flow")
    print("=" * 70)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="chrome",
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-NG",
            timezone_id="Africa/Lagos",
        )
        page = await context.new_page()
        page.set_default_timeout(20_000)

        await context.add_init_script("""(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        })();""")

        # Intercept API calls to find the internal API
        api_calls = []
        page.on("request", lambda req: api_calls.append({
            "url": req.url[:200],
            "method": req.method,
        }) if "api" in req.url.lower() or "search" in req.url.lower() or "event" in req.url.lower() or "sport" in req.url.lower() else None)

        # ── Part 1: Load homepage, find search bar ────────────────────
        print("\n--- Part 1: Homepage & Search ---")
        await page.goto("https://www.sportybet.com/ng/", timeout=30_000, wait_until="domcontentloaded")
        await asyncio.sleep(3)
        print(f"  Title: {await page.title()}")
        print(f"  URL: {page.url}")

        # Find search-related elements
        search_elements = await page.evaluate("""
            () => {
                const results = [];
                const selectors = [
                    'input[type="search"]', 'input[type="text"]',
                    '[class*="search"]', '[class*="Search"]',
                    '[placeholder*="search" i]', '[placeholder*="Search"]',
                    '[id*="search" i]', '[aria-label*="search" i]',
                ];
                for (const sel of selectors) {
                    document.querySelectorAll(sel).forEach(el => {
                        results.push({
                            tag: el.tagName,
                            type: el.type || '',
                            id: el.id || '',
                            class: (typeof el.className === 'string' ? el.className : '').substring(0, 100),
                            placeholder: el.placeholder || '',
                            visible: el.getBoundingClientRect().width > 0,
                        });
                    });
                }
                return results;
            }
        """)
        print(f"  Search elements found: {len(search_elements)}")
        for el in search_elements:
            print(f"    <{el['tag']} type='{el['type']}' id='{el['id']}' placeholder='{el['placeholder']}' visible={el['visible']}>")
            print(f"      class: {el['class']}")

        # ── Part 2: Try the search functionality ─────────────────────
        print("\n--- Part 2: Search for 'Stockport' ---")

        # Look for a search input
        search_input = await page.query_selector('input[placeholder*="Search" i], input[placeholder*="search" i], [class*="search"] input')
        if search_input:
            print(f"  Found search input")
            await search_input.click()
            await asyncio.sleep(1)
            await search_input.fill("Stockport")
            print("  Typed 'Stockport'")
            await asyncio.sleep(3)

            # Check for results
            results = await page.evaluate("""
                () => {
                    const r = [];
                    document.querySelectorAll('[class*="search-result"], [class*="searchResult"], [class*="result"], [class*="suggest"]').forEach(el => {
                        if (el.getBoundingClientRect().width > 0) {
                            r.push({
                                class: (typeof el.className === 'string' ? el.className : '').substring(0, 100),
                                text: el.textContent.trim().substring(0, 200),
                            });
                        }
                    });
                    return r;
                }
            """)
            print(f"  Search results: {len(results)}")
            for r in results[:5]:
                print(f"    {r['class'][:60]}: {r['text'][:100]}")
        else:
            print("  No search input found, trying click-based search")
            # Try clicking a search icon
            search_icon = await page.query_selector('[class*="search" i] i, [class*="search" i] svg, a[href*="search"]')
            if search_icon:
                await search_icon.click()
                print("  Clicked search icon")
                await asyncio.sleep(2)

        # ── Part 3: Check for API-based search ───────────────────────
        print("\n--- Part 3: API Calls Intercepted ---")
        for call in api_calls[:20]:
            print(f"  {call['method']} {call['url']}")

        # ── Part 4: Try direct URL patterns ──────────────────────────
        print("\n--- Part 4: Direct URL Navigation ---")

        # Try common SportyBet URL patterns for events
        test_urls = [
            "https://www.sportybet.com/ng/sport/football",
            "https://www.sportybet.com/ng/m/search?q=Stockport",
        ]

        for test_url in test_urls:
            try:
                await page.goto(test_url, timeout=15_000, wait_until="domcontentloaded")
                await asyncio.sleep(2)
                print(f"\n  URL: {test_url}")
                print(f"  Final URL: {page.url}")
                title = await page.title()
                print(f"  Title: {title}")
            except Exception as e:
                print(f"  {test_url}: {str(e)[:80]}")

        # ── Part 5: Intercept API for event data ─────────────────────
        print("\n--- Part 5: Full API Intercept ---")
        api_calls.clear()

        # Load a known share code to see what API calls happen
        await page.goto("https://www.sportybet.com/ng/?shareCode=6234E4B3F4B4&c=ng", timeout=30_000, wait_until="domcontentloaded")
        await asyncio.sleep(5)

        print("  API calls during share code load:")
        for call in api_calls:
            if any(k in call['url'].lower() for k in ['sport', 'event', 'bet', 'book', 'share', 'market']):
                print(f"  {call['method']} {call['url']}")

        # ── Part 6: Check for SportyBet internal API patterns ────────
        print("\n--- Part 6: Network API Discovery ---")

        # Clear and listen for API responses
        api_responses = []

        async def capture_response(response):
            url = response.url
            if any(k in url.lower() for k in ['api', 'sport', 'event', 'share', 'book', 'search']):
                try:
                    body = await response.text()
                    api_responses.append({
                        "url": url[:200],
                        "status": response.status,
                        "body_preview": body[:500] if len(body) < 2000 else body[:500],
                    })
                except Exception:
                    pass

        page.on("response", capture_response)

        # Reload the share code page to capture API responses
        await page.goto("https://www.sportybet.com/ng/?shareCode=6234E4B3F4B4&c=ng", timeout=30_000, wait_until="domcontentloaded")
        await asyncio.sleep(5)

        print(f"  Captured {len(api_responses)} API responses:")
        for resp in api_responses[:15]:
            print(f"\n  [{resp['status']}] {resp['url']}")
            if resp['body_preview']:
                # Try to parse as JSON
                try:
                    data = json.loads(resp['body_preview'][:500])
                    print(f"  Body: {json.dumps(data, indent=2)[:300]}")
                except Exception:
                    print(f"  Body: {resp['body_preview'][:200]}")

        await browser.close()
        print("\n  Done!")


if __name__ == "__main__":
    asyncio.run(main())
