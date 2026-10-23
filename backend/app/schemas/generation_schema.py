from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from backend.app.schemas.question import QuestionOptionSchema

class AIGenerateRequest(BaseModel):
    subject: str = Field(..., min_length=2)
    topic: str = Field(..., min_length=2)
    subtopics: Optional[str] = None
    educational_level: Optional[str] = "undergraduate" # high_school, undergraduate, graduate, professional
    question_count: int = Field(default=5, ge=1, le=50)
    question_types: List[str] = Field(default=["single_choice"])
    difficulty: str = Field(default="mixed") # easy, medium, hard, mixed
    difficulty_distribution: Optional[Dict[str, int]] = None # e.g. {"easy": 30, "medium": 50, "hard": 20}
    num_mcq_options: int = Field(default=4, ge=2, le=6)
    require_explanations: bool = True
    require_worked_solutions: bool = False
    include_code_questions: bool = False
    source_material: Optional[str] = None # When generating grounded in notes/text
    source_only_mode: bool = False # If true, AI must only use facts in source_material
    language: str = "English"
    api_key: Optional[str] = None # User's personal Gemini key if provided
    model_name: Optional[str] = None

class SingleQuestionRegenerateRequest(BaseModel):
    topic: str
    question_type: str
    difficulty: str
    previous_question_text: Optional[str] = None
    reason: Optional[str] = None

class TestConnectionRequest(BaseModel):
    api_key: Optional[str] = None # If None, uses configured backend key
    model_name: Optional[str] = None

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    model_used: Optional[str] = None
    available_models: Optional[List[str]] = None
