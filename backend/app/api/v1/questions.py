from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user_optional
from backend.app.models.user import User
from backend.app.models.question import Question
from backend.app.models.question_bank import QuestionBank
from backend.app.schemas.question import QuestionCreate, QuestionUpdate, QuestionRead, QuestionBatchDelete

router = APIRouter(prefix="/questions", tags=["Questions"])

@router.get("", response_model=List[QuestionRead])
def list_questions(
    bank_id: Optional[int] = None,
    quiz_id: Optional[int] = None,
    unassigned_only: Optional[bool] = False,
    subject_id: Optional[int] = None,
    topic_id: Optional[int] = None,
    difficulty: Optional[str] = None,
    question_type: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    query = db.query(Question)
    if current_user:
        query = query.filter(Question.user_id == current_user.id)
    else:
        query = query.filter(Question.user_id.is_(None))
        
    if quiz_id:
        query = query.filter(Question.quiz_id == quiz_id)
    elif unassigned_only:
        query = query.filter(Question.quiz_id.is_(None))
    if bank_id:
        query = query.filter(Question.bank_id == bank_id)
    if subject_id:
        query = query.filter(Question.subject_id == subject_id)
    if topic_id:
        query = query.filter(Question.topic_id == topic_id)
    if difficulty:
        query = query.filter(Question.difficulty == difficulty.lower())
    if question_type:
        query = query.filter(Question.question_type == question_type)
    if is_favorite is not None:
        query = query.filter(Question.is_favorite == is_favorite)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Question.question_text.ilike(search_pattern),
                Question.explanation.ilike(search_pattern),
                Question.source_ref.ilike(search_pattern)
            )
        )
    return query.order_by(Question.created_at.desc()).offset(skip).limit(limit).all()

@router.post("", response_model=QuestionRead)
def create_question(
    payload: QuestionCreate, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    # If no bank_id, use personal default bank
    bank_id = payload.bank_id
    if not bank_id:
        bank_q = db.query(QuestionBank).filter(QuestionBank.is_default == True)
        if current_user:
            bank_q = bank_q.filter(QuestionBank.user_id == current_user.id)
        default_bank = bank_q.first()
        if not default_bank:
            default_bank = QuestionBank(
                title="Default Bank", 
                is_default=True,
                user_id=current_user.id if current_user else None
            )
            db.add(default_bank)
            db.commit()
            db.refresh(default_bank)
        bank_id = default_bank.id
            
    q_data = payload.model_dump()
    q_data["bank_id"] = bank_id
    if current_user:
        q_data["user_id"] = current_user.id
        
    # Format options as dicts for JSON column
    if "options" in q_data and q_data["options"]:
        q_data["options"] = [
            (opt if isinstance(opt, dict) else opt.model_dump())
            for opt in q_data["options"]
        ]
        
    question = Question(**q_data)
    db.add(question)
    db.commit()
    db.refresh(question)
    return question

@router.get("/{question_id}", response_model=QuestionRead)
def get_question(
    question_id: int, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if current_user and question.user_id and question.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to access this question.")
    return question

@router.put("/{question_id}", response_model=QuestionRead)
def update_question(
    question_id: int, 
    payload: QuestionUpdate, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if current_user and question.user_id and question.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to update this question.")
        
    update_data = payload.model_dump(exclude_unset=True)
    if "options" in update_data and update_data["options"] is not None:
        update_data["options"] = [
            (opt if isinstance(opt, dict) else opt.model_dump())
            for opt in update_data["options"]
        ]
        
    for key, value in update_data.items():
        setattr(question, key, value)
        
    question.version += 1
    db.commit()
    db.refresh(question)
    return question

@router.post("/batch-delete")
def batch_delete_questions(
    payload: QuestionBatchDelete, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    if not payload.ids:
        return {"message": "No IDs provided", "deleted_count": 0}
        
    query = db.query(Question).filter(Question.id.in_(payload.ids))
    if current_user and current_user.role != "admin":
        query = query.filter(Question.user_id == current_user.id)
        
    deleted_count = query.delete(synchronize_session=False)
    db.commit()
    return {"message": f"Successfully deleted {deleted_count} questions", "deleted_count": deleted_count}

@router.delete("/clear-all")
def clear_all_questions(
    bank_id: Optional[int] = None, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    query = db.query(Question)
    if current_user and current_user.role != "admin":
        query = query.filter(Question.user_id == current_user.id)
    if bank_id is not None:
        query = query.filter(Question.bank_id == bank_id)
    deleted_count = query.delete(synchronize_session=False)
    db.commit()
    return {"message": f"Successfully cleared {deleted_count} questions", "deleted_count": deleted_count}

@router.delete("/{question_id}")
def delete_question(
    question_id: int, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if current_user and question.user_id and question.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to delete this question.")
    db.delete(question)
    db.commit()
    return {"message": "Question deleted successfully"}

@router.post("/{question_id}/duplicate", response_model=QuestionRead)
def duplicate_question(
    question_id: int, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    orig = db.query(Question).filter(Question.id == question_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Question not found")
    if current_user and orig.user_id and orig.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to duplicate this question.")
        
    dup = Question(
        user_id=current_user.id if current_user else orig.user_id,
        bank_id=orig.bank_id,
        subject_id=orig.subject_id,
        topic_id=orig.topic_id,
        question_text=f"{orig.question_text} (Copy)",
        question_type=orig.question_type,
        difficulty=orig.difficulty,
        options=orig.options,
        correct_answer=orig.correct_answer,
        accepted_answers=orig.accepted_answers,
        numerical_tolerance=orig.numerical_tolerance,
        explanation=orig.explanation,
        worked_solution=orig.worked_solution,
        points=orig.points,
        negative_marks=orig.negative_marks,
        source_ref=orig.source_ref,
        creation_source=orig.creation_source,
        tags=orig.tags
    )
    db.add(dup)
    db.commit()
    db.refresh(dup)
    return dup

@router.post("/{question_id}/toggle-favorite", response_model=QuestionRead)
def toggle_favorite(
    question_id: int, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if current_user and question.user_id and question.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to favorite this question.")
    question.is_favorite = not question.is_favorite
    db.commit()
    db.refresh(question)
    return question
