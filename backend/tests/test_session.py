import pytest
from backend.app.models.quiz import Quiz
from backend.app.models.question import Question
from backend.app.services.session_service import SessionService
from backend.app.schemas.session_schema import SubmitAnswerRequest

def test_session_lifecycle(db_session):
    # Setup sample questions
    q1 = Question(
        question_text="What is 2 + 2?",
        question_type="single_choice",
        options=[{"id": "A", "text": "3"}, {"id": "B", "text": "4"}],
        correct_answer=["B"],
        points=1.0,
        negative_marks=0.0
    )
    q2 = Question(
        question_text="Is Python dynamically typed?",
        question_type="true_false",
        options=[{"id": "TRUE", "text": "True"}, {"id": "FALSE", "text": "False"}],
        correct_answer=["TRUE"],
        points=1.0,
        negative_marks=0.0
    )
    db_session.add_all([q1, q2])
    db_session.commit()
    
    quiz = Quiz(
        title="Math and Python Test",
        mode="exam",
        timing_mode="total_duration",
        duration_minutes=10,
        positive_marks=1.0,
        negative_marks=0.0,
        question_ids=[q1.id, q2.id]
    )
    db_session.add(quiz)
    db_session.commit()
    
    # 1. Start Session
    session = SessionService.start_session(db_session, quiz)
    assert session.session_token is not None
    assert session.status == "in_progress"
    assert session.session_deadline is not None
    
    # 2. Get Status (verifies client question view does not leak correct answer in exam mode)
    status = SessionService.get_session_status(db_session, session)
    assert status.current_question is not None
    assert status.current_question.correct_answer is None
    assert status.current_question.explanation is None
    assert status.session_remaining_seconds > 0
    
    # 3. Submit Answer for Q1
    SessionService.submit_answer(
        db_session, 
        session, 
        SubmitAnswerRequest(question_id=q1.id, user_answer=["B"], time_spent_seconds=12)
    )
    
    # 4. Navigate to Q2
    SessionService.navigate_question(db_session, session, target_index=1)
    status_nav = SessionService.get_session_status(db_session, session)
    assert status_nav.current_question_index == 1
    assert status_nav.current_question.id == q2.id
    
    # 5. Submit Answer for Q2
    SessionService.submit_answer(
        db_session, 
        session, 
        SubmitAnswerRequest(question_id=q2.id, user_answer=["TRUE"], time_spent_seconds=8)
    )
    
    # 6. Finalize & Evaluate
    result = SessionService.submit_and_evaluate(db_session, session)
    assert result.status if hasattr(result, "status") else True
    assert result.total_questions == 2
    assert result.correct_count == 2
    assert result.score == 2.0
    assert result.percentage == 100.0
    assert len(result.attempt_details) == 2
    # Check that snapshot was saved immutably
    assert result.attempt_details[0].question_snapshot["question_text"] == "What is 2 + 2?"

def test_question_palette_and_code_execution(db_session):
    # Setup coding and mcq questions
    q1 = Question(
        question_text="Print hello world",
        question_type="coding",
        correct_answer="print('hello world')",
        points=2.0,
        metadata_extra={
            "starter_code": "def solution():\n    print('hello world')",
            "test_cases": [{"input": "", "expected_output": "hello world"}]
        }
    )
    q2 = Question(
        question_text="Sample Q2",
        question_type="single_choice",
        options=[{"id": "A", "text": "Choice A"}],
        correct_answer=["A"],
        points=1.0
    )
    db_session.add_all([q1, q2])
    db_session.commit()

    quiz = Quiz(
        title="Coding Assessment",
        mode="practice",
        timing_mode="untimed",
        question_ids=[q1.id, q2.id]
    )
    db_session.add(quiz)
    db_session.commit()

    session = SessionService.start_session(db_session, quiz)
    status = SessionService.get_session_status(db_session, session)

    # 1. Palette sequence verification
    assert len(status.question_palette) == 2
    assert status.question_palette[0].index == 0
    assert status.question_palette[0].question_id == q1.id
    assert status.question_palette[0].is_visited is True
    assert status.question_palette[0].is_answered is False

    assert status.question_palette[1].index == 1
    assert status.question_palette[1].question_id == q2.id
    assert status.question_palette[1].is_visited is False

    # 2. Test code execution service
    run_res = SessionService.execute_code(
        code="print('hello world')",
        language="python",
        test_cases=[{"input": "", "expected_output": "hello world"}]
    )
    assert run_res.all_passed is True
    assert run_res.passed_count == 1
    assert len(run_res.results) == 1
    assert run_res.results[0].passed is True

    # 3. Test failing code execution
    run_res_fail = SessionService.execute_code(
        code="print('wrong')",
        language="python",
        test_cases=[{"input": "", "expected_output": "hello world"}]
    )
    assert run_res_fail.all_passed is False
    assert run_res_fail.passed_count == 0


def test_palette_non_linear_jump_trace(db_session):
    """
    Verify that jumping from question 3 to question 10 only marks question 10 as visited,
    leaving untouched questions (questions 4 through 9) unvisited (grey).
    """
    questions = []
    for i in range(1, 11):
        q = Question(
            question_text=f"Question {i} text",
            question_type="single_choice",
            difficulty="easy",
            options=[{"id": "A", "text": "Opt A"}, {"id": "B", "text": "Opt B"}],
            correct_answer=["A"],
            points=1.0
        )
        questions.append(q)
    db_session.add_all(questions)
    db_session.commit()

    quiz = Quiz(
        title="10 Questions Jump Test",
        mode="exam",
        timing_mode="total_duration",
        question_ids=[q.id for q in questions]
    )
    db_session.add(quiz)
    db_session.commit()

    # 1. Start session -> user is on Question 1 (index 0)
    session = SessionService.start_session(db_session, quiz)
    
    # 2. Answer Q1
    SessionService.submit_answer(db_session, session, SubmitAnswerRequest(
        question_id=questions[0].id,
        user_answer=["A"],
        time_spent_seconds=10
    ))

    # 3. Navigate to Q2 (index 1) and answer it
    SessionService.navigate_question(db_session, session, target_index=1)
    SessionService.submit_answer(db_session, session, SubmitAnswerRequest(
        question_id=questions[1].id,
        user_answer=["A"],
        time_spent_seconds=10
    ))

    # 4. Navigate to Q3 (index 2) but do NOT answer
    SessionService.navigate_question(db_session, session, target_index=2)

    # 5. User jumps directly from Q3 (index 2) to Question 10 (index 9)
    SessionService.navigate_question(db_session, session, target_index=9)

    status = SessionService.get_session_status(db_session, session)
    palette = status.question_palette

    # Q1 (index 0): Visited & Answered -> Green
    assert palette[0].is_visited is True
    assert palette[0].is_answered is True

    # Q2 (index 1): Visited & Answered -> Green
    assert palette[1].is_visited is True
    assert palette[1].is_answered is True

    # Q3 (index 2): Visited & Not Answered -> Red
    assert palette[2].is_visited is True
    assert palette[2].is_answered is False

    # Q4 to Q9 (indices 3 to 8): NEVER VISITED -> Must be False (Grey)
    for idx in range(3, 9):
        assert palette[idx].is_visited is False, f"Question index {idx} (Q{idx+1}) was falsely marked as visited!"
        assert palette[idx].is_answered is False

    # Q10 (index 9): Navigated to / Visited & Not Answered -> Red
    assert palette[9].is_visited is True
    assert palette[9].is_answered is False


