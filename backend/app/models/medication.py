from datetime import datetime, date, UTC
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

MED_SLOTS = ("morning", "noon", "evening", "bedtime")
CHANGE_TYPES = ("added", "stopped", "dose_changed", "note")


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Medication(Base):
    __tablename__ = "medications"
    id: Mapped[int] = mapped_column(primary_key=True)
    person_id: Mapped[int] = mapped_column(
        ForeignKey("people.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(nullable=False)
    dose: Mapped[str] = mapped_column(nullable=False)  # human text; app never computes
    purpose: Mapped[str | None] = mapped_column(nullable=True)
    slot: Mapped[str] = mapped_column(default="morning", nullable=False)
    prescriber: Mapped[str | None] = mapped_column(nullable=True)
    prn: Mapped[bool] = mapped_column(default=False, nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    pack_pickup: Mapped[date | None] = mapped_column(nullable=True)


class MedicationChange(Base):
    __tablename__ = "medication_changes"
    id: Mapped[int] = mapped_column(primary_key=True)
    person_id: Mapped[int] = mapped_column(
        ForeignKey("people.id"), nullable=False, index=True
    )
    medication_id: Mapped[int | None] = mapped_column(
        ForeignKey("medications.id"), nullable=True
    )
    change_type: Mapped[str] = mapped_column(nullable=False)
    summary: Mapped[str] = mapped_column(nullable=False)
    reason: Mapped[str | None] = mapped_column(nullable=True)
    recorded_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(default=_now, nullable=False)
    photo_path: Mapped[str | None] = mapped_column(nullable=True)
