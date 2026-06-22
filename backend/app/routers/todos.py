from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user
from app.models.user import User
from app.schemas.todo import TodoIn, TodoDoneIn, TodoOut
from app.services import todos as svc

router = APIRouter(prefix="/api/todos", tags=["todos"])

@router.get("", response_model=list[TodoOut])
def list_(db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.list_todos(db)

@router.post("", response_model=TodoOut)
def add(body: TodoIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return svc.add(db, text=body.text, created_by=user.id, assignee_id=body.assignee_id)

@router.put("/{todo_id}", response_model=TodoOut)
def edit(todo_id: int, body: TodoIn, db: Session = Depends(get_db), _=Depends(current_user)):
    t = svc.edit(db, todo_id, text=body.text)
    if t is None: raise HTTPException(404, "Todo not found")
    return t

@router.post("/{todo_id}/done", response_model=TodoOut)
def done(todo_id: int, body: TodoDoneIn, db: Session = Depends(get_db), _=Depends(current_user)):
    t = svc.set_done(db, todo_id, body.done)
    if t is None: raise HTTPException(404, "Todo not found")
    return t

@router.delete("/{todo_id}")
def delete(todo_id: int, db: Session = Depends(get_db), _=Depends(current_user)):
    if not svc.delete(db, todo_id): raise HTTPException(404, "Todo not found")
    return {"ok": True}
