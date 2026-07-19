"""
OddSwitch Engine — Browser Stealth (Production Grade).

Deep anti-detection measures extracted from:
  - DarkMatter: WebGL/Canvas/Audio fingerprint spoofing, navigator shields,
    Chrome runtime, plugin simulation, bezier mouse movement
  - AliScribe: Proxy rotation, user-agent rotation, stealth launch args

Layers:
  1. Launch args (TLS/JA3, WebRTC, automation flags)
  2. Init scripts (fingerprint spoofing injected before page load)
  3. Behavioral (human-like mouse movement, typing, delays)
"""

from __future__ import annotations

import asyncio
import random
from typing import Any

import structlog

logger = structlog.get_logger()

# ── Layer 1: Chromium Launch Args ────────────────────────────────────────────

STEALTH_LAUNCH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-infobars",
    "--disable-webrtc",                                    # Prevent WebRTC IP leaks
    "--cipher-suite-blacklist=0xc02f,0xc02b",              # TLS JA3 hash mutation
    "--disable-features=IsolateOrigins,site-per-process",  # Reduce fingerprint surface
]

# ── Layer 2: User Agent Pool ─────────────────────────────────────────────────

USER_AGENTS = [
    # Chrome on Windows (most common)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    # Chrome on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    # Chrome on Linux
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

# ── Layer 3: Deep Fingerprint Spoofing (from DarkMatter) ─────────────────────

STEALTH_INIT_SCRIPT = """
(() => {
    // ── Navigator Shields ───────────────────────────────────────────────
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

    // ── Plugin Array Simulation (realistic, not [1,2,3,4,5]) ────────────
    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const pluginArray = Object.create(PluginArray.prototype);
            const pdfPlugin = Object.create(Plugin.prototype);
            Object.defineProperties(pdfPlugin, {
                name: { value: 'Chrome PDF Plugin' },
                filename: { value: 'internal-pdf-viewer' },
                description: { value: 'Portable Document Format' },
                length: { value: 1 }
            });
            const pdfViewerPlugin = Object.create(Plugin.prototype);
            Object.defineProperties(pdfViewerPlugin, {
                name: { value: 'Chrome PDF Viewer' },
                filename: { value: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                description: { value: '' },
                length: { value: 1 }
            });
            const nativeClientPlugin = Object.create(Plugin.prototype);
            Object.defineProperties(nativeClientPlugin, {
                name: { value: 'Native Client' },
                filename: { value: 'internal-nacl-plugin' },
                description: { value: '' },
                length: { value: 2 }
            });
            Object.defineProperty(pluginArray, 0, { value: pdfPlugin });
            Object.defineProperty(pluginArray, 1, { value: pdfViewerPlugin });
            Object.defineProperty(pluginArray, 2, { value: nativeClientPlugin });
            Object.defineProperty(pluginArray, 'length', { value: 3 });
            return pluginArray;
        }
    });

    // ── WebGL Vendor/Renderer Spoofing ───────────────────────────────────
    const isWindows = navigator.userAgent.includes('Windows');
    const vendor = isWindows ? 'Google Inc. (Intel)' : 'Google Inc. (AMD)';
    const renderer = isWindows
        ? 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)'
        : 'ANGLE (AMD, AMD Radeon Graphics (RADV RENOIR) OpenGL Engine)';

    const wrapGetParam = (proto) => {
        const orig = proto.getParameter;
        proto.getParameter = function(p) {
            if (p === 37445) return vendor;   // UNMASKED_VENDOR_WEBGL
            if (p === 37446) return renderer; // UNMASKED_RENDERER_WEBGL
            return orig.apply(this, arguments);
        };
    };
    if (typeof WebGLRenderingContext !== 'undefined') wrapGetParam(WebGLRenderingContext.prototype);
    if (typeof WebGL2RenderingContext !== 'undefined') wrapGetParam(WebGL2RenderingContext.prototype);

    // ── Canvas Noise Injection ───────────────────────────────────────────
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function() {
        const img = origGetImageData.apply(this, arguments);
        for (let i = 0; i < img.data.length; i += 1024) {
            img.data[i] = img.data[i] + (Math.random() > 0.5 ? 1 : -1);
        }
        return img;
    };

    // ── AudioContext Noise Injection ─────────────────────────────────────
    if (typeof AudioBuffer !== 'undefined') {
        const origGetChannelData = AudioBuffer.prototype.getChannelData;
        AudioBuffer.prototype.getChannelData = function() {
            const results = origGetChannelData.apply(this, arguments);
            for (let i = 0; i < results.length; i += 100) {
                results[i] = results[i] + (Math.random() * 0.0000001);
            }
            return results;
        };
    }

    // ── Permissions API Spoofing ─────────────────────────────────────────
    if (navigator.permissions) {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters)
        );
    }

    // ── Chrome Runtime & Extension Simulation ────────────────────────────
    window.chrome = {
        app: { isInstalled: false },
        webstore: { onInstall: {}, onDownloadProgress: {} },
        runtime: {
            PlatformOs: 'win',
            PlatformArch: 'x86-64',
            PlatformNaclArch: 'x86-64',
            RequestUpdateCheckStatus: 'throttled',
            OnInstalledReason: 'install',
            OnRestartRequiredReason: 'app_update',
        }
    };

    // ── React DevTools Hook (sites check for this) ───────────────────────
    if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
            supportsFiber: true,
            renderers: new Map()
        };
    }

    // ── Connection API Spoofing ──────────────────────────────────────────
    if (navigator.connection) {
        Object.defineProperty(navigator.connection, 'rtt', { get: () => 100 });
    }
})();
"""

# ── Layer 4: Viewport Pool ───────────────────────────────────────────────────

VIEWPORTS = [
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
    {"width": 1536, "height": 864},
    {"width": 1920, "height": 1080},
    {"width": 1280, "height": 720},
]

# ── Apply to Context ────────────────────────────────────────────────────────


async def apply_stealth(context: Any) -> None:
    """
    Apply deep stealth injection to a browser context.

    Injects DarkMatter-level fingerprint spoofing before any page loads:
      - WebGL vendor/renderer masking
      - Canvas noise injection
      - AudioContext noise injection
      - Navigator property hardening
      - Plugin array simulation
      - Chrome runtime/extension spoofing
      - Permissions API spoofing
    """
    try:
        await context.add_init_script(STEALTH_INIT_SCRIPT)
    except Exception as e:
        logger.warning("stealth_script_failed", error=str(e))


# ── Layer 5: Human Behavior Simulation (from DarkMatter) ────────────────────


async def random_delay(min_ms: int = 500, max_ms: int = 2000) -> None:
    """
    Human-like random delay with Gaussian distribution.

    Uses Gaussian instead of uniform for more realistic timing.
    Mean = midpoint, stddev = range/6 (99.7% within bounds).
    """
    mean = (min_ms + max_ms) / 2
    stddev = (max_ms - min_ms) / 6
    delay = max(min_ms, min(max_ms, random.gauss(mean, stddev)))
    await asyncio.sleep(delay / 1000)


async def bezier_mouse_move(
    page: Any,
    start_x: float,
    start_y: float,
    target_x: float,
    target_y: float,
    steps: int | None = None,
) -> None:
    """
    Move mouse along a cubic bezier curve (from DarkMatter).

    Features:
      - Random control points for natural wandering
      - 15% chance of overshoot + correction
      - Mid-flight pause (simulates reading/thinking)
      - Gaussian pre-move hesitation
    """
    if not steps:
        steps = random.randint(45, 85)

    # Hesitate before moving
    await asyncio.sleep(max(0.0, random.gauss(0.25, 0.1)))

    # 15% chance of overshoot
    overshoot = random.random() > 0.85
    actual_x = target_x + random.randint(-25, 25) if overshoot else target_x
    actual_y = target_y + random.randint(-25, 25) if overshoot else target_y

    # Cubic bezier control points (natural wandering)
    c1x = start_x + random.randint(-200, 200)
    c1y = start_y + random.randint(-200, 200)
    c2x = actual_x + random.randint(-200, 200)
    c2y = actual_y + random.randint(-200, 200)

    pause_step = random.randint(int(steps * 0.3), int(steps * 0.7))

    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 3 * start_x + 3 * (1 - t) ** 2 * t * c1x + 3 * (1 - t) * t ** 2 * c2x + t ** 3 * actual_x
        y = (1 - t) ** 3 * start_y + 3 * (1 - t) ** 2 * t * c1y + 3 * (1 - t) * t ** 2 * c2y + t ** 3 * actual_y

        await page.mouse.move(x, y)
        await asyncio.sleep(random.uniform(0.002, 0.01))

        # Mid-flight pause (reading/thinking)
        if i == pause_step and random.random() > 0.5:
            await asyncio.sleep(random.uniform(0.3, 0.8))

    # Corrective micro-movement after overshoot
    if overshoot:
        await asyncio.sleep(max(0.0, random.gauss(0.15, 0.05)))
        await page.mouse.move(target_x, target_y)


async def human_type(page: Any, text: str) -> None:
    """
    Type text with human-like timing and occasional typos (from DarkMatter).

    Features:
      - Gaussian inter-keystroke delay (~80ms mean)
      - 2% typo rate with immediate backspace correction
      - Natural pause after typo correction
    """
    qwerty = "qwertyuiopasdfghjklzxcvbnm"
    for char in text:
        # 2% typo chance
        if char.isalpha() and random.random() < 0.02:
            idx = qwerty.find(char.lower())
            typo = qwerty[max(0, idx - 1)]
            await page.keyboard.press(typo)
            await asyncio.sleep(max(0.0, random.gauss(0.12, 0.04)))
            await page.keyboard.press("Backspace")
            await asyncio.sleep(max(0.0, random.gauss(0.15, 0.05)))

        await page.keyboard.press(char)
        await asyncio.sleep(max(0.0, random.gauss(0.08, 0.03)))


async def stealth_scroll(page: Any) -> None:
    """Perform a random human-like scroll action."""
    try:
        x = random.randint(100, 1000)
        y = random.randint(100, 800)
        await page.mouse.move(x, y, steps=5)
        await page.mouse.wheel(0, random.randint(100, 500))
        await asyncio.sleep(random.uniform(0.5, 2.0))
    except Exception:
        pass


# ── Helpers ──────────────────────────────────────────────────────────────────


def random_viewport() -> dict[str, int]:
    """Pick a random realistic viewport."""
    return random.choice(VIEWPORTS)


def random_user_agent() -> str:
    """Pick a random user agent from the pool."""
    return random.choice(USER_AGENTS)


def get_launch_args() -> list[str]:
    """Get stealth launch args for Chromium."""
    return list(STEALTH_LAUNCH_ARGS)
