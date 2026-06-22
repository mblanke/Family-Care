from datetime import datetime, UTC
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.todo import Todo

def _now() -> datetime: return datetime.now(UTC).replace(tzinfo=None)

def list_todos(db: Session) -> list[Todo]:
    open_ = db.scalars(select(Todo).where(Todo.done.is_(False)).order_by(Todo.created_at)).all()
    done_ = db.scalars(select(Todo).where(Todo.done.is_(True)).order_by(Todo.done_at.desc())).all()
    return list(open_) + list(done_)

def add(db: Session, *, text: str, created_by: int, assignee_id: int | None = None) -> Todo:
    t = Todo(text=text, created_by=created_by, assignee_id=assignee_id)
    db.add(t); db.commit(); db.refresh(t)
    return t

def set_done(db: Session, todo_id: int, done: bool) -> Todo | None:
    t = db.get(Todo, todo_id)
    if t is None: return None
    t.done = done; t.done_at = _now() if done else None
    db.commit(); db.refresh(t)
    return t

def edit(db: Session, todo_id: int, *, text: str) -> Todo | None:
    t = db.get(Todo, todo_id)
    if t is None: return None
    t.text = text; db.commit(); db.refresh(t)
    return t

def delete(db: Session, todo_id: int) -> bool:
    t = db.get(Todo, todo_id)
    if t is None: return False
    db.delete(t); db.commit()
    return True
