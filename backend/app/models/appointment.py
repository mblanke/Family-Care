from datetime import datetime
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class Appointment(Base):
    __tablename__ = "appointments"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(nullable=False)
    start: Mapped[datetime] = mapped_column(nullable=False, index=True)   # UTC
    end: Mapped[datetime | None] = mapped_column(nullable=True)
    location: Mapped[str | None] = mapped_column(nullable=True)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    for_both: Mapped[bool] = mapped_column(default=False, nullable=False)
    needs_ride: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(nullable=True)
    recurrence: Mapped[str] = mapped_column(default="none", nullable=False)  # none | monthly
    recur_day: Mapped[int | None] = mapped_column(nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    canceled: Mapped[bool] = mapped_column(default=False, nullable=False)
