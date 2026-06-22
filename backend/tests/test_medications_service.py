from app.services import medications as meds
from app.services import auth, people


def _setup(db):
    u = auth.create_user(db, username="a", password="p", display_name="A", role="admin")
    p = people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    return u, p


def test_add_logs_history(db):
    u, p = _setup(db)
    m = meds.add_med(db, person_id=p.id, name="Amlodipine", dose="10 mg", slot="morning", recorded_by=u.id)
    assert [x.name for x in meds.list_regimen(db, p.id)] == ["Amlodipine"]
    hist = meds.history(db, p.id)
    assert hist[0].change_type == "added" and "Amlodipine" in hist[0].summary


def test_dose_change_records_old_and_new_and_keeps_history(db):
    u, p = _setup(db)
    m = meds.add_med(db, person_id=p.id, name="Amlodipine", dose="10 mg", slot="morning", recorded_by=u.id)
    meds.change_dose(db, medication_id=m.id, new_dose="5 mg", recorded_by=u.id,
                     reason="Dr. Lee reduced after Feb stroke follow-up")
    reg = meds.list_regimen(db, p.id)
    assert reg[0].dose == "5 mg"
    hist = meds.history(db, p.id)        # newest first: dose_changed, then added — both kept
    assert hist[0].change_type == "dose_changed"
    assert "10 mg" in hist[0].summary and "5 mg" in hist[0].summary
    assert hist[1].change_type == "added"


def test_stop_marks_inactive_but_history_remains(db):
    u, p = _setup(db)
    m = meds.add_med(db, person_id=p.id, name="X", dose="1", slot="noon", recorded_by=u.id)
    meds.stop_med(db, medication_id=m.id, recorded_by=u.id)
    assert meds.list_regimen(db, p.id)[0].active is False
    assert any(h.change_type == "stopped" for h in meds.history(db, p.id))
