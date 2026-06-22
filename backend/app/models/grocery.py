from datetime import datetime
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class GroceryItem(Base):
    __tablename__ = "grocery_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    store: Mapped[str] = mapped_column(default="either", nullable=False)  # costco | grocery | either
    qty: Mapped[int] = mapped_column(default=1, nullable=False)
    checked: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    checked_at: Mapped[datetime | None] = mapped_column(nullable=True)
