from typing import Optional, List
from pydantic import BaseModel

class AISettingsUpdate(BaseModel):
    api_key: Optional[str] = None
    model_name: Optional[str] = None

class AISettingsResponse(BaseModel):
    is_key_configured: bool
    masked_key: Optional[str] = None
    model_name: str
    available_models: List[str]

class AppearanceSettings(BaseModel):
    theme: str = "system" # light, dark, system
    accent_color: str = "indigo"
    font_size: str = "medium"

class AppPreferences(BaseModel):
    default_timing_mode: str = "total_duration"
    default_quiz_duration_mins: int = 30
    default_question_seconds: int = 60
    default_positive_marks: float = 1.0
    default_negative_marks: float = 0.0
    confirm_on_leave: bool = True

class PurgeStorageRequest(BaseModel):
    confirmation: str
