"""
Quick test: Load a SportyBet share code and intercept the API calls
to find the event/outcome IDs and the booking API endpoint.
If SportyBet uses an API to create booking codes, we can call it
directly instead of UI automation.
"""
import asyncio
import json
from playwright.async_api import async_playwright


async def main():
    print("=" * 60)
    print("  SportyBet API Discovery")
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

        # Capture ALL network requests & responses
        requests_log = []
        responses_log = []

        def on_request(req):
            url = req.url
            if any(k in url for k in ['/api/', '/factsCenter/', '/share', '/book', '/sport/', '/event']):
                requests_log.append({
                    "method": req.method,
                    "url": url,
                    "post": req.post_data[:500] if req.post_data else None,
                })

        async def on_response(resp):
            url = resp.url
            if any(k in url for k in ['/api/', '/factsCenter/', '/share', '/book', '/sport/', '/event']):
                try:
                    body = await resp.text()
                    responses_log.append({
                        "status": resp.status,
                        "url": url[:200],
                        "body": body[:2000],
                    })
                except Exception:
                    pass

        page.on("request", on_request)
        page.on("response", on_response)

        # Load a share code
        code = "6234E4B3F4B4"
        url = f"https://www.sportybet.com/ng/?shareCode={code}&c=ng"
        print(f"\n  Loading share code: {url}")
        await page.goto(url, timeout=30_000, wait_until="domcontentloaded")
        await asyncio.sleep(8)

        print(f"\n--- Requests ({len(requests_log)}) ---")
        for r in requests_log:
            print(f"  {r['method']} {r['url'][:150]}")
            if r['post']:
                print(f"    POST: {r['post'][:300]}")

        print(f"\n--- Responses ({len(responses_log)}) ---")
        for r in responses_log:
            print(f"\n  [{r['status']}] {r['url']}")
            try:
                data = json.loads(r['body'])
                print(f"  {json.dumps(data, indent=2)[:800]}")
            except Exception:
                print(f"  {r['body'][:300]}")

        # Also check: what happens when we look at the betslip items
        # — do they contain event IDs we can reuse?
        print("\n--- Betslip Items with Data Attributes ---")
        items_data = await page.evaluate("""
            () => {
                const items = document.querySelectorAll('#j_betslip .m-item');
                return Array.from(items).slice(0, 5).map(el => ({
                    html: el.outerHTML.substring(0, 800),
                    dataAttrs: Array.from(el.attributes)
                        .filter(a => a.name.startsWith('data-'))
                        .map(a => ({name: a.name, value: a.value})),
                    text: el.textContent.trim().substring(0, 150),
                }));
            }
        """)
        for i, item in enumerate(items_data):
            print(f"\n  Item {i+1}: {item['text'][:100]}")
            if item['dataAttrs']:
                for attr in item['dataAttrs']:
                    print(f"    {attr['name']}={attr['value']}")
            print(f"    HTML: {item['html'][:400]}")

        # Check if there's a BookBet/Share API endpoint
        print("\n--- Checking for Book/Share API in page scripts ---")
        api_patterns = await page.evaluate("""
            () => {
                const scripts = document.querySelectorAll('script');
                const patterns = [];
                scripts.forEach(s => {
                    const text = s.textContent;
                    if (text.includes('shareCode') || text.includes('bookBet') || text.includes('booking')) {
                        // Find URL patterns
                        const matches = text.match(/['"][^'"]*(?:share|book|bet|code)[^'"]*['"]/gi);
                        if (matches) patterns.push(...matches.slice(0, 10));
                    }
                });
                return patterns;
            }
        """)
        print(f"  API patterns in scripts: {api_patterns}")

        await browser.close()
        print("\n  Done!")


if __name__ == "__main__":
    asyncio.run(main())
