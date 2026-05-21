"""
OddSwitch Engine — Proxy Rotator.

Rotates proxies per request to avoid IP-based detection.
Proxies loaded from environment or config file.
"""

from __future__ import annotations

import itertools
import os

import structlog

logger = structlog.get_logger()


class ProxyRotator:
    """
    Round-robin proxy rotation.

    Proxies are loaded from the PROXY_LIST environment variable
    (comma-separated) or from a proxies.txt file.

    Format: protocol://user:pass@host:port
    """

    def __init__(self) -> None:
        self._proxies = self._load_proxies()
        self._cycle = itertools.cycle(self._proxies) if self._proxies else None
        if self._proxies:
            logger.info("proxies_loaded", count=len(self._proxies))
        else:
            logger.warning("no_proxies_configured")

    def _load_proxies(self) -> list[str]:
        """Load proxies from environment or file."""
        # From environment
        proxy_list = os.environ.get("PROXY_LIST", "")
        if proxy_list:
            return [p.strip() for p in proxy_list.split(",") if p.strip()]

        # From file
        proxy_file = os.environ.get("PROXY_FILE", "proxies.txt")
        if os.path.exists(proxy_file):
            with open(proxy_file) as f:
                return [line.strip() for line in f if line.strip() and not line.startswith("#")]

        return []

    def next_proxy(self) -> str | None:
        """Get the next proxy in rotation. Returns None if no proxies."""
        if self._cycle:
            return next(self._cycle)
        return None

    def remove_proxy(self, proxy: str) -> None:
        """Remove a dead proxy from the rotation."""
        if proxy in self._proxies:
            self._proxies.remove(proxy)
            self._cycle = itertools.cycle(self._proxies) if self._proxies else None
            logger.info("proxy_removed", proxy=proxy, remaining=len(self._proxies))

    @property
    def count(self) -> int:
        """Number of active proxies."""
        return len(self._proxies)
