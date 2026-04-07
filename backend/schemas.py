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