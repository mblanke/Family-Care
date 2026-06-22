import pytest
from app.services import med_scan

def test_parse_candidates_maps_fields_and_normalizes_slot():
    payload = {"medications": [
        {"name": "Amlodipine", "dose": "5 mg", "time_of_day": "Morning", "prescriber": "Dr. Lee"},
        {"name": "Atorvastatin", "dose": "20 mg", "time_of_day": "at bedtime", "prescriber": None},
        {"name": "Mystery", "dose": "1 tab", "time_of_day": "whenever", "prescriber": None},
    ]}
    out = med_scan.parse_candidates(payload)
    assert [m.name for m in out] == ["Amlodipine", "Atorvastatin", "Mystery"]
    assert out[0].slot == "morning"
    assert out[1].slot == "bedtime"
    assert out[2].slot == "morning"          # unknown → default, never guessed/dropped

def test_normalize_slot_known_and_unknown():
    assert med_scan.normalize_slot("NOON") == "noon"
    assert med_scan.normalize_slot("supper-time") == "evening"   # 'evening' synonyms map
    assert med_scan.normalize_slot("") == "morning"

def test_get_extractor_unconfigured_raises_actionable(monkeypatch):
    monkeypatch.setenv("LLM_ROUTER_URL", "")
    from app.config import get_settings; get_settings.cache_clear()
    ex = med_scan.get_extractor()
    with pytest.raises(med_scan.ScanUnavailable) as e:
        ex.extract(b"fake-image-bytes")
    assert "LLM_ROUTER_URL" in str(e.value)
