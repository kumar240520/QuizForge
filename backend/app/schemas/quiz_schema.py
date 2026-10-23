from typing import List, Optional, Dict
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class QuizBase(BaseModel):
    user_id: Optional[int] = None
    title: str = Field(..., min_length=3)
    description: Optional[str] = None
    mode: str = "exam" # practice, exam, revision
    timing_mode: str = "total_duration" # total_duration, per_question, both, untimed
    duration_minutes: Optional[int] = 30
    per_question_seconds: Optional[int] = 60
    custom_question_durations: Optional[Dict[str, int]] = Field(default_factory=dict)
    positive_marks: float = 1.0
    negative_marks: float = 0.0
    partial_credit: bool = True
    randomize_questions: bool = False
    randomize_options: bool = False
    allow_skip: bool = True
    allow_back_nav: bool = True
    allow_change_answer: bool = True
    immediate_feedback: bool = False
    show_explanation: bool = True
    auto_submit_on_timeout: bool = True
    question_ids: List[int] = Field(default_factory=list)
    question_count_to_present: Optional[int] = None
    sections: Optional[List[Dict]] = Field(default_factory=list)

class QuizCreate(QuizBase):
    pass

class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    mode: Optional[str] = None
    timing_mode: Optional[str] = None
    duration_minutes: Optional[int] = None
    per_question_seconds: Optional[int] = None
    custom_question_durations: Optional[Dict[str, int]] = None
    positive_marks: Optional[float] = None
    negative_marks: Optional[float] = None
    partial_credit: Optional[bool] = None
    randomize_questions: Optional[bool] = None
    randomize_options: Optional[bool] = None
    allow_skip: Optional[bool] = None
    allow_back_nav: Optional[bool] = None
    allow_change_answer: Optional[bool] = None
    immediate_feedback: Optional[bool] = None
    show_explanation: Optional[bool] = None
    auto_submit_on_timeout: Optional[bool] = None
    question_ids: Optional[List[int]] = None
    question_count_to_present: Optional[int] = None
    sections: Optional[List[Dict]] = None

class QuizRead(QuizBase):
    id: int
    question_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
