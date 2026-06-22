FROM python:3.13-slim
WORKDIR /app
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir .
COPY backend/ ./
COPY mcp/ ./mcp/
EXPOSE 8765
CMD ["python", "-m", "mcp.server"]
