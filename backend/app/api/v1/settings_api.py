import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.core.database import get_db, engine, Base
import backend.app.models # ensures all model tables are registered in Base.metadata
from backend.app.models.settings import SystemSetting
from backend.app.models.question import Question
from backend.app.models.quiz import Quiz
from backend.app.models.result import QuizResult, QuestionAttemptResult
from backend.app.models.revision import RevisionItem
from backend.app.core.config import settings
from backend.app.schemas.settings_schema import (
    AISettingsUpdate, AISettingsResponse, AppearanceSettings, AppPreferences, PurgeStorageRequest
)
from backend.app.schemas.generation_schema import TestConnectionRequest, TestConnectionResponse
from backend.app.models.user import User
from backend.app.core.security import get_current_user_optional, get_current_user, require_admin
from backend.app.integrations.gemini.client import GeminiClient, SUPPORTED_MODELS

router = APIRouter(prefix="/settings", tags=["Settings"])

def mask_key(key: str) -> Optional[str]:
    if not key or len(key.strip()) < 8:
        return None
    k = key.strip()
    return f"{k[:6]}...{k[-4:]}"

@router.get("/ai", response_model=AISettingsResponse)
def get_ai_settings(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    if current_user:
        raw_key = (current_user.gemini_api_key or "").strip()
        model_name = current_user.gemini_model or "gemini-2.5-flash"
    else:
        raw_key = ""
        model_name = "gemini-2.5-flash"
    
    return AISettingsResponse(
        is_key_configured=bool(raw_key),
        masked_key=mask_key(raw_key),
        model_name=model_name,
        available_models=SUPPORTED_MODELS
    )

@router.post("/ai")
def update_ai_settings(
    payload: AISettingsUpdate, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required to update AI settings")
        
    if payload.api_key is not None:
        cleaned_key = payload.api_key.strip()
        current_user.gemini_api_key = cleaned_key if cleaned_key else None
        db.add(current_user)
            
    if payload.model_name is not None:
        current_user.gemini_model = payload.model_name.strip()
        db.add(current_user)
            
    # Purge any legacy shared keys in SystemSetting to ensure zero cross-account leakage
    db.query(SystemSetting).filter(SystemSetting.key.in_(["gemini_api_key"])).delete(synchronize_session=False)
    db.commit()
    return {"message": "AI settings updated successfully for your account"}

@router.post("/ai/test", response_model=TestConnectionResponse)
def test_ai_connection(
    payload: TestConnectionRequest, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    target_key = payload.api_key.strip() if payload.api_key and payload.api_key.strip() else ""
    if not target_key and current_user and current_user.gemini_api_key:
        target_key = current_user.gemini_api_key.strip()
        
    if not target_key:
        raise HTTPException(status_code=400, detail="Gemini API key is required. Please provide a key to test.")
        
    target_model = payload.model_name or (current_user.gemini_model if current_user else None) or "gemini-2.5-flash"
    return GeminiClient.test_connection(api_key=target_key, model_name=target_model)

@router.get("/appearance", response_model=AppearanceSettings)
def get_appearance(db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == "appearance").first()
    if setting:
        data = json.loads(setting.value_json)
        return AppearanceSettings(**data)
    return AppearanceSettings()

@router.post("/appearance")
def update_appearance(payload: AppearanceSettings, db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == "appearance").first()
    if not setting:
        setting = SystemSetting(key="appearance", value_json=payload.model_dump_json())
        db.add(setting)
    else:
        setting.value_json = payload.model_dump_json()
    db.commit()
    return {"message": "Appearance preferences updated successfully"}

@router.get("/preferences", response_model=AppPreferences)
def get_preferences(db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == "app_preferences").first()
    if setting:
        data = json.loads(setting.value_json)
        return AppPreferences(**data)
    return AppPreferences()

@router.post("/preferences")
def update_preferences(payload: AppPreferences, db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == "app_preferences").first()
    if not setting:
        setting = SystemSetting(key="app_preferences", value_json=payload.model_dump_json())
        db.add(setting)
    else:
        setting.value_json = payload.model_dump_json()
    db.commit()
    return {"message": "Application preferences saved successfully"}

@router.get("/backup")
def export_database_backup(db: Session = Depends(get_db)):
    questions = db.query(Question).all()
    quizzes = db.query(Quiz).all()
    results = db.query(QuizResult).all()
    
    return {
        "timestamp": "backup",
        "questions": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "difficulty": q.difficulty,
                "options": q.options,
                "correct_answer": q.correct_answer,
                "explanation": q.explanation,
                "points": q.points,
                "source_ref": q.source_ref
            }
            for q in questions
        ],
        "quizzes": [
            {"id": qz.id, "title": qz.title, "mode": qz.mode, "timing_mode": qz.timing_mode, "question_ids": qz.question_ids}
            for qz in quizzes
        ],
        "results_count": len(results)
    }

@router.post("/data/reset-history")
def reset_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reset attempt history and spaced revision states for current user."""
    user_results = db.query(QuizResult).filter(QuizResult.user_id == current_user.id).all()
    result_ids = [r.id for r in user_results]
    if result_ids:
        db.query(QuestionAttemptResult).filter(QuestionAttemptResult.result_id.in_(result_ids)).delete(synchronize_session=False)
        db.query(QuizResult).filter(QuizResult.user_id == current_user.id).delete(synchronize_session=False)
    db.query(RevisionItem).filter(RevisionItem.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return {"message": "Your assessment attempt history and revision items have been reset."}

@router.post("/data/purge-full-storage")
def purge_full_storage(
    payload: PurgeStorageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    DANGER ZONE: Completely delete all database records, drop all tables, and recreate clean schema.
    Requires exact confirmation string: 'DELETE STORAGE' and Administrator privileges.
    """
    if payload.confirmation.strip() != "DELETE STORAGE":
        raise HTTPException(
            status_code=400,
            detail="Confirmation string must be exactly 'DELETE STORAGE'."
        )

    # Close the current session connection so tables can be dropped cleanly
    db.close()

    # Drop all database tables
    Base.metadata.drop_all(bind=engine)
    # Recreate all tables cleanly
    Base.metadata.create_all(bind=engine)

    # Run SQLite VACUUM to reclaim storage and clear WAL journals
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("VACUUM")
            conn.commit()
    except Exception:
        pass

    return {
        "message": "All database storage purged successfully. System reset to a completely clean state."
    }
