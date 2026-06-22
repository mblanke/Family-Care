from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.medication import Medication, MedicationChange, MED_SLOTS

_SLOT_ORDER = {s: i for i, s in enumerate(MED_SLOTS)}


def list_regimen(db: Session, person_id: int) -> list[Medication]:
    rows = db.scalars(select(Medication).where(Medication.person_id == person_id)).all()
    return sorted(rows, key=lambda m: (not m.active, _SLOT_ORDER.get(m.slot, 9), m.name))


def history(db: Session, person_id: int) -> list[MedicationChange]:
    return list(db.scalars(
        select(MedicationChange).where(MedicationChange.person_id == person_id)
        .order_by(MedicationChange.recorded_at.desc(), MedicationChange.id.desc())))


def _log(db, *, person_id, medication_id, change_type, summary, reason, recorded_by) -> MedicationChange:
    c = MedicationChange(
        person_id=person_id,
        medication_id=medication_id,
        change_type=change_type,
        summary=summary,
        reason=reason,
        recorded_by=recorded_by,
    )
    db.add(c)
    return c


def add_med(
    db: Session,
    *,
    person_id,
    name,
    dose,
    slot,
    recorded_by,
    purpose=None,
    prescriber=None,
    prn=False,
    reason=None,
) -> Medication:
    m = Medication(
        person_id=person_id,
        name=name,
        dose=dose,
        slot=slot,
        purpose=purpose,
        prescriber=prescriber,
        prn=prn,
    )
    db.add(m)
    db.flush()
    _log(
        db,
        person_id=person_id,
        medication_id=m.id,
        change_type="added",
        summary=f"Started {name} {dose} ({slot})",
        reason=reason,
        recorded_by=recorded_by,
    )
    db.commit()
    db.refresh(m)
    return m


def change_dose(
    db: Session, *, medication_id, new_dose, recorded_by, reason=None
) -> Medication | None:
    m = db.get(Medication, medication_id)
    if m is None:
        return None
    old = m.dose
    m.dose = new_dose
    _log(
        db,
        person_id=m.person_id,
        medication_id=m.id,
        change_type="dose_changed",
        summary=f"{m.name} dose changed from {old} to {new_dose}",
        reason=reason,
        recorded_by=recorded_by,
    )
    db.commit()
    db.refresh(m)
    return m


def stop_med(
    db: Session, *, medication_id, recorded_by, reason=None
) -> Medication | None:
    m = db.get(Medication, medication_id)
    if m is None:
        return None
    m.active = False
    _log(
        db,
        person_id=m.person_id,
        medication_id=m.id,
        change_type="stopped",
        summary=f"Stopped {m.name}",
        reason=reason,
        recorded_by=recorded_by,
    )
    db.commit()
    db.refresh(m)
    return m


def add_note(
    db: Session, *, person_id, summary, recorded_by, medication_id=None
) -> MedicationChange:
    c = _log(
        db,
        person_id=person_id,
        medication_id=medication_id,
        change_type="note",
        summary=summary,
        reason=None,
        recorded_by=recorded_by,
    )
    db.commit()
    db.refresh(c)
    return c
