from app.models.medication import Medication, MedicationChange, MED_SLOTS, CHANGE_TYPES


def test_models_define_slots_and_change_types(db):
    m = Medication(person_id=1, name="Amlodipine", dose="5 mg", slot="morning")
    db.add(m)
    db.commit()
    db.refresh(m)
    assert m.active is True and m.prn is False
    assert set(MED_SLOTS) == {"morning", "noon", "evening", "bedtime"}
    assert set(CHANGE_TYPES) == {"added", "stopped", "dose_changed", "note"}
    c = MedicationChange(
        person_id=1,
        medication_id=m.id,
        change_type="added",
        summary="Started Amlodipine 5 mg",
        recorded_by=1,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    assert c.recorded_at is not None
