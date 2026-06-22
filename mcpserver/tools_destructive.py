"""Destructive MCP tools — confirm-first (Task 4).

Each tool carries destructiveHint=True and refuses to execute until
confirm=True is passed, enforcing explicit in-conversation confirmation
at the tool layer regardless of client behaviour.
"""
from app.models.medication import CHANGE_TYPES, MedicationChange
from app.services import appointments, grocery, medications
from mcpserver.context import session, resolve_person, admin_user_id
from mcpserver.server import mcp


def _need_confirm(action: str) -> dict:
    return {
        "confirmation_required": True,
        "message": f"This will {action}. Re-call with confirm=true to proceed.",
    }


def _record_typed(db, person_id, change_type, summary, reason, medication_id):
    """Write a typed history row verbatim — append-only, no regimen mutation."""
    c = MedicationChange(
        person_id=person_id,
        medication_id=medication_id,
        change_type=change_type,
        summary=summary,
        reason=reason,
        recorded_by=admin_user_id(db),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@mcp.tool(annotations={"destructiveHint": True})
def familyhub_cancel_appointment(appointment_id: int, confirm: bool = False) -> dict:
    """Cancel an appointment. Destructive — requires confirm=true to execute."""
    with session() as db:
        a = appointments.get(db, appointment_id)
        if a is None:
            raise ValueError(f"No appointment with id {appointment_id}.")
        if not confirm:
            return _need_confirm(f"cancel '{a.title}' on {a.start:%Y-%m-%d %H:%M}")
        appointments.cancel(db, appointment_id)
        return {"done": True, "summary": f"Cancelled '{a.title}'."}


@mcp.tool(annotations={"destructiveHint": True})
def familyhub_clear_checked(confirm: bool = False) -> dict:
    """Remove all checked grocery items. Destructive — requires confirm=true to execute."""
    with session() as db:
        pending = [i for i in grocery.list_items(db) if i.checked]
        if not confirm:
            return _need_confirm(f"permanently remove {len(pending)} checked grocery item(s)")
        n = grocery.clear_checked(db)
        return {"done": True, "summary": f"Removed {n} checked item(s)."}


@mcp.tool(annotations={"destructiveHint": True})
def familyhub_log_medication_change(
    person: str,
    change_type: str,
    summary: str,
    reason: str | None = None,
    medication_id: int | None = None,
    confirm: bool = False,
) -> dict:
    """Append a medication-history record EXACTLY as stated. change_type must be one of:
    added, stopped, dose_changed, note. Never computes or suggests a dose.
    Requires confirm=true to execute."""
    if change_type not in CHANGE_TYPES:
        raise ValueError(f"change_type must be one of: {', '.join(CHANGE_TYPES)}.")
    with session() as db:
        p = resolve_person(db, person)
        if not confirm:
            return _need_confirm(
                f"record a '{change_type}' change for {p.name}: \"{summary}\""
            )
        if change_type == "note":
            medications.add_note(
                db,
                person_id=p.id,
                summary=summary,
                recorded_by=admin_user_id(db),
                medication_id=medication_id,
            )
        else:
            _record_typed(db, p.id, change_type, summary, reason, medication_id)
        return {"done": True, "summary": f"Recorded for {p.name}: {summary}."}
