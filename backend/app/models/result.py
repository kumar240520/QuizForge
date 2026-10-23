from sqlalchemy import Column, String, Text, Boolean, Integer, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from backend.app.models.base import BaseModel

class QuizResult(BaseModel):
    __tablename__ = "quiz_results"
    
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("quiz_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    total_questions = Column(Integer, nullable=False)
    correct_count = Column(Integer, nullable=False, default=0)
    incorrect_count = Column(Integer, nullable=False, default=0)
    unanswered_count = Column(Integer, nullable=False, default=0)
    partially_correct_count = Column(Integer, nullable=False, default=0)
    pending_review_count = Column(Integer, nullable=False, default=0)
    
    score = Column(Float, nullable=False, default=0.0)
    max_score = Column(Float, nullable=False, default=0.0)
    percentage = Column(Float, nullable=False, default=0.0)
    
    time_taken_seconds = Column(Integer, nullable=False, default=0)
    completed_at = Column(DateTime(timezone=True), nullable=False)
    
    # Analytics breakdown: by topic, difficulty, question type
    breakdown = Column(JSON, nullable=True, default=dict)
    
    quiz = relationship("Quiz", back_populates="results")
    session = relationship("QuizSession", back_populates="results")
    attempt_details = relationship("QuestionAttemptResult", back_populates="result", cascade="all, delete-orphan")

class QuestionAttemptResult(BaseModel):
    __tablename__ = "question_attempt_results"
    
    result_id = Column(Integer, ForeignKey("quiz_results.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, nullable=False, index=True)
    
    # Immutable snapshot of the question at the exact moment the attempt occurred
    question_snapshot = Column(JSON, nullable=False)
    
    user_answer = Column(JSON, nullable=True)
    is_correct = Column(Boolean, nullable=False, default=False)
    is_partially_correct = Column(Boolean, nullable=False, default=False)
    marks_awarded = Column(Float, nullable=False, default=0.0)
    max_marks = Column(Float, nullable=False, default=1.0)
    time_spent_seconds = Column(Integer, nullable=False, default=0)
    feedback = Column(Text, nullable=True)
    evaluation_method = Column(String(50), nullable=False, default="deterministic") # deterministic, ai_assisted, manual_pending
    
    result = relationship("QuizResult", back_populates="attempt_details")
