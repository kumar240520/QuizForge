from typing import List, Optional, Any, Dict, Union
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict

class QuestionOptionSchema(BaseModel):
    id: str # "A", "B", "1", "true", etc.
    text: str

class QuestionBase(BaseModel):
    question_text: str = Field(..., min_length=3)
    question_type: str = Field(default="single_choice")
    difficulty: str = Field(default="medium")
    bank_id: Optional[int] = None
    quiz_id: Optional[int] = None
    subject_id: Optional[int] = None
    topic_id: Optional[int] = None
    section_name: Optional[str] = "General"
    per_question_timer: Optional[int] = None
    options: Optional[List[QuestionOptionSchema]] = Field(default_factory=list)
    correct_answer: Any # Can be list of strings, dict, float, string
    accepted_answers: Optional[List[str]] = Field(default_factory=list)
    numerical_tolerance: Optional[float] = 0.0
    explanation: Optional[str] = None
    worked_solution: Optional[str] = None
    points: float = 1.0
    negative_marks: float = 0.0
    source_ref: Optional[str] = None
    creation_source: str = "manual"
    is_approved: bool = True
    is_favorite: bool = False
    tags: Optional[List[str]] = Field(default_factory=list)
    metadata_extra: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v: str) -> str:
        valid = {"easy", "medium", "hard"}
        if v.lower() not in valid:
            return "medium"
        return v.lower()

    @field_validator("question_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        valid = {
            "single_choice", "multiple_choice", "true_false", "fill_in_the_blank",
            "short_answer", "match_the_following", "arrange_in_order", "numerical",
            "code_output", "code_writing", "assertion_reasoning", "descriptive",
            "coding", "code_debug"
        }
        if v.lower() not in valid:
            return "single_choice"
        return v.lower()

class QuestionCreate(QuestionBase):
    pass

class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_type: Optional[str] = None
    difficulty: Optional[str] = None
    bank_id: Optional[int] = None
    quiz_id: Optional[int] = None
    subject_id: Optional[int] = None
    topic_id: Optional[int] = None
    section_name: Optional[str] = None
    per_question_timer: Optional[int] = None
    options: Optional[List[QuestionOptionSchema]] = None
    correct_answer: Optional[Any] = None
    accepted_answers: Optional[List[str]] = None
    numerical_tolerance: Optional[float] = None
    explanation: Optional[str] = None
    worked_solution: Optional[str] = None
    points: Optional[float] = None
    negative_marks: Optional[float] = None
    source_ref: Optional[str] = None
    is_approved: Optional[bool] = None
    is_favorite: Optional[bool] = None
    tags: Optional[List[str]] = None
    metadata_extra: Optional[Dict[str, Any]] = None

class QuestionRead(QuestionBase):
    id: int
    version: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class QuestionBatchDelete(BaseModel):
    ids: List[int]

class QuestionBankBase(BaseModel):
    title: str
    description: Optional[str] = None
    is_default: bool = False

class QuestionBankCreate(QuestionBankBase):
    pass

class QuestionBankRead(QuestionBankBase):
    id: int
    created_at: datetime
    updated_at: datetime
    question_count: Optional[int] = 0
    model_config = ConfigDict(from_attributes=True)

class SubjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    bank_id: Optional[int] = None

class SubjectCreate(SubjectBase):
    pass

class SubjectRead(SubjectBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TopicBase(BaseModel):
    name: str
    description: Optional[str] = None
    subject_id: int

class TopicCreate(TopicBase):
    pass

class TopicRead(TopicBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
