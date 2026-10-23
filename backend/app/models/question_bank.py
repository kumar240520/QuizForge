from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.models.base import BaseModel

class QuestionBank(BaseModel):
    __tablename__ = "question_banks"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    
    subjects = relationship("Subject", back_populates="bank", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="bank", cascade="all, delete-orphan")
    user = relationship("User", backref="question_banks")

class Subject(BaseModel):
    __tablename__ = "subjects"
    
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    bank_id = Column(Integer, ForeignKey("question_banks.id", ondelete="CASCADE"), nullable=True)
    
    bank = relationship("QuestionBank", back_populates="subjects")
    topics = relationship("Topic", back_populates="subject", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="subject")

class Topic(BaseModel):
    __tablename__ = "topics"
    
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    
    subject = relationship("Subject", back_populates="topics")
    questions = relationship("Question", back_populates="topic")

class QuestionTag(BaseModel):
    __tablename__ = "question_tags"
    
    name = Column(String(100), unique=True, index=True, nullable=False)
