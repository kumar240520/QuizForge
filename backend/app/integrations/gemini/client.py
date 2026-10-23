import json
import re
import os
from typing import Optional, List, Dict, Any, Tuple
from google import genai
from google.genai.errors import APIError
from backend.app.core.config import settings
from backend.app.schemas.generation_schema import TestConnectionResponse
from backend.app.schemas.import_schema import ParsedQuestionItem
from backend.app.schemas.question import QuestionOptionSchema

SUPPORTED_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.8-pro"
]

MODEL_ALIASES = {
    "gemini-2.5-flash": "gemini-3.5-flash-lite",
    "gemini-2.5-pro": "gemini-3.8-pro",
    "gemini-2.0-flash": "gemini-3.5-flash-lite",
    "gemini-1.5-flash": "gemini-3.5-flash-lite",
    "gemini-1.5-pro": "gemini-3.8-pro",
    "models/gemini-2.5-flash": "gemini-3.5-flash-lite",
    "models/gemini-2.5-pro": "gemini-3.8-pro",
    "models/gemini-2.0-flash": "gemini-3.5-flash-lite",
}

def resolve_model(model_name: Optional[str]) -> str:
    """Normalize model string, resolving deprecated models and stripping prefix."""
    if not model_name or not model_name.strip():
        model_name = settings.GEMINI_MODEL or "gemini-3.5-flash-lite"
    m = model_name.strip()
    if m in MODEL_ALIASES:
        return MODEL_ALIASES[m]
    if m.startswith("models/"):
        stripped = m[len("models/"):]
        return MODEL_ALIASES.get(stripped, stripped)
    return m

class GeminiClient:
    @classmethod
    def get_api_key(cls, override_key: Optional[str] = None) -> str:
        """Resolve API key with precedence: override_key -> settings -> os.environ"""
        if override_key is not None:
            return override_key.strip()
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
            return settings.GEMINI_API_KEY.strip()
        env_key = os.environ.get("GEMINI_API_KEY", "").strip()
        return env_key

    @classmethod
    def get_client(cls, api_key: Optional[str] = None) -> genai.Client:
        resolved_key = cls.get_api_key(api_key)
        if not resolved_key:
            raise ValueError("Gemini API key is not configured. Please set it in AI Settings or the GEMINI_API_KEY environment variable.")
        return genai.Client(api_key=resolved_key)

    @classmethod
    def test_connection(cls, api_key: Optional[str] = None, model_name: Optional[str] = None) -> TestConnectionResponse:
        resolved_key = cls.get_api_key(api_key)
        if not resolved_key:
            return TestConnectionResponse(
                success=False,
                message="No Gemini API key configured. Please enter an API key.",
                available_models=SUPPORTED_MODELS
            )
            
        target_model = resolve_model(model_name)
        fallback_models = [target_model] + [m for m in ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"] if m != target_model]
        
        last_err = ""
        client = None
        try:
            client = genai.Client(api_key=resolved_key)
        except Exception as e:
            return TestConnectionResponse(
                success=False,
                message=f"Failed to initialize Gemini client: {str(e)}",
                model_used=target_model,
                available_models=SUPPORTED_MODELS
            )
            
        for m in fallback_models:
            try:
                response = client.models.generate_content(
                    model=m,
                    contents="Ping. Respond with Pong."
                )
                if response and response.text:
                    return TestConnectionResponse(
                        success=True,
                        message=f"Successfully connected to Google Gemini using model {m}!",
                        model_used=m,
                        available_models=SUPPORTED_MODELS
                    )
            except Exception as e:
                last_err = str(e)
                continue
                
        # Redact API key from any error message
        if resolved_key and len(resolved_key) > 6:
            last_err = last_err.replace(resolved_key, "[REDACTED_API_KEY]")
        return TestConnectionResponse(
            success=False,
            message=f"Gemini connection failed: {last_err}",
            model_used=target_model,
            available_models=SUPPORTED_MODELS
        )

    @classmethod
    def generate_questions(
        cls,
        subject: str,
        topic: str,
        count: int,
        question_types: List[str],
        difficulty: str,
        subtopics: Optional[str] = None,
        educational_level: Optional[str] = "undergraduate",
        num_mcq_options: int = 4,
        require_explanations: bool = True,
        source_material: Optional[str] = None,
        source_only_mode: bool = False,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None
    ) -> List[ParsedQuestionItem]:
        """
        Generate structured questions from topic or source material.
        Guarantees schema validation and returns validated ParsedQuestionItem objects.
        """
        resolved_key = cls.get_api_key(api_key)
        if not resolved_key:
            raise ValueError("Gemini API key is missing. Please configure it in AI Settings.")

        client = cls.get_client(resolved_key)
        target_model = resolve_model(model_name)
        fallback_models = [target_model] + [m for m in ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"] if m != target_model]

        types_str = ", ".join(question_types)
        
        # Build prompt
        prompt_parts = [
            f"You are QuizForge, an enterprise AI assessment generator.",
            f"Generate exactly {count} distinct assessment questions for:",
            f"- Subject: {subject}",
            f"- Topic: {topic}",
            f"- Difficulty: {difficulty}",
            f"- Target Educational Level: {educational_level}",
            f"- Allowed Question Types: {types_str}",
            f"- Number of options for MCQs: {num_mcq_options}"
        ]

        if subtopics:
            prompt_parts.append(f"- Subtopics / Concepts to cover: {subtopics}")

        if source_material:
            if source_only_mode:
                prompt_parts.append("\nCRITICAL CONSTRAINT: You MUST formulate questions strictly and solely using the provided reference material below. Do not introduce external facts.")
            else:
                prompt_parts.append("\nReference the following material to formulate grounded assessment questions:")
            prompt_parts.append(f"\n--- SOURCE MATERIAL ---\n{source_material[:8000]}\n--- END SOURCE MATERIAL ---")

        prompt_parts.append("""
OUTPUT SPECIFICATION:
You MUST output ONLY a valid JSON array of objects. Do not wrap in markdown or backticks if possible, or use standard ```json.
Each JSON object must have this exact structure:
[
  {
    "question_text": "Clear question statement here",
    "question_type": "single_choice", // one of: single_choice, multiple_choice, true_false, fill_in_the_blank, short_answer, match_the_following, arrange_in_order, numerical, code_output, coding, code_debug, assertion_reasoning, descriptive
    "difficulty": "medium", // easy, medium, or hard
    "options": [
      {"id": "A", "text": "First option"},
      {"id": "B", "text": "Second option"},
      {"id": "C", "text": "Third option"},
      {"id": "D", "text": "Fourth option"}
    ],
    "correct_answer": ["B"], // for single_choice/multiple_choice: array of IDs. For match_the_following: {"A": "Target 1"}. For arrange_in_order: ["STEP1", "STEP2"]. For coding: full reference solution code.
    "accepted_answers": ["alternative acceptable phrasing"],
    "numerical_tolerance": 0.0,
    "explanation": "Detailed explanation of why this answer is correct",
    "points": 1.0,
    "section_name": "Section A: Conceptual Fundamentals",
    "per_question_timer": 60,
    "source_ref": "Reference citation or excerpt",
    "metadata_extra": {
      // For type "coding":
      // "language": "python",
      // "starter_code": "def solution(...):\n    # Write your code here\n    pass\n",
      // "test_cases": [{"input": "5", "expected_output": "25"}]
      // For type "code_output" or "code_debug":
      // "code_snippet": "for i in range(3):\n    print(i)",
      // "language": "python"
    }
  }
]
Ensure the answer key is 100% accurate and mathematically/conceptually sound.
""")

        prompt_text = "\n".join(prompt_parts)

        response = None
        last_error = None
        for m in fallback_models:
            try:
                response = client.models.generate_content(
                    model=m,
                    contents=prompt_text
                )
                if response and response.text:
                    target_model = m
                    break
            except Exception as e:
                last_error = e
                continue

        if not response or not response.text:
            raise last_error or ValueError("Failed to generate questions: No response from Gemini models.")

        raw_output = response.text or ""
        
        # Clean potential markdown fences
        clean_json_str = raw_output.strip()
        if clean_json_str.startswith("```json"):
            clean_json_str = clean_json_str[7:]
        elif clean_json_str.startswith("```"):
            clean_json_str = clean_json_str[3:]
        if clean_json_str.endswith("```"):
            clean_json_str = clean_json_str[:-3]
        clean_json_str = clean_json_str.strip()

        try:
            items_raw = json.loads(clean_json_str)
            if not isinstance(items_raw, list):
                if isinstance(items_raw, dict) and "questions" in items_raw:
                    items_raw = items_raw["questions"]
                else:
                    items_raw = [items_raw]
        except Exception as e:
            # Fallback regex extraction for json array
            match = re.search(r"\[\s*\{[\s\S]*\}\s*\]", clean_json_str)
            if match:
                items_raw = json.loads(match.group(0))
            else:
                raise ValueError(f"Failed to parse AI response into structured JSON: {str(e)}")

        parsed_results: List[ParsedQuestionItem] = []
        for idx, item in enumerate(items_raw, 1):
            q_text = item.get("question_text") or f"Question {idx}"
            q_type = item.get("question_type") or "single_choice"
            q_diff = item.get("difficulty") or difficulty if difficulty != "mixed" else "medium"
            sec_name = item.get("section_name") or f"Section: {topic}"
            q_timer = int(item.get("per_question_timer") or 60)
            
            raw_options = item.get("options") or []
            options_list: List[QuestionOptionSchema] = []
            for opt in raw_options:
                if isinstance(opt, dict):
                    options_list.append(QuestionOptionSchema(id=str(opt.get("id", "")).upper(), text=str(opt.get("text", ""))))
                elif isinstance(opt, str):
                    options_list.append(QuestionOptionSchema(id=chr(65 + len(options_list)), text=opt))
            
            # Format correct_answer
            corr = item.get("correct_answer")
            if q_type in ["single_choice", "multiple_choice", "true_false"] and isinstance(corr, str):
                corr = [corr.upper()]
            elif corr is None and options_list:
                corr = [options_list[0].id]
                
            parsed_results.append(
                ParsedQuestionItem(
                    temp_id=f"ai-{idx}",
                    question_text=q_text,
                    question_type=q_type,
                    difficulty=q_diff,
                    options=options_list,
                    correct_answer=corr,
                    accepted_answers=item.get("accepted_answers") or [],
                    numerical_tolerance=float(item.get("numerical_tolerance") or 0.0),
                    explanation=item.get("explanation"),
                    points=float(item.get("points") or 1.0),
                    negative_marks=0.0,
                    section_name=sec_name,
                    per_question_timer=q_timer,
                    source_ref=item.get("source_ref") or f"Gemini: {topic}",
                    status="valid",
                    issues=[],
                    is_approved=True,
                    metadata_extra=item.get("metadata_extra") or {}
                )
            )

        return parsed_results
