"""FastMCP server entry-point for family-hub.

Auth note (fastmcp 3.4.2):
  Bearer-token protection is wired via the `auth` kwarg on FastMCP(), which
  accepts an AuthProvider object (e.g. a TokenVerifier subclass from
  fastmcp.server.auth).  The run() / run_http_async() calls do NOT accept an
  `auth` argument — auth must be set at construction time.

  TODO (Task 5): subclass TokenVerifier to verify that the incoming Bearer
  token matches MCP_TOKEN and pass it as `FastMCP(name=..., auth=verifier)`.
  For now the server runs unauthenticated; the container is only reachable
  inside the Tailscale network (TAILSCALE_BIND in docker-compose.yml).
"""

import os
from fastmcp import FastMCP

mcp = FastMCP(name="family-hub")

# Tool modules register their tools against `mcp` on import (filled in Tasks 2-4).
from mcpserver import tools_read, tools_write, tools_destructive  # noqa: F401,E402

if __name__ == "__main__":
    _token = os.environ.get("MCP_TOKEN", "")  # noqa: F841 — reserved for auth wiring
    mcp.run(transport="http", host="0.0.0.0", port=8765)
