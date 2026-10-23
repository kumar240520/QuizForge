import json
import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from backend.app.core.database import get_db
from backend.app.models.import_job import ImportJob
from backend.app.models.question import Question
from backend.app.models.question_bank import QuestionBank, Subject, Topic
from backend.app.models.quiz import Quiz
from backend.app.schemas.import_schema import (
    ImportJobResponse, TextImportRequest, ApproveQuestionsRequest, ParsedQuestionItem
)
from backend.app.services.parsing_service import ParsingService

router = APIRouter(prefix="/imports", tags=["Imports"])

@router.post("/pdf", response_model=ImportJobResponse)
async def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    pdf_bytes = await file.read()
    if len(pdf_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF file size exceeds 25MB limit.")
        
    try:
        full_text, pages = ParsingService.extract_text_from_pdf(pdf_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF document: {str(e)}")
        
    if not full_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF. The document may be scanned or empty.")
        
    parsed_items = ParsingService.parse_text_questions(full_text, source_ref_prefix=f"{file.filename}")
    
    issues_list = []
    for idx, item in enumerate(parsed_items):
        if item.issues:
            issues_list.append({"question_index": idx, "temp_id": item.temp_id, "issues": item.issues})
            
    job = ImportJob(
        source_type="pdf",
        filename=file.filename,
        raw_content=full_text[:50000], # store preview
        total_detected=len(parsed_items),
        successfully_parsed=sum(1 for i in parsed_items if i.status == "valid"),
        issues_count=len(issues_list),
        parsed_questions=[item.model_dump() for item in parsed_items],
        issues=issues_list,
        status="parsed"
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@router.post("/text", response_model=ImportJobResponse)
def import_pasted_text(payload: TextImportRequest, db: Session = Depends(get_db)):
    parsed_items = ParsingService.parse_text_questions(payload.content, source_ref_prefix="Pasted Text")
    
    issues_list = []
    for idx, item in enumerate(parsed_items):
        if item.issues:
            issues_list.append({"question_index": idx, "temp_id": item.temp_id, "issues": item.issues})
            
    job = ImportJob(
        source_type="text",
        filename="Pasted_Questions.txt",
        raw_content=payload.content[:50000],
        total_detected=len(parsed_items),
        successfully_parsed=sum(1 for i in parsed_items if i.status == "valid"),
        issues_count=len(issues_list),
        parsed_questions=[item.model_dump() for item in parsed_items],
        issues=issues_list,
        status="parsed"
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@router.post("/json", response_model=ImportJobResponse)
def import_json(raw_json: List[dict], db: Session = Depends(get_db)):
    parsed_items: List[ParsedQuestionItem] = []
    issues_list = []
    
    for idx, item in enumerate(raw_json, 1):
        q_text = item.get("question_text") or f"Question {idx}"
        q_type = item.get("question_type") or "single_choice"
        opts = item.get("options") or []
        corr = item.get("correct_answer")
        
        # Consolidate metadata_extra and any top-level helper fields
        meta_extra = dict(item.get("metadata_extra") or {})
        for extra_key in ["code", "code_snippet", "language", "starter_code", "test_cases", "constraints", "sample_input", "sample_output", "expected_fn", "function_name", "match_targets"]:
            if extra_key in item and extra_key not in meta_extra:
                if extra_key == "code" and "code_snippet" not in meta_extra:
                    meta_extra["code_snippet"] = item[extra_key]
                meta_extra[extra_key] = item[extra_key]
                
        if q_type == "code_output" and "code" in item and "code_snippet" not in meta_extra:
            meta_extra["code"] = item["code"]
            meta_extra["code_snippet"] = item["code"]

        if q_type == "coding":
            # Extract expected function name
            expected_fn = meta_extra.get("expected_fn") or meta_extra.get("function_name")
            if not expected_fn and corr:
                corr_str = corr[0] if isinstance(corr, list) and len(corr) > 0 else str(corr)
                m = re.search(r"def\s+([a-zA-Z_]\w*)\s*\(", corr_str)
                if m:
                    expected_fn = m.group(1)
            expected_fn = expected_fn or "solution"
            meta_extra["expected_fn"] = expected_fn
            meta_extra["function_name"] = expected_fn

            # Ensure starter code exists
            if "starter_code" not in meta_extra:
                meta_extra["starter_code"] = f"def {expected_fn}():\n    # Write your solution here\n    pass\n"

            # Auto-generate test cases if sample_input & sample_output present
            if "test_cases" not in meta_extra and ("sample_input" in meta_extra or "sample_output" in meta_extra):
                meta_extra["test_cases"] = [{
                    "input": meta_extra.get("sample_input", ""),
                    "expected_output": meta_extra.get("sample_output", ""),
                    "expected_fn": expected_fn
                }]
        
        issues = []
        if corr is None:
            issues.append("Missing correct answer key")
        if q_type in ["single_choice", "multiple_choice"] and len(opts) < 2:
            issues.append("Fewer than 2 options provided")
            
        status = "needs_review" if issues else "valid"
        
        parsed_item = ParsedQuestionItem(
            temp_id=f"json-{idx}",
            question_text=q_text,
            question_type=q_type,
            difficulty=item.get("difficulty", "medium"),
            options=opts,
            correct_answer=corr if corr is not None else ["A"],
            accepted_answers=item.get("accepted_answers", []),
            numerical_tolerance=float(item.get("numerical_tolerance", 0.0)),
            explanation=item.get("explanation"),
            points=float(item.get("points", 1.0)),
            negative_marks=float(item.get("negative_marks", 0.0)),
            source_ref=item.get("source_ref") or "Structured JSON Import",
            section_name=item.get("section_name", "General"),
            per_question_timer=item.get("per_question_timer"),
            status=status,
            issues=issues,
            is_approved=len(issues) == 0,
            metadata_extra=meta_extra
        )
        parsed_items.append(parsed_item)
        if issues:
            issues_list.append({"question_index": idx - 1, "temp_id": parsed_item.temp_id, "issues": issues})
            
    job = ImportJob(
        source_type="json",
        filename="structured_import.json",
        raw_content=json.dumps(raw_json)[:50000],
        total_detected=len(parsed_items),
        successfully_parsed=sum(1 for i in parsed_items if i.status == "valid"),
        issues_count=len(issues_list),
        parsed_questions=[item.model_dump() for item in parsed_items],
        issues=issues_list,
        status="parsed"
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@router.get("/jobs/{job_id}", response_model=ImportJobResponse)
def get_import_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return job

@router.post("/jobs/{job_id}/approve")
def approve_and_commit_import(
    job_id: int, 
    payload: ApproveQuestionsRequest, 
    db: Session = Depends(get_db)
):
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
        
    # Target quiz if provided
    quiz = None
    if payload.quiz_id:
        quiz = db.query(Quiz).filter(Quiz.id == payload.quiz_id).first()

    # Get or create target bank
    bank_id = payload.bank_id
    if not bank_id and not payload.quiz_id:
        default_bank = db.query(QuestionBank).filter(QuestionBank.is_default == True).first()
        if not default_bank:
            default_bank = QuestionBank(title="Assessment Questions Bank", is_default=True)
            db.add(default_bank)
            db.commit()
            db.refresh(default_bank)
        bank_id = default_bank.id

    created_questions = []
    new_qids = []
    sections_seen = set()
    target_sec = payload.target_section.strip() if payload.target_section and payload.target_section.strip() else None

    for item in payload.questions:
        if not item.is_approved:
            continue
            
        # If target_section is explicitly targeted, all approved items belong to this section
        if target_sec:
            sec = target_sec
        else:
            sec = (item.section_name or "General").strip() or "General"
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
            source_ref=item.source_ref,
            creation_source=f"imported_{job.source_type}",
            is_approved=True,
            metadata_extra=item.metadata_extra or {}
        )
        db.add(q)
        created_questions.append(q)

    db.flush()
    for q in created_questions:
        new_qids.append(q.id)

    if quiz:
        current_ids = list(quiz.question_ids or [])
        for qid in new_qids:
            if qid not in current_ids:
                current_ids.append(qid)
        quiz.question_ids = current_ids
        flag_modified(quiz, "question_ids")
        
        # Merge sections
        existing_secs = list(quiz.sections or [])
        existing_names = {s.get("name") for s in existing_secs}
        for sec in sections_seen:
            if sec not in existing_names:
                existing_secs.append({"name": sec, "description": ""})
        quiz.sections = existing_secs
        flag_modified(quiz, "sections")

    job.status = "approved"
    db.commit()
    
    return {
        "message": f"Successfully approved and saved {len(created_questions)} questions.",
        "imported_count": len(created_questions),
        "quiz_id": payload.quiz_id,
        "bank_id": bank_id
    }
