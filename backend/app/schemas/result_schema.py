from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class QuestionAttemptDetail(BaseModel):
    id: int
    question_id: int
    question_snapshot: Dict[str, Any]
    user_answer: Any
    is_correct: bool
    is_partially_correct: bool
    marks_awarded: float
    max_marks: float
    time_spent_seconds: int
    feedback: Optional[str] = None
    evaluation_method: str

class QuizResultResponse(BaseModel):
    id: int
    quiz_id: int
    quiz_title: Optional[str] = None
    session_id: int
    total_questions: int
    correct_count: int
    incorrect_count: int
    unanswered_count: int
    partially_correct_count: int
    pending_review_count: int
    score: float
    max_score: float
    percentage: float
    time_taken_seconds: int
    completed_at: datetime
    breakdown: Dict[str, Any]
    attempt_details: List[QuestionAttemptDetail] = []
    model_config = ConfigDict(from_attributes=True)

class QuizResultListItem(BaseModel):
    id: int
    quiz_id: int
    quiz_title: str
    score: float
    max_score: float
    percentage: float
    total_questions: int
    correct_count: int
    incorrect_count: int
    time_taken_seconds: int
    completed_at: datetime
    model_config = ConfigDict(from_attributes=True)
