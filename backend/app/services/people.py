from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.person import Person


def list_people(db: Session) -> list[Person]:
    return list(db.scalars(select(Person).order_by(Person.sort_order, Person.id)))


def get_person(db: Session, person_id: int) -> Person | None:
    return db.get(Person, person_id)


def get_person_by_slug(db: Session, slug: str) -> Person | None:
    return db.scalar(select(Person).where(Person.slug == slug))


def create_person(
    db: Session, *, name: str, slug: str, color: str, sort_order: int = 0
) -> Person:
    p = Person(name=name, slug=slug, color=color, sort_order=sort_order)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
