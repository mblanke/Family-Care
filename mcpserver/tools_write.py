"""Additive write tools for the family-hub MCP server (Task 3).

All tools proceed directly — no confirmation gate. Destructive operations
(cancel/delete) are a separate task. Admin scope: created_by/recorded_by
is always the configured admin user.
"""
from app.services import appointments, todos, grocery, birthdays, bp
from mcpserver.context import session, resolve_person, parse_when, admin_user_id
from mcpserver.server import mcp


def _person_id(db, who: str) -> tuple[int | None, bool]:
    """Return (person_id, for_both). who ∈ dad|mom|both (default both → person_id None)."""
    if who.lower() in ("both", "family", ""):
        return None, True
    return resolve_person(db, who).id, False


@mcp.tool()
def familyhub_add_appointment(
    title: str,
    when: str,
    who: str = "both",
    location: str | None = None,
    needs_ride: bool = False,
    notes: str | None = None,
) -> dict:
    """Add an appointment. `when` must be an explicit ISO datetime (e.g. 2026-07-02T14:00).
    `who` is dad, mom, or both. Set needs_ride when the admin must drive."""
    start = parse_when(when)
    with session() as db:
        pid, for_both = _person_id(db, who)
        a = appointments.create(
            db,
            title=title,
            start=start,
            location=location,
            person_id=pid,
            for_both=for_both,
            needs_ride=needs_ride,
            notes=notes,
            created_by=admin_user_id(db),
        )
        return {
            "appointment_id": a.id,
            "needs_ride": a.needs_ride,
            "summary": (
                f"Added '{title}' on {start:%Y-%m-%d %H:%M}"
                f"{' (needs a ride)' if needs_ride else ''}."
            ),
        }


@mcp.tool()
def familyhub_update_appointment(
    appointment_id: int,
    title: str | None = None,
    when: str | None = None,
    location: str | None = None,
    needs_ride: bool | None = None,
    notes: str | None = None,
) -> dict:
    """Update fields on an existing appointment. Only provided fields change. `when` is explicit ISO."""
    fields: dict = {}
    if title is not None:
        fields["title"] = title
    if when is not None:
        fields["start"] = parse_when(when)
    if location is not None:
        fields["location"] = location
    if needs_ride is not None:
        fields["needs_ride"] = needs_ride
    if notes is not None:
        fields["notes"] = notes
    with session() as db:
        a = appointments.update(db, appointment_id, **fields)
        if a is None:
            raise ValueError(f"No appointment with id {appointment_id}.")
        return {"appointment_id": a.id, "summary": f"Updated appointment {a.id} ('{a.title}')."}


@mcp.tool()
def familyhub_add_todo(text: str) -> dict:
    """Add a household to-do item. (No assignee from MCP — admin scope only.)"""
    with session() as db:
        t = todos.add(db, text=text, created_by=admin_user_id(db), assignee_id=None)
        return {"todo_id": t.id, "summary": f"Added to-do: {text}."}


@mcp.tool()
def familyhub_complete_todo(todo_id: int) -> dict:
    """Mark a to-do item done."""
    with session() as db:
        t = todos.set_done(db, todo_id, True)
        if t is None:
            raise ValueError(f"No to-do with id {todo_id}.")
        return {"todo_id": t.id, "summary": f"Checked off: {t.text}."}


@mcp.tool()
def familyhub_add_grocery_item(name: str, store: str = "either") -> dict:
    """Add a grocery item with a store tag: costco, grocery, or either."""
    if store not in ("costco", "grocery", "either"):
        raise ValueError("store must be one of: costco, grocery, either.")
    with session() as db:
        g = grocery.add(db, name=name, store=store, created_by=admin_user_id(db))
        return {"item_id": g.id, "summary": f"Added {name} to the {store} list."}


@mcp.tool()
def familyhub_check_grocery_item(item_id: int) -> dict:
    """Check off a grocery item (drops to the bottom of its group; not deleted)."""
    with session() as db:
        g = grocery.set_checked(db, item_id, True)
        if g is None:
            raise ValueError(f"No grocery item with id {item_id}.")
        return {"item_id": g.id, "summary": f"Checked off {g.name}."}


@mcp.tool()
def familyhub_add_birthday(name: str, month: int, day: int, year: int | None = None) -> dict:
    """Add an annual birthday."""
    with session() as db:
        b = birthdays.add(db, name=name, month=month, day=day, year=year)
        return {"birthday_id": b.id, "summary": f"Added {name}'s birthday ({month}/{day})."}


@mcp.tool()
def familyhub_log_bp(
    person: str,
    systolic: int,
    diastolic: int,
    pulse: int | None = None,
    note: str | None = None,
) -> dict:
    """Log a blood-pressure reading for a person (Dad or Mom). Records data only — no interpretation."""
    with session() as db:
        p = resolve_person(db, person)
        r = bp.log_reading(
            db,
            person_id=p.id,
            systolic=systolic,
            diastolic=diastolic,
            pulse=pulse,
            note=note,
            recorded_by=admin_user_id(db),
        )
        return {"reading_id": r.id, "summary": f"Logged {systolic}/{diastolic} for {p.name}."}
