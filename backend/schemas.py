from datetime import datetime
from typing import Optional

from pydantic import BaseModel

class SourceCreate(BaseModel):
    name: str
    url: str

class SourceOut(BaseModel):
    id: int
    name: str
    url: str
    is_active: bool

    class Config:
        from_attributes = True

class CompanyCreate(BaseModel):
    name: str

class CompanyOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class CrawlJobOut(BaseModel):
    id: int
    source_id: int
    status: str
    total_records: int
    inserted_records: int
    duplicate_records: int
    started_at: datetime
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True