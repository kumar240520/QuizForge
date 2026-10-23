import pytest
from backend.app.services.scoring_service import ScoringService

def test_single_choice_scoring():
    q = {
        "question_type": "single_choice",
        "correct_answer": ["B"],
        "points": 2.0,
        "negative_marks": 0.5
    }
    
    # Correct
    res_correct = ScoringService.evaluate_question(q, "B")
    assert res_correct["is_correct"] is True
    assert res_correct["marks_awarded"] == 2.0
    
    # Incorrect
    res_incorrect = ScoringService.evaluate_question(q, "C")
    assert res_incorrect["is_correct"] is False
    assert res_incorrect["marks_awarded"] == -0.5
    
    # Unanswered
    res_unanswered = ScoringService.evaluate_question(q, None)
    assert res_unanswered["is_correct"] is False
    assert res_unanswered["marks_awarded"] == 0.0

def test_multiple_choice_partial_credit():
    q = {
        "question_type": "multiple_choice",
        "correct_answer": ["A", "C", "D"],
        "points": 3.0,
        "negative_marks": 1.0
    }
    
    # All correct
    res_all = ScoringService.evaluate_question(q, ["A", "C", "D"])
    assert res_all["is_correct"] is True
    assert res_all["marks_awarded"] == 3.0
    
    # Partial credit (2 out of 3, no wrong ones)
    res_partial = ScoringService.evaluate_question(q, ["A", "C"], quiz_config={"partial_credit": True})
    assert res_partial["is_partially_correct"] is True
    assert res_partial["marks_awarded"] == 2.0 # 2/3 * 3.0
    
    # Incorrect selection included
    res_wrong = ScoringService.evaluate_question(q, ["A", "B"])
    assert res_wrong["is_correct"] is False
    assert res_wrong["marks_awarded"] == -1.0

def test_numerical_tolerance_scoring():
    q = {
        "question_type": "numerical",
        "correct_answer": [3.1415],
        "numerical_tolerance": 0.01,
        "points": 2.0,
        "negative_marks": 0.0
    }
    
    # Within tolerance
    res_close = ScoringService.evaluate_question(q, 3.14)
    assert res_close["is_correct"] is True
    assert res_close["marks_awarded"] == 2.0
    
    # Out of tolerance
    res_far = ScoringService.evaluate_question(q, 3.20)
    assert res_far["is_correct"] is False
    assert res_far["marks_awarded"] == 0.0

def test_fill_in_the_blank_accepted_answers():
    q = {
        "question_type": "fill_in_the_blank",
        "correct_answer": ["mitochondria"],
        "accepted_answers": ["mitochondrion", "the powerhouse"],
        "points": 1.0,
        "negative_marks": 0.0
    }
    
    res1 = ScoringService.evaluate_question(q, "Mitochondria ")
    assert res1["is_correct"] is True
    
    res2 = ScoringService.evaluate_question(q, "mitochondrion")
    assert res2["is_correct"] is True
    
    res3 = ScoringService.evaluate_question(q, "chloroplast")
    assert res3["is_correct"] is False

def test_matching_partial_credit():
    q = {
        "question_type": "match_the_following",
        "correct_answer": {"1": "A", "2": "B", "3": "C", "4": "D"},
        "points": 4.0,
        "negative_marks": 0.0
    }
    
    # 2 out of 4 matched
    res = ScoringService.evaluate_question(q, {"1": "A", "2": "B", "3": "X", "4": "Y"})
    assert res["is_partially_correct"] is True
    assert res["marks_awarded"] == 2.0
