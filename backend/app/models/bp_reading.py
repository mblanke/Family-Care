from datetime import datetime, UTC
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class BpReading(Base):
    __tablename__ = "bp_readings"
    id: Mapped[int] = mapped_column(primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), nullable=False, index=True)
    systolic: Mapped[int] = mapped_column(nullable=False)
    diastolic: Mapped[int] = mapped_column(nullable=False)
    pulse: Mapped[int | None] = mapped_column(nullable=True)
    taken_at: Mapped[datetime] = mapped_column(default=_now, nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(nullable=True)
    recorded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)


class BpTarget(Base):
    __tablename__ = "bp_targets"
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), primary_key=True)
    sys_low: Mapped[int] = mapped_column(nullable=False)
    sys_high: Mapped[int] = mapped_column(nullable=False)
    dia_low: Mapped[int] = mapped_column(nullable=False)
    dia_high: Mapped[int] = mapped_column(nullable=False)
    doctor_label: Mapped[str] = mapped_column(nullable=False)
