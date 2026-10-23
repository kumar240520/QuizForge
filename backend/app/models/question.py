from sqlalchemy import Column, String, Text, Boolean, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.models.base import BaseModel

class Question(BaseModel):
    __tablename__ = "questions"
    
    bank_id = Column(Integer, ForeignKey("question_banks.id", ondelete="SET NULL"), nullable=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)
    section_name = Column(String(100), nullable=True, default="General", index=True)
    per_question_timer = Column(Integer, nullable=True) # Optional individual timer in seconds
    
    question_text = Column(Text, nullable=False)
    # Question types:
    # single_choice, multiple_choice, true_false, fill_in_the_blank,
    # short_answer, match_the_following, arrange_in_order, numerical,
    # code_output, code_writing, assertion_reasoning, descriptive
    question_type = Column(String(50), nullable=False, default="single_choice", index=True)
    difficulty = Column(String(20), nullable=False, default="medium", index=True) # easy, medium, hard
    
    # Options list: [{"id": "A", "text": "Option A"}, ...]
    options = Column(JSON, nullable=True, default=list)
    
    # Correct answer format:
    # single_choice/true_false: ["A"]
    # multiple_choice: ["A", "C"]
    # fill_in_the_blank: ["accepted1", "accepted2"]
    # match_the_following: {"left_1": "right_B", "left_2": "right_A"}
    # arrange_in_order: ["step1", "step2", "step3"]
    # numerical: 42.5
    # code_output / short_answer: "exact or pattern"
    correct_answer = Column(JSON, nullable=False)
    
    accepted_answers = Column(JSON, nullable=True, default=list)
    numerical_tolerance = Column(Float, nullable=True, default=0.0)
    
    explanation = Column(Text, nullable=True)
    worked_solution = Column(Text, nullable=True)
    
    points = Column(Float, nullable=False, default=1.0)
    negative_marks = Column(Float, nullable=False, default=0.0)
    
    source_ref = Column(String(255), nullable=True) # PDF page, textbook chapter, or prompt
    creation_source = Column(String(50), nullable=False, default="manual") # imported_pdf, imported_text, imported_json, ai_generated, manual
    is_approved = Column(Boolean, nullable=False, default=True)
    is_favorite = Column(Boolean, nullable=False, default=False)
    
    tags = Column(JSON, nullable=True, default=list) # ["biology", "neet-2024"]
    version = Column(Integer, nullable=False, default=1)
    
    # Optional code block context or assertion statements
    metadata_extra = Column(JSON, nullable=True, default=dict)
    
    bank = relationship("QuestionBank", back_populates="questions")
    subject = relationship("Subject", back_populates="questions")
    topic = relationship("Topic", back_populates="questions")
    revision_items = relationship("RevisionItem", back_populates="question", cascade="all, delete-orphan")
