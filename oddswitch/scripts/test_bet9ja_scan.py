"""
Comprehensive Bet9ja DOM scanner using system Chrome.
Finds ALL class names containing 'bet', 'slip', 'coupon', 'match', 'selection',
'book', 'odds', 'market' — any pattern that could be the betslip.
Also dumps the full page HTML structure for analysis.
"""
import asyncio
from playwright.async_api import async_playwright


async def main():
    print("=" * 60)
    print("Bet9ja Comprehensive DOM Scanner (channel='chrome')")
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

        # Stealth + print suppression
        await context.add_init_script("""
            (() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.chrome = { app: { isInstalled: false }, runtime: {} };
            })();
        """)
        await page.add_init_script("window.print = function() { console.log('print suppressed'); };")

        url = "https://sports.bet9ja.com/?bookABetCode=5CJJLLH"
        print(f"  Navigating to {url}")

        try:
            await page.goto(url, timeout=30_000, wait_until="domcontentloaded")
        except Exception as e:
            print(f"  Navigation note: {str(e)[:100]}")

        title = await page.title()
        print(f"  Page title: {title}")
        print(f"  Page URL: {page.url}")

        # Wait longer for JS rendering
        print("  Waiting 10s for JavaScript to render...")
        await asyncio.sleep(10)

        # Scan 1: Find ALL class names that could be betslip-related
        print("\n--- SCAN 1: All interesting class names ---")
        classes = await page.evaluate("""
            () => {
                const keywords = ['bet', 'slip', 'coupon', 'match', 'selection', 'book',
                                  'odds', 'market', 'event', 'league', 'team', 'item',
                                  'sidebar', 'right', 'panel', 'cart'];
                const found = {};
                document.querySelectorAll('*').forEach(el => {
                    if (el.className && typeof el.className === 'string') {
                        el.className.split(' ').forEach(c => {
                            const cl = c.toLowerCase();
                            for (const kw of keywords) {
                                if (cl.includes(kw)) {
                                    if (!found[kw]) found[kw] = new Set();
                                    found[kw].add(c);
                                }
                            }
                        });
                    }
                });
                // Convert Sets to Arrays for JSON
                const result = {};
                for (const [k, v] of Object.entries(found)) {
                    result[k] = Array.from(v).sort();
                }
                return result;
            }
        """)

        for keyword, class_list in sorted(classes.items()):
            print(f"\n  [{keyword}] ({len(class_list)} classes):")
            for c in class_list[:20]:
                print(f"    .{c}")
            if len(class_list) > 20:
                print(f"    ... and {len(class_list) - 20} more")

        # Scan 2: Find the right sidebar / betslip container
        print("\n--- SCAN 2: Betslip container candidates ---")
        containers = await page.evaluate("""
            () => {
                const results = [];
                const candidates = document.querySelectorAll('[class*="betslip"], [class*="coupon"], [class*="sidebar"], [id*="betslip"], [id*="coupon"], [id*="sidebar"]');
                candidates.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    results.push({
                        tag: el.tagName,
                        id: el.id || '',
                        class: el.className || '',
                        visible: rect.width > 0 && rect.height > 0,
                        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                        childCount: el.children.length,
                        textPreview: el.textContent.trim().substring(0, 200),
                    });
                });
                return results;
            }
        """)

        for i, c in enumerate(containers):
            print(f"\n  Container {i+1}:")
            print(f"    Tag: {c['tag']}, ID: {c['id']}")
            print(f"    Class: {c['class'][:150]}")
            print(f"    Visible: {c['visible']}, Rect: {c['rect']}")
            print(f"    Children: {c['childCount']}")
            print(f"    Text: {c['textPreview'][:150]}")

        # Scan 3: Get the full body structure (top-level divs)
        print("\n--- SCAN 3: Top-level page structure ---")
        structure = await page.evaluate("""
            () => {
                const results = [];
                document.body.childNodes.forEach(child => {
                    if (child.nodeType === 1) { // Element node
                        const rect = child.getBoundingClientRect();
                        results.push({
                            tag: child.tagName,
                            id: child.id || '',
                            class: (child.className || '').substring(0, 100),
                            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                            childCount: child.children.length,
                        });
                    }
                });
                return results;
            }
        """)

        for s in structure:
            print(f"  <{s['tag']} id='{s['id']}' class='{s['class']}'> children={s['childCount']} rect={s['rect']}")

        # Scan 4: Get body text sample
        print("\n--- SCAN 4: Body text keywords ---")
        try:
            body_text = await page.inner_text("body")
            # Look for betting-related text
            words = body_text.split()
            total = len(words)
            print(f"  Total words on page: {total}")

            # Find lines with betting keywords
            for keyword in ["Book", "Bet", "Odds", "Selection", "Booking", "Code", "Stake", "Total"]:
                idx = body_text.lower().find(keyword.lower())
                if idx >= 0:
                    context_text = body_text[max(0, idx-30):idx+80].replace("\n", " ").strip()
                    print(f"  '{keyword}' found at {idx}: ...{context_text}...")
        except Exception as e:
            print(f"  Error: {e}")

        # Scan 5: Take a screenshot
        screenshot_path = "/home/whoami/tools/Gemini/Work/OddSwitch/scripts/bet9ja_scan.png"
        await page.screenshot(path=screenshot_path, full_page=False)
        print(f"\n  Screenshot saved: {screenshot_path}")

        await browser.close()
        print("\n  Done!")


if __name__ == "__main__":
    asyncio.run(main())
