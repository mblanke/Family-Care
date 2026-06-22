from pydantic import BaseModel

class LoginIn(BaseModel):
    username: str
    password: str

class FontScaleIn(BaseModel):
    font_scale: str  # "normal" | "large"

class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    role: str
    font_scale: str
    person_id: int | None
    class Config: from_attributes = True

class PersonOut(BaseModel):
    id: int
    name: str
    slug: str
    color: str
    class Config: from_attributes = True
