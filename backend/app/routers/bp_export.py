from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from datetime import datetime, timedelta, UTC
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user
from app.services import bp, people

router = APIRouter(prefix="/api", tags=["bp-export"])


@router.get("/people/{pid}/bp/export", response_class=HTMLResponse)
def export(pid: int, days: int = 90, db: Session = Depends(get_db), _=Depends(current_user)):
    person = people.get_person(db, pid)
    if person is None:
        raise HTTPException(404, "Person not found")
    since = None if days == 0 else datetime.now(UTC).replace(tzinfo=None) - timedelta(days=days)
    rows = bp.list_readings(db, pid, since=since)
    target = bp.get_target(db, pid)
    trs = "".join(
        f"<tr><td>{r.taken_at:%Y-%m-%d %H:%M}</td><td>{r.systolic}/{r.diastolic}</td>"
        f"<td>{r.pulse or ''}</td><td>{r.note or ''}</td></tr>" for r in rows
    )
    tgt = (
        f"<p>Doctor's target ({target.doctor_label}): systolic {target.sys_low}–{target.sys_high}, "
        f"diastolic {target.dia_low}–{target.dia_high}</p>"
    ) if target else ""
    return f"""<!doctype html><html><head><meta charset="utf-8">
<title>BP summary — {person.name}</title>
<style>body{{font-family:system-ui;font-size:16px;padding:24px}}
table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #999;padding:6px;text-align:left}}</style>
</head><body>
<h1>Blood pressure summary — {person.name}</h1>
<p>Last {days or 'all'} days · {len(rows)} readings · generated for sharing with a clinician.</p>
{tgt}
<table><thead><tr><th>When</th><th>BP</th><th>Pulse</th><th>Note</th></tr></thead><tbody>{trs}</tbody></table>
<p style="margin-top:16px;font-style:italic">A personal record — not medical advice.</p>
</body></html>"""
