"""
Quick integration test — tests both adapters directly
with real browsers using DarkMatter-level stealth.
"""
import asyncio
import random

from playwright.async_api import async_playwright

# ── DarkMatter Stealth Config ────────────────────────────────────────────────

STEALTH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-infobars",
    "--disable-webrtc",
    "--cipher-suite-blacklist=0xc02f,0xc02b",
    "--disable-features=IsolateOrigins,site-per-process",
]

STEALTH_INIT_SCRIPT = """
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
    const wrapGP = (proto) => {
        const orig = proto.getParameter;
        proto.getParameter = function(p) {
            if (p === 37445) return vendor;
            if (p === 37446) return renderer;
            return orig.apply(this, arguments);
        };
    };
    if (typeof WebGLRenderingContext !== 'undefined') wrapGP(WebGLRenderingContext.prototype);
    if (typeof WebGL2RenderingContext !== 'undefined') wrapGP(WebGL2RenderingContext.prototype);

    const origGID = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function() {
        const img = origGID.apply(this, arguments);
        for (let i = 0; i < img.data.length; i += 1024) {
            img.data[i] = img.data[i] + (Math.random() > 0.5 ? 1 : -1);
        }
        return img;
    };

    if (typeof AudioBuffer !== 'undefined') {
        const origGCD = AudioBuffer.prototype.getChannelData;
        AudioBuffer.prototype.getChannelData = function() {
            const r = origGCD.apply(this, arguments);
            for (let i = 0; i < r.length; i += 100) { r[i] += Math.random() * 0.0000001; }
            return r;
        };
    }

    if (navigator.permissions) {
        const oq = navigator.permissions.query;
        navigator.permissions.query = p => p.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission }) : oq(p);
    }

    window.chrome = {
        app: { isInstalled: false },
        webstore: { onInstall: {}, onDownloadProgress: {} },
        runtime: { PlatformOs: 'win', PlatformArch: 'x86-64', PlatformNaclArch: 'x86-64',
                   RequestUpdateCheckStatus: 'throttled', OnInstalledReason: 'install',
                   OnRestartRequiredReason: 'app_update' }
    };
    if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers: new Map() };
    }
})();
"""


async def create_stealth_context(playwright):
    """Create a browser + context with full DarkMatter stealth."""
    browser = await playwright.chromium.launch(
        headless=True,
        args=STEALTH_ARGS,
    )
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport={"width": 1920, "height": 1080},
        locale="en-NG",
        timezone_id="Africa/Lagos",
    )
    await context.add_init_script(STEALTH_INIT_SCRIPT)
    return browser, context


# ── Test: SportyBet ──────────────────────────────────────────────────────────


async def test_sportybet():
    print("=" * 60)
    print("Testing SportyBet (code: SU88SY)")
    print("  Stealth: DarkMatter (WebGL+Canvas+Audio+Nav)")
    print("=" * 60)

    async with async_playwright() as p:
        browser, context = await create_stealth_context(p)
        page = await context.new_page()
        page.set_default_timeout(20_000)

        url = "https://www.sportybet.com/?shareCode=SU88SY&c=ng"
        print(f"  Navigating to {url}")
        await page.goto(url, timeout=30_000, wait_until="domcontentloaded")

        print("  Waiting for betslip items...")
        await page.wait_for_selector("#j_betslip .m-list .m-item", timeout=20_000)

        items = await page.query_selector_all("#j_betslip .m-list .m-item")
        print(f"  Found {len(items)} betslip items")

        for i, item in enumerate(items[:5]):
            sel_el = await item.query_selector(".m-item-play span")
            selection = await sel_el.inner_text() if sel_el else "?"

            team_el = await item.query_selector(".m-item-team")
            event = ""
            if team_el:
                event = await team_el.get_attribute("title") or await team_el.inner_text()

            market_el = await item.query_selector(".m-item-market")
            market = await market_el.inner_text() if market_el else "?"

            odds_el = await item.query_selector(".m-item-odds .m-text-main")
            odds = await odds_el.inner_text() if odds_el else "?"

            print(f"  [{i+1}] {event}")
            print(f"       Selection: {selection} | Market: {market} | Odds: {odds}")

        if len(items) > 5:
            print(f"  ... and {len(items) - 5} more items")

        await browser.close()
        print(f"\n  ✅ SportyBet: {len(items)} legs extracted successfully")


# ── Test: Bet9ja ─────────────────────────────────────────────────────────────


async def test_bet9ja():
    print("\n" + "=" * 60)
    print("Testing Bet9ja (code: 5CJJLLH)")
    print("  Stealth: DarkMatter + print suppression + 2-stage nav")
    print("=" * 60)

    async with async_playwright() as p:
        browser, context = await create_stealth_context(p)
        page = await context.new_page()
        page.set_default_timeout(20_000)

        # CRITICAL: Suppress window.print() before navigation
        await page.add_init_script("window.print = function() {};")

        # Strategy: 2-stage navigation
        # Stage 1: Load homepage first (builds normal browsing context)
        print("  Stage 1: Loading homepage first...")
        try:
            await page.goto("https://sports.bet9ja.com/", timeout=30_000, wait_until="domcontentloaded")
            print("  Homepage loaded successfully")
            await asyncio.sleep(random.uniform(2, 4))
        except Exception as e:
            print(f"  Homepage load failed: {e}")
            print(f"  Trying direct navigation...")

        # Stage 2: Navigate to booking code URL
        print("  Stage 2: Loading booking code...")
        try:
            await page.goto(
                "https://sports.bet9ja.com/?bookABetCode=5CJJLLH",
                timeout=30_000,
                wait_until="domcontentloaded",
            )
        except Exception as e:
            print(f"  domcontentloaded failed, trying commit: {e}")
            try:
                await page.goto(
                    "https://sports.bet9ja.com/?bookABetCode=5CJJLLH",
                    timeout=45_000,
                    wait_until="commit",
                )
                await asyncio.sleep(8)
            except Exception as e2:
                print(f"  ❌ Bet9ja navigation failed: {e2}")
                print(f"  This is Cloudflare/anti-bot at the TLS/HTTP level.")
                print(f"  Residential proxy required for production.")

                # Diagnostic: what does Bet9ja see?
                try:
                    title = await page.title()
                    url = page.url
                    print(f"  Page title: {title}")
                    print(f"  Page URL: {url}")
                except Exception:
                    pass

                await browser.close()
                return

        # Wait for content
        print("  Waiting for betslip items...")
        await asyncio.sleep(5)

        # Try multiple selector strategies
        selectors = [
            "[class*='betslip__item']:not([class*='betslip__items'])",
            ".betslip__group",
            "[class*='betslip'] [class*='item']",
        ]

        items = []
        for sel in selectors:
            items = await page.query_selector_all(sel)
            if items:
                print(f"  Found {len(items)} items with: {sel}")
                break

        if not items:
            print("  ⚠️ No betslip items found with known selectors")
            print("  Dumping diagnostics...")

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
            print(f"  Betslip/coupon classes: {betslip_classes}")

            # Get page text sample
            try:
                body_text = await page.inner_text("body")
                print(f"  Body text preview: {body_text[:500]}")
            except Exception:
                pass

            right = await page.evaluate("""
                () => {
                    const bs = document.querySelector('[class*="betslip"]');
                    if (bs) return {cls: bs.className, html: bs.innerHTML.substring(0, 3000)};
                    return null;
                }
            """)
            if right:
                print(f"  Betslip container: {right['cls']}")
                print(f"  innerHTML (3000 chars):\n{right['html']}")
        else:
            for i, item in enumerate(items[:5]):
                text = await item.inner_text()
                text = " ".join(text.split())
                print(f"  [{i+1}] {text[:120]}")

            if len(items) > 5:
                print(f"  ... and {len(items) - 5} more items")

            print(f"\n  ✅ Bet9ja: {len(items)} items extracted successfully")

        await browser.close()


# ── Main ─────────────────────────────────────────────────────────────────────


async def main():
    await test_sportybet()
    await test_bet9ja()
    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
