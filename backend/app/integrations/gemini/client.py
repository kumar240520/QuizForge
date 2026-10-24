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
    "question_type": "single_choice", // one of: single_choice, multiple_choice, true_false, fill_in_the_blank, short_answer, match_the_following, arrange_in_order, numerical, code_output, coding, code_debug, assertion_reasoning, descriptive, code_writing
    "difficulty": "medium", // easy, medium, or hard
    "options": [
      {"id": "A", "text": "First option"},
      {"id": "B", "text": "Second option"},
      {"id": "C", "text": "Third option"},
      {"id": "D", "text": "Fourth option"}
    ],
    "correct_answer": ["B"],
    "accepted_answers": ["alternative acceptable phrasing"],
    "numerical_tolerance": 0.0,
    "explanation": "Detailed explanation of why this answer is correct",
    "points": 1.0,
    "section_name": "Section A: Conceptual Fundamentals",
    "per_question_timer": 60,
    "source_ref": "Reference citation or excerpt",
    "metadata_extra": {}
  }
]

CRITICAL RULES FOR QUESTION TYPES:
1. "true_false":
   - "options" MUST ALWAYS be exactly: [{"id": "TRUE", "text": "True"}, {"id": "FALSE", "text": "False"}]
   - "correct_answer" MUST be either ["TRUE"] or ["FALSE"] (NEVER use 'A' or 'B' or lowercase).
2. "single_choice":
   - "options" are IDs "A", "B", "C", "D". "correct_answer" is a single ID array, e.g. ["B"].
3. "multiple_choice":
   - "options" are IDs "A", "B", "C", "D". "correct_answer" is an array of all correct IDs, e.g. ["A", "C"].
4. "fill_in_the_blank" and "short_answer":
   - "options" MUST be empty array [].
   - "correct_answer" is an array with primary answer, e.g. ["Stack"].
   - "accepted_answers" provides case-insensitive synonyms or alternative spellings.
5. "numerical":
   - "options" MUST be empty array [].
   - "correct_answer" is a number, e.g. 42.5.
   - "numerical_tolerance" is the accepted margin, e.g. 0.05.
6. "match_the_following":
   - "options" are the items to match (Column A / Left): [{"id": "1", "text": "Item 1"}, {"id": "2", "text": "Item 2"}, ...]
   - "metadata_extra" MUST contain "match_targets" (Column B / Right): [{"id": "A", "text": "Target A"}, {"id": "B", "text": "Target B"}, ...]
   - "correct_answer" MUST be a JSON object mapping left ID to right ID: {"1": "A", "2": "B", ...}
7. "arrange_in_order":
   - "options" are the sequence elements: [{"id": "STEP_1", "text": "Step 1"}, {"id": "STEP_2", "text": "Step 2"}, ...]
   - "correct_answer" MUST be the array of IDs in correct order: ["STEP_1", "STEP_2", ...]
8. "assertion_reasoning":
   - "options" are the 4 standard choices:
     {"id": "A", "text": "Both (A) and (R) are true, and (R) is the correct explanation of (A)."},
     {"id": "B", "text": "Both (A) and (R) are true, but (R) is NOT the correct explanation of (A)."},
     {"id": "C", "text": "(A) is true, but (R) is false."},
     {"id": "D", "text": "(A) is false, but (R) is true."}
   - "correct_answer" is ["A"] (or B, C, D).
9. "code_output" / "code_debug":
   - "metadata_extra" MUST have "code_snippet": "..." and "language": "python" (or target language).
   - "options" are A, B, C, D choices and "correct_answer" is ["A"].
10. "coding":
   - "metadata_extra" MUST contain "language": "python", "starter_code": "def ...", "constraints": [...], and "test_cases": [{"input": "...", "expected_output": "..."}].
   - "correct_answer" is the full reference solution code string.
11. "descriptive" and "code_writing":
   - "options" MUST be empty array [].
   - "correct_answer" is the model answer or reference solution.

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
            q_type = str(item.get("question_type") or "single_choice").lower().strip()
            q_diff = item.get("difficulty") or difficulty if difficulty != "mixed" else "medium"
            sec_name = item.get("section_name") or f"Section: {topic}"
            q_timer = int(item.get("per_question_timer") or 60)
            meta_extra = dict(item.get("metadata_extra") or {})
            
            raw_options = item.get("options") or []
            options_list: List[QuestionOptionSchema] = []
            
            # --- Question Type Specific Normalizers ---
            
            # 1. True / False normalization
            if q_type == "true_false":
                options_list = [
                    QuestionOptionSchema(id="TRUE", text="True"),
                    QuestionOptionSchema(id="FALSE", text="False")
                ]
                
                raw_corr = item.get("correct_answer")
                corr_val = raw_corr[0] if isinstance(raw_corr, list) and len(raw_corr) > 0 else raw_corr
                corr_str = str(corr_val or "").strip().upper()
                
                # Check if raw options had A as True and B as False
                opt_a_text = ""
                opt_b_text = ""
                for o in raw_options:
                    if isinstance(o, dict):
                        oid = str(o.get("id", "")).strip().upper()
                        otxt = str(o.get("text", "")).strip().lower()
                        if oid == "A": opt_a_text = otxt
                        if oid == "B": opt_b_text = otxt

                if corr_str in ["TRUE", "T", "1"]:
                    corr = ["TRUE"]
                elif corr_str in ["FALSE", "F", "0"]:
                    corr = ["FALSE"]
                elif corr_str == "A":
                    corr = ["FALSE"] if "false" in opt_a_text else ["TRUE"]
                elif corr_str == "B":
                    corr = ["TRUE"] if "true" in opt_b_text else ["FALSE"]
                else:
                    corr = ["TRUE"]
                    
            # 2. Match the Following normalization
            elif q_type == "match_the_following":
                # Ensure options are left items
                for opt in raw_options:
                    if isinstance(opt, dict):
                        options_list.append(QuestionOptionSchema(id=str(opt.get("id", "")), text=str(opt.get("text", ""))))
                    elif isinstance(opt, str):
                        options_list.append(QuestionOptionSchema(id=str(len(options_list) + 1), text=opt))
                
                # Ensure metadata_extra has match_targets
                if "match_targets" not in meta_extra or not meta_extra["match_targets"]:
                    # Fallback default right targets if AI put them in a dict
                    corr_dict = item.get("correct_answer")
                    if isinstance(corr_dict, dict):
                        targets = []
                        for k, v in corr_dict.items():
                            targets.append({"id": str(v), "text": str(v)})
                        meta_extra["match_targets"] = targets
                    else:
                        meta_extra["match_targets"] = [
                            {"id": chr(65 + i), "text": f"Target {chr(65 + i)}"}
                            for i in range(len(options_list) or 4)
                        ]
                
                raw_corr = item.get("correct_answer")
                if isinstance(raw_corr, dict):
                    corr = {str(k): str(v).strip().upper() for k, v in raw_corr.items()}
                else:
                    # Synthesize mapping if missing
                    targets = meta_extra.get("match_targets", [])
                    corr = {}
                    for i, opt in enumerate(options_list):
                        if i < len(targets):
                            t_id = targets[i].get("id") if isinstance(targets[i], dict) else chr(65 + i)
                            corr[str(opt.id)] = str(t_id).strip().upper()
                            
            # 3. Assertion & Reasoning normalization
            elif q_type == "assertion_reasoning":
                options_list = [
                    QuestionOptionSchema(id="A", text="Both (A) and (R) are true, and (R) is the correct explanation of (A)."),
                    QuestionOptionSchema(id="B", text="Both (A) and (R) are true, but (R) is NOT the correct explanation of (A)."),
                    QuestionOptionSchema(id="C", text="(A) is true, but (R) is false."),
                    QuestionOptionSchema(id="D", text="(A) is false, but (R) is true.")
                ]
                raw_corr = item.get("correct_answer")
                c_val = (raw_corr[0] if isinstance(raw_corr, list) and len(raw_corr) > 0 else raw_corr) or "A"
                corr = [str(c_val).strip().upper()[:1] if str(c_val).strip() else "A"]

            # 4. Standard Choice / Order / General
            else:
                for opt in raw_options:
                    if isinstance(opt, dict):
                        options_list.append(QuestionOptionSchema(id=str(opt.get("id", "")).upper(), text=str(opt.get("text", ""))))
                    elif isinstance(opt, str):
                        options_list.append(QuestionOptionSchema(id=chr(65 + len(options_list)), text=opt))
                
                raw_corr = item.get("correct_answer")
                if q_type in ["single_choice", "multiple_choice"] and isinstance(raw_corr, str):
                    corr = [raw_corr.upper()]
                elif q_type == "arrange_in_order" and isinstance(raw_corr, list):
                    corr = [str(x) for x in raw_corr]
                elif q_type == "numerical":
                    try:
                        corr = float(raw_corr[0] if isinstance(raw_corr, list) and len(raw_corr) > 0 else raw_corr)
                    except (ValueError, TypeError):
                        corr = 0.0
                elif corr_val := raw_corr:
                    corr = corr_val
                elif options_list:
                    corr = [options_list[0].id]
                else:
                    corr = []
                
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
                    metadata_extra=meta_extra
                )
            )

        return parsed_results
