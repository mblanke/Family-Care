from datetime import datetime
from app.services import bp, auth, people


def _setup(db):
    u = auth.create_user(db, username="a", password="p", display_name="A", role="admin")
    p = people.create_person(db, name="Mom", slug="mom", color="#a371f7")
    return u, p


def test_log_and_list_newest_first(db):
    u, p = _setup(db)
    bp.log_reading(db, person_id=p.id, systolic=130, diastolic=80, recorded_by=u.id, taken_at=datetime(2026, 6, 20, 9))
    bp.log_reading(db, person_id=p.id, systolic=128, diastolic=78, recorded_by=u.id, taken_at=datetime(2026, 6, 21, 9))
    rows = bp.list_readings(db, p.id)
    assert [r.systolic for r in rows] == [128, 130]


def test_status_only_with_target_and_is_factual(db):
    u, p = _setup(db)
    r = bp.log_reading(db, person_id=p.id, systolic=145, diastolic=85, recorded_by=u.id)
    assert bp.status_for(r, None) is None        # no target → no status at all
    bp.set_target(db, person_id=p.id, sys_low=110, sys_high=135, dia_low=70, dia_high=85, doctor_label="Dr. Lee")
    t = bp.get_target(db, p.id)
    st = bp.status_for(r, t)
    assert st == {"systolic": "above", "diastolic": "within"}   # never "high"/"abnormal"
