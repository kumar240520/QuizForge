# QuizForge — Comprehensive Question Types, Schema Specification & AI Return Contracts

This document is the official, complete specification for all question types supported across **QuizForge** (Backend, AI Generation Engine, Database, Import Parsers, Scoring Engine, and Candidate Exam Interface).

You can use this reference to:
1. **Understand what the AI must return** when generating questions (for Gemini, OpenAI, Claude, etc.).
2. **Format JSON files** for direct batch import via `/imports` or `POST /api/v1/imports/json`.
3. **Understand backend normalizers, deterministic scoring rules, and candidate UI behavior**.
4. **Configure assessment options**, including custom duration limits (e.g. 5m, 10m, untimed) and Blind Mode (No Spoilers).

---

## 1. Core Question Schema Reference

Every question in QuizForge is represented as a JSON object adhering to the schema below.

### Complete Field Definitions

| Field Name | Type | Required? | Default | AI Return Mandate & Description |
| :--- | :--- | :--- | :--- | :--- |
| `question_text` | `string` | **Yes** | — | The problem statement or prompt. Markdown and LaTeX (`$math$`) are supported. |
| `question_type` | `string` | **Yes** | `"single_choice"` | Must be one of the **14 supported question types** (see Table 2). |
| `difficulty` | `string` | No | `"medium"` | `"easy"`, `"medium"`, or `"hard"`. |
| `points` | `float` | No | `1.0` | Maximum positive marks awarded for a fully correct answer. |
| `negative_marks` | `float` | No | `0.0` | Penalty deducted for an incorrect response (e.g., `0.25`). Set to `0.0` to disable penalty. |
| `section_name` | `string` | No | `"General"` | Name of the exam section (e.g. `"Computer Networks"`, `"Section A: Aptitude"`). |
| `per_question_timer` | `integer` | No | `null` | Per-question countdown time in seconds (e.g., `60`). Overrides quiz-level timer if enabled. |
| `options` | `array` | Conditional | `[]` | Array of objects `[{"id": "...", "text": "..."}]`. Required for choice-based, binary, matching (Column A), sequence, and assertion questions. Empty `[]` for freeform types. |
| `correct_answer` | `any` | **Yes** | — | Expected answer payload. Exact structure depends on `question_type` (e.g., array of IDs, mapping object, float, or reference code string). |
| `accepted_answers` | `array[str]` | No | `[]` | List of acceptable synonyms, alternate phrasings, or case variants for text/blank questions. |
| `numerical_tolerance` | `float` | No | `0.0` | Absolute allowed error margin for `numerical` questions (e.g. `0.05` means `answer ± 0.05` is accepted). |
| `explanation` | `string` | No | `null` | Detailed educational explanation shown during review or practice mode. |
| `worked_solution` | `string` | No | `null` | Step-by-step mathematical derivation or programmatic walkthrough. |
| `source_ref` | `string` | No | `null` | Reference text, chapter, textbook citation, or PDF page number. |
| `metadata_extra` | `object` | No | `{}` | Question-type-specific configuration (code snippets, starter code, test cases, match targets). |

---

## 2. All 14 Supported Question Types Overview

| Index | `question_type` Identifier | Category | Options Format | `correct_answer` Format | `metadata_extra` Requirements | Evaluation Method |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `single_choice` | Choice | `[{"id": "A", "text": "..."}]` | `["B"]` or `"B"` | Optional | Deterministic (exact ID match) |
| 2 | `multiple_choice` | Choice | `[{"id": "A", "text": "..."}]` | `["A", "C"]` | Optional | Deterministic (set match, partial credit) |
| 3 | `true_false` | Binary | `[{"id": "TRUE", "text": "True"}, {"id": "FALSE", "text": "False"}]` | `["TRUE"]` or `["FALSE"]` | Optional | Deterministic (normalized boolean comparison) |
| 4 | `fill_in_the_blank` | Text Entry | `[]` (empty) | `["primary term"]` | Optional | Deterministic (whitespace/case-normalized) |
| 5 | `short_answer` | Text Entry | `[]` (empty) | `["primary term"]` | Optional | Deterministic (whitespace/case-normalized) |
| 6 | `numerical` | Calculation | `[]` (empty) | `42.5` or `[42.5]` | Optional | Deterministic (within absolute tolerance) |
| 7 | `match_the_following` | Relational | `[{"id": "1", "text": "..."}]` (Left items) | `{"1": "A", "2": "B"}` (Object mapping) | `match_targets`: `[{"id": "A", "text": "..."}]` (Right items) | Deterministic (pair matching, partial credit) |
| 8 | `arrange_in_order` | Sequence | `[{"id": "STEP_1", ...}]` | `["STEP_1", "STEP_2", ...]` (Ordered IDs) | Optional | Deterministic (order alignment, partial credit) |
| 9 | `assertion_reasoning` | Logic | 4 Standard Choices A-D | `["A"]` | Optional | Deterministic (exact ID match) |
| 10 | `code_output` | Coding | Optional or `[]` | `["expected stdout"]` or `["A"]` | `code_snippet`: string, `language`: string | Deterministic (option ID or text output) |
| 11 | `code_debug` | Coding | Choices describing fixes | `["A"]` | `code_snippet`: string, `language`: string | Deterministic (fix option selection) |
| 12 | `coding` | Interactive | `[]` (empty) | Full Reference Solution Code | `language`, `starter_code`, `constraints`, `test_cases` | Sandbox Runner (live test execution) |
| 13 | `code_writing` | Subjective | `[]` (empty) | Reference Script / SQL Query | Optional | Rubric-assisted / Manual review |
| 14 | `descriptive` | Subjective | `[]` (empty) | Model Answer / Key Concept Points | Optional | Rubric-assisted / Manual review |

---

## 3. Strict AI Return Contracts for All 14 Question Types

When the AI generates questions, it must strictly return fields adhering to these contracts. The QuizForge backend normalizer enforces and sanitizes these formats before persisting to the database.

### 1. `single_choice` (Single-Answer MCQ)
- **AI Return Contract**:
  - `options`: Exactly 4 options with IDs `"A"`, `"B"`, `"C"`, `"D"`.
  - `correct_answer`: Array with single correct option ID, e.g. `["B"]`.
  - `metadata_extra`: Not required (or empty `{}`).

```json
{
  "question_text": "Which design pattern ensures a class has only one instance and provides a global point of access to it?",
  "question_type": "single_choice",
  "difficulty": "easy",
  "section_name": "Software Architecture",
  "points": 1.0,
  "negative_marks": 0.25,
  "per_question_timer": 45,
  "options": [
    {"id": "A", "text": "Factory Pattern"},
    {"id": "B", "text": "Singleton Pattern"},
    {"id": "C", "text": "Observer Pattern"},
    {"id": "D", "text": "Adapter Pattern"}
  ],
  "correct_answer": ["B"],
  "explanation": "The Singleton pattern restricts the instantiation of a class to one single instance and provides a global access point to it."
}
```

---

### 2. `multiple_choice` (Multiple-Select MCQ)
- **AI Return Contract**:
  - `options`: 4 to 6 options with IDs `"A"`, `"B"`, `"C"`, `"D"`, `"E"`.
  - `correct_answer`: Array of all valid option IDs, e.g. `["A", "B"]`.
  - Scoring: Proportional partial credit is awarded if partial credit is enabled, without penalizing unselected options unless a distractor is checked.

```json
{
  "question_text": "Which of the following sorting algorithms exhibit O(n log n) worst-case time complexity? (Select all that apply)",
  "question_type": "multiple_choice",
  "difficulty": "medium",
  "section_name": "Algorithms",
  "points": 2.0,
  "negative_marks": 0.5,
  "options": [
    {"id": "A", "text": "Merge Sort"},
    {"id": "B", "text": "Heap Sort"},
    {"id": "C", "text": "Quicksort"},
    {"id": "D", "text": "Bubble Sort"}
  ],
  "correct_answer": ["A", "B"],
  "explanation": "Merge Sort and Heap Sort guarantee O(n log n) in the worst case. Quicksort worst-case is O(n^2), and Bubble Sort is O(n^2)."
}
```

---

### 3. `true_false` (Binary Logic)
- **AI Return Contract**:
  - `options`: **MUST ALWAYS** be exactly:
    ```json
    [
      {"id": "TRUE", "text": "True"},
      {"id": "FALSE", "text": "False"}
    ]
    ```
  - `correct_answer`: **MUST ALWAYS** be either `["TRUE"]` or `["FALSE"]`.
  - **CRITICAL**: Never return `"A"` or `"B"`. Never return lowercase `"true"`.
  - **Backend Evaluation**: Token normalizer accepts `TRUE/FALSE`, `T/F`, `1/0`, `True/False`, and maps legacy `A/B`. Practice mode feedback renders friendly `"Incorrect. Correct answer is: True"` or `"False"`.

```json
{
  "question_text": "In Python, a tuple containing only immutable elements can be used as a dictionary key.",
  "question_type": "true_false",
  "difficulty": "easy",
  "section_name": "Python Fundamentals",
  "points": 1.0,
  "negative_marks": 0.0,
  "options": [
    {"id": "TRUE", "text": "True"},
    {"id": "FALSE", "text": "False"}
  ],
  "correct_answer": ["TRUE"],
  "explanation": "Dictionary keys in Python must be hashable. Tuples of immutable objects have a deterministic hash and can serve as dictionary keys."
}
```

---

### 4. `fill_in_the_blank` (Cloze Completion)
- **AI Return Contract**:
  - `options`: **MUST be empty array `[]`**.
  - `correct_answer`: Primary expected string array, e.g. `["method overriding"]`.
  - `accepted_answers`: Array of alternative acceptable phrasings, synonyms, or acronyms, e.g. `["overriding", "method override", "dynamic polymorphism"]`.
  - **Evaluation**: Normalized for case, leading/trailing whitespace, and internal spacing.

```json
{
  "question_text": "In Object-Oriented Programming, ________ allows a subclass to provide a specific implementation of a method that is already provided by its parent class.",
  "question_type": "fill_in_the_blank",
  "difficulty": "easy",
  "section_name": "OOP Concepts",
  "points": 1.0,
  "negative_marks": 0.0,
  "options": [],
  "correct_answer": ["method overriding"],
  "accepted_answers": ["overriding", "method override", "dynamic polymorphism"],
  "explanation": "Method overriding allows a subclass to redefine the behavior of an inherited superclass method."
}
```

---

### 5. `short_answer` (Factual Entry)
- **AI Return Contract**:
  - `options`: **MUST be empty array `[]`**.
  - `correct_answer`: Primary factual string in array, e.g. `["201"]`.
  - `accepted_answers`: Alternate forms, e.g. `["201 Created", "HTTP 201", "Created"]`.

```json
{
  "question_text": "What is the standard HTTP status code returned by a server when a new resource is successfully created via a POST request?",
  "question_type": "short_answer",
  "difficulty": "easy",
  "section_name": "Web Protocols",
  "points": 1.0,
  "negative_marks": 0.0,
  "options": [],
  "correct_answer": ["201"],
  "accepted_answers": ["201 Created", "HTTP 201", "Created"],
  "explanation": "HTTP 201 Created signifies that the request succeeded and resulted in one or more new resources being created on the server."
}
```

---

### 6. `numerical` (Quantitative Math/Engineering)
- **AI Return Contract**:
  - `options`: **MUST be empty array `[]`**.
  - `correct_answer`: Number (e.g. `28` or `42.5` or `[28]`).
  - `numerical_tolerance`: Float margin of error (e.g. `0.05` for `±0.05`). If exact answer is required, use `0.0`.

```json
{
  "question_text": "Calculate the total number of edges in a complete undirected graph with 8 vertices (K_8).",
  "question_type": "numerical",
  "difficulty": "medium",
  "section_name": "Discrete Mathematics",
  "points": 2.0,
  "negative_marks": 0.5,
  "options": [],
  "correct_answer": 28,
  "numerical_tolerance": 0.0,
  "explanation": "For any complete graph K_n, the number of edges is n * (n - 1) / 2. For n = 8: 8 * 7 / 2 = 28."
}
```

---

### 7. `match_the_following` (Column A to Column B Relational Matching)
- **AI Return Contract**:
  - `options`: List of items to match (**Column A / Left**): `[{"id": "1", "text": "..."}, {"id": "2", "text": "..."}]`.
  - `metadata_extra.match_targets`: Target pool (**Column B / Right**): `[{"id": "A", "text": "..."}, {"id": "B", "text": "..."}]`.
  - `correct_answer`: **JSON object** mapping Left IDs to Right IDs: `{"1": "A", "2": "B", "3": "C", "4": "D"}`.
  - **Candidate UI**: Renders mobile-responsive column selectors with dropdowns that wrap seamlessly on screens `<400px`.
  - **Scoring**: Partial credit awarded proportionally: `(matched_pairs / total_pairs) * max_marks`.

```json
{
  "question_text": "Match each networking protocol with its primary operating characteristic:",
  "question_type": "match_the_following",
  "difficulty": "medium",
  "section_name": "Computer Networks",
  "points": 4.0,
  "negative_marks": 1.0,
  "options": [
    {"id": "1", "text": "TCP (Transmission Control Protocol)"},
    {"id": "2", "text": "UDP (User Datagram Protocol)"},
    {"id": "3", "text": "ICMP (Internet Control Message Protocol)"},
    {"id": "4", "text": "ARP (Address Resolution Protocol)"}
  ],
  "metadata_extra": {
    "match_targets": [
      {"id": "A", "text": "Connection-oriented with reliable byte-stream and flow control"},
      {"id": "B", "text": "Connectionless lightweight datagram service with minimal overhead"},
      {"id": "C", "text": "Network layer diagnostics, error reporting, and ping utilities"},
      {"id": "D", "text": "Maps IP network addresses to physical MAC hardware addresses"}
    ]
  },
  "correct_answer": {
    "1": "A",
    "2": "B",
    "3": "C",
    "4": "D"
  },
  "explanation": "TCP is reliable connection-oriented; UDP is connectionless; ICMP handles diagnostics like ping; ARP translates IP addresses to hardware MAC addresses."
}
```

---

### 8. `arrange_in_order` (Chronological / Lifecycle Sequence)
- **AI Return Contract**:
  - `options`: List of sequence elements with arbitrary IDs: `[{"id": "STEP_1", "text": "..."}, {"id": "STEP_2", "text": "..."}]`.
  - `correct_answer`: **Array of IDs in the true sequential order**: `["STEP_1", "STEP_2", "STEP_3", "STEP_4", "STEP_5"]`.
  - **Candidate UI**: Interactive Up/Down reordering buttons and Reset Order helper.
  - **Scoring**: Full credit for exact match; partial credit if ≥50% of elements occupy their correct positional index.

```json
{
  "question_text": "Arrange the standard stages of the Java compilation and execution lifecycle in chronological order from earliest to latest:",
  "question_type": "arrange_in_order",
  "difficulty": "medium",
  "section_name": "Java Architecture",
  "points": 3.0,
  "negative_marks": 0.5,
  "options": [
    {"id": "STEP_1", "text": "Write source code files (.java)"},
    {"id": "STEP_2", "text": "Compile into platform-independent bytecode (.class) via javac"},
    {"id": "STEP_3", "text": "Class Loader loads bytecode into JVM memory"},
    {"id": "STEP_4", "text": "Bytecode Verifier checks for security and structure violations"},
    {"id": "STEP_5", "text": "Execution Engine (JIT Compiler / Interpreter) executes machine code"}
  ],
  "correct_answer": ["STEP_1", "STEP_2", "STEP_3", "STEP_4", "STEP_5"],
  "explanation": "Java lifecycle: Source Code (.java) -> javac Compiler -> Bytecode (.class) -> ClassLoader -> Bytecode Verifier -> JIT Compiler Execution."
}
```

---

### 9. `assertion_reasoning` (Logic & Causal Deduction)
- **AI Return Contract**:
  - `question_text`: Must contain labeled statements:
    - `Assertion (A): ...`
    - `Reason (R): ...`
  - `options`: Must include the 4 standard entrance-exam evaluation options:
    - `"A"`: Both (A) and (R) are true, and (R) is the correct explanation of (A).
    - `"B"`: Both (A) and (R) are true, but (R) is NOT the correct explanation of (A).
    - `"C"`: (A) is true, but (R) is false.
    - `"D"`: (A) is false, but (R) is true.
  - `correct_answer`: Array with single correct option ID, e.g. `["A"]`.

```json
{
  "question_text": "Given below are two statements, one labeled as Assertion (A) and the other labeled as Reason (R):\n\nAssertion (A): Hash table lookups have an average-case time complexity of O(1), but can degrade to O(n) in the worst case.\nReason (R): When hash collisions occur frequently and all keys map to the same bucket in separate chaining, lookup traverses a linked list of length n.\n\nChoose the correct option:",
  "question_type": "assertion_reasoning",
  "difficulty": "medium",
  "section_name": "Data Structures",
  "points": 2.0,
  "negative_marks": 0.5,
  "options": [
    {"id": "A", "text": "Both (A) and (R) are true, and (R) is the correct explanation of (A)."},
    {"id": "B", "text": "Both (A) and (R) are true, but (R) is NOT the correct explanation of (A)."},
    {"id": "C", "text": "(A) is true, but (R) is false."},
    {"id": "D", "text": "(A) is false, but (R) is true."}
  ],
  "correct_answer": ["A"],
  "explanation": "Both statements are correct. When a pathological collision pattern hashes all entries into a single bucket, search requires traversing a linked list of size n, causing O(n) worst-case time."
}
```

---

### 10. `code_output` (Terminal / Stdout Output Prediction)
- **AI Return Contract**:
  - `metadata_extra.code_snippet`: Code string to format in syntax highlighter.
  - `metadata_extra.language`: Target language (`"python"`, `"javascript"`, `"java"`, `"cpp"`).
  - `options`: Choices for output (or empty `[]` for free terminal text entry).
  - `correct_answer`: Option ID `["A"]` or exact terminal output string.

```json
{
  "question_text": "What is the exact console output produced by the following Python program?",
  "question_type": "code_output",
  "difficulty": "medium",
  "section_name": "Python Internals",
  "points": 1.5,
  "negative_marks": 0.25,
  "metadata_extra": {
    "language": "python",
    "code_snippet": "nums = [0, 1, 2, 3, 4, 5]\nresult = [x for x in nums if x % 2 == 0]\nprint(result)"
  },
  "options": [
    {"id": "A", "text": "[0, 2, 4]"},
    {"id": "B", "text": "[0, 1, 2, 3, 4]"},
    {"id": "C", "text": "[2, 4, 6]"},
    {"id": "D", "text": "[]"}
  ],
  "correct_answer": ["A"],
  "accepted_answers": ["[0, 2, 4]"],
  "explanation": "The list comprehension filters numbers where x % 2 == 0 from [0, 1, 2, 3, 4, 5], keeping 0, 2, and 4."
}
```

---

### 11. `code_debug` (Bug Detection & Remediation)
- **AI Return Contract**:
  - `metadata_extra.code_snippet`: Buggy code snippet.
  - `metadata_extra.language`: Target language.
  - `options`: Diagnostic choices describing the bug or code remediation.
  - `correct_answer`: Single-item array `["A"]`.

```json
{
  "question_text": "The following Python function intends to calculate the average of a list of numbers, but raises an unhandled ZeroDivisionError when given an empty list. Identify the correct fix.",
  "question_type": "code_debug",
  "difficulty": "medium",
  "section_name": "Debugging & Error Handling",
  "points": 2.0,
  "negative_marks": 0.5,
  "metadata_extra": {
    "language": "python",
    "code_snippet": "def calculate_average(numbers):\n    # Bug: crashes with ZeroDivisionError if numbers is empty\n    return sum(numbers) / len(numbers)"
  },
  "options": [
    {"id": "A", "text": "Check if not numbers and return 0.0 before dividing by len(numbers)"},
    {"id": "B", "text": "Use len(numbers) - 1 in the division formula"},
    {"id": "C", "text": "Replace sum(numbers) with reduce(numbers)"},
    {"id": "D", "text": "Convert numbers into a set before computing length"}
  ],
  "correct_answer": ["A"],
  "explanation": "If `numbers` is empty, len(numbers) is 0, causing ZeroDivisionError. Adding a guard condition `if not numbers: return 0.0` prevents division by zero."
}
```

---

### 12. `coding` (Interactive Programming Challenge with Test Runner)
- **AI Return Contract**:
  - `options`: **MUST be empty array `[]`**.
  - `metadata_extra.language`: `"python"` or `"javascript"`.
  - `metadata_extra.starter_code`: Boilerplate function template provided to the candidate.
  - `metadata_extra.constraints`: Array of strings specifying input bounds and performance limits.
  - `metadata_extra.test_cases`: Array of test objects `[{"input": "...", "expected_output": "..."}]`.
  - `correct_answer`: Complete reference implementation / working solution code.
  - **Candidate UI**: Split-pane professional Monaco / Code IDE with language switcher, test case tabs, and live runner.

```json
{
  "question_text": "Given an array of integers nums and an integer target, write a function two_sum(nums, target) that returns the indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. Return the answer in any order.",
  "question_type": "coding",
  "difficulty": "medium",
  "section_name": "Algorithms & Coding",
  "points": 5.0,
  "negative_marks": 0.0,
  "per_question_timer": 300,
  "options": [],
  "metadata_extra": {
    "language": "python",
    "starter_code": "def two_sum(nums: list[int], target: int) -> list[int]:\n    # Write your solution here\n    pass\n",
    "constraints": [
      "2 <= len(nums) <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists."
    ],
    "test_cases": [
      {
        "input": "nums = [2, 7, 11, 15], target = 9",
        "expected_output": "[0, 1]"
      },
      {
        "input": "nums = [3, 2, 4], target = 6",
        "expected_output": "[1, 2]"
      },
      {
        "input": "nums = [3, 3], target = 6",
        "expected_output": "[0, 1]"
      }
    ]
  },
  "correct_answer": "def two_sum(nums: list[int], target: int) -> list[int]:\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []",
  "explanation": "We iterate through the list while maintaining a hash map of seen numbers and their indices. For each number, we check if its complement (target - num) exists in the map in O(1) time, yielding O(n) overall time."
}
```

---

### 13. `code_writing` (Written Code / SQL / Scripts)
- **AI Return Contract**:
  - `options`: **MUST be empty array `[]`**.
  - `correct_answer`: Reference script or SQL statement.
  - `explanation`: Detailed explanation of syntax and query mechanics.

```json
{
  "question_text": "Write a SQL query to retrieve the names and salaries of the top 3 highest-earning employees from an 'employees' table with columns (id, name, salary, department_id), ordered by salary descending.",
  "question_type": "code_writing",
  "difficulty": "medium",
  "section_name": "Databases & SQL",
  "points": 3.0,
  "negative_marks": 0.0,
  "options": [],
  "correct_answer": "SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 3;",
  "explanation": "SELECT name, salary retrieves the required columns, ORDER BY salary DESC sorts from highest to lowest salary, and LIMIT 3 restricts the output to the top 3 records."
}
```

---

### 14. `descriptive` (Subjective Essay / Architectural Analysis)
- **AI Return Contract**:
  - `options`: **MUST be empty array `[]`**.
  - `correct_answer`: Model answer or key evaluation points.
  - `explanation`: Detailed grading rubric and scoring criteria breakdown.

```json
{
  "question_text": "Explain the ACID properties of relational database management systems. Describe each property briefly and provide a concrete banking scenario illustrating what could go wrong if that property were violated.",
  "question_type": "descriptive",
  "difficulty": "hard",
  "section_name": "Database Architecture",
  "points": 5.0,
  "negative_marks": 0.0,
  "options": [],
  "correct_answer": "A complete response covers Atomicity (all or nothing, e.g. debit without credit), Consistency (valid state transitions upholding integrity constraints), Isolation (concurrent transactions do not interfere, e.g. dirty reads), and Durability (committed data survives server crashes).",
  "explanation": "Grading Rubric:\n- Atomicity (25%): Explains all-or-nothing execution with transaction commit/rollback example.\n- Consistency (25%): Explains adherence to schema constraints and non-negative account balances.\n- Isolation (25%): Explains concurrency control and avoidance of dirty/lost updates.\n- Durability (25%): Explains write-ahead logging (WAL) ensuring durability after server crash."
}
```

---

## 4. Backend AI Output Normalization Layer

To protect against unexpected LLM hallucinations, QuizForge runs an automatic normalization layer (`backend/app/integrations/gemini/client.py`) on every generated question before saving:

1. **`true_false` Normalization**:
   - Replaces any option format with canonical `[{"id": "TRUE", "text": "True"}, {"id": "FALSE", "text": "False"}]`.
   - Converts answers like `"A"`, `"B"`, `"T"`, `"F"`, `"True"`, `"False"`, `1`, `0` to authoritative `["TRUE"]` or `["FALSE"]` by inspecting option semantics.
2. **`match_the_following` Normalization**:
   - Ensures `options` strictly contains Left Column items.
   - Extracts or provisions `metadata_extra.match_targets` for Right Column targets.
   - Converts `correct_answer` arrays or merged strings into a key-value dictionary `{"1": "A", ...}`.
3. **`numerical` Normalization**:
   - Coerces string numbers (e.g. `"28.5"`) into genuine floats/integers.
   - Ensures `options` is empty `[]`.
4. **`assertion_reasoning` Normalization**:
   - Detects missing boilerplate Assertion-Reason options and auto-populates standard A, B, C, D choices.
5. **`arrange_in_order` Normalization**:
   - Verifies that `correct_answer` is an array of IDs matching the sequence items.

---

## 5. Assessment Timing, Blind Mode & Creation Workflows

### 1. Custom Duration Limits (`custom_duration_minutes`)
- Users can override default assessment timing directly on the **Pre-Assessment Launchpad**:
  - **Presets**: `Default`, `5m`, `10m`, `15m`, `20m`, `30m`, `Custom Input`, and `Untimed`.
  - When starting a session (`POST /api/v1/sessions/start`), `custom_duration_minutes` is passed in the payload:
    - If `custom_duration_minutes > 0`: Deadline is calculated authoritatively by the backend as `session_deadline = now + timedelta(minutes=custom_duration_minutes)`.
    - If `custom_duration_minutes == 0`: Assessment runs in **Untimed Mode** (`session_deadline = null`).
- Eliminates hardcoded timer defaults and provides candidate flexibility.

### 2. Blind Assessment Mode ("No Spoilers")
- Available on the AI Generation and Import review screens.
- **Features**:
  - Masks question stems and seals answer keys during generation review.
  - Allows assessment creators to take their newly generated quiz without cognitive bias or spoilers.
  - Offers rapid attempt limit selectors (`5 Questions`, `10 Questions`, or `All Questions`) and a 1-click **"Start Assessment Now"** launch.

### 3. Assessment Attachment & Duplicate Prevention
- When generating questions with an active `quiz_id` (via wizard or URL parameter), QuizForge directly attaches newly generated questions to the existing assessment instead of spawning a duplicate quiz.

---

## 6. Production Master AI Prompt (Ready for Gemini / OpenAI / Claude)

Copy and paste this system prompt into any LLM to generate 100% compliant questions:

````markdown
You are an expert assessment author for QuizForge.
Generate assessment questions formatted STRICTLY as a JSON array of objects.

ALLOWED QUESTION TYPES:
- single_choice
- multiple_choice
- true_false
- fill_in_the_blank
- short_answer
- numerical
- match_the_following
- arrange_in_order
- assertion_reasoning
- code_output
- code_debug
- coding
- code_writing
- descriptive

JSON OBJECT SPECIFICATION:
[
  {
    "question_text": "Clear problem statement (supports Markdown and LaTeX $math$)",
    "question_type": "single_choice",
    "difficulty": "easy | medium | hard",
    "section_name": "Section Name",
    "points": 1.0,
    "negative_marks": 0.0,
    "per_question_timer": 60,
    "options": [
      {"id": "A", "text": "Option text 1"},
      {"id": "B", "text": "Option text 2"}
    ],
    "correct_answer": ["A"],
    "accepted_answers": ["alternative acceptable phrasing"],
    "numerical_tolerance": 0.0,
    "explanation": "Detailed rationale explaining why this answer is correct",
    "metadata_extra": {}
  }
]

CRITICAL RULES FOR SPECIFIC QUESTION TYPES:
1. "true_false":
   - "options" MUST ALWAYS be exactly:
     [{"id": "TRUE", "text": "True"}, {"id": "FALSE", "text": "False"}]
   - "correct_answer" MUST be either ["TRUE"] or ["FALSE"] (NEVER use 'A' or 'B').
2. "single_choice":
   - "options" are IDs "A", "B", "C", "D". "correct_answer" is ["B"].
3. "multiple_choice":
   - "options" are IDs "A", "B", "C", "D". "correct_answer" is an array of IDs, e.g. ["A", "C"].
4. "fill_in_the_blank" and "short_answer":
   - "options" MUST be empty array [].
   - "correct_answer" is an array with the primary answer string, e.g. ["Stack"].
   - "accepted_answers" lists valid synonyms or alternative spellings.
5. "numerical":
   - "options" MUST be empty array [].
   - "correct_answer" is a float or integer, e.g. 42.5.
   - "numerical_tolerance" is the allowed margin (e.g. 0.05).
6. "match_the_following":
   - "options" contains Column A (Left items): [{"id": "1", "text": "Item 1"}, ...]
   - "metadata_extra" MUST have "match_targets" for Column B (Right items): [{"id": "A", "text": "Target A"}, ...]
   - "correct_answer" MUST be an object mapping Left ID to Right ID: {"1": "A", "2": "B", ...}
7. "arrange_in_order":
   - "options" contains the items to sequence: [{"id": "STEP_1", "text": "..."}, ...]
   - "correct_answer" MUST be the array of IDs in correct sequence: ["STEP_1", "STEP_2", ...]
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
   - "metadata_extra" MUST have "language": "python", "starter_code": "def ...", "constraints": [...], and "test_cases": [{"input": "...", "expected_output": "..."}].
   - "correct_answer" is the complete reference solution code string.
11. "descriptive" and "code_writing":
   - "options" MUST be empty array [].
   - "correct_answer" is the model answer or reference script.

Always output ONLY valid JSON in a top-level array without preamble. Ensure 100% factual and mathematical accuracy.
````

---

## 7. File Location Reference

- **Documentation**: [sample_data/question_types.md](file:///d:/JAVA%20WEBDEV/QuizForge/sample_data/question_types.md)
- **Ready-to-Import Complete Sample JSON**: [sample_data/sample_questions.json](file:///d:/JAVA%20WEBDEV/QuizForge/sample_data/sample_questions.json)
