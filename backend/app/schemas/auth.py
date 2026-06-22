from pydantic import BaseModel, ConfigDict

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
    model_config = ConfigDict(from_attributes=True)

class PersonOut(BaseModel):
    id: int
    name: str
    slug: str
    color: str
    model_config = ConfigDict(from_attributes=True)
