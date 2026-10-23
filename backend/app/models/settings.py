from sqlalchemy import Column, String, Text, Boolean
from backend.app.models.base import BaseModel

class SystemSetting(BaseModel):
    __tablename__ = "system_settings"
    
    key = Column(String(100), unique=True, index=True, nullable=False)
    value_json = Column(Text, nullable=False)
    is_encrypted = Column(Boolean, default=False, nullable=False)
    description = Column(String(255), nullable=True)
