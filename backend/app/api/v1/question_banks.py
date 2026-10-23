from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.models.question_bank import QuestionBank, Subject, Topic
from backend.app.models.question import Question
from backend.app.schemas.question import (
    QuestionBankCreate, QuestionBankRead,
    SubjectCreate, SubjectRead,
    TopicCreate, TopicRead
)

router = APIRouter(prefix="/banks", tags=["Question Banks"])

@router.get("", response_model=List[QuestionBankRead])
def list_banks(db: Session = Depends(get_db)):
    banks = db.query(QuestionBank).all()
    # If no banks exist, auto-create a Default Bank
    if not banks:
        default_bank = QuestionBank(title="Default Bank", description="Primary personal question bank", is_default=True)
        db.add(default_bank)
        db.commit()
        db.refresh(default_bank)
        banks = [default_bank]
        
    res = []
    for b in banks:
        q_count = db.query(Question).filter(Question.bank_id == b.id).count()
        item = QuestionBankRead.model_validate(b)
        item.question_count = q_count
        res.append(item)
    return res

@router.post("", response_model=QuestionBankRead)
def create_bank(payload: QuestionBankCreate, db: Session = Depends(get_db)):
    bank = QuestionBank(**payload.model_dump())
    db.add(bank)
    db.commit()
    db.refresh(bank)
    item = QuestionBankRead.model_validate(bank)
    item.question_count = 0
    return item

@router.delete("/{bank_id}")
def delete_bank(bank_id: int, db: Session = Depends(get_db)):
    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id).first()
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    db.delete(bank)
    db.commit()
    return {"message": "Question bank deleted successfully"}

# Subjects
@router.get("/subjects", response_model=List[SubjectRead])
def list_subjects(bank_id: int = None, db: Session = Depends(get_db)):
    q = db.query(Subject)
    if bank_id:
        q = q.filter(Subject.bank_id == bank_id)
    return q.all()

@router.post("/subjects", response_model=SubjectRead)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)):
    subject = Subject(**payload.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject

# Topics
@router.get("/topics", response_model=List[TopicRead])
def list_topics(subject_id: int = None, db: Session = Depends(get_db)):
    q = db.query(Topic)
    if subject_id:
        q = q.filter(Topic.subject_id == subject_id)
    return q.all()

@router.post("/topics", response_model=TopicRead)
def create_topic(payload: TopicCreate, db: Session = Depends(get_db)):
    topic = Topic(**payload.model_dump())
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic
