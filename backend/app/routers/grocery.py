from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user
from app.models.user import User
from app.schemas.grocery import GroceryIn, GroceryCheckIn, GroceryQtyIn, GroceryNameIn, GroceryOut
from app.services import grocery as svc

router = APIRouter(prefix="/api/grocery", tags=["grocery"])


@router.get("", response_model=list[GroceryOut])
def list_(store: str | None = Query(None), db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.list_items(db, store=store)


@router.post("", response_model=GroceryOut)
def add(body: GroceryIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return svc.add(db, name=body.name, store=body.store, qty=body.qty, created_by=user.id)


@router.post("/clear-checked")
def clear_checked(db: Session = Depends(get_db), _=Depends(current_user)):
    return {"removed": svc.clear_checked(db)}


@router.put("/{item_id}", response_model=GroceryOut)
def edit(item_id: int, body: GroceryNameIn, db: Session = Depends(get_db), _=Depends(current_user)):
    g = svc.edit(db, item_id, name=body.name)
    if g is None: raise HTTPException(404, "Item not found")
    return g


@router.post("/{item_id}/check", response_model=GroceryOut)
def check(item_id: int, body: GroceryCheckIn, db: Session = Depends(get_db), _=Depends(current_user)):
    g = svc.set_checked(db, item_id, body.checked)
    if g is None: raise HTTPException(404, "Item not found")
    return g


@router.post("/{item_id}/qty", response_model=GroceryOut)
def qty(item_id: int, body: GroceryQtyIn, db: Session = Depends(get_db), _=Depends(current_user)):
    g = svc.set_qty(db, item_id, body.qty)
    if g is None: raise HTTPException(404, "Item not found")
    return g


@router.delete("/{item_id}")
def delete(item_id: int, db: Session = Depends(get_db), _=Depends(current_user)):
    if not svc.delete(db, item_id): raise HTTPException(404, "Item not found")
    return {"ok": True}
