from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from backend.app.models.revision import RevisionItem
from backend.app.models.question import Question
from backend.app.models.quiz import Quiz
from backend.app.schemas.revision_schema import RevisionItemResponse, CreateRevisionQuizRequest

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class RevisionService:
    @classmethod
    def get_revision_items(
        cls, 
        db: Session, 
        due_only: bool = False,
        mastery_filter: Optional[str] = None
    ) -> List[RevisionItemResponse]:
        query = db.query(RevisionItem).join(Question, RevisionItem.question_id == Question.id)
        
        now = utc_now()
        if due_only:
            query = query.filter(RevisionItem.next_review_due <= now)
        if mastery_filter:
            query = query.filter(RevisionItem.mastery_state == mastery_filter)
            
        items = query.order_by(RevisionItem.next_review_due.asc()).all()
        results: List[RevisionItemResponse] = []
        
        for item in items:
            q = item.question
            acc = round((item.correct_attempts / item.total_attempts * 100), 1) if item.total_attempts > 0 else 0.0
            
            due_dt = item.next_review_due
            if due_dt.tzinfo is None:
                due_dt = due_dt.replace(tzinfo=timezone.utc)
            is_due = due_dt <= now
            
            results.append(
                RevisionItemResponse(
                    id=item.id,
                    question_id=item.question_id,
                    question_text=q.question_text if q else "Question",
                    question_type=q.question_type if q else "single_choice",
                    difficulty=q.difficulty if q else "medium",
                    subject_name=q.subject.name if (q and q.subject) else None,
                    topic_name=q.topic.name if (q and q.topic) else None,
                    mastery_state=item.mastery_state,
                    total_attempts=item.total_attempts,
                    correct_attempts=item.correct_attempts,
                    accuracy_percentage=acc,
                    streak=item.streak,
                    next_review_due=due_dt,
                    is_due=is_due
                )
            )
        return results

    @classmethod
    def create_revision_quiz(cls, db: Session, payload: CreateRevisionQuizRequest) -> Quiz:
        now = utc_now()
        query = db.query(RevisionItem).join(Question, RevisionItem.question_id == Question.id)
        
        if payload.subject_id:
            query = query.filter(Question.subject_id == payload.subject_id)
        if payload.topic_id:
            query = query.filter(Question.topic_id == payload.topic_id)
            
        if payload.filter_by == "mistakes":
            query = query.filter(
                (RevisionItem.mastery_state == "needs_revision") |
                (RevisionItem.correct_attempts < RevisionItem.total_attempts)
            )
        elif payload.filter_by == "due_for_revision":
            query = query.filter(RevisionItem.next_review_due <= now)
            
        items = query.order_by(RevisionItem.next_review_due.asc()).limit(payload.question_count).all()
        selected_q_ids = [item.question_id for item in items]
        
        # If not enough revision items, fall back to any available questions
        if len(selected_q_ids) < payload.question_count:
            remaining_count = payload.question_count - len(selected_q_ids)
            extra_questions = db.query(Question.id).filter(~Question.id.in_(selected_q_ids)).limit(remaining_count).all()
            selected_q_ids.extend([q[0] for q in extra_questions])
            
        new_quiz = Quiz(
            title=payload.title,
            description="Smart spaced-revision assessment generated to reinforce memory and weak concepts.",
            mode="revision",
            timing_mode=payload.timing_mode,
            duration_minutes=20 if payload.timing_mode != "untimed" else None,
            per_question_seconds=60 if payload.timing_mode == "per_question" else None,
            positive_marks=1.0,
            negative_marks=0.0,
            allow_skip=True,
            allow_back_nav=True,
            allow_change_answer=True,
            immediate_feedback=True,
            show_explanation=True,
            question_ids=selected_q_ids
        )
        db.add(new_quiz)
        db.commit()
        db.refresh(new_quiz)
        return new_quiz
