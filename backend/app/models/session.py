from sqlalchemy import Column, String, Text, Boolean, Integer, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from backend.app.models.base import BaseModel

class QuizSession(BaseModel):
    __tablename__ = "quiz_sessions"
    
    session_token = Column(String(64), unique=True, index=True, nullable=False)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    mode = Column(String(50), nullable=False, default="exam")
    
    # State machine: created, ready, in_progress, paused, submitted, evaluated
    status = Column(String(50), nullable=False, default="ready", index=True)
    
    current_question_index = Column(Integer, nullable=False, default=0)
    
    # Server-authoritative timestamps in UTC
    started_at = Column(DateTime(timezone=True), nullable=True)
    paused_at = Column(DateTime(timezone=True), nullable=True)
    total_paused_seconds = Column(Integer, nullable=False, default=0)
    session_deadline = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Snapshot of question IDs order for this session
    question_order = Column(JSON, nullable=False, default=list) # [5, 2, 8, 1]
    
    # Randomized option orders per question: {"question_id": ["C", "A", "D", "B"]}
    option_orders = Column(JSON, nullable=True, default=dict)
    
    # Deadlines per question: {"question_id": "2026-10-22T17:30:00Z"}
    per_question_deadlines = Column(JSON, nullable=True, default=dict)
    
    # Track actually visited question IDs deterministically
    visited_question_ids = Column(JSON, nullable=True, default=list) # [5, 10]
    
    quiz = relationship("Quiz", back_populates="sessions")
    user = relationship("User", backref="quiz_sessions")
    answers = relationship("SessionAnswer", back_populates="session", cascade="all, delete-orphan")
    results = relationship("QuizResult", back_populates="session", cascade="all, delete-orphan")

class SessionAnswer(BaseModel):
    __tablename__ = "session_answers"
    
    session_id = Column(Integer, ForeignKey("quiz_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Answers submitted:
    # Multiple/Single choice: list of option IDs ["A"]
    # Match: dict {"left_1": "right_B"}
    # Ordering: list ["step2", "step1"]
    # Text/Blank/Numerical/Descriptive: string or number
    user_answer = Column(JSON, nullable=True)
    
    is_flagged = Column(Boolean, nullable=False, default=False)
    is_skipped = Column(Boolean, nullable=False, default=False)
    time_spent_seconds = Column(Integer, nullable=False, default=0)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    
    session = relationship("QuizSession", back_populates="answers")
    question = relationship("Question")
