from datetime import date, datetime, timedelta, UTC
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db import get_db
from app.deps import current_user
from app.schemas.today import TodayOut, WeekOut, DayOut
from app.services import today as svc

router = APIRouter(prefix="/api", tags=["today"])


def _local_today() -> date:
    return datetime.now(UTC).astimezone(ZoneInfo(get_settings().app_timezone)).date()


@router.get("/today", response_model=TodayOut)
def today(db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.today_rollup(db, today=_local_today())


@router.get("/week", response_model=WeekOut)
def week(start: date | None = Query(None), db: Session = Depends(get_db), _=Depends(current_user)):
    ws = start or _local_today()
    roll = svc.week_rollup(db, week_start=ws)
    days = [DayOut(date=ws + timedelta(days=i), appointments=roll["days"][i]) for i in range(7)]
    return WeekOut(week_start=ws, days=days, driver_runs=roll["driver_runs"])
