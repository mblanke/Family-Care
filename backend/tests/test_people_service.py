from app.services import people


def test_create_and_fetch_person(db):
    p = people.create_person(db, name="Dad", slug="dad", color="#1f6feb", sort_order=0)
    assert p.id is not None
    assert people.get_person_by_slug(db, "dad").name == "Dad"
    assert [x.name for x in people.list_people(db)] == ["Dad"]


def test_list_people_orders_by_sort_order(db):
    people.create_person(db, name="Mom", slug="mom", color="#a371f7", sort_order=1)
    people.create_person(db, name="Dad", slug="dad", color="#1f6feb", sort_order=0)
    assert [x.name for x in people.list_people(db)] == ["Dad", "Mom"]
