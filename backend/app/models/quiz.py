from sqlalchemy import Column, String, Text, Boolean, Integer, Float, JSON, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.models.base import BaseModel

class Quiz(BaseModel):
    __tablename__ = "quizzes"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Mode: practice, exam, revision
    mode = Column(String(50), nullable=False, default="exam")
    
    # Timing mode: total_duration (A), per_question (B), both (C), untimed (D)
    timing_mode = Column(String(50), nullable=False, default="total_duration")
    duration_minutes = Column(Integer, nullable=True, default=30) # Total duration in minutes
    per_question_seconds = Column(Integer, nullable=True, default=60) # Default per-question seconds
    custom_question_durations = Column(JSON, nullable=True, default=dict) # {"1": 45, "2": 90}
    
    # Scoring rules
    positive_marks = Column(Float, nullable=False, default=1.0)
    negative_marks = Column(Float, nullable=False, default=0.0)
    partial_credit = Column(Boolean, nullable=False, default=True)
    
    # Navigation & behavioral rules
    randomize_questions = Column(Boolean, nullable=False, default=False)
    randomize_options = Column(Boolean, nullable=False, default=False)
    allow_skip = Column(Boolean, nullable=False, default=True)
    allow_back_nav = Column(Boolean, nullable=False, default=True)
    allow_change_answer = Column(Boolean, nullable=False, default=True)
    immediate_feedback = Column(Boolean, nullable=False, default=False)
    show_explanation = Column(Boolean, nullable=False, default=True)
    auto_submit_on_timeout = Column(Boolean, nullable=False, default=True)
    
    # Question IDs included
    question_ids = Column(JSON, nullable=False, default=list) # [1, 2, 5, 8]
    question_count_to_present = Column(Integer, nullable=True) # Custom question count to present per session
    sections = Column(JSON, nullable=True, default=list) # [{"name": "Section A", "description": "..."}]
    
    questions = relationship("Question", backref="quiz", cascade="all, delete-orphan", foreign_keys="Question.quiz_id")
    sessions = relationship("QuizSession", back_populates="quiz", cascade="all, delete-orphan")
    results = relationship("QuizResult", back_populates="quiz", cascade="all, delete-orphan")
    user = relationship("User", backref="quizzes")
