from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_display_name: str = "Home Board"
    app_timezone: str = "America/Toronto"
    database_url: str = "postgresql+psycopg://familyhub:familyhub@db:5432/familyhub"
    session_secret: str = "dev-insecure-secret-change-me"
    admin_username: str = "admin"
    admin_password: str = "admin"
    mcp_token: str = "dev-mcp-token"

@lru_cache
def get_settings() -> Settings:
    return Settings()
