"""Read-only MCP tools — implemented in Task 2."""
from datetime import date, datetime, timedelta, UTC
from zoneinfo import ZoneInfo

from app.config import get_settings
from app.services import today as today_svc, grocery, birthdays, medications, bp
from mcpserver.context import session, resolve_person
from mcpserver.server import mcp


def _today() -> date:
    return datetime.now(UTC).astimezone(ZoneInfo(get_settings().app_timezone)).date()


def _occ(o) -> dict:
    return {
        "appointment_id": o.appointment_id,
        "title": o.title,
        "start": o.start.isoformat(),
        "location": o.location,
        "needs_ride": o.needs_ride,
        "person_id": o.person_id,
    }


@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_get_today() -> dict:
    """Today's appointments, ride-needed items, open to-dos, and upcoming birthdays."""
    with session() as db:
        r = today_svc.today_rollup(db, today=_today())
        appts = [_occ(o) for o in r["appointments"]]
        rides = [_occ(o) for o in r["rides_today"]]
        todos = [{"id": t.id, "text": t.text} for t in r["open_todos"]]
        bdays = [{"name": b.name, "days_until": b.days_until} for b in r["upcoming_birthdays"]]
        summary = (
            f"{len(appts)} appointment(s) today, {len(rides)} need a ride; "
            f"{len(todos)} open to-do(s); {len(bdays)} birthday(s) coming up."
        )
        return {
            "appointments": appts,
            "rides_today": rides,
            "todos": todos,
            "upcoming_birthdays": bdays,
            "summary": summary,
        }


@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_get_week(week_start: str | None = None) -> dict:
    """This week's agenda plus the driver roll-up. week_start is an ISO date (YYYY-MM-DD) or omitted for the current week."""
    ws = date.fromisoformat(week_start) if week_start else _today()
    with session() as db:
        r = today_svc.week_rollup(db, week_start=ws)
        driver_runs = [_occ(o) for o in r["driver_runs"]]
        days = [
            {
                "date": (ws + timedelta(days=i)).isoformat(),
                "appointments": [_occ(o) for o in r["days"][i]],
            }
            for i in range(7)
        ]
        total = sum(len(d["appointments"]) for d in days)
        summary = f"{total} appointment(s) this week; {len(driver_runs)} ride(s) to drive."
        return {
            "week_start": ws.isoformat(),
            "days": days,
            "driver_runs": driver_runs,
            "summary": summary,
        }


@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_list_grocery(store: str = "all") -> dict:
    """List grocery items, optionally filtered by store: costco, grocery, either, or all."""
    with session() as db:
        items = grocery.list_items(db, None if store == "all" else store)
        out = [
            {"id": i.id, "name": i.name, "store": i.store, "qty": i.qty, "checked": i.checked}
            for i in items
        ]
        names = ", ".join(i["name"] for i in out if not i["checked"]) or "nothing unchecked"
        return {"items": out, "summary": f"{store} list: {names}."}


@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_list_upcoming_birthdays(within_days: int = 30) -> dict:
    """Upcoming birthdays within the given number of days (default 30)."""
    with session() as db:
        up = birthdays.upcoming(db, today=_today(), within_days=within_days)
        out = [
            {
                "name": b.name,
                "next_date": b.next_date.isoformat(),
                "days_until": b.days_until,
                "turning": b.turning,
            }
            for b in up
        ]
        summary = "; ".join(f"{b['name']} in {b['days_until']}d" for b in out) or "none"
        return {"birthdays": out, "summary": summary}


@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_get_medications(person: str) -> dict:
    """Current medication regimen and recent change history for a person. Read-only; not medical advice."""
    with session() as db:
        p = resolve_person(db, person)
        reg = [
            {
                "name": m.name,
                "dose": m.dose,
                "slot": m.slot,
                "prn": m.prn,
                "active": m.active,
                "purpose": m.purpose,
                "prescriber": m.prescriber,
            }
            for m in medications.list_regimen(db, p.id)
            if m.active
        ]
        hist = [
            {
                "date": c.recorded_at.date().isoformat(),
                "change_type": c.change_type,
                "summary": c.summary,
                "reason": c.reason,
            }
            for c in medications.history(db, p.id)[:20]
        ]
        return {
            "person": p.name,
            "regimen": reg,
            "recent_changes": hist,
            "summary": (
                f"{p.name} is on {len(reg)} active medication(s). "
                "This is a record, not medical advice."
            ),
        }


@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_list_bp(person: str, days: int = 30) -> dict:
    """Recent blood-pressure readings for a person. Returns data only — no interpretation beyond the doctor's recorded target."""
    with session() as db:
        p = resolve_person(db, person)
        since = (
            None
            if days == 0
            else datetime.now(UTC).replace(tzinfo=None) - timedelta(days=days)
        )
        target = bp.get_target(db, p.id)
        rows = bp.list_readings(db, p.id, since=since)[:30]
        out = [
            {
                "taken_at": r.taken_at.isoformat(),
                "systolic": r.systolic,
                "diastolic": r.diastolic,
                "pulse": r.pulse,
                "status": bp.status_for(r, target),
            }
            for r in rows
        ]
        tgt = (
            {
                "sys": [target.sys_low, target.sys_high],
                "dia": [target.dia_low, target.dia_high],
                "doctor": target.doctor_label,
            }
            if target
            else None
        )
        summary = f"{len(out)} reading(s) for {p.name} in the last {days or 'all'} days."
        return {"person": p.name, "readings": out, "target": tgt, "summary": summary}
