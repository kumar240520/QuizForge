from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.schemas.revision_schema import RevisionItemResponse, CreateRevisionQuizRequest
from backend.app.schemas.quiz_schema import QuizRead
from backend.app.services.revision_service import RevisionService

router = APIRouter(prefix="/revision", tags=["Revision Center"])

@router.get("/items", response_model=List[RevisionItemResponse])
def get_revision_items(
    due_only: bool = False,
    mastery_state: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return RevisionService.get_revision_items(db, due_only=due_only, mastery_filter=mastery_state)

@router.post("/create-quiz", response_model=QuizRead)
def create_revision_quiz(payload: CreateRevisionQuizRequest, db: Session = Depends(get_db)):
    quiz = RevisionService.create_revision_quiz(db, payload)
    item = QuizRead.model_validate(quiz)
    item.question_count = len(quiz.question_ids) if quiz.question_ids else 0
    return item
