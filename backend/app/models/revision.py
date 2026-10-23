from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from backend.app.models.base import BaseModel, utc_now

class RevisionItem(BaseModel):
    __tablename__ = "revision_items"
    
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    # Mastery state: new, learning, needs_revision, mastered
    mastery_state = Column(String(50), nullable=False, default="new", index=True)
    
    total_attempts = Column(Integer, nullable=False, default=0)
    correct_attempts = Column(Integer, nullable=False, default=0)
    streak = Column(Integer, nullable=False, default=0)
    
    # Spaced repetition parameters (SuperMemo SM-2 variation)
    ease_factor = Column(Float, nullable=False, default=2.5)
    interval_days = Column(Integer, nullable=False, default=1)
    next_review_due = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    last_attempted_at = Column(DateTime(timezone=True), nullable=True)
    
    question = relationship("Question", back_populates="revision_item")
