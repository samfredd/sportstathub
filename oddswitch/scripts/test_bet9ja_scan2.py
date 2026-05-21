"""
Bet9ja DOM Scanner v2: Focus on booking code loading mechanism.
The first scan showed the betslip is empty despite the bookABetCode URL param.
Need to check:
  1. Does the booking code load after more time?
  2. Is there a "Book:" input field where we must paste the code manually?
  3. What are the real betslip item classes once items ARE loaded?
"""
import asyncio
from playwright.async_api import async_playwright


async def main():
    print("=" * 60)
    print("Bet9ja Scanner v2: Booking Code Loading")
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

        # Listen to console messages for clues
        page.on("console", lambda msg: print(f"  [CONSOLE] {msg.type}: {msg.text[:150]}") if "bet" in msg.text.lower() or "book" in msg.text.lower() or "error" in msg.text.lower() or "code" in msg.text.lower() else None)

        url = "https://sports.bet9ja.com/?bookABetCode=5CJJLLH"
        print(f"\n  Navigating to {url}")

        try:
            resp = await page.goto(url, timeout=30_000, wait_until="domcontentloaded")
            print(f"  Response status: {resp.status if resp else 'None'}")
        except Exception as e:
            print(f"  Navigation note: {str(e)[:100]}")

        print(f"  Title: {await page.title()}")
        print(f"  URL: {page.url}")

        # Check betslip state every 2 seconds for 20 seconds
        print("\n--- Monitoring betslip loading ---")
        for i in range(10):
            await asyncio.sleep(2)

            # Check betslip content
            betslip_text = await page.evaluate("""
                () => {
                    const body = document.querySelector('.betslip__body');
                    return body ? body.textContent.trim().substring(0, 200) : 'NO .betslip__body FOUND';
                }
            """)

            # Count betslip-related elements
            counts = await page.evaluate("""
                () => {
                    return {
                        betslip_items: document.querySelectorAll('[class*="betslip__item"]').length,
                        betslip_match: document.querySelectorAll('[class*="betslip__match"]').length,
                        betslip_bets: document.querySelectorAll('[class*="betslip__bets"]').length,
                        betslip_event: document.querySelectorAll('[class*="betslip__event"]').length,
                        betslip_selection: document.querySelectorAll('[class*="betslip__sel"]').length,
                        betslip_odds: document.querySelectorAll('[class*="betslip__odd"]').length,
                        betslip_all: document.querySelectorAll('[class*="betslip"]').length,
                    };
                }
            """)

            print(f"  t={i*2+2}s: items={counts['betslip_items']} match={counts['betslip_match']} "
                  f"bets={counts['betslip_bets']} events={counts['betslip_event']} "
                  f"sel={counts['betslip_selection']} odds={counts['betslip_odds']} "
                  f"total_betslip={counts['betslip_all']}")

            # If items appeared, break early
            if counts['betslip_items'] > 0 or counts['betslip_match'] > 0 or counts['betslip_bets'] > 0:
                print(f"  ✅ Betslip items appeared at t={i*2+2}s!")
                break

            if "empty" not in betslip_text.lower() and len(betslip_text) > 50:
                print(f"  ✅ Betslip content changed at t={i*2+2}s!")
                print(f"  Content: {betslip_text[:200]}")
                break

        # Check the reservation container — is there an input to type the code?
        print("\n--- Reservation Container Analysis ---")
        reservation = await page.evaluate("""
            () => {
                const container = document.querySelector('.betslip__reservation-container');
                if (!container) return { found: false };

                const inputs = container.querySelectorAll('input');
                const buttons = container.querySelectorAll('button, a');

                return {
                    found: true,
                    html: container.innerHTML.substring(0, 2000),
                    inputCount: inputs.length,
                    buttonCount: buttons.length,
                    inputs: Array.from(inputs).map(i => ({
                        type: i.type, placeholder: i.placeholder, value: i.value, id: i.id, name: i.name
                    })),
                    buttons: Array.from(buttons).map(b => ({
                        text: b.textContent.trim(), class: b.className, id: b.id
                    })),
                };
            }
        """)

        if reservation['found']:
            print(f"  Inputs: {reservation['inputCount']}")
            for inp in reservation.get('inputs', []):
                print(f"    Input: type={inp['type']} placeholder='{inp['placeholder']}' id='{inp['id']}' value='{inp['value']}'")
            print(f"  Buttons: {reservation['buttonCount']}")
            for btn in reservation.get('buttons', []):
                print(f"    Button: text='{btn['text']}' class='{btn['class']}' id='{btn['id']}'")
            print(f"\n  HTML:\n{reservation.get('html', '')[:1500]}")
        else:
            print("  No reservation container found")

        # Try manually typing the code into the Book input and clicking Book
        print("\n--- Attempting manual booking code entry ---")
        try:
            book_input = await page.query_selector('.betslip__reservation-container input[type="text"]')
            if not book_input:
                # Try broader selector
                book_input = await page.query_selector('.betslip__reservation-container input')

            if book_input:
                await book_input.fill("5CJJLLH")
                print("  Filled booking code: 5CJJLLH")
                await asyncio.sleep(1)

                # Click the "Book" button
                book_btn = await page.query_selector('.betslip__reservation-container button')
                if not book_btn:
                    book_btn = await page.query_selector('button:has-text("Book")')

                if book_btn:
                    await book_btn.click()
                    print("  Clicked Book button")

                    # Wait for betslip to load
                    print("  Waiting for betslip to populate...")
                    for i in range(15):
                        await asyncio.sleep(2)

                        counts = await page.evaluate("""
                            () => {
                                const all = document.querySelectorAll('[class*="betslip"]');
                                const relevant = [];
                                all.forEach(el => {
                                    const cls = el.className || '';
                                    if (typeof cls === 'string' && (
                                        cls.includes('item') || cls.includes('match') ||
                                        cls.includes('bets') || cls.includes('event') ||
                                        cls.includes('sel') || cls.includes('odd')
                                    )) {
                                        relevant.push(cls.substring(0, 80));
                                    }
                                });
                                return {
                                    total: all.length,
                                    relevant: relevant.slice(0, 20),
                                    bodyText: (document.querySelector('.betslip__body') || {}).textContent?.substring(0, 200) || '',
                                };
                            }
                        """)

                        print(f"  t={i*2+2}s: total_betslip_els={counts['total']} "
                              f"relevant={len(counts['relevant'])}")

                        if counts['relevant']:
                            print(f"  ✅ Found betslip item classes!")
                            for cls in counts['relevant']:
                                print(f"    .{cls}")
                            break

                        if counts['bodyText'] and "empty" not in counts['bodyText'].lower():
                            print(f"  ✅ Body changed: {counts['bodyText'][:150]}")

                            # Get all betslip classes now
                            all_cls = await page.evaluate("""
                                () => {
                                    const cls = new Set();
                                    document.querySelectorAll('[class*="betslip"]').forEach(el => {
                                        if (typeof el.className === 'string') {
                                            el.className.split(' ').forEach(c => cls.add(c));
                                        }
                                    });
                                    return Array.from(cls).sort();
                                }
                            """)
                            print(f"  All betslip classes: {all_cls}")

                            # Get the full betslip body HTML
                            body_html = await page.evaluate("""
                                () => {
                                    const body = document.querySelector('.betslip__body');
                                    return body ? body.innerHTML.substring(0, 5000) : 'NOT FOUND';
                                }
                            """)
                            print(f"\n  Betslip body HTML:\n{body_html[:3000]}")
                            break
                else:
                    print("  No Book button found")
            else:
                print("  No booking input found")
        except Exception as e:
            print(f"  Error: {e}")

        # Screenshot
        screenshot_path = "/home/whoami/tools/Gemini/Work/OddSwitch/scripts/bet9ja_scan2.png"
        await page.screenshot(path=screenshot_path, full_page=False)
        print(f"\n  Screenshot saved: {screenshot_path}")

        await browser.close()
        print("\n  Done!")


if __name__ == "__main__":
    asyncio.run(main())
