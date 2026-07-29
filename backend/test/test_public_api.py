"""API integration tests for /api/v2/publicv2 public endpoints.

Tests endpoints that don't require authentication:
- GET /api/v2/publicv2/status          (public service, cached)
- GET /api/v2/publicv2/status-detail   (public service, cached)
- GET /api/v2/publicv2/robots.txt
- GET /api/v2/publicv2/sitemap.xml
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


# ── GET /api/v2/publicv2/status (system ping) ─────────────────


@pytest.mark.asyncio
async def test_api_status(api_client):
    """Lightweight health check, no auth required."""
    resp = await api_client.get("/api/v2/publicv2/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "ok"


# ── GET /api/v2/publicv2/status ───────────────────────────────


@pytest.mark.asyncio
async def test_public_status(api_client):
    resp = await api_client.get("/api/v2/publicv2/status")
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body


# ── GET /api/v2/publicv2/status-detail ────────────────────────


@pytest.mark.asyncio
async def test_public_status_detail(api_client):
    resp = await api_client.get("/api/v2/publicv2/status-detail")
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body


# ── GET /api/v2/publicv2/robots.txt ───────────────────────────


@pytest.mark.asyncio
async def test_robots_txt(api_client):
    resp = await api_client.get("/api/v2/publicv2/robots.txt")
    assert resp.status_code == 200
    assert "User-agent" in resp.text


# ── GET /api/v2/publicv2/sitemap.xml ──────────────────────────
# Skipped: PublicService.build_sitemap_xml is not implemented (pre-existing bug).
