from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.contact import Contact


def list_contacts(db: Session) -> list[Contact]:
    return list(db.scalars(
        select(Contact).order_by(Contact.is_emergency.desc(), Contact.sort_order, Contact.name)
    ))


def create(
    db: Session,
    *,
    name: str,
    role: str,
    phone: str,
    address: str | None = None,
    notes: str | None = None,
    person_id: int | None = None,
    is_emergency: bool = False,
    sort_order: int = 0,
) -> Contact:
    c = Contact(
        name=name,
        role=role,
        phone=phone,
        address=address,
        notes=notes,
        person_id=person_id,
        is_emergency=is_emergency,
        sort_order=sort_order,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def update(db: Session, contact_id: int, **fields) -> Contact | None:
    c = db.get(Contact, contact_id)
    if c is None:
        return None
    for k, v in fields.items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


def delete(db: Session, contact_id: int) -> bool:
    c = db.get(Contact, contact_id)
    if c is None:
        return False
    db.delete(c)
    db.commit()
    return True
