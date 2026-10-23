from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from backend.app.schemas.question import QuestionOptionSchema

class ParsedQuestionItem(BaseModel):
    temp_id: str
    question_text: str
    question_type: str = "single_choice"
    difficulty: str = "medium"
    options: List[QuestionOptionSchema] = Field(default_factory=list)
    correct_answer: Any = None
    accepted_answers: List[str] = Field(default_factory=list)
    numerical_tolerance: float = 0.0
    explanation: Optional[str] = None
    points: float = 1.0
    negative_marks: float = 0.0
    source_ref: Optional[str] = None
    section_name: Optional[str] = "General"
    per_question_timer: Optional[int] = None
    status: str = "valid" # valid, needs_review, duplicate, missing_answer
    issues: List[str] = Field(default_factory=list)
    is_approved: bool = True
    metadata_extra: Optional[Dict[str, Any]] = None

class TextImportRequest(BaseModel):
    content: str = Field(..., min_length=10)
    bank_id: Optional[int] = None
    quiz_id: Optional[int] = None
    subject: Optional[str] = None
    topic: Optional[str] = None

class ImportJobResponse(BaseModel):
    id: int
    source_type: str
    filename: Optional[str] = None
    total_detected: int
    successfully_parsed: int
    issues_count: int
    parsed_questions: List[ParsedQuestionItem]
    issues: List[Dict[str, Any]]
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ApproveQuestionsRequest(BaseModel):
    job_id: int
    quiz_id: Optional[int] = None
    bank_id: Optional[int] = None
    subject_id: Optional[int] = None
    topic_id: Optional[int] = None
    target_section: Optional[str] = None
    questions: List[ParsedQuestionItem]
