"""
Bet9ja Extraction v2: Get the REAL betslip item structure.
Now we know:
  - bookABetCode URL param works (takes ~4s to load)
  - betslip__match is the correct class (191 elements for many bets)
  - Need to map the full class hierarchy inside each match element
"""
import asyncio
from playwright.async_api import async_playwright


async def main():
    print("=" * 60)
    print("Bet9ja Extraction v2: Real DOM Structure")
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
        page.set_default_timeout(30_000)

        await context.add_init_script("""
            (() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.chrome = { app: { isInstalled: false }, runtime: {} };
            })();
        """)
        await page.add_init_script("window.print = function() {};")

        url = "https://sports.bet9ja.com/?bookABetCode=5CJJLLH"
        print(f"  Navigating to {url}")
        await page.goto(url, timeout=30_000, wait_until="domcontentloaded")
        print(f"  Page loaded: {await page.title()}")

        # Wait for betslip items
        print("  Waiting for betslip items...")
        for i in range(15):
            await asyncio.sleep(2)
            count = await page.evaluate("() => document.querySelectorAll('[class*=\"betslip__match\"]').length")
            print(f"  t={i*2+2}s: betslip__match elements = {count}")
            if count > 0:
                break

        # Get ALL betslip classes
        print("\n--- ALL betslip classes on page ---")
        all_classes = await page.evaluate("""
            () => {
                const cls = new Set();
                document.querySelectorAll('[class*="betslip"]').forEach(el => {
                    if (typeof el.className === 'string') {
                        el.className.split(' ').forEach(c => {
                            if (c.startsWith('betslip')) cls.add(c);
                        });
                    }
                });
                return Array.from(cls).sort();
            }
        """)
        for c in all_classes:
            count = await page.evaluate(f"() => document.querySelectorAll('.{c}').length")
            print(f"  .{c} ({count})")

        # Get the HTML of the first 3 top-level betslip items
        # First find what the direct children of betslip__body are
        print("\n--- Betslip body structure ---")
        body_structure = await page.evaluate("""
            () => {
                const body = document.querySelector('.betslip__body');
                if (!body) return 'NO BODY';
                const children = [];
                for (const child of body.children) {
                    children.push({
                        tag: child.tagName,
                        class: (typeof child.className === 'string' ? child.className : '').substring(0, 100),
                        childCount: child.children.length,
                        textPreview: child.textContent.trim().substring(0, 150),
                    });
                }
                return children;
            }
        """)
        for i, child in enumerate(body_structure if isinstance(body_structure, list) else []):
            print(f"  [{i}] <{child['tag']} class='{child['class']}'> children={child['childCount']}")
            print(f"      text: {child['textPreview'][:120]}")

        # Get HTML of first 3 individual match items
        print("\n--- First 5 betslip__match-item elements ---")
        items_html = await page.evaluate("""
            () => {
                const items = document.querySelectorAll('.betslip__match-item');
                if (items.length === 0) {
                    // Try betslip__match
                    const matches = document.querySelectorAll('.betslip__match');
                    return Array.from(matches).slice(0, 5).map(el => ({
                        class: el.className,
                        html: el.outerHTML.substring(0, 1500),
                        text: el.textContent.trim().substring(0, 200),
                    }));
                }
                return Array.from(items).slice(0, 5).map(el => ({
                    class: el.className,
                    html: el.outerHTML.substring(0, 1500),
                    text: el.textContent.trim().substring(0, 200),
                }));
            }
        """)
        for i, item in enumerate(items_html):
            print(f"\n  ITEM {i+1} (class: {item['class']}):")
            print(f"  Text: {item['text']}")
            print(f"  HTML:\n{item['html'][:1200]}")

        # Extract data from each match systematically
        print("\n\n--- SYSTEMATIC DATA EXTRACTION ---")
        extraction = await page.evaluate("""
            () => {
                // Try different container selectors
                const containers = document.querySelectorAll(
                    '.betslip__match-item, .betslip__bets-item, .betslip__item'
                );

                // If nothing found, try to find the repeating pattern
                if (containers.length === 0) {
                    // Look at betslip__body children
                    const body = document.querySelector('.betslip__body, .betslip__bets-body, .betslip__bets');
                    if (!body) return { error: 'no body', totalBetslip: document.querySelectorAll('[class*="betslip"]').length };

                    const result = [];
                    // Walk through all elements and find ones with event-like text
                    body.querySelectorAll('*').forEach(el => {
                        const text = el.textContent.trim();
                        if (text.includes(' - ') && text.length < 200 && el.children.length < 10) {
                            const cls = typeof el.className === 'string' ? el.className : '';
                            if (cls.includes('betslip')) {
                                result.push({
                                    class: cls.substring(0, 100),
                                    tag: el.tagName,
                                    text: text.substring(0, 200),
                                    childClasses: Array.from(el.children).map(c =>
                                        (typeof c.className === 'string' ? c.className : '').substring(0, 80)
                                    ),
                                });
                            }
                        }
                    });
                    return { method: 'text-scan', items: result.slice(0, 10) };
                }

                return {
                    method: 'direct',
                    count: containers.length,
                    items: Array.from(containers).slice(0, 5).map(el => ({
                        class: el.className,
                        text: el.textContent.trim().substring(0, 200),
                    })),
                };
            }
        """)
        print(f"  Extraction result: {extraction}")

        # Finally, do a broad innerHTML dump of the betslip area
        print("\n--- BETSLIP BODY innerHTML (first 6000 chars) ---")
        body_html = await page.evaluate("""
            () => {
                const body = document.querySelector('.betslip__body');
                return body ? body.innerHTML.substring(0, 6000) : 'NOT FOUND';
            }
        """)
        print(body_html[:6000])

        # Screenshot
        await page.screenshot(
            path="/home/whoami/tools/Gemini/Work/OddSwitch/scripts/bet9ja_extract_v2.png",
            full_page=False
        )
        print("\n  Screenshot saved")

        await browser.close()
        print("\n  Done!")


if __name__ == "__main__":
    asyncio.run(main())
