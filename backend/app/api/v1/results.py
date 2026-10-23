import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user_optional
from backend.app.models.user import User
from backend.app.models.result import QuizResult, QuestionAttemptResult
from backend.app.schemas.result_schema import QuizResultResponse, QuizResultListItem, QuestionAttemptDetail

router = APIRouter(prefix="/results", tags=["Results & Analytics"])

@router.get("", response_model=List[QuizResultListItem])
def list_results(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    query = db.query(QuizResult)
    if current_user:
        if current_user.role != "admin":
            query = query.filter(QuizResult.user_id == current_user.id)
    else:
        query = query.filter(QuizResult.user_id == None)
    results = query.order_by(QuizResult.completed_at.desc()).all()
    out = []
    for r in results:
        out.append(
            QuizResultListItem(
                id=r.id,
                quiz_id=r.quiz_id,
                quiz_title=r.quiz.title if r.quiz else "Assessment",
                score=r.score,
                max_score=r.max_score,
                percentage=r.percentage,
                total_questions=r.total_questions,
                correct_count=r.correct_count,
                incorrect_count=r.incorrect_count,
                time_taken_seconds=r.time_taken_seconds,
                completed_at=r.completed_at
            )
        )
    return out

@router.get("/{result_id}", response_model=QuizResultResponse)
def get_result_details(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    result = db.query(QuizResult).filter(QuizResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
        
    if result.user_id:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required to view this result.")
        if current_user.role != "admin" and result.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You do not have permission to view this result.")
        
    attempts = db.query(QuestionAttemptResult).filter(QuestionAttemptResult.result_id == result.id).all()
    
    details = [
        QuestionAttemptDetail(
            id=a.id,
            question_id=a.question_id,
            question_snapshot=a.question_snapshot,
            user_answer=a.user_answer,
            is_correct=a.is_correct,
            is_partially_correct=a.is_partially_correct,
            marks_awarded=a.marks_awarded,
            max_marks=a.max_marks,
            time_spent_seconds=a.time_spent_seconds,
            feedback=a.feedback,
            evaluation_method=a.evaluation_method
        )
        for a in attempts
    ]
    
    return QuizResultResponse(
        id=result.id,
        quiz_id=result.quiz_id,
        quiz_title=result.quiz.title if result.quiz else "Assessment",
        session_id=result.session_id,
        total_questions=result.total_questions,
        correct_count=result.correct_count,
        incorrect_count=result.incorrect_count,
        unanswered_count=result.unanswered_count,
        partially_correct_count=result.partially_correct_count,
        pending_review_count=result.pending_review_count,
        score=result.score,
        max_score=result.max_score,
        percentage=result.percentage,
        time_taken_seconds=result.time_taken_seconds,
        completed_at=result.completed_at,
        breakdown=result.breakdown or {},
        attempt_details=details
    )

@router.get("/{result_id}/export-csv")
def export_result_csv(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    result = db.query(QuizResult).filter(QuizResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
        
    if result.user_id:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required to view this result.")
        if current_user.role != "admin" and result.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You do not have permission to view this result.")
        
    attempts = db.query(QuestionAttemptResult).filter(QuestionAttemptResult.result_id == result.id).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Question No", "Question Text", "Question Type", "User Answer", "Correct Answer",
        "Is Correct", "Marks Awarded", "Max Marks", "Time Spent (s)", "Feedback"
    ])
    
    for idx, a in enumerate(attempts, 1):
        q_snap = a.question_snapshot or {}
        writer.writerow([
            idx,
            q_snap.get("question_text", ""),
            q_snap.get("question_type", ""),
            str(a.user_answer),
            str(q_snap.get("correct_answer", "")),
            "Yes" if a.is_correct else "No",
            a.marks_awarded,
            a.max_marks,
            a.time_spent_seconds,
            a.feedback or ""
        ])
        
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=assessment_result_{result_id}.csv"}
    )
