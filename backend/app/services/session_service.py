import uuid
import random
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from backend.app.models.quiz import Quiz
from backend.app.models.question import Question
from backend.app.models.session import QuizSession, SessionAnswer
from backend.app.models.result import QuizResult, QuestionAttemptResult
from backend.app.models.revision import RevisionItem
from backend.app.schemas.session_schema import (
    ClientQuestionView, SessionStatusResponse, SubmitAnswerRequest,
    QuestionPaletteItem, TestCaseResult, RunCodeResponse,
    CheckAnswerRequest, CheckAnswerResponse
)
from backend.app.schemas.question import QuestionOptionSchema
from backend.app.services.scoring_service import ScoringService
from backend.app.services.parsing_service import ParsingService

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class SessionService:
    @classmethod
    def start_session(
        cls,
        db: Session,
        quiz: Quiz,
        requested_question_count: Optional[int] = None,
        requested_question_ids: Optional[List[int]] = None,
        mode: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> QuizSession:
        """Create and initialize a server-authoritative quiz session."""
        if requested_question_ids and len(requested_question_ids) > 0:
            # Explicit custom question selection requested by user
            question_ids = [int(qid) for qid in requested_question_ids]
        else:
            question_ids = list(quiz.question_ids)
            
            # Custom count of questions selection
            if requested_question_count is not None and requested_question_count > 0:
                target_count = requested_question_count
            else:
                target_count = getattr(quiz, 'question_count_to_present', None)
            if target_count and 0 < target_count < len(question_ids):
                if quiz.randomize_questions:
                    random.shuffle(question_ids)
                    question_ids = question_ids[:target_count]
                else:
                    question_ids = question_ids[:target_count]
            elif quiz.randomize_questions:
                random.shuffle(question_ids)
            
        now = utc_now()
        token = uuid.uuid4().hex
        
        session_mode = mode or quiz.mode or "exam"

        # Calculate session deadline (Exam mode enforces deadlines strictly, Practice can be untimed if configured)
        session_deadline = None
        if quiz.timing_mode in ["total_duration", "both"] and quiz.duration_minutes:
            session_deadline = now + timedelta(minutes=quiz.duration_minutes)
            
        # Option order randomization per question
        option_orders: Dict[str, List[str]] = {}
        if quiz.randomize_options:
            questions = db.query(Question).filter(Question.id.in_(question_ids)).all()
            for q in questions:
                if q.options and isinstance(q.options, list):
                    opt_ids = [opt.get("id") if isinstance(opt, dict) else opt.id for opt in q.options]
                    random.shuffle(opt_ids)
                    option_orders[str(q.id)] = opt_ids

        # Per question deadlines
        per_question_deadlines: Dict[str, str] = {}
        if quiz.timing_mode in ["per_question", "both"]:
            # Set deadline for the first question
            first_q_id = str(question_ids[0]) if question_ids else None
            if first_q_id:
                first_q_obj = db.query(Question).filter(Question.id == int(first_q_id)).first()
                q_indiv_timer = getattr(first_q_obj, 'per_question_timer', None) if first_q_obj else None
                limit = (quiz.custom_question_durations or {}).get(first_q_id) or q_indiv_timer or quiz.per_question_seconds or 60
                q_deadline = now + timedelta(seconds=limit)
                if session_deadline and q_deadline > session_deadline:
                    q_deadline = session_deadline
                per_question_deadlines[first_q_id] = q_deadline.isoformat()

        first_q_id_int = int(question_ids[0]) if question_ids else None
        visited_ids = [first_q_id_int] if first_q_id_int is not None else []

        session = QuizSession(
            session_token=token,
            quiz_id=quiz.id,
            user_id=user_id,
            mode=session_mode,
            status="in_progress",
            current_question_index=0,
            started_at=now,
            session_deadline=session_deadline,
            question_order=question_ids,
            option_orders=option_orders,
            per_question_deadlines=per_question_deadlines,
            visited_question_ids=visited_ids
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @classmethod
    def get_session_status(cls, db: Session, session: QuizSession) -> SessionStatusResponse:
        """Calculate and return full session status with server-authoritative remaining time."""
        now = utc_now()
        quiz = session.quiz
        
        # Check if session has expired
        if session.status == "in_progress" and session.session_deadline:
            deadline = session.session_deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if now >= deadline:
                # Automatically auto-submit and evaluate
                cls.submit_and_evaluate(db, session)
                db.refresh(session)

        # Compute remaining seconds
        session_remaining = None
        if session.session_deadline:
            deadline = session.session_deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            session_remaining = max(0, int((deadline - now).total_seconds()))

        question_remaining = None
        curr_q_id = None
        if 0 <= session.current_question_index < len(session.question_order):
            curr_q_id = str(session.question_order[session.current_question_index])
            
        if curr_q_id and session.per_question_deadlines and curr_q_id in session.per_question_deadlines:
            q_dl_str = session.per_question_deadlines[curr_q_id]
            q_dl = datetime.fromisoformat(q_dl_str)
            if q_dl.tzinfo is None:
                q_dl = q_dl.replace(tzinfo=timezone.utc)
            question_remaining = max(0, int((q_dl - now).total_seconds()))

        # Build answers status map
        answers = db.query(SessionAnswer).filter(SessionAnswer.session_id == session.id).all()
        answers_by_qid = {str(a.question_id): a for a in answers}
        
        answered_count = 0
        flagged_count = 0
        skipped_count = 0
        status_map: Dict[str, Dict[str, Any]] = {}

        # Set of actually visited questions (persisted list + currently active question + any question with answers/time spent)
        visited_set = set(session.visited_question_ids or [])
        if curr_q_id:
            visited_set.add(int(curr_q_id))
        for qid_s, ans_item in answers_by_qid.items():
            if ans_item.user_answer is not None or ans_item.is_flagged or (ans_item.time_spent_seconds or 0) > 0:
                visited_set.add(int(qid_s))

        palette_list: List[QuestionPaletteItem] = []
        for idx, q_id in enumerate(session.question_order):
            qid_str = str(q_id)
            ans = answers_by_qid.get(qid_str)
            is_ans = ans is not None and ans.user_answer is not None and not ans.is_skipped
            is_flg = ans is not None and ans.is_flagged
            is_skp = ans is not None and ans.is_skipped
            is_vis = int(q_id) in visited_set
            
            if is_ans:
                answered_count += 1
            if is_flg:
                flagged_count += 1
            if is_skp:
                skipped_count += 1
                
            status_map[qid_str] = {
                "is_answered": is_ans,
                "is_flagged": is_flg,
                "is_skipped": is_skp,
                "is_visited": is_vis
            }
            palette_list.append(
                QuestionPaletteItem(
                    index=idx,
                    question_id=int(q_id),
                    is_answered=is_ans,
                    is_flagged=is_flg,
                    is_visited=is_vis
                )
            )

        # Active question view
        current_question_view = None
        current_answer_val = None
        is_curr_flagged = False
        
        if curr_q_id:
            q_obj = db.query(Question).filter(Question.id == int(curr_q_id)).first()
            if q_obj:
                # Option ordering
                opts = []
                opt_order = (session.option_orders or {}).get(curr_q_id)
                raw_opts = q_obj.options or []
                
                # Convert raw_opts to dict map
                raw_opts_dict = {
                    (opt.get("id") if isinstance(opt, dict) else opt.id): (opt.get("text") if isinstance(opt, dict) else opt.text)
                    for opt in raw_opts
                }
                
                if opt_order:
                    for oid in opt_order:
                        if oid in raw_opts_dict:
                            opts.append(QuestionOptionSchema(id=oid, text=raw_opts_dict[oid]))
                else:
                    for opt in raw_opts:
                        if isinstance(opt, dict):
                            opts.append(QuestionOptionSchema(id=opt["id"], text=opt["text"]))
                        else:
                            opts.append(QuestionOptionSchema(id=opt.id, text=opt.text))

                # Sanitize options text
                clean_opts = [
                    QuestionOptionSchema(id=opt.id, text=ParsingService.clean_text(opt.text))
                    for opt in opts
                ]

                # Question duration limit (prioritize custom duration on quiz or question's own timer, then quiz default)
                q_limit = (quiz.custom_question_durations or {}).get(curr_q_id) or getattr(q_obj, 'per_question_timer', None) or quiz.per_question_seconds

                session_mode = getattr(session, 'mode', None) or quiz.mode or "exam"
                # Show correct answer only if Practice Mode AND immediate_feedback is enabled
                show_ans = session_mode == "practice" and quiz.immediate_feedback
                
                meta_extra = dict(q_obj.metadata_extra or {})
                if q_obj.question_type == "match_the_following" and "match_targets" not in meta_extra:
                    corr = q_obj.correct_answer
                    targets = []
                    if isinstance(corr, dict):
                        for k, v in corr.items():
                            targets.append({"id": str(k), "text": str(v)})
                    elif isinstance(corr, list):
                        for i, v in enumerate(corr):
                            targets.append({"id": str(i + 1), "text": str(v)})
                    if targets:
                        shuffled_targets = sorted(targets, key=lambda x: str(x.get("text", "")))
                        meta_extra["match_targets"] = shuffled_targets

                current_question_view = ClientQuestionView(
                    id=q_obj.id,
                    question_text=ParsingService.clean_text(q_obj.question_text),
                    question_type=q_obj.question_type,
                    difficulty=q_obj.difficulty,
                    points=q_obj.points,
                    negative_marks=q_obj.negative_marks,
                    options=clean_opts,
                    correct_answer=q_obj.correct_answer if show_ans else None,
                    explanation=ParsingService.clean_text(q_obj.explanation) if (show_ans and quiz.show_explanation and q_obj.explanation) else None,
                    worked_solution=ParsingService.clean_text(q_obj.worked_solution) if (show_ans and quiz.show_explanation and q_obj.worked_solution) else None,
                    time_limit_seconds=q_limit,
                    section_name=getattr(q_obj, 'section_name', 'General') or 'General',
                    metadata_extra=meta_extra
                )
                
                curr_ans_obj = answers_by_qid.get(curr_q_id)
                if curr_ans_obj:
                    current_answer_val = curr_ans_obj.user_answer
                    is_curr_flagged = curr_ans_obj.is_flagged

        return SessionStatusResponse(
            session_token=session.session_token,
            quiz_id=quiz.id,
            quiz_title=quiz.title,
            mode=session_mode,
            status=session.status,
            current_question_index=session.current_question_index,
            total_questions=len(session.question_order),
            started_at=session.started_at,
            session_deadline=session.session_deadline,
            session_remaining_seconds=session_remaining,
            question_remaining_seconds=question_remaining,
            answered_count=answered_count,
            flagged_count=flagged_count,
            skipped_count=skipped_count,
            question_order=[int(x) for x in session.question_order],
            question_palette=palette_list,
            question_status_map=status_map,
            current_question=current_question_view,
            current_answer=current_answer_val,
            is_current_flagged=is_curr_flagged,
            sections=quiz.sections or [],
            allow_skip=quiz.allow_skip,
            allow_back_nav=quiz.allow_back_nav,
            allow_change_answer=quiz.allow_change_answer,
            immediate_feedback=(session_mode in ["practice", "revision"]) or bool(quiz.immediate_feedback),
            show_explanation=quiz.show_explanation or (session_mode in ["practice", "revision"]),
            timing_mode=quiz.timing_mode
        )

    @classmethod
    def submit_answer(cls, db: Session, session: QuizSession, payload: SubmitAnswerRequest) -> SessionAnswer:
        """Save or update an answer for a question in this session."""
        ans = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session.id,
            SessionAnswer.question_id == payload.question_id
        ).first()
        
        now = utc_now()
        if not ans:
            ans = SessionAnswer(
                session_id=session.id,
                question_id=payload.question_id,
                user_answer=payload.user_answer,
                is_flagged=payload.is_flagged,
                is_skipped=payload.is_skipped,
                time_spent_seconds=payload.time_spent_seconds,
                submitted_at=now
            )
            db.add(ans)
        else:
            ans.user_answer = payload.user_answer
            ans.is_flagged = payload.is_flagged
            ans.is_skipped = payload.is_skipped
            ans.time_spent_seconds += payload.time_spent_seconds
            ans.submitted_at = now
            
        # Ensure answered question is recorded in visited_question_ids
        visited = list(session.visited_question_ids or [])
        if payload.question_id not in visited:
            visited.append(payload.question_id)
            session.visited_question_ids = visited
            flag_modified(session, "visited_question_ids")

        db.commit()
        db.refresh(ans)
        return ans

    @classmethod
    def check_answer(cls, db: Session, session: QuizSession, payload: CheckAnswerRequest) -> CheckAnswerResponse:
        """Instant answer validation for Practice Mode without advancing question."""
        q_obj = db.query(Question).filter(Question.id == payload.question_id).first()
        if not q_obj:
            raise ValueError("Question not found")
            
        quiz = session.quiz
        # Record this answer in SessionAnswer so progress is saved
        ans = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session.id,
            SessionAnswer.question_id == payload.question_id
        ).first()
        now = utc_now()
        if not ans:
            ans = SessionAnswer(
                session_id=session.id,
                question_id=payload.question_id,
                user_answer=payload.user_answer,
                time_spent_seconds=payload.time_spent_seconds,
                submitted_at=now
            )
            db.add(ans)
        else:
            ans.user_answer = payload.user_answer
            ans.time_spent_seconds += payload.time_spent_seconds
            ans.submitted_at = now

        # Ensure answered question is recorded in visited_question_ids
        visited = list(session.visited_question_ids or [])
        if payload.question_id not in visited:
            visited.append(payload.question_id)
            session.visited_question_ids = visited
            flag_modified(session, "visited_question_ids")
        
        db.commit()

        q_dict = {
            "question_text": q_obj.question_text,
            "question_type": q_obj.question_type,
            "difficulty": q_obj.difficulty,
            "options": [
                (opt if isinstance(opt, dict) else {"id": opt.id, "text": opt.text})
                for opt in (q_obj.options or [])
            ],
            "correct_answer": q_obj.correct_answer,
            "accepted_answers": q_obj.accepted_answers,
            "numerical_tolerance": q_obj.numerical_tolerance,
            "explanation": q_obj.explanation,
            "worked_solution": q_obj.worked_solution,
            "points": q_obj.points,
            "negative_marks": 0.0 if session.mode in ["practice", "revision"] else q_obj.negative_marks,
            "source_ref": q_obj.source_ref,
            "metadata_extra": q_obj.metadata_extra or {}
        }

        quiz_config_dict = {
            "positive_marks": quiz.positive_marks,
            "negative_marks": 0.0 if session.mode in ["practice", "revision"] else quiz.negative_marks,
            "partial_credit": quiz.partial_credit
        }

        eval_res = ScoringService.evaluate_question(q_dict, payload.user_answer, quiz_config_dict)

        # In Revision Mode or Practice Mode, update spaced repetition revision state
        cls._update_revision_item(db, q_obj.id, eval_res["is_correct"], now)
        db.commit()

        return CheckAnswerResponse(
            question_id=q_obj.id,
            is_correct=eval_res["is_correct"],
            is_partially_correct=eval_res.get("is_partially_correct", False),
            points_awarded=eval_res["marks_awarded"],
            max_marks=eval_res["max_marks"],
            correct_answer=q_obj.correct_answer,
            explanation=q_obj.explanation,
            worked_solution=q_obj.worked_solution,
            feedback=eval_res.get("feedback"),
            details=eval_res.get("details", {})
        )

    @classmethod
    def navigate_question(cls, db: Session, session: QuizSession, target_index: int) -> QuizSession:
        """Navigate to target question index and set up question timers if applicable."""
        if 0 <= target_index < len(session.question_order):
            session.current_question_index = target_index
            target_qid_int = int(session.question_order[target_index])

            # Record newly visited question
            visited = list(session.visited_question_ids or [])
            if target_qid_int not in visited:
                visited.append(target_qid_int)
                session.visited_question_ids = visited
                flag_modified(session, "visited_question_ids")

            # Setup question timer for the newly navigated question if not already set
            now = utc_now()
            target_qid = str(session.question_order[target_index])
            deadlines = dict(session.per_question_deadlines or {})
            
            if session.quiz.timing_mode in ["per_question", "both"] and target_qid not in deadlines:
                target_q_obj = db.query(Question).filter(Question.id == int(target_qid)).first()
                q_indiv_timer = getattr(target_q_obj, 'per_question_timer', None) if target_q_obj else None
                limit = (session.quiz.custom_question_durations or {}).get(target_qid) or q_indiv_timer or session.quiz.per_question_seconds or 60
                q_dl = now + timedelta(seconds=limit)
                if session.session_deadline:
                    deadline = session.session_deadline
                    if deadline.tzinfo is None:
                        deadline = deadline.replace(tzinfo=timezone.utc)
                    if q_dl > deadline:
                        q_dl = deadline
                deadlines[target_qid] = q_dl.isoformat()
                session.per_question_deadlines = deadlines
                
            db.commit()
            db.refresh(session)
        return session

    @classmethod
    def submit_and_evaluate(cls, db: Session, session: QuizSession) -> QuizResult:
        """
        Finalize assessment:
        1. Evaluate all questions deterministically using ScoringService.
        2. Create immutable QuestionAttemptResult snapshots.
        3. Create QuizResult record.
        4. Update Spaced Repetition mastery items.
        """
        if session.status in ["submitted", "expired", "evaluated"]:
            existing_res = db.query(QuizResult).filter(QuizResult.session_id == session.id).first()
            if existing_res:
                return existing_res

        now = utc_now()
        session.status = "submitted"
        session.submitted_at = now
        db.commit()

        quiz = session.quiz
        questions = db.query(Question).filter(Question.id.in_(session.question_order)).all()
        q_map = {q.id: q for q in questions}

        answers = db.query(SessionAnswer).filter(SessionAnswer.session_id == session.id).all()
        ans_map = {a.question_id: a for a in answers}

        total_questions = len(session.question_order)
        correct_count = 0
        incorrect_count = 0
        unanswered_count = 0
        partial_count = 0
        pending_review_count = 0
        
        total_score = 0.0
        max_possible_score = 0.0
        total_time_taken = 0

        attempt_snapshots: List[QuestionAttemptResult] = []

        quiz_config_dict = {
            "positive_marks": quiz.positive_marks,
            "negative_marks": quiz.negative_marks,
            "partial_credit": quiz.partial_credit
        }

        # Topic & difficulty breakdown
        topic_stats: Dict[str, Dict[str, Any]] = {}
        difficulty_stats: Dict[str, Dict[str, Any]] = {}
        type_stats: Dict[str, Dict[str, Any]] = {}

        for q_id in session.question_order:
            q_obj = q_map.get(q_id)
            if not q_obj:
                continue

            q_ans = ans_map.get(q_id)
            user_val = q_ans.user_answer if (q_ans and not q_ans.is_skipped) else None
            time_spent = q_ans.time_spent_seconds if q_ans else 0
            total_time_taken += time_spent

            q_dict = {
                "question_text": q_obj.question_text,
                "question_type": q_obj.question_type,
                "difficulty": q_obj.difficulty,
                "options": [
                    (opt if isinstance(opt, dict) else {"id": opt.id, "text": opt.text})
                    for opt in (q_obj.options or [])
                ],
                "correct_answer": q_obj.correct_answer,
                "accepted_answers": q_obj.accepted_answers,
                "numerical_tolerance": q_obj.numerical_tolerance,
                "explanation": q_obj.explanation,
                "worked_solution": q_obj.worked_solution,
                "points": q_obj.points,
                "negative_marks": q_obj.negative_marks,
                "source_ref": q_obj.source_ref,
                "metadata_extra": q_obj.metadata_extra or {}
            }

            eval_res = ScoringService.evaluate_question(q_dict, user_val, quiz_config_dict)
            max_marks = eval_res["max_marks"]
            marks_awarded = eval_res["marks_awarded"]
            
            max_possible_score += max_marks
            total_score += marks_awarded

            if eval_res["evaluation_method"] == "manual_pending":
                pending_review_count += 1
            elif user_val is None:
                unanswered_count += 1
            elif eval_res["is_correct"]:
                correct_count += 1
            elif eval_res["is_partially_correct"]:
                partial_count += 1
            else:
                incorrect_count += 1

            # Immutable snapshot of question and attempt
            attempt_snapshot = QuestionAttemptResult(
                question_id=q_obj.id,
                question_snapshot=q_dict,
                user_answer=user_val,
                is_correct=eval_res["is_correct"],
                is_partially_correct=eval_res["is_partially_correct"],
                marks_awarded=marks_awarded,
                max_marks=max_marks,
                time_spent_seconds=time_spent,
                feedback=eval_res["feedback"],
                evaluation_method=eval_res["evaluation_method"]
            )
            attempt_snapshots.append(attempt_snapshot)

            # Update topic stats
            topic_name = q_obj.topic.name if q_obj.topic else "General"
            if topic_name not in topic_stats:
                topic_stats[topic_name] = {"total": 0, "correct": 0, "score": 0.0, "max_score": 0.0}
            topic_stats[topic_name]["total"] += 1
            if eval_res["is_correct"]:
                topic_stats[topic_name]["correct"] += 1
            topic_stats[topic_name]["score"] += marks_awarded
            topic_stats[topic_name]["max_score"] += max_marks

            # Update difficulty stats
            diff = q_obj.difficulty.capitalize()
            if diff not in difficulty_stats:
                difficulty_stats[diff] = {"total": 0, "correct": 0}
            difficulty_stats[diff]["total"] += 1
            if eval_res["is_correct"]:
                difficulty_stats[diff]["correct"] += 1

            # Update type stats
            qtype = q_obj.question_type
            if qtype not in type_stats:
                type_stats[qtype] = {"total": 0, "correct": 0}
            type_stats[qtype]["total"] += 1
            if eval_res["is_correct"]:
                type_stats[qtype]["correct"] += 1

            # Update spaced repetition revision state
            cls._update_revision_item(db, q_obj.id, eval_res["is_correct"], now, user_id=session.user_id)

        percentage = round((total_score / max_possible_score * 100), 2) if max_possible_score > 0 else 0.0

        breakdown = {
            "topics": topic_stats,
            "difficulty": difficulty_stats,
            "question_types": type_stats
        }

        # Calculate time taken from start if total_time_taken is 0
        if total_time_taken == 0 and session.started_at:
            started = session.started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            total_time_taken = max(1, int((now - started).total_seconds()))

        quiz_result = QuizResult(
            quiz_id=quiz.id,
            session_id=session.id,
            user_id=session.user_id,
            total_questions=total_questions,
            correct_count=correct_count,
            incorrect_count=incorrect_count,
            unanswered_count=unanswered_count,
            partially_correct_count=partial_count,
            pending_review_count=pending_review_count,
            score=round(total_score, 2),
            max_score=round(max_possible_score, 2),
            percentage=percentage,
            time_taken_seconds=total_time_taken,
            completed_at=now,
            breakdown=breakdown
        )
        db.add(quiz_result)
        db.flush()

        for snap in attempt_snapshots:
            snap.result_id = quiz_result.id
            db.add(snap)

        session.status = "evaluated"
        db.commit()
        db.refresh(quiz_result)
        return quiz_result

    @classmethod
    def _update_revision_item(cls, db: Session, question_id: int, is_correct: bool, now: datetime, user_id: Optional[int] = None):
        """Update or create SM-2 spaced repetition state for this question and user."""
        query = db.query(RevisionItem).filter(RevisionItem.question_id == question_id)
        if user_id is not None:
            query = query.filter(RevisionItem.user_id == user_id)
        rev = query.first()
        if not rev:
            rev = RevisionItem(
                user_id=user_id,
                question_id=question_id,
                mastery_state="learning" if is_correct else "needs_revision",
                total_attempts=1,
                correct_attempts=1 if is_correct else 0,
                streak=1 if is_correct else 0,
                ease_factor=2.5,
                interval_days=1 if is_correct else 1,
                next_review_due=now + timedelta(days=1),
                last_attempted_at=now
            )
            db.add(rev)
        else:
            rev.total_attempts += 1
            rev.last_attempted_at = now
            if is_correct:
                rev.correct_attempts += 1
                rev.streak += 1
                # Increase interval
                if rev.streak == 1:
                    rev.interval_days = 1
                elif rev.streak == 2:
                    rev.interval_days = 6
                else:
                    rev.interval_days = int(rev.interval_days * rev.ease_factor)
                
                # Check mastery
                if rev.streak >= 3 and (rev.correct_attempts / rev.total_attempts >= 0.8):
                    rev.mastery_state = "mastered"
                else:
                    rev.mastery_state = "learning"
            else:
                rev.streak = 0
                rev.interval_days = 1
                rev.ease_factor = max(1.3, rev.ease_factor - 0.2)
                rev.mastery_state = "needs_revision"
                
            rev.next_review_due = now + timedelta(days=rev.interval_days)

    @classmethod
    def execute_code(cls, code: str, language: str = "python", test_cases: Optional[List[Dict[str, Any]]] = None) -> RunCodeResponse:
        import sys
        import os
        import subprocess
        import json
        import time

        results: List[TestCaseResult] = []
        all_passed = True
        combined_stdout = ""
        cases = test_cases if test_cases and len(test_cases) > 0 else [{"input": "", "expected_output": ""}]
        runner_path = os.path.join(os.path.dirname(__file__), "code_runner.py")

        for idx, tc in enumerate(cases):
            tc_input = str(tc.get("input", "")).strip()
            tc_expected = str(tc.get("expected_output", "")).strip()
            expected_fn = str(tc.get("expected_fn", "")).strip()

            start_t = time.time()
            passed = False
            actual_out = ""
            err_msg = None

            try:
                lang_lower = (language or "python").lower()
                if lang_lower in ["python", "py"]:
                    payload = {
                        "code": code,
                        "input": tc_input,
                        "expected_output": tc_expected,
                        "expected_fn": expected_fn
                    }
                    proc = subprocess.run(
                        [sys.executable, runner_path],
                        input=json.dumps(payload),
                        capture_output=True,
                        text=True,
                        timeout=5.0
                    )
                    if proc.stdout.strip():
                        try:
                            res = json.loads(proc.stdout.strip())
                            passed = bool(res.get("passed"))
                            actual_out = str(res.get("actual_output", ""))
                            err_msg = res.get("error")
                            tc_stdout = res.get("stdout", "")
                            if tc_stdout:
                                combined_stdout += f"[TC {idx+1}] {tc_stdout}\n"
                        except json.JSONDecodeError:
                            actual_out = proc.stdout.strip()
                            passed = (actual_out == tc_expected)
                    elif proc.stderr.strip():
                        err_msg = proc.stderr.strip().splitlines()[-1]
                    else:
                        actual_out = ""

                elif lang_lower in ["javascript", "js", "node"]:
                    node_script = """
const fs = require('fs');
let raw = fs.readFileSync(0, 'utf-8');
let data = JSON.parse(raw);
let userCode = data.code;
let tcInput = data.input;
let tcExpected = data.expected_output;
try {
    eval(userCode);
    let candidateFns = Object.keys(this).filter(k => typeof this[k] === 'function');
    let targetFn = (data.expected_fn && typeof this[data.expected_fn] === 'function') 
        ? this[data.expected_fn] 
        : (typeof solution === 'function' ? solution : (candidateFns.length > 0 ? this[candidateFns[candidateFns.length-1]] : null));
    let actual = '';
    if (targetFn && tcInput) {
        let args = [];
        try { args = [JSON.parse(tcInput)]; } catch(e) { args = [tcInput]; }
        let ret = targetFn(...args);
        actual = (ret !== undefined) ? JSON.stringify(ret) : '';
    }
    let passed = (actual == tcExpected);
    console.log(JSON.stringify({ passed, actual_output: actual, error: null }));
} catch(err) {
    console.log(JSON.stringify({ passed: false, actual_output: '', error: err.message }));
}
"""
                    payload = {
                        "code": code,
                        "input": tc_input,
                        "expected_output": tc_expected,
                        "expected_fn": expected_fn
                    }
                    proc = subprocess.run(
                        ["node", "-e", node_script],
                        input=json.dumps(payload),
                        capture_output=True,
                        text=True,
                        timeout=5.0
                    )
                    if proc.stdout.strip():
                        res = json.loads(proc.stdout.strip())
                        passed = bool(res.get("passed"))
                        actual_out = str(res.get("actual_output", ""))
                        err_msg = res.get("error")
                else:
                    err_msg = f"Language '{language}' execution not supported."
            except subprocess.TimeoutExpired:
                err_msg = "Time Limit Exceeded (> 5.0s)"
            except Exception as e:
                err_msg = str(e)

            elapsed_ms = round((time.time() - start_t) * 1000, 2)
            if not passed:
                all_passed = False

            results.append(
                TestCaseResult(
                    input=tc_input,
                    expected_output=tc_expected,
                    actual_output=actual_out,
                    passed=passed,
                    error=err_msg,
                    execution_time_ms=elapsed_ms
                )
            )

        passed_count = sum(1 for r in results if r.passed)
        return RunCodeResponse(
            all_passed=all_passed,
            passed_count=passed_count,
            total_count=len(results),
            results=results,
            stdout=combined_stdout.strip()[:2000]
        )
