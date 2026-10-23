import pytest
from unittest.mock import patch, MagicMock
from backend.app.integrations.gemini.client import GeminiClient

def test_gemini_connection_test_without_key():
    # If no key, should return clear error message rather than crash
    res = GeminiClient.test_connection(api_key="")
    assert res.success is False
    assert "No Gemini API key" in res.message
    assert len(res.available_models) > 0

@patch("backend.app.integrations.gemini.client.genai.Client")
def test_gemini_mocked_generation(mock_genai_client):
    mock_instance = MagicMock()
    mock_genai_client.return_value = mock_instance
    
    # Mock model response with valid structured JSON
    mock_response = MagicMock()
    mock_response.text = """
[
  {
    "question_text": "What is the primary function of DNA polymerase?",
    "question_type": "single_choice",
    "difficulty": "medium",
    "options": [
      {"id": "A", "text": "Unwind the DNA double helix"},
      {"id": "B", "text": "Synthesize DNA molecules from deoxyribonucleotides"},
      {"id": "C", "text": "Degrade mRNA"},
      {"id": "D", "text": "Splice introns"}
    ],
    "correct_answer": ["B"],
    "explanation": "DNA polymerase catalyzes the synthesis of DNA molecules.",
    "points": 1.0,
    "source_ref": "Molecular Biology"
  }
]
    """
    mock_instance.models.generate_content.return_value = mock_response
    
    items = GeminiClient.generate_questions(
        subject="Biology",
        topic="Genetics",
        count=1,
        question_types=["single_choice"],
        difficulty="medium",
        api_key="mock_test_key_12345"
    )
    
    assert len(items) == 1
    q = items[0]
    assert "DNA polymerase" in q.question_text
    assert q.correct_answer == ["B"]
    assert len(q.options) == 4
    assert q.status == "valid"
    assert q.is_approved is True
