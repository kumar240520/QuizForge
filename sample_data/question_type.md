# QuizForge — Comprehensive Question Types & Schema Specification

This document is the official, complete specification for all question types supported across **QuizForge** (Backend, AI Generation Engine, Database, Import Parsers, Scoring Engine, and Candidate Exam Interface).

You can use this reference to:
1. **Format JSON files** for direct batch import via `/imports` or `POST /api/v1/imports/json`.
2. **Craft AI prompts** (for Gemini, ChatGPT, Claude, etc.) to generate questions that match QuizForge's exact structure without parsing errors.
3. **Understand candidate UI behavior & deterministic evaluation rules** for every assessment mode.

---

## 1. Core Question Schema Reference

Every question in QuizForge is represented as a JSON object adhering to the schema below.

### Field Definitions

| Field Name | Type | Required? | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `question_text` | `string` | **Yes** | — | The problem statement, prompt, or question body. Markdown and LaTeX (`$math$`) are supported. |
| `question_type` | `string` | **Yes** | `"single_choice"` | One of the 14 supported types (see list below). |
| `difficulty` | `string` | No | `"medium"` | `"easy"`, `"medium"`, or `"hard"`. |
| `points` | `float` | No | `1.0` | Maximum positive marks awarded for a fully correct answer. |
| `negative_marks` | `float` | No | `0.0` | Penalty deducted for an incorrect response (e.g., `0.25`). Set to `0.0` to disable negative marking. |
| `section_name` | `string` | No | `"General"` | Name of the exam section (e.g. `"Computer Networks"`, `"Section A: Aptitude"`). |
| `per_question_timer`| `integer` | No | `null` | Per-question countdown time in seconds (e.g., `60`). Overrides quiz-level timer if enabled. |
| `options` | `array` | Conditional | `[]` | List of option objects `{"id": "A", "text": "Option text"}`. Required for choice-based questions. |
| `correct_answer` | `any` | **Yes** | — | Expected answer payload. Structure depends on `question_type` (see detailed breakdown). |
| `accepted_answers` | `array[str]`| No | `[]` | List of acceptable synonyms, alternate phrasings, or case variants for text/blank questions. |
| `numerical_tolerance`| `float` | No | `0.0` | Absolute allowed error margin for `numerical` questions (e.g. `0.05` means `answer ± 0.05` is accepted). |
| `explanation` | `string` | No | `null` | Detailed educational explanation shown during review or practice mode. |
| `worked_solution` | `string` | No | `null` | Step-by-step mathematical derivation or programmatic walkthrough. |
| `source_ref` | `string` | No | `null` | Reference text, chapter, textbook citation, or PDF page number. |
| `metadata_extra` | `object` | No | `{}` | Question-type-specific configuration (code snippets, starter code, test cases, match targets). |

---

## 2. All 14 Supported Question Types

| Index | `question_type` Identifier | Category | Options Format | `correct_answer` Format | Evaluation Method |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | `single_choice` | Choice | `[{"id": "A", "text": "..."}]` | `["B"]` or `"B"` | Deterministic (exact ID match) |
| 2 | `multiple_choice` | Choice | `[{"id": "A", "text": "..."}]` | `["A", "C"]` | Deterministic (set match, partial credit) |
| 3 | `true_false` | Binary | `[{"id": "TRUE", ...}, ...]` | `["TRUE"]` or `"TRUE"` | Deterministic (exact ID match) |
| 4 | `fill_in_the_blank` | Text Entry | `[]` | `["primary term"]` | Deterministic (whitespace/case-normalized) |
| 5 | `short_answer` | Text Entry | `[]` | `["primary term"]` | Deterministic (whitespace/case-normalized) |
| 6 | `numerical` | Calculation | `[]` | `42.5` or `[42.5]` | Deterministic (within tolerance) |
| 7 | `match_the_following`| Relational | `[{"id": "1", ...}]` | `{"1": "A", "2": "B"}` | Deterministic (pair matching, partial credit) |
| 8 | `arrange_in_order` | Sequence | `[{"id": "STEP_1", ...}]`| `["STEP_1", "STEP_2"]` | Deterministic (order alignment, partial credit)|
| 9 | `assertion_reasoning`| Logic | 4 Standard Choices A-D | `["A"]` | Deterministic (exact ID match) |
| 10 | `code_output` | Coding | Optional or `[]` | `["expected stdout"]` | Deterministic (option ID or text output) |
| 11 | `code_debug` | Coding | Optional or `[]` | `["A"]` or fix string | Deterministic (fix option or correction) |
| 12 | `coding` | Interactive | `[]` | Reference Solution Code | Sandbox Runner (test cases execution) |
| 13 | `code_writing` | Subjective | `[]` | Reference Solution Code | Manual / Rubric evaluation |
| 14 | `descriptive` | Subjective | `[]` | Model Answer / Key Points| Manual / Rubric evaluation |

---

## 3. Detailed Specifications with JSON Examples

### 1. `single_choice` (Single-Answer Multiple Choice)
- **Description**: Standard 4-option question where candidate chooses exactly one answer.
- **Options**: Typically 4 options with identifiers `A`, `B`, `C`, `D`.
- **`correct_answer`**: Single-item array `["B"]` or string `"B"`.

```json
{
  "question_text": "Which design pattern ensures a class has only one instance and provides a global point of access to it?",
  "question_type": "single_choice",
  "difficulty": "easy",
  "section_name": "Software Architecture",
  "options": [
    {"id": "A", "text": "Factory Pattern"},
    {"id": "B", "text": "Singleton Pattern"},
    {"id": "C", "text": "Observer Pattern"},
    {"id": "D", "text": "Adapter Pattern"}
  ],
  "correct_answer": ["B"],
  "explanation": "The Singleton pattern restricts the instantiation of a class to one single instance and provides a global access point to it.",
  "points": 1.0,
  "negative_marks": 0.25,
  "per_question_timer": 45
}
```

---

### 2. `multiple_choice` (Multiple Select / Multi-Answer)
- **Description**: Question with multiple correct answers. Candidate checks checkboxes.
- **`correct_answer`**: Array of all valid option IDs, e.g. `["A", "B"]`.
- **Scoring**: Full credit if exact set matches. Partial credit is awarded proportionally if enabled (`marks * (selected / total_correct)`) without penalties for unselected options if no wrong option was clicked.

```json
{
  "question_text": "Which of the following sorting algorithms exhibit O(n log n) worst-case time complexity? (Select all that apply)",
  "question_type": "multiple_choice",
  "difficulty": "medium",
  "section_name": "Algorithms",
  "options": [
    {"id": "A", "text": "Merge Sort"},
    {"id": "B", "text": "Heap Sort"},
    {"id": "C", "text": "Quicksort"},
    {"id": "D", "text": "Bubble Sort"}
  ],
  "correct_answer": ["A", "B"],
  "explanation": "Merge Sort and Heap Sort guarantee O(n log n) in the worst case. Quicksort worst-case is O(n^2), and Bubble Sort is O(n^2).",
  "points": 2.0,
  "negative_marks": 0.5
}
```

---

### 3. `true_false` (Binary Choice)
- **Description**: Statement evaluated as True or False.
- **Options**: Always `[{"id": "TRUE", "text": "True"}, {"id": "FALSE", "text": "False"}]`.
- **`correct_answer`**: `["TRUE"]` or `["FALSE"]`.

```json
{
  "question_text": "In Python, a tuple containing only immutable elements can be used as a dictionary key.",
  "question_type": "true_false",
  "difficulty": "easy",
  "section_name": "Python Fundamentals",
  "options": [
    {"id": "TRUE", "text": "True"},
    {"id": "FALSE", "text": "False"}
  ],
  "correct_answer": ["TRUE"],
  "explanation": "Dictionary keys in Python must be hashable. Tuples of immutable objects have a deterministic hash and can serve as dictionary keys.",
  "points": 1.0,
  "negative_marks": 0.0
}
```

---

### 4. `fill_in_the_blank` (Cloze Completion)
- **Description**: Sentence containing blanks (`_______`). Candidate inputs text.
- **Options**: Empty array `[]`.
- **`correct_answer`**: Primary answer array `["method overriding"]`.
- **`accepted_answers`**: Alternate spellings or variations e.g. `["overriding", "method override"]`.
- **Scoring**: Case-insensitive and whitespace-normalized comparison against `correct_answer` and `accepted_answers`.

```json
{
  "question_text": "In Object-Oriented Programming, ________ allows a subclass to provide a specific implementation of a method that is already provided by its parent class.",
  "question_type": "fill_in_the_blank",
  "difficulty": "easy",
  "section_name": "OOP Concepts",
  "options": [],
  "correct_answer": ["method overriding"],
  "accepted_answers": ["overriding", "method override", "dynamic polymorphism"],
  "explanation": "Method overriding allows a subclass to redefine the behavior of an inherited superclass method.",
  "points": 1.0,
  "negative_marks": 0.0
}
```

---

### 5. `short_answer` (Direct Factual Entry)
- **Description**: Concise question answered with a short phrase, term, or acronym.
- **Options**: Empty array `[]`.
- **`correct_answer`**: Array with primary answer `["201"]`.
- **`accepted_answers`**: Array of acceptable variations `["201 Created", "Created (201)"]`.

```json
{
  "question_text": "What is the standard HTTP status code returned by a server when a new resource is successfully created via a POST request?",
  "question_type": "short_answer",
  "difficulty": "easy",
  "section_name": "Web Protocols",
  "options": [],
  "correct_answer": ["201"],
  "accepted_answers": ["201 Created", "HTTP 201", "Created"],
  "explanation": "HTTP 201 Created signifies that the request succeeded and resulted in one or more new resources being created on the server.",
  "points": 1.0,
  "negative_marks": 0.0
}
```

---

### 6. `numerical` (Quantitative Calculation)
- **Description**: Math, physics, or algorithmic calculation where candidate enters a number.
- **Options**: Empty array `[]`.
- **`correct_answer`**: Float or integer value (e.g. `28` or `[28]`).
- **`numerical_tolerance`**: Allowed deviation `±tolerance`. If set to `0.0`, exact match (or fallback 1% relative tolerance) is used.

```json
{
  "question_text": "Calculate the total number of edges in a complete undirected graph with 8 vertices (K_8).",
  "question_type": "numerical",
  "difficulty": "medium",
  "section_name": "Discrete Mathematics",
  "options": [],
  "correct_answer": 28,
  "numerical_tolerance": 0.0,
  "explanation": "For any complete graph K_n, the number of edges is n * (n - 1) / 2. For n = 8: 8 * 7 / 2 = 28.",
  "points": 2.0,
  "negative_marks": 0.5
}
```

---

### 7. `match_the_following` (Column A to Column B Matching)
- **Description**: Matches items in Column A (Left) with definitions/targets in Column B (Right).
- **`options`**: Left-hand items to match `[{"id": "1", "text": "..."}, ...]`.
- **`metadata_extra.match_targets`**: Right-hand target pool `[{"id": "A", "text": "..."}, ...]`.
- **`correct_answer`**: JSON dictionary mapping left ID to right ID: `{"1": "A", "2": "B", ...}`.
- **Scoring**: Partial credit awarded based on matched ratio `(matched_pairs / total_pairs) * max_marks`.

```json
{
  "question_text": "Match each networking protocol with its primary operating characteristic:",
  "question_type": "match_the_following",
  "difficulty": "medium",
  "section_name": "Computer Networks",
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
  "explanation": "TCP is reliable connection-oriented; UDP is connectionless; ICMP handles diagnostics like ping; ARP translates IP addresses to hardware MAC addresses.",
  "points": 4.0,
  "negative_marks": 1.0
}
```

---

### 8. `arrange_in_order` (Sequence Reordering)
- **Description**: Sequence of steps or lifecycle phases that candidate reorders top-to-bottom.
- **`options`**: Unordered or arbitrary items `[{"id": "STEP_1", "text": "..."}, ...]`.
- **`correct_answer`**: Array of IDs in the true chronological or logical sequence: `["STEP_1", "STEP_2", ...]`.
- **Scoring**: Exact order gives 100%. If ≥50% of items are in their correct positional index, partial credit is awarded.

```json
{
  "question_text": "Arrange the standard stages of the Java compilation and execution lifecycle in chronological order from earliest to latest:",
  "question_type": "arrange_in_order",
  "difficulty": "medium",
  "section_name": "Java Architecture",
  "options": [
    {"id": "STEP_1", "text": "Write source code files (.java)"},
    {"id": "STEP_2", "text": "Compile into platform-independent bytecode (.class) via javac"},
    {"id": "STEP_3", "text": "Class Loader loads bytecode into JVM memory"},
    {"id": "STEP_4", "text": "Bytecode Verifier checks for security and structure violations"},
    {"id": "STEP_5", "text": "Execution Engine (JIT Compiler / Interpreter) executes machine code"}
  ],
  "correct_answer": ["STEP_1", "STEP_2", "STEP_3", "STEP_4", "STEP_5"],
  "explanation": "Java lifecycle: Source Code (.java) -> javac Compiler -> Bytecode (.class) -> ClassLoader -> Bytecode Verifier -> JIT Compiler Execution.",
  "points": 3.0,
  "negative_marks": 0.5
}
```

---

### 9. `assertion_reasoning` (Assertion & Reason)
- **Description**: Classic entrance exam question format consisting of Assertion (A) and Reason (R).
- **Options**: The standard 4 assertion-reason options A, B, C, D.
- **`correct_answer`**: Single-item array `["A"]` or string `"A"`.

```json
{
  "question_text": "Given below are two statements, one labeled as Assertion (A) and the other labeled as Reason (R):\n\nAssertion (A): Hash table lookups have an average-case time complexity of O(1), but can degrade to O(n) in the worst case.\nReason (R): When hash collisions occur frequently and all keys map to the same bucket in separate chaining, lookup traverses a linked list of length n.\n\nChoose the correct option:",
  "question_type": "assertion_reasoning",
  "difficulty": "medium",
  "section_name": "Data Structures",
  "options": [
    {"id": "A", "text": "Both (A) and (R) are true, and (R) is the correct explanation of (A)."},
    {"id": "B", "text": "Both (A) and (R) are true, but (R) is NOT the correct explanation of (A)."},
    {"id": "C", "text": "(A) is true, but (R) is false."},
    {"id": "D", "text": "(A) is false, but (R) is true."}
  ],
  "correct_answer": ["A"],
  "explanation": "Both statements are correct. When a pathological collision pattern hashes all entries into a single bucket, search requires traversing a linked list of size n, causing O(n) worst-case time.",
  "points": 2.0,
  "negative_marks": 0.5
}
```

---

### 10. `code_output` (Predict Code Output)
- **Description**: Displays a formatted code snippet. Candidate predicts the terminal / stdout result.
- **`metadata_extra.code_snippet`**: Code string to display in syntax highlighter.
- **`metadata_extra.language`**: `"python"`, `"javascript"`, `"java"`, `"c"`, `"cpp"`, etc.
- **`options`**: Multiple choice options (or empty array `[]` for free terminal text entry).
- **`correct_answer`**: Array of option ID `["A"]` or expected terminal output string.

```json
{
  "question_text": "What is the exact console output produced by the following Python program?",
  "question_type": "code_output",
  "difficulty": "medium",
  "section_name": "Python Internals",
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
  "explanation": "The list comprehension filters numbers where x % 2 == 0 from [0, 1, 2, 3, 4, 5], keeping 0, 2, and 4.",
  "points": 1.5,
  "negative_marks": 0.25
}
```

---

### 11. `code_debug` (Identify & Fix Bug)
- **Description**: Presents buggy code. Candidate identifies the bug or chooses the correct fix.
- **`metadata_extra.code_snippet`**: Buggy code snippet.
- **`metadata_extra.language`**: Programming language.
- **`options`**: Diagnostic choices describing the bug or code remediation.
- **`correct_answer`**: Single-item array `["A"]`.

```json
{
  "question_text": "The following Python function intends to calculate the average of a list of numbers, but raises an unhandled ZeroDivisionError when given an empty list. Identify the correct fix.",
  "question_type": "code_debug",
  "difficulty": "medium",
  "section_name": "Debugging & Error Handling",
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
  "explanation": "If `numbers` is empty, len(numbers) is 0, causing ZeroDivisionError. Adding a guard condition `if not numbers: return 0.0` prevents division by zero.",
  "points": 2.0,
  "negative_marks": 0.5
}
```

---

### 12. `coding` (Interactive Programming Challenge with Test Runner)
- **Description**: Full programming problem solved inside QuizForge's code editor with live test case verification.
- **`metadata_extra`**:
  - `language`: Target language (`"python"`, `"javascript"`, etc.).
  - `starter_code`: Boilerplate function template provided to the candidate.
  - `constraints`: Array of problem constraints.
  - `test_cases`: Array of test objects `{"input": "...", "expected_output": "..."}`.
- **`correct_answer`**: Complete reference implementation / solution code.
- **Scoring**: Evaluated by executing test cases in real-time or recorded for automated test verification.

```json
{
  "question_text": "Given an array of integers nums and an integer target, write a function two_sum(nums, target) that returns the indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. Return the answer in any order.",
  "question_type": "coding",
  "difficulty": "medium",
  "section_name": "Algorithms & Coding",
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
  "explanation": "We iterate through the list while maintaining a hash map of seen numbers and their indices. For each number, we check if its complement (target - num) exists in the map in O(1) time, yielding O(n) overall time.",
  "points": 5.0,
  "negative_marks": 0.0,
  "per_question_timer": 300
}
```

---

### 13. `code_writing` (Written Code / SQL / Scripts)
- **Description**: Candidate writes code or SQL queries into a code editor/textarea for human or rubric-assisted review.
- **`correct_answer`**: Reference script or SQL statement.
- **Scoring**: Recorded and flagged for subjective rubric evaluation.

```json
{
  "question_text": "Write a SQL query to retrieve the names and salaries of the top 3 highest-earning employees from an 'employees' table with columns (id, name, salary, department_id), ordered by salary descending.",
  "question_type": "code_writing",
  "difficulty": "medium",
  "section_name": "Databases & SQL",
  "options": [],
  "correct_answer": "SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 3;",
  "explanation": "SELECT name, salary retrieves the required columns, ORDER BY salary DESC sorts from highest to lowest salary, and LIMIT 3 restricts the output to the top 3 records.",
  "points": 3.0,
  "negative_marks": 0.0
}
```

---

### 14. `descriptive` (Subjective Essay / Theoretical Analysis)
- **Description**: Open-ended conceptual analysis, architectural design, or essay question.
- **`correct_answer`**: Model answer or key evaluation points.
- **`explanation`**: Detailed grading rubric and scoring criteria.
- **Scoring**: Flagged as `manual_pending` for instructor evaluation against the rubric.

```json
{
  "question_text": "Explain the ACID properties of relational database management systems. Describe each property briefly and provide a concrete banking scenario illustrating what could go wrong if that property were violated.",
  "question_type": "descriptive",
  "difficulty": "hard",
  "section_name": "Database Architecture",
  "options": [],
  "correct_answer": "A complete response covers Atomicity (all or nothing, e.g. debit without credit), Consistency (valid state transitions upholding integrity constraints), Isolation (concurrent transactions do not interfere, e.g. dirty reads), and Durability (committed data survives server crashes).",
  "explanation": "Grading Rubric:\n- Atomicity (25%): Explains all-or-nothing execution with transaction commit/rollback example.\n- Consistency (25%): Explains adherence to schema constraints and non-negative account balances.\n- Isolation (25%): Explains concurrency control and avoidance of dirty/lost updates.\n- Durability (25%): Explains write-ahead logging (WAL) ensuring durability after server crash.",
  "points": 5.0,
  "negative_marks": 0.0
}
```

---

## 4. Master AI Prompt for Question Generation

You can copy and paste the system prompt below into any AI model (Gemini, Claude, ChatGPT, etc.) to generate questions formatted for QuizForge:

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
    "question_text": "Clear question body (supports markdown and LaTeX)",
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
    "accepted_answers": ["alternative phrasing"],
    "numerical_tolerance": 0.0,
    "explanation": "Comprehensive explanation of the solution",
    "metadata_extra": {
      // For coding:
      // "language": "python",
      // "starter_code": "def solution(...):\n    pass\n",
      // "constraints": ["1 <= n <= 10^5"],
      // "test_cases": [{"input": "...", "expected_output": "..."}]
      //
      // For match_the_following:
      // "match_targets": [{"id": "A", "text": "Target text"}]
      //
      // For code_output or code_debug:
      // "language": "python",
      // "code_snippet": "print('hello')"
    }
  }
]

CRITICAL RULES:
1. Always output ONLY valid JSON in a top-level array. Do not include markdown preamble outside the ```json codeblock.
2. For match_the_following, `options` contains Left items, `metadata_extra.match_targets` contains Right items, and `correct_answer` is an object: `{"1": "A", "2": "B"}`.
3. For arrange_in_order, `correct_answer` is an array of IDs in correct sequence: `["STEP_1", "STEP_2"]`.
4. Ensure 100% factual accuracy and sound answer keys.
````

---

## 5. File Location Reference

- **Documentation**: [sample_data/question_type.md](file:///d:/JAVA%20WEBDEV/QuizForge/sample_data/question_type.md)
- **Ready-to-Import Complete Sample JSON**: [sample_data/sample_questions.json](file:///d:/JAVA%20WEBDEV/QuizForge/sample_data/sample_questions.json)
