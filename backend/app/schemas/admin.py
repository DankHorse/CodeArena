from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class RoleUpdate(BaseModel):
    role: Literal["participant", "organizer"]


class RoleUpdateResponse(BaseModel):
    id: UUID
    role: str
