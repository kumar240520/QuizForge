from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, Field
from backend.app.schemas.question import QuestionOptionSchema

class StartSessionRequest(BaseModel):
    quiz_id: int
    mode: Optional[str] = None
    question_count: Optional[int] = None
    question_ids: Optional[List[int]] = None

class CheckAnswerRequest(BaseModel):
    question_id: int
    user_answer: Any
    time_spent_seconds: int = 0

class CheckAnswerResponse(BaseModel):
    question_id: int
    is_correct: bool
    is_partially_correct: bool = False
    points_awarded: float
    max_marks: float
    correct_answer: Any
    explanation: Optional[str] = None
    worked_solution: Optional[str] = None
    feedback: Optional[str] = None
    details: Dict[str, Any] = {}

class ClientQuestionView(BaseModel):
    id: int
    question_text: str
    question_type: str
    difficulty: str
    points: float
    negative_marks: float
    options: List[QuestionOptionSchema]
    # In Exam Mode or before submitting, correct_answer and explanation are None!
    correct_answer: Optional[Any] = None
    explanation: Optional[str] = None
    worked_solution: Optional[str] = None
    time_limit_seconds: Optional[int] = None
    section_name: Optional[str] = "General"
    metadata_extra: Optional[Dict[str, Any]] = None

class SubmitAnswerRequest(BaseModel):
    question_id: int
    user_answer: Any
    time_spent_seconds: int = 0
    is_flagged: bool = False
    is_skipped: bool = False

class SessionNavigationRequest(BaseModel):
    target_index: int

class QuestionPaletteItem(BaseModel):
    index: int
    question_id: int
    is_answered: bool
    is_flagged: bool
    is_visited: bool

class TestCaseResult(BaseModel):
    input: str
    expected_output: str
    actual_output: str
    passed: bool
    error: Optional[str] = None
    execution_time_ms: float = 0.0

class RunCodeRequest(BaseModel):
    code: str
    language: str = "python"
    test_cases: List[Dict[str, Any]] = []

class RunCodeResponse(BaseModel):
    all_passed: bool
    passed_count: int
    total_count: int
    results: List[TestCaseResult]
    stdout: str = ""

class SessionStatusResponse(BaseModel):
    session_token: str
    quiz_id: int
    quiz_title: str
    mode: str
    status: str
    current_question_index: int
    total_questions: int
    started_at: Optional[datetime] = None
    session_deadline: Optional[datetime] = None
    session_remaining_seconds: Optional[int] = None
    question_remaining_seconds: Optional[int] = None
    
    # Progress and palette
    answered_count: int = 0
    flagged_count: int = 0
    skipped_count: int = 0
    question_order: List[int] = []
    question_palette: List[QuestionPaletteItem] = []
    question_status_map: Dict[str, Dict[str, Any]] # question_id -> {"is_answered": bool, "is_flagged": bool, "is_skipped": bool}
    
    # Active question data
    current_question: Optional[ClientQuestionView] = None
    current_answer: Optional[Any] = None
    is_current_flagged: bool = False
    
    # Sections in this assessment
    sections: Optional[List[Dict[str, Any]]] = None
    
    # Rules
    allow_skip: bool = True
    allow_back_nav: bool = True
    allow_change_answer: bool = True
    immediate_feedback: bool = False
    show_explanation: bool = False
    timing_mode: str = "total_duration"
