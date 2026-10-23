import pytest
from backend.app.services.parsing_service import ParsingService

def test_parse_standard_mcq_inline_answer():
    sample_text = """
1. What is the capital of France?
A. London
B. Paris
C. Berlin
D. Madrid
Answer: B
Explanation: Paris has been the capital of France since 987 CE.

2. Which data structure uses FIFO ordering?
(a) Stack
(b) Queue
(c) Tree
(d) Graph
Ans: (b)
    """
    items = ParsingService.parse_text_questions(sample_text)
    assert len(items) == 2
    
    q1 = items[0]
    assert "capital of France" in q1.question_text
    assert q1.question_type == "single_choice"
    assert len(q1.options) == 4
    assert q1.correct_answer == ["B"]
    assert "Paris" in q1.explanation
    
    q2 = items[1]
    assert "FIFO ordering" in q2.question_text
    assert q2.correct_answer == ["B"]

def test_parse_separate_answer_key():
    sample_text = """
1. Which planet is closest to the Sun?
A. Venus
B. Mercury
C. Mars
D. Jupiter

2. Water boils at 100 degrees Celsius under standard atmospheric pressure.
True
False

ANSWER KEY:
1. B
2. TRUE
    """
    items = ParsingService.parse_text_questions(sample_text)
    assert len(items) == 2
    assert items[0].correct_answer == ["B"]
    assert items[1].question_type == "true_false"
    assert items[1].correct_answer == ["TRUE"]

def test_parse_fill_in_the_blank_and_numerical():
    sample_text = """
1. The process by which plants convert sunlight into energy is called _____.
Ans: photosynthesis

2. Calculate the area of a rectangle with length 5 and width 4.
Answer: 20
    """
    items = ParsingService.parse_text_questions(sample_text)
    assert len(items) == 2
    assert items[0].question_type == "fill_in_the_blank"
    assert items[0].correct_answer == ["photosynthesis"]
    assert items[1].question_type == "numerical"

def test_duplicate_question_detection():
    sample_text = """
1. What is Python?
A. Snake
B. Programming language
Answer: B

2. What is Python?
A. Snake
B. Programming language
Answer: B
    """
    items = ParsingService.parse_text_questions(sample_text)
    assert len(items) == 2
    assert items[1].status == "duplicate"
    assert "Potential duplicate" in items[1].issues[0]
