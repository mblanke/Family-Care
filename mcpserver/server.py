"""FastMCP server entry-point for family-hub.

Auth (fastmcp 3.4.2):
  Bearer-token protection is wired via the `auth` kwarg on FastMCP(), which
  accepts an AuthProvider object (a TokenVerifier subclass from
  fastmcp.server.auth).  The run() call does NOT accept an `auth` argument —
  auth must be set at construction time.

  When MCP_TOKEN is set the server requires a matching Bearer token on every
  request.  When MCP_TOKEN is unset (local stdio dev) the server runs
  unauthenticated.  In production the container always sets MCP_TOKEN from
  .env and the service is Tailscale-bound, so it is never publicly reachable.
"""

import os
import secrets

from fastmcp import FastMCP
from fastmcp.server.auth import AccessToken, TokenVerifier


class StaticTokenVerifier(TokenVerifier):
    """Verifies that the incoming Bearer token matches a fixed secret."""

    def __init__(self, token: str) -> None:
        super().__init__()
        self._token = token

    async def verify_token(self, token: str) -> AccessToken | None:
        if token and self._token and secrets.compare_digest(token, self._token):
            return AccessToken(token=token, client_id="familyhub-admin", scopes=[])
        return None


_TOKEN = os.environ.get("MCP_TOKEN", "")

mcp = FastMCP(
    name="family-hub",
    auth=StaticTokenVerifier(_TOKEN) if _TOKEN else None,
)

# Tool modules register their tools against `mcp` on import (filled in Tasks 2-4).
from mcpserver import tools_read, tools_write, tools_destructive  # noqa: F401,E402

if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=8765)
