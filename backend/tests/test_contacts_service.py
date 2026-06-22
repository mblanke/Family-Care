from app.services import contacts


def test_emergency_sorts_first_then_name(db):
    contacts.create(db, name="Dr. Lee", role="doctor", phone="555-1000", sort_order=1)
    contacts.create(db, name="Ambulance", role="paramedics", phone="911", is_emergency=True)
    contacts.create(db, name="Aimee OT", role="occupational_therapist", phone="555-2000", sort_order=0)
    names = [c.name for c in contacts.list_contacts(db)]
    assert names[0] == "Ambulance"                 # emergency pinned first
    assert names[1:] == ["Aimee OT", "Dr. Lee"]    # then by sort_order


def test_update_and_delete(db):
    c = contacts.create(db, name="Pharmacy", role="pharmacist", phone="555-3000")
    contacts.update(db, c.id, phone="555-3001")
    assert contacts.list_contacts(db)[0].phone == "555-3001"
    assert contacts.delete(db, c.id) is True
    assert contacts.list_contacts(db) == []
