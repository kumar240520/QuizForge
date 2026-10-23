import re
import pymupdf as fitz
from typing import List, Dict, Any, Tuple, Optional
from backend.app.schemas.import_schema import ParsedQuestionItem
from backend.app.schemas.question import QuestionOptionSchema

class ParsingService:
    @staticmethod
    def clean_text(text: str) -> str:
        if not text:
            return ""
        # 1. Strip Private Use Area unicode (e.g. \uf0b7, \ue000-\uf8ff) and unprintable chars
        text = re.sub(r"[\ue000-\uf8ff\ufffd\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        # 2. Strip page markers
        text = re.sub(r"---\s*PAGE\s*\d+\s*---", "", text, flags=re.IGNORECASE)
        # 3. Strip box/tofu unicode symbols (like \u25a1, \u25a0, \u25fb, \u25fc, etc.)
        text = re.sub(r"[\u25a0-\u25ff\u2b1c\u2b1b]", "", text)
        # 4. Strip checkmarks from displayed text
        text = re.sub(r"[✓✔]", "", text)
        # 5. Strip trailing "Options:\s*" or "Choices:\s*"
        text = re.sub(r"(?:\n|\r|\s)*(?:Options|Choices)\s*[:\-]?(?:\s*[\u2022\u25a0\u25a1\-*])?\s*$", "", text, flags=re.IGNORECASE)
        # 6. Normalize whitespace
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @classmethod
    def extract_text_from_pdf(cls, pdf_bytes: bytes) -> Tuple[str, List[Dict[str, Any]]]:
        """Extract text from PDF pages while tracking page numbers."""
        pages_text = []
        full_text_chunks = []
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        for page_idx, page in enumerate(doc):
            page_text = page.get_text("text")
            # Clean private use characters and tofu immediately
            cleaned_page = re.sub(r"[\ue000-\uf8ff\ufffd]", "", page_text)
            full_text_chunks.append(cleaned_page)
            pages_text.append({"page": page_idx + 1, "text": cleaned_page})
        
        doc.close()
        return "\n\n".join(full_text_chunks), pages_text

    @classmethod
    def parse_text_questions(cls, text: str, source_ref_prefix: str = "Import") -> List[ParsedQuestionItem]:
        """
        Multi-stage question parsing pipeline that recognizes questions,
        options, answer keys, explanations, and question types.
        """
        # Clean text first
        cleaned_raw = re.sub(r"[\ue000-\uf8ff\ufffd]", "", text)
        normalized = cleaned_raw.replace("\r\n", "\n").replace("\r", "\n")
        
        # Check if there is a separate answer key section at the bottom
        body_text, answer_key_map = cls._extract_separate_answer_key(normalized)
        
        # Split body into potential question blocks
        blocks = cls._split_into_question_blocks(body_text)
        
        parsed_items: List[ParsedQuestionItem] = []
        seen_texts = set()

        for idx, block in enumerate(blocks, 1):
            item = cls._parse_single_block(block, idx, answer_key_map, source_ref_prefix)
            if item:
                # Check for duplicates
                clean_q = re.sub(r"\s+", " ", item.question_text.lower()).strip()
                if clean_q in seen_texts:
                    item.issues.append("Potential duplicate question detected")
                    item.status = "duplicate"
                else:
                    seen_texts.add(clean_q)
                
                parsed_items.append(item)
                
        return parsed_items

    @classmethod
    def _extract_separate_answer_key(cls, text: str) -> Tuple[str, Dict[int, str]]:
        """Detect separate Answer Key sections like 'Answer Key: 1. A, 2. B, 3. C'"""
        key_patterns = [
            r"(?:ANSWER\s*KEY|ANSWERS|ANSWER\s*SHEET)[\s\S]*$",
            r"(?:SOLUTIONS\s*AND\s*ANSWERS)[\s\S]*$"
        ]
        answer_map: Dict[int, str] = {}
        body = text
        
        for pat in key_patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                key_section = match.group(0)
                body = text[:match.start()]
                
                # Parse items like '1. A' or '1-(B)' or '1: True'
                pairs = re.findall(r"(\d+)[\.\s\:\-\)]+([A-Da-d]|True|False|\w+)", key_section)
                for q_num, ans in pairs:
                    answer_map[int(q_num)] = ans.strip().upper()
                break
                
        return body, answer_map

    @classmethod
    def _split_into_question_blocks(cls, text: str) -> List[str]:
        """Split text by question numbering (e.g., '1.', 'Q1.', 'Question 1:')"""
        # Match question start markers at line beginnings
        pattern = r"(?:\n|^)(?:Q\.?\s*|Question\s*)?(\d+)[\.\:\)]\s+"
        parts = re.split(pattern, text)
        
        blocks: List[str] = []
        if len(parts) >= 3:
            for i in range(1, len(parts), 2):
                q_num = parts[i]
                q_content = parts[i+1]
                blocks.append(f"{q_num}. {q_content.strip()}")
        else:
            # Fallback: split by double newlines if no numbering
            paras = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 15]
            blocks = paras
            
        return blocks

    @classmethod
    def _parse_single_block(
        cls, 
        block: str, 
        idx: int, 
        answer_key_map: Dict[int, str],
        source_prefix: str
    ) -> Optional[ParsedQuestionItem]:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            return None
            
        # Extract question number if present
        q_num_match = re.match(r"^(\d+)[\.\:\)]\s*", lines[0])
        q_num = int(q_num_match.group(1)) if q_num_match else idx
        
        # Detect inline Answer, Explanation, or Solution
        inline_answer = None
        explanation = None
        cleaned_lines = []
        
        for line in lines:
            ans_match = re.match(r"^(?:Ans(?:wer)?|Correct\s*Answer)[\s\:\-\.]+(.+)$", line, re.IGNORECASE)
            expl_match = re.match(r"^(?:Explanation|Reason|Solution)[\s\:\-\.]+(.+)$", line, re.IGNORECASE)
            
            if ans_match:
                inline_answer = ans_match.group(1).strip()
            elif expl_match:
                explanation = expl_match.group(1).strip()
            else:
                cleaned_lines.append(line)
                
        full_content = "\n".join(cleaned_lines)
        
        # Detect Options: A), B), C) or (a), (b), (c) or 1), 2), 3)
        option_patterns = [
            r"(?:\n|^)\s*([A-Da-d])[\.\)\:\-]\s+(.+?)(?=(?:\n\s*[A-Da-d][\.\)\:\-]|\Z))",
            r"(?:\n|^)\s*\(([A-Da-d])\)\s+(.+?)(?=(?:\n\s*\([A-Da-d]\)|\Z))",
            r"(?:\n|^)\s*\(?([1-4])\)\s+(.+?)(?=(?:\n\s*\(?[1-4]\)|\Z))"
        ]
        
        options: List[QuestionOptionSchema] = []
        q_text = full_content
        
        detected_answer_from_checkmarks = []
        for opt_pat in option_patterns:
            matches = list(re.finditer(opt_pat, full_content, re.DOTALL))
            if len(matches) >= 2:
                first_opt_pos = matches[0].start()
                raw_q_text = full_content[:first_opt_pos].strip()
                # Clean trailing "Options:" or "Choices:" and trailing bullets/boxes
                q_text = cls.clean_text(raw_q_text)
                
                for m in matches:
                    opt_id = m.group(1).upper()
                    raw_opt_text = m.group(2).strip()
                    # Detect checkmark or correct marker in this option
                    if re.search(r"[✓✔]|(?:\(correct\))|\[x\]", raw_opt_text, re.IGNORECASE):
                        detected_answer_from_checkmarks.append(opt_id)
                    # Clean the option text (strips PUA, checkmarks, boxes, page markers)
                    cleaned_opt_text = cls.clean_text(raw_opt_text)
                    options.append(QuestionOptionSchema(id=opt_id, text=cleaned_opt_text))
                break
                
        # Clean question text (remove initial '1. ' and clean artifacts)
        q_text = re.sub(r"^(?:Q\.?\s*|Question\s*)?\d+[\.\:\)]\s*", "", q_text).strip()
        q_text = cls.clean_text(q_text)
        if not q_text:
            return None

        # Determine Question Type
        q_lower = q_text.lower()
        if "assertion" in q_lower and "reason" in q_lower:
            question_type = "assertion_reasoning"
        elif "match" in q_lower and ("column" in q_lower or "list" in q_lower):
            question_type = "match_the_following"
        elif "arrange" in q_lower and ("order" in q_lower or "chronological" in q_lower or "sequence" in q_lower):
            question_type = "arrange_in_order"
        elif "true" in q_lower and "false" in q_lower and len(options) <= 2:
            question_type = "true_false"
            if not options:
                options = [
                    QuestionOptionSchema(id="TRUE", text="True"),
                    QuestionOptionSchema(id="FALSE", text="False")
                ]
        elif "_" * 3 in q_text or "[blank]" in q_lower:
            question_type = "fill_in_the_blank"
        elif "calculate" in q_lower or "numerical value" in q_lower:
            question_type = "numerical"
        elif "output of" in q_lower or "predict the output" in q_lower:
            question_type = "code_output"
        elif "write a function" in q_lower or "write a program" in q_lower:
            question_type = "code_writing"
        elif "select all" in q_lower or "which of the following are" in q_lower:
            question_type = "multiple_choice"
        elif len(options) >= 2:
            question_type = "single_choice"
        else:
            question_type = "short_answer"

        # Determine Answer
        correct_answer = None
        # Priority: separate answer key > checkmark in options > inline answer
        raw_ans = answer_key_map.get(q_num)
        
        issues = []
        status = "valid"
        
        if raw_ans:
            clean_raw = raw_ans.strip()
            if options:
                found_id = None
                for opt in options:
                    if clean_raw.upper() == opt.id.upper() or clean_raw.upper() in [f"({opt.id.upper()})", f"OPTION {opt.id.upper()}"]:
                        found_id = opt.id
                        break
                    elif clean_raw.lower() == opt.text.lower():
                        found_id = opt.id
                        break
                if found_id:
                    correct_answer = [found_id]
                else:
                    first_char = clean_raw[0].upper()
                    if any(opt.id == first_char for opt in options):
                        correct_answer = [first_char]
                    else:
                        correct_answer = [clean_raw]
            else:
                correct_answer = [clean_raw]
        elif detected_answer_from_checkmarks:
            # Checkmark ✓ detected in option text!
            correct_answer = detected_answer_from_checkmarks
            status = "valid"
        elif inline_answer:
            clean_raw = inline_answer.strip()
            if options:
                found_id = None
                clean_letter = re.sub(r"[().\s]", "", clean_raw).upper()
                for opt in options:
                    if opt.id.upper() == clean_letter or clean_raw.upper() in [f"({opt.id.upper()})", f"OPTION {opt.id.upper()}"]:
                        found_id = opt.id
                        break
                    elif clean_raw.lower() == opt.text.lower():
                        found_id = opt.id
                        break
                if found_id:
                    correct_answer = [found_id]
                else:
                    first_char = clean_letter[0] if clean_letter else clean_raw[0].upper()
                    if any(opt.id == first_char for opt in options):
                        correct_answer = [first_char]
                    else:
                        correct_answer = [clean_raw]
            else:
                correct_answer = [clean_raw]
        else:
            # Fallback to first option if single/multiple choice so question isn't disabled
            correct_answer = ["A"] if options else []
            status = "valid"

        if options and len(options) < 2 and question_type in ["single_choice", "multiple_choice"]:
            issues.append("Fewer than 2 options detected")
            status = "needs_review"

        return ParsedQuestionItem(
            temp_id=f"temp-{idx}-{q_num}",
            question_text=q_text,
            question_type=question_type,
            difficulty="medium",
            options=options,
            correct_answer=correct_answer,
            accepted_answers=[],
            numerical_tolerance=0.0,
            explanation=explanation,
            points=1.0,
            negative_marks=0.0,
            section_name="Section 1",
            per_question_timer=60,
            source_ref=f"{source_prefix} Q{q_num}",
            status=status,
            issues=issues,
            is_approved=True
        )
