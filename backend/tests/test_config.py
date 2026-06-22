from app.config import get_settings

def test_settings_read_from_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@db:5432/x")
    monkeypatch.setenv("SESSION_SECRET", "s" * 64)
    monkeypatch.setenv("APP_DISPLAY_NAME", "Hearth")
    get_settings.cache_clear()
    s = get_settings()
    assert s.app_display_name == "Hearth"
    assert s.app_timezone == "America/Toronto"   # default
    assert str(s.database_url).startswith("postgresql+psycopg://")
