from sqlalchemy import Column, String, Boolean, DateTime
from backend.app.models.base import BaseModel

class User(BaseModel):
    __tablename__ = "users"
    
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="candidate") # "admin", "candidate"
    is_active = Column(Boolean, nullable=False, default=True)
    gemini_api_key = Column(String(255), nullable=True)
    gemini_model = Column(String(100), nullable=True, default="gemini-2.5-flash")
    active_session_id = Column(String(64), nullable=True, index=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    @property
    def is_gemini_configured(self) -> bool:
        return bool(self.gemini_api_key and self.gemini_api_key.strip())

    @property
    def masked_gemini_key(self) -> str:
        if not self.gemini_api_key or len(self.gemini_api_key.strip()) < 8:
            return ""
        k = self.gemini_api_key.strip()
        return f"{k[:6]}...{k[-4:]}"

