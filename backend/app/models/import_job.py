from sqlalchemy import Column, String, Text, Integer, JSON, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.models.base import BaseModel

class ImportJob(BaseModel):
    __tablename__ = "import_jobs"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    source_type = Column(String(50), nullable=False) # 'pdf', 'text', 'json'
    filename = Column(String(255), nullable=True)
    raw_content = Column(Text, nullable=True)
    
    total_detected = Column(Integer, nullable=False, default=0)
    successfully_parsed = Column(Integer, nullable=False, default=0)
    issues_count = Column(Integer, nullable=False, default=0)
    
    # List of parsed question dicts with status: 'valid', 'needs_review', 'duplicate', 'missing_answer'
    parsed_questions = Column(JSON, nullable=False, default=list)
    
    # List of issues: [{"question_index": 2, "code": "MISSING_ANSWER", "message": "..."}]
    issues = Column(JSON, nullable=False, default=list)
    
    # Status: 'pending', 'parsed', 'approved', 'rejected'
    status = Column(String(50), nullable=False, default="parsed")
    
    user = relationship("User", backref="import_jobs")
