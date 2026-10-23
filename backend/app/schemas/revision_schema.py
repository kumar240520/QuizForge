from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

class RevisionItemResponse(BaseModel):
    id: int
    question_id: int
    question_text: str
    question_type: str
    difficulty: str
    subject_name: Optional[str] = None
    topic_name: Optional[str] = None
    mastery_state: str # new, learning, needs_revision, mastered
    total_attempts: int
    correct_attempts: int
    accuracy_percentage: float
    streak: int
    next_review_due: datetime
    is_due: bool

class CreateRevisionQuizRequest(BaseModel):
    title: str = "Revision Assessment"
    filter_by: str = "mistakes" # "mistakes", "due_for_revision", "weak_topics", "all"
    question_count: int = 10
    subject_id: Optional[int] = None
    topic_id: Optional[int] = None
    timing_mode: str = "untimed"
