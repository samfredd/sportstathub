"""
Test Bet9ja with different Chrome strategies to bypass TLS fingerprint detection.

The ERR_HTTP2_PROTOCOL_ERROR is NOT an IP issue — it's Cloudflare detecting
Playwright's bundled Chromium TLS fingerprint (JA3 hash).

Strategies:
  1. channel="chrome" — use system Chrome (real TLS fingerprint)
  2. headful + Xvfb — run real Chrome headful in virtual display
  3. headless="new" — use Chrome's new headless mode (shares headful TLS)
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
    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const pa = Object.create(PluginArray.prototype);
            const pdf = Object.create(Plugin.prototype);
            Object.defineProperties(pdf, {
                name: { value: 'Chrome PDF Plugin' },
                filename: { value: 'internal-pdf-viewer' },
                description: { value: 'Portable Document Format' },
                length: { value: 1 }
            });
            Object.defineProperty(pa, 0, { value: pdf });
            Object.defineProperty(pa, 'length', { value: 1 });
            return pa;
        }
    });
    const vendor = 'Google Inc. (Intel)';
    const renderer = 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)';
    const wrap = (proto) => {
        const orig = proto.getParameter;
        proto.getParameter = function(p) {
            if (p === 37445) return vendor;
            if (p === 37446) return renderer;
            return orig.apply(this, arguments);
        };
    };
    if (typeof WebGLRenderingContext !== 'undefined') wrap(WebGLRenderingContext.prototype);
    if (typeof WebGL2RenderingContext !== 'undefined') wrap(WebGL2RenderingContext.prototype);
    const origGID = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function() {
        const img = origGID.apply(this, arguments);
        for (let i = 0; i < img.data.length; i += 1024) {
            img.data[i] = img.data[i] + (Math.random() > 0.5 ? 1 : -1);
        }
        return img;
    };
    window.chrome = {
        app: { isInstalled: false },
        webstore: { onInstall: {}, onDownloadProgress: {} },
        runtime: { PlatformOs: 'win', PlatformArch: 'x86-64' }
    };
})();
"""


async def test_strategy(name, launch_kwargs):
    """Test a single browser launch strategy against Bet9ja."""
    print(f"\n{'='*60}")
    print(f"Strategy: {name}")
    print(f"{'='*60}")

    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(**launch_kwargs)
        except Exception as e:
            print(f"  ❌ Launch failed: {e}")
            return False

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-NG",
            timezone_id="Africa/Lagos",
        )
        page = await context.new_page()
        page.set_default_timeout(20_000)

        # Inject stealth
        await context.add_init_script(STEALTH_INIT)
        # Suppress print dialog
        await page.add_init_script("window.print = function() {};")

        # Try homepage first
        print("  Loading homepage...")
        try:
            await page.goto("https://sports.bet9ja.com/", timeout=30_000, wait_until="domcontentloaded")
            print(f"  ✅ Homepage loaded! Title: {await page.title()}")
        except Exception as e:
            err_str = str(e)
            if "ERR_HTTP2" in err_str or "ERR_CONNECTION" in err_str:
                print(f"  ❌ TLS/Network block: {err_str[:100]}")
                await browser.close()
                return False
            print(f"  ⚠️  Error (may be partial): {err_str[:100]}")

        await asyncio.sleep(random.uniform(2, 4))

        # Try booking code URL
        print("  Loading booking code 5CJJLLH...")
        try:
            await page.goto(
                "https://sports.bet9ja.com/?bookABetCode=5CJJLLH",
                timeout=30_000,
                wait_until="domcontentloaded",
            )
            print(f"  ✅ Booking page loaded! URL: {page.url}")
        except Exception as e:
            err_str = str(e)
            if "ERR_HTTP2" in err_str:
                print(f"  ❌ TLS block on booking URL: {err_str[:100]}")
                await browser.close()
                return False
            print(f"  ⚠️  Partial load: {err_str[:80]}")

        # Wait for content
        await asyncio.sleep(5)

        # Check what we got
        title = await page.title()
        url = page.url
        print(f"  Page title: {title}")
        print(f"  Page URL: {url}")

        # Try to find betslip items
        betslip_classes = await page.evaluate("""
            () => {
                const cls = new Set();
                document.querySelectorAll('*').forEach(el => {
                    if (el.className && typeof el.className === 'string') {
                        el.className.split(' ').forEach(c => {
                            if (c.toLowerCase().includes('betslip') || c.toLowerCase().includes('coupon'))
                                cls.add(c);
                        });
                    }
                });
                return Array.from(cls).sort();
            }
        """)
        print(f"  Betslip classes found: {betslip_classes}")

        # Try known selectors
        for sel in ["[class*='betslip__item']", ".betslip__group", "[class*='betslip']"]:
            items = await page.query_selector_all(sel)
            if items:
                print(f"  ✅ Found {len(items)} elements with: {sel}")
                # Print first item text
                for i, item in enumerate(items[:3]):
                    text = await item.inner_text()
                    text = " ".join(text.split())[:120]
                    print(f"    [{i+1}] {text}")
                break

        # Get body text sample
        try:
            body = await page.inner_text("body")
            body_preview = " ".join(body.split())[:300]
            print(f"  Body text: {body_preview}")
        except Exception:
            pass

        await browser.close()
        return True


async def main():
    print("Testing Bet9ja TLS bypass strategies")
    print("Your IP is Nigerian, regular Chrome works fine.")
    print("The issue is Playwright's Chromium TLS fingerprint (JA3).")

    results = {}

    # Strategy 1: System Chrome via channel
    results["channel=chrome"] = await test_strategy(
        "System Chrome (channel='chrome')",
        {
            "channel": "chrome",
            "headless": True,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-infobars",
                "--disable-webrtc",
            ],
        },
    )

    # Strategy 2: System Chrome headful (works via Xvfb)
    results["headful+xvfb"] = await test_strategy(
        "System Chrome Headful (Xvfb)",
        {
            "channel": "chrome",
            "headless": False,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-infobars",
                "--disable-webrtc",
                "--disable-gpu",
            ],
        },
    )

    # Strategy 3: Playwright Chromium with new headless mode
    results["headless=new"] = await test_strategy(
        "Playwright Chromium (headless='new')",
        {
            "headless": True,
            "args": [
                "--headless=new",
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-infobars",
                "--disable-webrtc",
                "--cipher-suite-blacklist=0xc02f,0xc02b",
            ],
        },
    )

    # Summary
    print("\n" + "=" * 60)
    print("RESULTS SUMMARY")
    print("=" * 60)
    for strategy, success in results.items():
        status = "✅ WORKS" if success else "❌ BLOCKED"
        print(f"  {strategy}: {status}")


if __name__ == "__main__":
    asyncio.run(main())
