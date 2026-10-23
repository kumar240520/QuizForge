from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user_optional
from backend.app.models.user import User
from backend.app.schemas.revision_schema import RevisionItemResponse, CreateRevisionQuizRequest
from backend.app.schemas.quiz_schema import QuizRead
from backend.app.services.revision_service import RevisionService

router = APIRouter(prefix="/revision", tags=["Revision Center"])

@router.get("/items", response_model=List[RevisionItemResponse])
def get_revision_items(
    due_only: bool = False,
    mastery_state: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id = current_user.id if current_user else None
    return RevisionService.get_revision_items(db, due_only=due_only, mastery_filter=mastery_state, user_id=user_id)

@router.post("/create-quiz", response_model=QuizRead)
def create_revision_quiz(
    payload: CreateRevisionQuizRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id = current_user.id if current_user else None
    quiz = RevisionService.create_revision_quiz(db, payload, user_id=user_id)
    item = QuizRead.model_validate(quiz)
    item.question_count = len(quiz.question_ids) if quiz.question_ids else 0
    return item

