"""Unit tests for StaticTokenVerifier bearer-auth."""

import pytest
from mcpserver.server import StaticTokenVerifier


@pytest.mark.asyncio
async def test_correct_token_returns_access_token():
    verifier = StaticTokenVerifier("secret")
    result = await verifier.verify_token("secret")
    assert result is not None
    assert result.client_id == "familyhub-admin"


@pytest.mark.asyncio
async def test_wrong_token_returns_none():
    verifier = StaticTokenVerifier("secret")
    result = await verifier.verify_token("wrong")
    assert result is None


@pytest.mark.asyncio
async def test_empty_token_returns_none():
    verifier = StaticTokenVerifier("secret")
    result = await verifier.verify_token("")
    assert result is None
