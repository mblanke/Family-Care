from datetime import datetime, UTC
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.orm import Session
from app.models.grocery import GroceryItem


def _now(): return datetime.now(UTC).replace(tzinfo=None)


def list_items(db: Session, store: str | None = None) -> list[GroceryItem]:
    stmt = select(GroceryItem)
    if store and store != "all":
        stmt = stmt.where(GroceryItem.store == store)
    stmt = stmt.order_by(GroceryItem.checked, GroceryItem.id)
    return list(db.scalars(stmt))


def add(db: Session, *, name: str, store: str = "either", qty: int = 1, created_by: int) -> GroceryItem:
    g = GroceryItem(name=name, store=store, qty=qty, created_by=created_by)
    db.add(g); db.commit(); db.refresh(g)
    return g


def set_checked(db: Session, item_id: int, checked: bool) -> GroceryItem | None:
    g = db.get(GroceryItem, item_id)
    if g is None: return None
    g.checked = checked; g.checked_at = _now() if checked else None
    db.commit(); db.refresh(g)
    return g


def set_qty(db: Session, item_id: int, qty: int) -> GroceryItem | None:
    g = db.get(GroceryItem, item_id)
    if g is None: return None
    g.qty = max(1, qty); db.commit(); db.refresh(g)
    return g


def edit(db: Session, item_id: int, *, name: str) -> GroceryItem | None:
    g = db.get(GroceryItem, item_id)
    if g is None: return None
    g.name = name; db.commit(); db.refresh(g)
    return g


def delete(db: Session, item_id: int) -> bool:
    g = db.get(GroceryItem, item_id)
    if g is None: return False
    db.delete(g); db.commit()
    return True


def clear_checked(db: Session) -> int:
    n = db.execute(sa_delete(GroceryItem).where(GroceryItem.checked.is_(True))).rowcount
    db.commit()
    return n
