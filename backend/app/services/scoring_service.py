import re
from typing import Any, Dict, List, Tuple, Optional

class ScoringService:
    @staticmethod
    def _parse_float(val: Any) -> Optional[float]:
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, list):
            return ScoringService._parse_float(val[0]) if len(val) > 0 else None
        if isinstance(val, str):
            s = val.strip()
            if s.startswith("[") and s.endswith("]"):
                try:
                    import json
                    loaded = json.loads(s)
                    return ScoringService._parse_float(loaded)
                except Exception:
                    pass
            s = s.replace(",", "").strip("\"'")
            try:
                return float(s)
            except ValueError:
                return None
        return None

    @staticmethod
    def _normalize_bool_token(val: Any, options: Optional[List[Any]] = None) -> Optional[str]:
        if val is None:
            return None
        if isinstance(val, bool):
            return "TRUE" if val else "FALSE"
        s = str(val).strip().upper()
        if s in ["TRUE", "T", "1"]:
            return "TRUE"
        if s in ["FALSE", "F", "0"]:
            return "FALSE"
            
        # Check against options if A/B was passed
        if options and s in ["A", "B"]:
            opt_a_text = ""
            opt_b_text = ""
            for o in options:
                oid = (o.get("id") if isinstance(o, dict) else getattr(o, "id", "") or "").strip().upper()
                otxt = (o.get("text") if isinstance(o, dict) else getattr(o, "text", "") or "").strip().lower()
                if oid == "A": opt_a_text = otxt
                if oid == "B": opt_b_text = otxt
            if s == "A":
                return "FALSE" if "false" in opt_a_text else "TRUE"
            if s == "B":
                return "TRUE" if "true" in opt_b_text else "FALSE"
        if s == "A":
            return "TRUE"
        if s == "B":
            return "FALSE"
        return s

    @classmethod
    def evaluate_question(
        cls,
        question_dict: Dict[str, Any],
        user_answer: Any,
        quiz_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Deterministic, comprehensive scoring calculation for any question type.
        Returns a dict:
        {
            "is_correct": bool,
            "is_partially_correct": bool,
            "marks_awarded": float,
            "max_marks": float,
            "feedback": str,
            "evaluation_method": str # 'deterministic', 'ai_assisted', 'manual_pending'
        }
        """
        max_marks = float(question_dict.get("points") or 1.0)
        negative_marks = float(question_dict.get("negative_marks") or 0.0)
        
        # Override with quiz config if provided
        if quiz_config:
            if "positive_marks" in quiz_config:
                max_marks = float(quiz_config["positive_marks"])
            if "negative_marks" in quiz_config:
                negative_marks = float(quiz_config["negative_marks"])
        
        q_type = question_dict.get("question_type", "single_choice")
        correct_answer = question_dict.get("correct_answer")
        accepted_answers = question_dict.get("accepted_answers") or []
        tolerance = float(question_dict.get("numerical_tolerance") or 0.0)
        options = question_dict.get("options") or []
        
        # Unanswered check
        if user_answer is None or user_answer == "" or user_answer == [] or user_answer == {}:
            return {
                "is_correct": False,
                "is_partially_correct": False,
                "marks_awarded": 0.0,
                "max_marks": max_marks,
                "feedback": "Question was skipped / unanswered.",
                "evaluation_method": "deterministic"
            }
            
        # 1. Descriptive Questions -> Manual/Subjective Review
        if q_type == "descriptive" or q_type == "code_writing":
            return {
                "is_correct": False,
                "is_partially_correct": False,
                "marks_awarded": 0.0,
                "max_marks": max_marks,
                "feedback": "Descriptive response recorded. Pending evaluation against rubric.",
                "evaluation_method": "manual_pending"
            }

        # 2a. True / False Binary Evaluation
        if q_type == "true_false":
            target = correct_answer[0] if isinstance(correct_answer, list) and len(correct_answer) > 0 else correct_answer
            user_val = user_answer[0] if isinstance(user_answer, list) and len(user_answer) > 0 else user_answer
            
            norm_target = cls._normalize_bool_token(target, options) or "TRUE"
            norm_user = cls._normalize_bool_token(user_val, options)
            
            is_match = norm_target == norm_user
            display_target = "True" if norm_target == "TRUE" else "False"
            
            if is_match:
                return {
                    "is_correct": True,
                    "is_partially_correct": False,
                    "marks_awarded": max_marks,
                    "max_marks": max_marks,
                    "feedback": "Correct answer!",
                    "evaluation_method": "deterministic"
                }
            else:
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": -negative_marks,
                    "max_marks": max_marks,
                    "feedback": f"Incorrect. Correct answer is: {display_target}",
                    "evaluation_method": "deterministic"
                }
            
        # 2b. Single Choice & Assertion & Reasoning
        if q_type in ["single_choice", "assertion_reasoning"]:
            target = correct_answer
            if isinstance(target, list) and len(target) > 0:
                target = target[0]
            
            user_val = user_answer
            if isinstance(user_val, list) and len(user_val) > 0:
                user_val = user_val[0]
                
            is_match = str(user_val).strip().upper() == str(target).strip().upper()
            if is_match:
                return {
                    "is_correct": True,
                    "is_partially_correct": False,
                    "marks_awarded": max_marks,
                    "max_marks": max_marks,
                    "feedback": "Correct answer!",
                    "evaluation_method": "deterministic"
                }
            else:
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": -negative_marks,
                    "max_marks": max_marks,
                    "feedback": f"Incorrect. Correct answer is: {target}",
                    "evaluation_method": "deterministic"
                }

        # 3. Multiple Choice (Multiple select)
        if q_type == "multiple_choice":
            targets = set([str(x).strip().upper() for x in (correct_answer if isinstance(correct_answer, list) else [correct_answer])])
            user_selection = set([str(x).strip().upper() for x in (user_answer if isinstance(user_answer, list) else [user_answer])])
            
            allow_partial = quiz_config.get("partial_credit", True) if quiz_config else True
            
            if user_selection == targets:
                return {
                    "is_correct": True,
                    "is_partially_correct": False,
                    "marks_awarded": max_marks,
                    "max_marks": max_marks,
                    "feedback": "All correct choices selected!",
                    "evaluation_method": "deterministic"
                }
            elif allow_partial and user_selection.issubset(targets) and len(user_selection) > 0:
                # Partial credit: fraction of correct answers chosen without selecting wrong ones
                ratio = len(user_selection) / len(targets)
                awarded = round(max_marks * ratio, 2)
                return {
                    "is_correct": False,
                    "is_partially_correct": True,
                    "marks_awarded": awarded,
                    "max_marks": max_marks,
                    "feedback": f"Partially correct ({len(user_selection)} of {len(targets)} correct options selected).",
                    "evaluation_method": "deterministic"
                }
            else:
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": -negative_marks,
                    "max_marks": max_marks,
                    "feedback": f"Incorrect. Expected: {', '.join(sorted(targets))}",
                    "evaluation_method": "deterministic"
                }

        # 4. Fill in the blank & Short answer & Code Output
        if q_type in ["fill_in_the_blank", "short_answer", "code_output"]:
            user_val = user_answer[0] if isinstance(user_answer, list) and len(user_answer) > 0 else user_answer
            clean_user = re.sub(r"\s+", " ", str(user_val or "").strip().lower())
            
            all_valid_answers = []
            if isinstance(correct_answer, list):
                all_valid_answers.extend([str(x).strip().lower() for x in correct_answer])
            elif correct_answer is not None:
                all_valid_answers.append(str(correct_answer).strip().lower())
                
            for acc in accepted_answers:
                all_valid_answers.append(str(acc).strip().lower())

            # If question has options (e.g. A, B, C, D code_output), also match option texts
            opts = question_dict.get("options") or []
            target_opt_texts = []
            for opt in opts:
                opt_id = (opt.get("id") if isinstance(opt, dict) else opt.id) if opt else ""
                opt_text = (opt.get("text") if isinstance(opt, dict) else opt.text) if opt else ""
                if str(opt_id).strip().lower() in all_valid_answers:
                    target_opt_texts.append(re.sub(r"\s+", " ", str(opt_text).strip().lower()))

            all_valid_answers.extend(target_opt_texts)
                
            if clean_user in all_valid_answers:
                return {
                    "is_correct": True,
                    "is_partially_correct": False,
                    "marks_awarded": max_marks,
                    "max_marks": max_marks,
                    "feedback": "Correct!",
                    "evaluation_method": "deterministic"
                }
            else:
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": -negative_marks,
                    "max_marks": max_marks,
                    "feedback": f"Incorrect. Accepted answer: {all_valid_answers[0] if all_valid_answers else 'N/A'}",
                    "evaluation_method": "deterministic"
                }

        # 5. Numerical Calculations with Tolerance
        if q_type == "numerical":
            user_float = cls._parse_float(user_answer)
            target_float = cls._parse_float(correct_answer)
            
            if user_float is None or target_float is None:
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": -negative_marks,
                    "max_marks": max_marks,
                    "feedback": f"Invalid numerical format: {user_answer}",
                    "evaluation_method": "deterministic"
                }

            diff = abs(user_float - target_float)
            allowed_tol = tolerance
            # Also accept relative tolerance if tolerance is 0
            is_within_tol = diff <= allowed_tol or (target_float != 0 and diff / abs(target_float) <= 0.01)

            if is_within_tol:
                return {
                    "is_correct": True,
                    "is_partially_correct": False,
                    "marks_awarded": max_marks,
                    "max_marks": max_marks,
                    "feedback": f"Correct numerical value ({user_float}).",
                    "evaluation_method": "deterministic"
                }
            else:
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": -negative_marks,
                    "max_marks": max_marks,
                    "feedback": f"Incorrect. Expected {target_float} (±{allowed_tol}). Received {user_float}.",
                    "evaluation_method": "deterministic"
                }

        # 6. Match the following
        if q_type == "match_the_following":
            # user_answer and correct_answer are dicts mapping left_id -> right_id
            if not isinstance(correct_answer, dict) or not isinstance(user_answer, dict):
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": 0.0,
                    "max_marks": max_marks,
                    "feedback": "Invalid matching payload.",
                    "evaluation_method": "deterministic"
                }
            
            total_pairs = len(correct_answer)
            if total_pairs == 0:
                return {
                    "is_correct": True,
                    "is_partially_correct": False,
                    "marks_awarded": max_marks,
                    "max_marks": max_marks,
                    "feedback": "Correct!",
                    "evaluation_method": "deterministic"
                }
                
            matched_count = sum(1 for k, v in user_answer.items() if str(correct_answer.get(k)).strip().upper() == str(v).strip().upper())
            
            if matched_count == total_pairs:
                return {
                    "is_correct": True,
                    "is_partially_correct": False,
                    "marks_awarded": max_marks,
                    "max_marks": max_marks,
                    "feedback": "All pairs matched correctly!",
                    "evaluation_method": "deterministic"
                }
            elif matched_count > 0:
                fraction = matched_count / total_pairs
                awarded = round(max_marks * fraction, 2)
                return {
                    "is_correct": False,
                    "is_partially_correct": True,
                    "marks_awarded": awarded,
                    "max_marks": max_marks,
                    "feedback": f"Partially correct: {matched_count}/{total_pairs} pairs matched.",
                    "evaluation_method": "deterministic"
                }
            else:
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": -negative_marks,
                    "max_marks": max_marks,
                    "feedback": "No pairs matched correctly.",
                    "evaluation_method": "deterministic"
                }

        # 7. Arrange in order
        if q_type == "arrange_in_order":
            # list of IDs in sequence
            if not isinstance(correct_answer, list) or not isinstance(user_answer, list):
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": 0.0,
                    "max_marks": max_marks,
                    "feedback": "Invalid sequence format.",
                    "evaluation_method": "deterministic"
                }
                
            if user_answer == correct_answer:
                return {
                    "is_correct": True,
                    "is_partially_correct": False,
                    "marks_awarded": max_marks,
                    "max_marks": max_marks,
                    "feedback": "Sequence arranged in perfect order!",
                    "evaluation_method": "deterministic"
                }
            else:
                # Count correct relative positions for partial credit
                pos_matches = sum(1 for i in range(min(len(user_answer), len(correct_answer))) if user_answer[i] == correct_answer[i])
                ratio = pos_matches / len(correct_answer) if len(correct_answer) > 0 else 0
                if ratio >= 0.5:
                    return {
                        "is_correct": False,
                        "is_partially_correct": True,
                        "marks_awarded": round(max_marks * ratio, 2),
                        "max_marks": max_marks,
                        "feedback": f"Partially correct: {pos_matches} items in correct index position.",
                        "evaluation_method": "deterministic"
                    }
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": -negative_marks,
                    "max_marks": max_marks,
                    "feedback": f"Incorrect sequence. Expected: {' -> '.join(str(x) for x in correct_answer)}",
                    "evaluation_method": "deterministic"
                }

        # 8. Interactive Coding Question (Evaluated against Test Cases)
        if q_type == "coding":
            code_to_eval = user_answer
            if isinstance(code_to_eval, list) and len(code_to_eval) > 0:
                code_to_eval = code_to_eval[0]
            code_to_eval = str(code_to_eval or "").strip()

            meta = question_dict.get("metadata_extra") or {}
            test_cases = meta.get("test_cases") or []
            lang = meta.get("language") or "python"
            expected_fn = meta.get("expected_fn") or meta.get("function_name")

            if not code_to_eval or code_to_eval in [
                "def solution():\n    pass",
                "def solution():\n    # Write your solution here\n    pass",
                meta.get("starter_code", "").strip()
            ]:
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": -negative_marks if negative_marks else 0.0,
                    "max_marks": max_marks,
                    "feedback": "No solution implemented (unchanged template submitted).",
                    "evaluation_method": "deterministic"
                }

            if not test_cases and ("sample_input" in meta or "sample_output" in meta):
                test_cases = [{
                    "input": meta.get("sample_input", ""),
                    "expected_output": meta.get("sample_output", ""),
                    "expected_fn": expected_fn
                }]

            if not test_cases:
                test_cases = [{"input": "", "expected_output": "", "expected_fn": expected_fn}]

            # Execute against test cases using SessionService
            from backend.app.services.session_service import SessionService
            run_res = SessionService.execute_code(code_to_eval, lang, test_cases)

            passed_cnt = run_res.passed_count
            total_cnt = run_res.total_count

            if passed_cnt == total_cnt and total_cnt > 0:
                return {
                    "is_correct": True,
                    "is_partially_correct": False,
                    "marks_awarded": max_marks,
                    "max_marks": max_marks,
                    "feedback": f"All {total_cnt} test cases passed successfully!",
                    "evaluation_method": "deterministic"
                }
            elif passed_cnt > 0:
                ratio = passed_cnt / total_cnt
                awarded = round(max_marks * ratio, 2)
                return {
                    "is_correct": False,
                    "is_partially_correct": True,
                    "marks_awarded": awarded,
                    "max_marks": max_marks,
                    "feedback": f"Partially correct: passed {passed_cnt} of {total_cnt} test cases.",
                    "evaluation_method": "deterministic"
                }
            else:
                first_err = next((r.error for r in run_res.results if r.error), None)
                err_summary = f" ({first_err})" if first_err else ""
                return {
                    "is_correct": False,
                    "is_partially_correct": False,
                    "marks_awarded": -negative_marks,
                    "max_marks": max_marks,
                    "feedback": f"Failed all test cases (0/{total_cnt} passed){err_summary}.",
                    "evaluation_method": "deterministic"
                }

        # Default fallback
        is_exact = str(user_answer).strip() == str(correct_answer).strip()
        return {
            "is_correct": is_exact,
            "is_partially_correct": False,
            "marks_awarded": max_marks if is_exact else -negative_marks,
            "max_marks": max_marks,
            "feedback": "Correct!" if is_exact else f"Incorrect. Correct answer: {correct_answer}",
            "evaluation_method": "deterministic"
        }
