FROM python:3.13-slim
WORKDIR /app
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir .
COPY backend/ ./
COPY mcpserver/ ./mcpserver/
EXPOSE 8765
# Package is named `mcpserver` (NOT `mcp`) to avoid shadowing the `mcp` SDK that FastMCP imports.
CMD ["python", "-m", "mcpserver.server"]
