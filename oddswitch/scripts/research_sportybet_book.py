"""
Find the SportyBet "Book Bet" / "Share" API endpoint.
Load a valid share code, then click "Book Bet" and capture the API call.
"""
import asyncio
import json
from playwright.async_api import async_playwright


async def main():
    print("=" * 60)
    print("  SportyBet: Find Share/Book API")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="chrome",
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
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

        # First: find a valid share code by looking at the betslip
        # Load SportyBet homepage and look for live events
        print("\n  Step 1: Get event list via API...")
        resp = await page.goto("https://www.sportybet.com/api/ng/factsCenter/liveOrPrematchEvents?sportId=sr%3Asport%3A1", timeout=15_000)
        body = await resp.text()
        data = json.loads(body)

        # Get first few events
        events = []
        for tournament in data.get("data", [])[:3]:
            for event in tournament.get("events", [])[:2]:
                events.append({
                    "eventId": event["eventId"],
                    "gameId": event.get("gameId"),
                    "home": event.get("homeTeamName"),
                    "away": event.get("awayTeamName"),
                })

        print(f"  Found {len(events)} events:")
        for e in events:
            print(f"    {e['eventId']} ({e['gameId']}): {e['home']} vs {e['away']}")

        # Step 2: Get the markets for the first event
        if events:
            event = events[0]
            print(f"\n  Step 2: Get markets for {event['home']} vs {event['away']}...")

            markets_url = f"https://www.sportybet.com/api/ng/factsCenter/event?eventId={event['eventId']}&_t=1"
            try:
                resp = await page.goto(markets_url, timeout=15_000)
                body = await resp.text()
                mdata = json.loads(body)

                # Look at market structure
                event_data = mdata.get("data", {})
                markets = event_data.get("markets", [])
                print(f"  Markets: {len(markets)}")
                for m in markets[:5]:
                    print(f"    Market: id={m.get('id')} name={m.get('name')} desc={m.get('desc','')[:60]}")
                    outcomes = m.get("outcomes", [])
                    for o in outcomes[:3]:
                        print(f"      Outcome: id={o.get('id')} name={o.get('name')} odds={o.get('odds')}")
            except Exception as e:
                print(f"  Markets API error: {e}")

        # Step 3: Now load a page with betslip and try "Book Bet"
        print("\n  Step 3: Load page with betslip, intercept 'Book Bet' API...")

        # Navigate to the actual site
        await page.goto("https://www.sportybet.com/ng/", timeout=30_000, wait_until="domcontentloaded")
        await asyncio.sleep(3)

        # Start intercepting all network calls
        all_requests = []
        all_responses = []

        def on_req(req):
            if req.method == "POST" or 'share' in req.url.lower() or 'book' in req.url.lower() or 'order' in req.url.lower():
                all_requests.append({
                    "method": req.method,
                    "url": req.url[:200],
                    "post": req.post_data[:500] if req.post_data else None,
                    "headers": dict(req.headers) if req.method == "POST" else None,
                })

        async def on_resp(resp):
            if 'share' in resp.url.lower() or 'book' in resp.url.lower() or 'order' in resp.url.lower():
                try:
                    body = await resp.text()
                    all_responses.append({
                        "status": resp.status,
                        "url": resp.url[:200],
                        "body": body[:1000],
                    })
                except Exception:
                    pass

        page.on("request", on_req)
        page.on("response", on_resp)

        # Try to navigate to an event page and click a selection
        if events:
            event = events[0]
            event_url = f"https://www.sportybet.com/ng/sport/football/sr%3Asport%3A1/{event['eventId']}?source=event"
            print(f"  Navigating to event: {event_url}")
            await page.goto(event_url, timeout=30_000, wait_until="domcontentloaded")
            await asyncio.sleep(3)
            print(f"  URL: {page.url}")
            print(f"  Title: {await page.title()}")

            # Find odds buttons and click the first one
            odds_buttons = await page.query_selector_all("[class*='m-outcome'], [class*='odds-btn'], button[class*='m-btn']")
            print(f"  Odds buttons found: {len(odds_buttons)}")

            if not odds_buttons:
                # Try broader selector
                odds_buttons = await page.evaluate("""
                    () => {
                        const results = [];
                        document.querySelectorAll('*').forEach(el => {
                            const cls = typeof el.className === 'string' ? el.className : '';
                            if ((cls.includes('outcome') || cls.includes('odds') || cls.includes('m-btn'))
                                && el.textContent.trim().match(/^\\d+\\.\\d+$/)) {
                                results.push({
                                    tag: el.tagName,
                                    class: cls.substring(0, 80),
                                    text: el.textContent.trim(),
                                    visible: el.getBoundingClientRect().width > 0,
                                });
                            }
                        });
                        return results;
                    }
                """)
                print(f"  Odds-like elements: {len(odds_buttons)}")
                for ob in odds_buttons[:5]:
                    print(f"    <{ob['tag']} class='{ob['class']}'> {ob['text']} visible={ob['visible']}")

            # Click the first odds button to add to betslip
            first_odds = await page.query_selector("[class*='m-outcome'], [class*='odds-btn']")
            if not first_odds:
                # Try with data attribute
                first_odds = await page.query_selector("span[class*='m-btn']")

            if first_odds:
                await first_odds.click()
                print("  ✅ Clicked first odds button")
                await asyncio.sleep(2)

                # Check if betslip now has items
                items = await page.query_selector_all("#j_betslip .m-item")
                print(f"  Betslip items: {len(items)}")

                if items:
                    # Now look for "Book Bet" / Share button
                    book_btn = await page.query_selector(".m-share--wrapper a, a:has-text('Book Bet'), button:has-text('Book Bet'), [class*='book']")
                    if book_btn:
                        print("  Found 'Book Bet' button — clicking...")
                        await book_btn.click()
                        await asyncio.sleep(3)

                        # Check what API calls happened
                        print(f"\n  POST requests captured: {len([r for r in all_requests if r['method'] == 'POST'])}")
                        for r in all_requests:
                            if r['method'] == 'POST':
                                print(f"    POST {r['url']}")
                                if r['post']:
                                    print(f"    Body: {r['post'][:500]}")
                                if r.get('headers'):
                                    # Just show content-type
                                    ct = r['headers'].get('content-type', '')
                                    print(f"    Content-Type: {ct}")

                        print(f"\n  Share/Book responses: {len(all_responses)}")
                        for r in all_responses:
                            print(f"    [{r['status']}] {r['url']}")
                            print(f"    {r['body'][:500]}")
                    else:
                        print("  No 'Book Bet' button found")
                        # Check what's in the betslip area
                        betslip_html = await page.evaluate("""
                            () => {
                                const bs = document.querySelector('#j_betslip');
                                return bs ? bs.innerHTML.substring(0, 2000) : 'NO BETSLIP';
                            }
                        """)
                        print(f"  Betslip HTML:\n{betslip_html[:1500]}")
            else:
                print("  No odds buttons found on event page")
                # Debug: show what's on the page
                page_classes = await page.evaluate("""
                    () => {
                        const cls = new Set();
                        document.querySelectorAll('*').forEach(el => {
                            if (typeof el.className === 'string' && el.className.includes('m-')) {
                                el.className.split(' ').forEach(c => {
                                    if (c.startsWith('m-')) cls.add(c);
                                });
                            }
                        });
                        return Array.from(cls).sort().slice(0, 40);
                    }
                """)
                print(f"  m-* classes on page: {page_classes}")

        await browser.close()
        print("\n  Done!")


if __name__ == "__main__":
    asyncio.run(main())
