from __future__ import annotations

import socket
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.core.callback_security import validate_callback_url


@pytest.mark.asyncio
@pytest.mark.parametrize("url", [
    "http://127.0.0.1/hook",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/hook",
    "https://user:password@example.com/hook",
    "file:///etc/passwd",
])
async def test_callback_rejects_ssrf_targets(url):
    with pytest.raises(HTTPException):
        await validate_callback_url(url)


@pytest.mark.asyncio
async def test_callback_rejects_dns_names_resolving_to_private_addresses():
    private_result = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.8", 443))]
    with patch("socket.getaddrinfo", return_value=private_result):
        with pytest.raises(HTTPException):
            await validate_callback_url("https://callback.example/hook")
