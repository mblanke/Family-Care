from typing import Literal
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

ROLES = ("admin", "family", "parent")
Role = Literal["admin", "family", "parent"]


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(nullable=False)
    display_name: Mapped[str] = mapped_column(nullable=False)
    role: Mapped[str] = mapped_column(nullable=False)
    font_scale: Mapped[str] = mapped_column(default="normal", nullable=False)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
