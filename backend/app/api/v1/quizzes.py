from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.models.quiz import Quiz
from backend.app.models.question import Question
from backend.app.schemas.quiz_schema import QuizCreate, QuizUpdate, QuizRead
from backend.app.schemas.question import QuestionRead, QuestionCreate

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])

@router.get("", response_model=List[QuizRead])
def list_quizzes(db: Session = Depends(get_db)):
    quizzes = db.query(Quiz).order_by(Quiz.created_at.desc()).all()
    results = []
    for q in quizzes:
        item = QuizRead.model_validate(q)
        item.question_count = len(q.question_ids) if q.question_ids else 0
        results.append(item)
    return results

@router.post("", response_model=QuizRead)
def create_quiz(payload: QuizCreate, db: Session = Depends(get_db)):
    quiz_data = payload.model_dump()
    quiz = Quiz(**quiz_data)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    
    if quiz.question_ids:
        db.query(Question).filter(Question.id.in_(quiz.question_ids)).update({"quiz_id": quiz.id}, synchronize_session=False)
        db.commit()
    
    item = QuizRead.model_validate(quiz)
    item.question_count = len(quiz.question_ids) if quiz.question_ids else 0
    return item

@router.get("/{quiz_id}", response_model=QuizRead)
def get_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    item = QuizRead.model_validate(quiz)
    item.question_count = len(quiz.question_ids) if quiz.question_ids else 0
    return item

@router.put("/{quiz_id}", response_model=QuizRead)
def update_quiz(quiz_id: int, payload: QuizUpdate, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(quiz, k, v)
        
    db.commit()
    db.refresh(quiz)
    item = QuizRead.model_validate(quiz)
    item.question_count = len(quiz.question_ids) if quiz.question_ids else 0
    return item

@router.delete("/{quiz_id}")
def delete_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Cascade delete all questions belonging to this quiz's dedicated question bank
    if quiz.question_ids:
        db.query(Question).filter(Question.id.in_(quiz.question_ids)).delete(synchronize_session=False)
    db.query(Question).filter(Question.quiz_id == quiz.id).delete(synchronize_session=False)
    
    db.delete(quiz)
    db.commit()
    return {"message": "Assessment and its individual question bank deleted successfully"}

@router.get("/{quiz_id}/questions", response_model=List[QuestionRead])
def get_quiz_questions(quiz_id: int, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Query questions attached via quiz_id or listed in question_ids
    q_ids = quiz.question_ids or []
    questions = db.query(Question).filter(
        (Question.quiz_id == quiz_id) | (Question.id.in_(q_ids) if q_ids else False)
    ).all()
    
    # Sort in order of quiz.question_ids if available
    if q_ids:
        order_map = {qid: idx for idx, qid in enumerate(q_ids)}
        questions.sort(key=lambda x: order_map.get(x.id, 99999))
    return questions

@router.post("/{quiz_id}/questions", response_model=QuestionRead)
def add_question_to_quiz(quiz_id: int, payload: QuestionCreate, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    q_data = payload.model_dump()
    q_data["quiz_id"] = quiz_id
    if "options" in q_data and q_data["options"]:
        q_data["options"] = [
            (opt if isinstance(opt, dict) else opt.model_dump())
            for opt in q_data["options"]
        ]
        
    question = Question(**q_data)
    db.add(question)
    db.flush()
    
    current_ids = list(quiz.question_ids or [])
    if question.id not in current_ids:
        current_ids.append(question.id)
        quiz.question_ids = current_ids
    
    # Add section if new
    sec_name = payload.section_name or "General"
    secs = list(quiz.sections or [])
    if not any(s.get("name") == sec_name for s in secs):
        secs.append({"name": sec_name, "description": ""})
        quiz.sections = secs
        
    db.commit()
    db.refresh(question)
    return question

@router.delete("/{quiz_id}/questions/{question_id}")
def delete_question_from_quiz(quiz_id: int, question_id: int, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    # Remove from quiz question_ids
    if quiz.question_ids and question_id in quiz.question_ids:
        quiz.question_ids = [qid for qid in quiz.question_ids if qid != question_id]
        
    # Delete question
    q = db.query(Question).filter(Question.id == question_id).first()
    if q:
        db.delete(q)
    db.commit()
    return {"message": "Question deleted successfully from assessment bank"}

@router.delete("/{quiz_id}/sections/{section_name}")
def delete_section_from_quiz(quiz_id: int, section_name: str, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    # Find all questions in this section
    q_in_sec = db.query(Question).filter(
        ((Question.quiz_id == quiz_id) | (Question.id.in_(quiz.question_ids or []))) &
        (Question.section_name == section_name)
    ).all()
    
    del_ids = {q.id for q in q_in_sec}
    for q in q_in_sec:
        db.delete(q)
        
    if quiz.question_ids:
        quiz.question_ids = [qid for qid in quiz.question_ids if qid not in del_ids]
    if quiz.sections:
        quiz.sections = [s for s in quiz.sections if s.get("name") != section_name]
        
    db.commit()
    return {"message": f"Section '{section_name}' and its {len(del_ids)} questions deleted successfully"}
