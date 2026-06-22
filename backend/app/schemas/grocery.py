from pydantic import BaseModel, ConfigDict


class GroceryIn(BaseModel):
    name: str
    store: str = "either"
    qty: int = 1


class GroceryCheckIn(BaseModel):
    checked: bool


class GroceryQtyIn(BaseModel):
    qty: int


class GroceryNameIn(BaseModel):
    name: str


class GroceryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    store: str
    qty: int
    checked: bool
