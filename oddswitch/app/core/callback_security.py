"""Callback URL validation resistant to common SSRF targets."""
from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit

from fastapi import HTTPException

from app.config import get_settings


def _is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return ip.is_global and not (
        ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_multicast
        or ip.is_reserved or ip.is_unspecified
    )


async def validate_callback_url(url: str) -> tuple[str, tuple[str, ...]]:
    parsed = urlsplit(url)
    settings = get_settings()
    allowed_schemes = {"https"} if not settings.debug else {"https", "http"}
    if parsed.scheme.lower() not in allowed_schemes or not parsed.hostname:
        raise HTTPException(status_code=422, detail="Callback URL is not allowed")
    if parsed.username or parsed.password or parsed.fragment:
        raise HTTPException(status_code=422, detail="Callback URL is not allowed")
    hostname = parsed.hostname.rstrip(".").lower()
    if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith(".localhost"):
        raise HTTPException(status_code=422, detail="Callback URL is not allowed")
    try:
        direct = ipaddress.ip_address(hostname)
        addresses = (str(direct),)
    except ValueError:
        try:
            loop = asyncio.get_running_loop()
            info = await loop.run_in_executor(
                None, lambda: socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM))
            addresses = tuple(sorted({row[4][0] for row in info}))
        except OSError as exc:
            raise HTTPException(status_code=422, detail="Callback URL is not allowed") from exc
    if not addresses or any(not _is_public(address) for address in addresses):
        raise HTTPException(status_code=422, detail="Callback URL is not allowed")
    return hostname, addresses
