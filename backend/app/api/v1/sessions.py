from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.models.quiz import Quiz
from backend.app.models.session import QuizSession
from backend.app.schemas.session_schema import (
    StartSessionRequest, SessionStatusResponse, SubmitAnswerRequest, SessionNavigationRequest,
    RunCodeRequest, RunCodeResponse, CheckAnswerRequest, CheckAnswerResponse
)
from backend.app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["Assessment Sessions"])

@router.post("/start", response_model=SessionStatusResponse)
def start_quiz_session(payload: StartSessionRequest, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == payload.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    if not quiz.question_ids:
        raise HTTPException(status_code=400, detail="Cannot start an assessment with no questions assigned.")
        
    session = SessionService.start_session(
        db,
        quiz,
        requested_question_count=payload.question_count,
        requested_question_ids=payload.question_ids,
        mode=payload.mode
    )
    return SessionService.get_session_status(db, session)

@router.get("/{session_token}", response_model=SessionStatusResponse)
def get_session(session_token: str, db: Session = Depends(get_db)):
    session = db.query(QuizSession).filter(QuizSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")
        
    return SessionService.get_session_status(db, session)

@router.post("/{session_token}/answer")
def submit_answer(session_token: str, payload: SubmitAnswerRequest, db: Session = Depends(get_db)):
    session = db.query(QuizSession).filter(QuizSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")
        
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail=f"Cannot submit answer in '{session.status}' state.")
        
    SessionService.submit_answer(db, session, payload)
    return {"message": "Answer recorded successfully"}

@router.post("/{session_token}/check-answer", response_model=CheckAnswerResponse)
def check_answer(session_token: str, payload: CheckAnswerRequest, db: Session = Depends(get_db)):
    session = db.query(QuizSession).filter(QuizSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")
        
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail=f"Cannot check answer in '{session.status}' state.")
        
    try:
        return SessionService.check_answer(db, session, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{session_token}/navigate", response_model=SessionStatusResponse)
def navigate_question(session_token: str, payload: SessionNavigationRequest, db: Session = Depends(get_db)):
    session = db.query(QuizSession).filter(QuizSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")
        
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail=f"Cannot navigate question in '{session.status}' state.")
        
    session = SessionService.navigate_question(db, session, payload.target_index)
    return SessionService.get_session_status(db, session)

@router.post("/{session_token}/submit")
def submit_assessment(session_token: str, db: Session = Depends(get_db)):
    session = db.query(QuizSession).filter(QuizSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")
        
    result = SessionService.submit_and_evaluate(db, session)
    return {
        "message": "Assessment successfully submitted and evaluated",
        "result_id": result.id,
        "session_token": session_token
    }

@router.post("/{session_token}/run-code", response_model=RunCodeResponse)
def run_session_code(session_token: str, payload: RunCodeRequest, db: Session = Depends(get_db)):
    session = db.query(QuizSession).filter(QuizSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")
        
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail=f"Cannot run code in '{session.status}' state.")
        
    return SessionService.execute_code(payload.code, payload.language, payload.test_cases)
