from datetime import datetime
from pydantic import BaseModel, ConfigDict

class TodoIn(BaseModel):
    text: str
    assignee_id: int | None = None

class TodoDoneIn(BaseModel):
    done: bool

class TodoOut(BaseModel):
    id: int
    text: str
    done: bool
    assignee_id: int | None
    done_at: datetime | None
    model_config = ConfigDict(from_attributes=True)
