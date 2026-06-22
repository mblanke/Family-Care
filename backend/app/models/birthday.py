from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class Birthday(Base):
    __tablename__ = "birthdays"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    month: Mapped[int] = mapped_column(nullable=False)
    day: Mapped[int] = mapped_column(nullable=False)
    year: Mapped[int | None] = mapped_column(nullable=True)
