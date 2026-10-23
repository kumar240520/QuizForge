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
from backend.app.core.security import get_current_user_optional
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
    user_key = current_user.gemini_api_key if (current_user and current_user.gemini_api_key) else ""
    key_setting = db.query(SystemSetting).filter(SystemSetting.key == "gemini_api_key").first()
    model_setting = db.query(SystemSetting).filter(SystemSetting.key == "gemini_model").first()
    
    system_key = json.loads(key_setting.value_json) if key_setting else ""
    raw_key = user_key or system_key or (settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else "")
    
    model_name = json.loads(model_setting.value_json) if model_setting else (settings.GEMINI_MODEL or "gemini-3.5-flash-lite")
    
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
    if payload.api_key is not None:
        cleaned_key = payload.api_key.strip()
        if cleaned_key == "":
            # Clear / Remove key
            if current_user:
                current_user.gemini_api_key = None
                db.add(current_user)
            key_setting = db.query(SystemSetting).filter(SystemSetting.key == "gemini_api_key").first()
            if key_setting:
                db.delete(key_setting)
        else:
            if current_user:
                current_user.gemini_api_key = cleaned_key
                db.add(current_user)
            key_setting = db.query(SystemSetting).filter(SystemSetting.key == "gemini_api_key").first()
            if not key_setting:
                key_setting = SystemSetting(key="gemini_api_key", value_json=json.dumps(cleaned_key), is_encrypted=True)
                db.add(key_setting)
            else:
                key_setting.value_json = json.dumps(cleaned_key)
            
    if payload.model_name is not None:
        model_setting = db.query(SystemSetting).filter(SystemSetting.key == "gemini_model").first()
        if not model_setting:
            model_setting = SystemSetting(key="gemini_model", value_json=json.dumps(payload.model_name.strip()))
            db.add(model_setting)
        else:
            model_setting.value_json = json.dumps(payload.model_name.strip())
            
    db.commit()
    return {"message": "AI settings updated successfully"}

@router.post("/ai/test", response_model=TestConnectionResponse)
def test_ai_connection(
    payload: TestConnectionRequest, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    target_key = payload.api_key
    if not target_key or not target_key.strip():
        if current_user and current_user.gemini_api_key:
            target_key = current_user.gemini_api_key
        else:
            key_setting = db.query(SystemSetting).filter(SystemSetting.key == "gemini_api_key").first()
            if key_setting:
                target_key = json.loads(key_setting.value_json)
            elif settings.GEMINI_API_KEY:
                target_key = settings.GEMINI_API_KEY
            
    return GeminiClient.test_connection(api_key=target_key, model_name=payload.model_name)

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
def reset_history(db: Session = Depends(get_db)):
    """Reset attempt history and spaced revision states without deleting question banks."""
    db.query(QuestionAttemptResult).delete()
    db.query(QuizResult).delete()
    db.query(RevisionItem).delete()
    db.commit()
    return {"message": "Assessment attempt history and revision items have been reset."}

@router.post("/data/purge-full-storage")
def purge_full_storage(payload: PurgeStorageRequest, db: Session = Depends(get_db)):
    """
    DANGER ZONE: Completely delete all database records, drop all tables, and recreate clean schema.
    Requires exact confirmation string: 'DELETE STORAGE'.
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
