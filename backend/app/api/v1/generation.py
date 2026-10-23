import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from backend.app.core.database import get_db
from backend.app.models.settings import SystemSetting
from backend.app.models.question import Question
from backend.app.models.question_bank import QuestionBank
from backend.app.models.quiz import Quiz
from backend.app.schemas.generation_schema import AIGenerateRequest, SingleQuestionRegenerateRequest
from backend.app.schemas.import_schema import ParsedQuestionItem, ApproveQuestionsRequest
from backend.app.integrations.gemini.client import GeminiClient
from backend.app.services.parsing_service import ParsingService

from backend.app.models.user import User
from backend.app.core.security import get_current_user_optional
from backend.app.core.config import settings

router = APIRouter(prefix="/generation", tags=["AI Generation"])

def get_stored_gemini_credentials(db: Session):
    key_setting = db.query(SystemSetting).filter(SystemSetting.key == "gemini_api_key").first()
    model_setting = db.query(SystemSetting).filter(SystemSetting.key == "gemini_model").first()
    
    key = json.loads(key_setting.value_json) if key_setting else None
    model = json.loads(model_setting.value_json) if model_setting else (settings.GEMINI_MODEL or "gemini-3.8-flash")
    return key, model

@router.post("/generate", response_model=List[ParsedQuestionItem])
def generate_questions(
    payload: AIGenerateRequest, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    db_key, db_model = get_stored_gemini_credentials(db)
    
    # Priority order:
    # 1. Direct payload api_key from frontend modal
    # 2. Authenticated user's personal stored key
    # 3. Database SystemSetting key
    # 4. Fallback GEMINI_API_KEY from .env
    target_key = (
        (payload.api_key.strip() if payload.api_key and payload.api_key.strip() else None)
        or (current_user.gemini_api_key.strip() if current_user and current_user.gemini_api_key and current_user.gemini_api_key.strip() else None)
        or (db_key.strip() if db_key and str(db_key).strip() else None)
        or (settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip() else None)
    )
    
    if not target_key:
        raise HTTPException(
            status_code=400, 
            detail="Gemini API key is required. Please set up your free Gemini key in the AI Setup modal or Settings."
        )
        
    target_model = payload.model_name or db_model or settings.GEMINI_MODEL
    
    # If the user passed a valid key and is logged in but doesn't have one saved, save it automatically
    if payload.api_key and payload.api_key.strip() and current_user and not current_user.gemini_api_key:
        try:
            current_user.gemini_api_key = payload.api_key.strip()
            db.add(current_user)
            db.commit()
        except Exception:
            pass # Non-critical if auto-persist fails
    
    try:
        items = GeminiClient.generate_questions(
            subject=payload.subject,
            topic=payload.topic,
            count=payload.question_count,
            question_types=payload.question_types,
            difficulty=payload.difficulty,
            subtopics=payload.subtopics,
            educational_level=payload.educational_level,
            num_mcq_options=payload.num_mcq_options,
            require_explanations=payload.require_explanations,
            source_material=payload.source_material,
            source_only_mode=payload.source_only_mode,
            api_key=target_key,
            model_name=target_model
        )
        return items
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/grounded-from-file", response_model=List[ParsedQuestionItem])
async def generate_grounded_from_file(
    file: UploadFile = File(...),
    subject: str = Form(...),
    topic: str = Form(...),
    question_count: int = Form(5),
    question_types: str = Form("single_choice"), # comma-separated
    difficulty: str = Form("medium"),
    source_only_mode: bool = Form(True),
    db: Session = Depends(get_db)
):
    pdf_bytes = await file.read()
    try:
        text, _ = ParsingService.extract_text_from_pdf(pdf_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract document text: {str(e)}")
        
    db_key, db_model = get_stored_gemini_credentials(db)
    types_list = [t.strip() for t in question_types.split(",") if t.strip()]
    
    try:
        items = GeminiClient.generate_questions(
            subject=subject,
            topic=topic,
            count=question_count,
            question_types=types_list,
            difficulty=difficulty,
            source_material=text[:10000],
            source_only_mode=source_only_mode,
            api_key=db_key,
            model_name=db_model
        )
        return items
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/save-to-bank")
def save_generated_to_bank(payload: ApproveQuestionsRequest, db: Session = Depends(get_db)):
    from backend.app.models.quiz import Quiz
    
    quiz = None
    if payload.quiz_id:
        quiz = db.query(Quiz).filter(Quiz.id == payload.quiz_id).first()

    bank_id = payload.bank_id
    if not bank_id and not payload.quiz_id:
        default_bank = db.query(QuestionBank).filter(QuestionBank.is_default == True).first()
        if not default_bank:
            default_bank = QuestionBank(title="AI Generated Bank", is_default=True)
            db.add(default_bank)
            db.commit()
            db.refresh(default_bank)
        bank_id = default_bank.id

    saved_ids = []
    sections_seen = set()
    for item in payload.questions:
        if not item.is_approved:
            continue
            
        sec = item.section_name or "General"
        sections_seen.add(sec)
        clean_q_text = ParsingService.clean_text(item.question_text)
        clean_options = [
            {"id": opt.id, "text": ParsingService.clean_text(opt.text)}
            for opt in item.options
        ]
        q = Question(
            bank_id=bank_id,
            quiz_id=payload.quiz_id,
            section_name=sec,
            per_question_timer=item.per_question_timer or 60,
            subject_id=payload.subject_id,
            topic_id=payload.topic_id,
            question_text=clean_q_text,
            question_type=item.question_type,
            difficulty=item.difficulty,
            options=clean_options,
            correct_answer=item.correct_answer or (["A"] if clean_options else []),
            accepted_answers=item.accepted_answers,
            numerical_tolerance=item.numerical_tolerance,
            explanation=item.explanation,
            points=item.points,
            negative_marks=item.negative_marks,
            source_ref=item.source_ref or "Gemini AI",
            creation_source="ai_generated",
            is_approved=True,
            metadata_extra=item.metadata_extra
        )
        db.add(q)
        db.flush()
        saved_ids.append(q.id)

    if quiz:
        curr_ids = list(quiz.question_ids or [])
        for qid in saved_ids:
            if qid not in curr_ids:
                curr_ids.append(qid)
        quiz.question_ids = curr_ids
        flag_modified(quiz, "question_ids")

        existing_secs = list(quiz.sections or [])
        existing_names = {s.get("name") for s in existing_secs}
        for sec in sections_seen:
            if sec not in existing_names:
                existing_secs.append({"name": sec, "description": ""})
        quiz.sections = existing_secs
        flag_modified(quiz, "sections")

    db.commit()
    return {
        "message": f"Successfully approved and stored {len(saved_ids)} generated questions.",
        "question_ids": saved_ids,
        "quiz_id": payload.quiz_id,
        "bank_id": bank_id
    }
