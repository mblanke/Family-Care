from datetime import datetime
from app.services import appointments as appt
from app.services import auth

def _admin(db): return auth.create_user(db, username="a", password="p", display_name="A", role="admin")

def test_create_and_list_single(db):
    u = _admin(db)
    a = appt.create(db, title="Cardiology", start=datetime(2026, 7, 2, 14, 0),
                    needs_ride=True, person_id=None, created_by=u.id)
    occ = appt.list_between(db, datetime(2026, 7, 1), datetime(2026, 7, 31))
    assert len(occ) == 1 and occ[0].needs_ride and occ[0].title == "Cardiology"
    assert occ[0].appointment_id == a.id

def test_monthly_recurrence_expands(db):
    u = _admin(db)
    appt.create(db, title="Pay bills at bank", start=datetime(2026, 7, 5, 10, 0),
                location="Bank", recurrence="monthly", recur_day=5, created_by=u.id)
    occ = appt.list_between(db, datetime(2026, 7, 1), datetime(2026, 9, 30))
    assert [o.start.month for o in occ] == [7, 8, 9]
    assert all(o.location == "Bank" for o in occ)

def test_cancel_hides_from_list(db):
    u = _admin(db)
    a = appt.create(db, title="X", start=datetime(2026, 7, 2, 9, 0), created_by=u.id)
    assert appt.cancel(db, a.id) is True
    assert appt.list_between(db, datetime(2026, 7, 1), datetime(2026, 7, 31)) == []
