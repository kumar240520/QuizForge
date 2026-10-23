from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import require_admin
from backend.app.models.user import User
from backend.app.models.quiz import Quiz
from backend.app.models.question import Question
from backend.app.models.question_bank import QuestionBank
from backend.app.models.session import QuizSession
from backend.app.models.result import QuizResult, QuestionAttemptResult
from backend.app.models.revision import RevisionItem
from backend.app.models.import_job import ImportJob

router = APIRouter(prefix="/admin/users", tags=["Admin User Management"])

class AdminUserListItem(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    is_gemini_configured: bool
    masked_gemini_key: Optional[str] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None
    quizzes_count: int = 0
    questions_count: int = 0
    banks_count: int = 0
    attempts_count: int = 0

    class Config:
        from_attributes = True

@router.get("", response_model=List[AdminUserListItem])
def list_admin_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """List all registered users in QuizForge with their resource metrics."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    results = []
    
    for u in users:
        qz_count = db.query(Quiz).filter(Quiz.user_id == u.id).count()
        q_count = db.query(Question).filter(Question.user_id == u.id).count()
        b_count = db.query(QuestionBank).filter(QuestionBank.user_id == u.id).count()
        att_count = db.query(QuizResult).filter(QuizResult.user_id == u.id).count()
        
        results.append(
            AdminUserListItem(
                id=u.id,
                username=u.username,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                is_gemini_configured=u.is_gemini_configured,
                masked_gemini_key=u.masked_gemini_key,
                created_at=u.created_at,
                last_login_at=u.last_login_at,
                quizzes_count=qz_count,
                questions_count=q_count,
                banks_count=b_count,
                attempts_count=att_count
            )
        )
    return results

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Permanently delete a user account and cascade-delete all isolated data
    (quizzes, questions, question banks, test sessions, test results, revision items, import jobs).
    """
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own active administrator account."
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found.")

    username = target_user.username

    # 1. Purge spaced revision items
    db.query(RevisionItem).filter(RevisionItem.user_id == user_id).delete(synchronize_session=False)

    # 2. Purge results & question attempts
    user_results = db.query(QuizResult).filter(QuizResult.user_id == user_id).all()
    result_ids = [r.id for r in user_results]
    if result_ids:
        db.query(QuestionAttemptResult).filter(QuestionAttemptResult.result_id.in_(result_ids)).delete(synchronize_session=False)
        db.query(QuizResult).filter(QuizResult.user_id == user_id).delete(synchronize_session=False)

    # 3. Purge assessment sessions
    db.query(QuizSession).filter(QuizSession.user_id == user_id).delete(synchronize_session=False)

    # 4. Purge import jobs
    db.query(ImportJob).filter(ImportJob.user_id == user_id).delete(synchronize_session=False)

    # 5. Purge quizzes created by this user
    user_quizzes = db.query(Quiz).filter(Quiz.user_id == user_id).all()
    for qz in user_quizzes:
        db.delete(qz)

    # 6. Purge questions created by this user
    db.query(Question).filter(Question.user_id == user_id).delete(synchronize_session=False)

    # 7. Purge question banks created by this user
    user_banks = db.query(QuestionBank).filter(QuestionBank.user_id == user_id).all()
    for b in user_banks:
        db.delete(b)

    # 8. Delete the user record
    db.delete(target_user)
    db.commit()

    return {
        "message": f"User '{username}' (ID: {user_id}) and all associated assessments, questions, banks, and results have been permanently deleted."
    }
