"""
OddSwitch Engine — Browser Pool Manager (Production Grade).

Manages a pool of Playwright browser contexts with:
  - DarkMatter-level fingerprint spoofing
  - User-agent and viewport rotation
  - Proxy rotation with bad-proxy tracking
  - Context recycling after N uses
  - TLS JA3 mutation via launch args

Techniques sourced from DarkMatter + AliScribe projects.
"""

from __future__ import annotations

import asyncio
from typing import Any

import structlog

from app.browser.proxy import ProxyRotator
from app.browser.stealth import (
    apply_stealth,
    get_launch_args,
    random_user_agent,
    random_viewport,
)
from app.config import get_settings

logger = structlog.get_logger()


class BrowserManager:
    """
    Manages Playwright browser lifecycle and context pool.

    Each context gets:
      - A unique user-agent (rotated from pool)
      - A unique viewport size (randomized)
      - Deep fingerprint spoofing (WebGL, Canvas, Audio, navigator)
      - Optional proxy (rotated per context)

    Usage:
        manager = await BrowserManager.create()
        context = await manager.acquire()
        page = await context.new_page()
        # ... use page ...
        await manager.release(context)
        await manager.shutdown()
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        self._playwright: Any = None
        self._browser: Any = None
        self._proxy_rotator = ProxyRotator()
        self._pool: asyncio.Queue = asyncio.Queue()
        self._context_uses: dict[int, int] = {}
        self._max_uses = self._settings.browser_context_max_uses

    @classmethod
    async def create(cls) -> "BrowserManager":
        """Factory: create and initialize the browser manager."""
        manager = cls()
        await manager._initialize()
        return manager

    async def _initialize(self) -> None:
        """Launch Playwright and the browser with stealth args."""
        try:
            from playwright.async_api import async_playwright

            self._playwright = await async_playwright().start()
            # Use system Chrome (channel="chrome") instead of Playwright's
            # bundled Chromium. This is REQUIRED because Bet9ja's Cloudflare
            # blocks Playwright Chromium at the TLS level (JA3 fingerprint).
            # System Chrome shares the real Chrome TLS fingerprint.
            self._browser = await self._playwright.chromium.launch(
                channel="chrome",
                headless=True,
                args=get_launch_args(),
            )
            logger.info(
                "browser_launched",
                channel="chrome",
                args_count=len(get_launch_args()),
            )

            # Pre-create context pool
            pool_size = self._settings.browser_pool_size
            for _ in range(pool_size):
                ctx = await self._create_context()
                await self._pool.put(ctx)

            logger.info("browser_pool_ready", size=pool_size)

        except ImportError:
            logger.warning("playwright_not_installed")
        except Exception as e:
            logger.error("browser_launch_failed", error=str(e))

    async def _create_context(self) -> Any:
        """
        Create a new browser context with full stealth stack.

        Each context gets unique:
          - User-agent (from rotation pool)
          - Viewport (randomized)
          - Proxy (if available)
          - Deep fingerprint spoofing (DarkMatter-level)
        """
        if not self._browser:
            return None

        proxy = self._proxy_rotator.next_proxy()
        proxy_config = None
        if proxy:
            proxy_config = self._parse_proxy(proxy)

        ua = random_user_agent()
        viewport = random_viewport()

        context_kwargs: dict[str, Any] = {
            "viewport": viewport,
            "user_agent": ua,
            "locale": "en-NG",
            "timezone_id": "Africa/Lagos",
        }

        if proxy_config:
            context_kwargs["proxy"] = proxy_config

        context = await self._browser.new_context(**context_kwargs)

        # Apply deep stealth injection (WebGL, Canvas, Audio, etc.)
        await apply_stealth(context)

        self._context_uses[id(context)] = 0
        logger.debug(
            "context_created",
            ua=ua[:50],
            viewport=f"{viewport['width']}x{viewport['height']}",
            proxy=bool(proxy_config),
        )
        return context

    def _parse_proxy(self, proxy_str: str) -> dict[str, str]:
        """
        Parse proxy string into Playwright format (from AliScribe).

        Supports:
          - http://user:pass@host:port
          - http://host:port
          - socks5://user:pass@host:port
        """
        if "@" in proxy_str:
            scheme_rest = proxy_str.split("://")
            scheme = scheme_rest[0] if len(scheme_rest) > 1 else "http"
            rest = scheme_rest[-1]

            auth_host = rest.split("@")
            auth_parts = auth_host[0].split(":")
            host_port = auth_host[1]

            return {
                "server": f"{scheme}://{host_port}",
                "username": auth_parts[0],
                "password": auth_parts[1] if len(auth_parts) > 1 else "",
            }
        else:
            return {"server": proxy_str}

    async def acquire(self) -> Any:
        """Acquire a browser context from the pool."""
        if self._pool.empty():
            ctx = await self._create_context()
        else:
            ctx = await self._pool.get()

        # Recycle if max uses exceeded
        ctx_id = id(ctx)
        if ctx_id in self._context_uses and self._context_uses[ctx_id] >= self._max_uses:
            logger.info("context_recycled", uses=self._context_uses[ctx_id])
            try:
                await ctx.close()
            except Exception:
                pass
            ctx = await self._create_context()

        self._context_uses[id(ctx)] = self._context_uses.get(id(ctx), 0) + 1
        return ctx

    async def release(self, context: Any) -> None:
        """Return a context to the pool."""
        if context:
            try:
                await context.clear_cookies()
            except Exception:
                pass
            await self._pool.put(context)

    async def shutdown(self) -> None:
        """Close all contexts and the browser."""
        while not self._pool.empty():
            ctx = await self._pool.get()
            try:
                await ctx.close()
            except Exception:
                pass

        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

        logger.info("browser_shutdown")
