from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.app.models.base import BaseModel, utc_now

class RevisionItem(BaseModel):
    __tablename__ = "revision_items"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_user_question_rev"),
    )
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    
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
    
    user = relationship("User", backref="revision_items")
    question = relationship("Question", back_populates="revision_items")

