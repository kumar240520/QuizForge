# QuizForge — AI-Powered Assessment & Learning Platform

[![Tests](https://img.shields.io/badge/tests-13%20passed-emerald)](https://github.com/kumar240520/Minor-project-1)
[![Backend](https://img.shields.io/badge/FastAPI-0.115+-blue)](https://fastapi.tiangolo.com)
[![Frontend](https://img.shields.io/badge/React-19%20%7C%20TypeScript%20%7C%20Vite-61dafb)](https://react.dev)
[![AI](https://img.shields.io/badge/Google%20Gen%20AI-Gemini%202.5-purple)](https://ai.google.dev)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**QuizForge** is an enterprise-grade, full-stack assessment and personalized learning platform. It allows users to import question papers from PDFs or formatted text, generate high-quality question sets using Google's Gemini API, conduct server-authoritative timed assessments, evaluate responses with deterministic precision, and reinforce weak concepts through SM-2 spaced repetition algorithms.

---

## Key Highlights & Architectural Strengths

- **Universal Assessment Engine**: Handles imported and AI-generated questions through a single, consistent question bank, session state machine, and scoring engine.
- **Support for 12 Question Formats**:
  1. Single-choice MCQ
  2. Multiple-select MCQ (with partial credit)
  3. True / False
  4. Fill in the Blanks (whitespace-normalized, alternative accepted answers)
  5. Numerical Calculations (with configurable absolute & relative tolerances)
  6. Match the Following (column pair evaluation)
  7. Arrange in Order (sequence position analysis)
  8. Code-Output Prediction
  9. Code-Writing Questions
  10. Assertion and Reasoning
  11. Short Answer
  12. Descriptive Questions (rubric evaluation)
- **Authoritative Server Timers**: Timers are tied to server UTC timestamps and resilient against browser reloads, clock tampering, and page navigation.
- **Timing Modes**:
  - **Mode A**: Total Session Duration only
  - **Mode B**: Per-Question Timer only
  - **Mode C**: Both Timers (active question deadline strictly bounded by session deadline)
  - **Mode D**: Untimed
- **Immutable Historical Snapshots**: Completed assessment attempts preserve deep snapshots of questions at the moment of taking, guaranteeing that later edits to the question bank never corrupt past attempt metrics.
- **SM-2 Spaced Repetition**: Memory retention scheduling prioritizing repeatedly missed concepts, overdue items, and weak topics.
- **Zero-Credential Browser Exposure**: All Gemini calls run exclusively on the backend. The API key is optional and stored securely; quizzes and document imports work completely offline without it.

---

## Technology Stack

- **Backend**: Python 3.12+ / 3.13, FastAPI, SQLAlchemy 2.0, Pydantic v2, PyMuPDF (`pymupdf`), `google-genai` official SDK, Pytest, SQLite (with WAL mode & foreign keys enabled) / PostgreSQL-ready.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, Recharts for data visualization, React Router v7.

---

## Project Structure

```text
QuizForge/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI application & startup seed
│   │   ├── api/v1/                     # Versioned REST API routes
│   │   │   ├── api_router.py           # Master router aggregator
│   │   │   ├── health.py               # Health checks
│   │   │   ├── settings_api.py         # AI credentials, theme & data settings
│   │   │   ├── question_banks.py       # Banks, subjects, and topics
│   │   │   ├── questions.py            # Question CRUD & search
│   │   │   ├── imports.py              # PDF text extraction & staged parser
│   │   │   ├── generation.py           # Gemini topic & grounded question generator
│   │   │   ├── quizzes.py              # Quiz assessment builder & config
│   │   │   ├── sessions.py             # Authoritative quiz sessions & timers
│   │   │   ├── results.py              # Result analytics & CSV export
│   │   │   ├── revision.py             # Spaced repetition queue & quiz builder
│   │   │   └── analytics.py            # KPI aggregation & trends
│   │   ├── core/                       # Database engine, config & security
│   │   ├── models/                     # Relational SQLAlchemy models
│   │   ├── schemas/                    # Validated Pydantic models
│   │   ├── services/                   # Parsing, scoring, session & revision logic
│   │   └── integrations/gemini/        # Google GenAI official SDK client
│   ├── tests/                          # Pytest automated test suites
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/layout/          # AppShell, Sidebar & Header
│   │   ├── context/                    # ThemeContext (Light, Dark, System)
│   │   ├── pages/                      # All 20 application views
│   │   ├── services/api.ts             # Typed REST API client
│   │   ├── types/index.ts              # TypeScript interface contracts
│   │   ├── App.tsx                     # React Router layout
│   │   └── index.css                   # Tailwind tokens & dark mode styles
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── sample_data/                        # Sample PDF, text, and JSON test files
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Quickstart & Local Installation

### Prerequisites
- Python 3.12 or newer
- Node.js 18 or newer & npm

### Windows (PowerShell)

1. **Clone or Navigate to the Workspace**:
   ```powershell
   cd "d:\JAVA WEBDEV\QuizForge"
   ```

2. **Set up Python Virtual Environment**:
   ```powershell
   python -m venv backend\venv
   backend\venv\Scripts\pip.exe install -r backend\requirements.txt
   ```

3. **Install Frontend Dependencies**:
   ```powershell
   cd frontend
   npm install --legacy-peer-deps
   cd ..
   ```

4. **Start Both Backend & Frontend Simultaneously (Single Command)**:
   From the project root:
   ```powershell
   npm run dev
   ```
   *This uses `concurrently` to launch both the FastAPI backend (Port 8000) and Vite React frontend (Port 5173) in a single unified terminal with prefixed color logs.*

   *(Optional) To start them individually in separate terminals:*
   - Backend: `npm run dev:backend`
   - Frontend: `npm run dev:frontend`

5. Open `http://localhost:5173` in your browser.

---

### macOS / Linux (Bash)

1. **Set up Python Virtual Environment**:
   ```bash
   python3 -m venv backend/venv
   source backend/venv/bin/activate
   pip install -r backend/requirements.txt
   ```

2. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   cd ..
   ```

3. **Start Backend**:
   ```bash
   uvicorn backend.app.main:app --reload --port 8000
   ```

4. **Start Frontend**:
   ```bash
   cd frontend && npm run dev
   ```

---

## Running Automated Tests

### Backend Unit & Integration Tests (Pytest)
```powershell
# From project root:
backend\venv\Scripts\python.exe -m pytest backend/tests
```
Test suite covers:
- Document & text parsing (separate answer keys, multi-line questions, duplicate detection)
- Deterministic scoring engine (negative marking, partial credit, numerical tolerance)
- Assessment session lifecycle & server-authoritative timer limits
- Mocked Gemini structured JSON generation
- End-to-end API integration workflow

### Frontend Build & Typecheck
```powershell
cd frontend
npm run build
```

---

## End-to-End User Workflows

### 1. Document & Text Import
1. Navigate to **Workspace -> Imports**.
2. Upload a PDF or paste questions with options and an answer key.
3. Inspect the staged review screen: correct any detected ambiguities or missing keys.
4. Click **Approve & Save to Bank**.

### 2. AI Question Generation (Topic or Study Notes)
1. Go to **Workspace -> Create Assessment**.
2. Select **Generate From Topic** or **Grounded In Study Material**.
3. Configure subject, topic, question count, difficulty, and question types.
4. Click **Generate Questions**.
5. Review the structured output, make edits if desired, and click **Save to Bank** or **Start Assessment Now**.

### 3. Taking an Assessment
1. Select an assessment and review the pre-assessment instructions.
2. Enter the distraction-free assessment environment.
3. Answer questions using dedicated input controls (single-choice pills, checkboxes, formula inputs).
4. Monitor server-authoritative global and per-question timers.
5. Submit early or allow automatic submission upon timeout.

### 4. Reviewing Results & Spaced Revision
1. View the **Results Dashboard** with Recharts breakdowns by topic, difficulty, and question type.
2. Open **Detailed Answer Review** to inspect your responses alongside correct answers and explanations.
3. Head to the **Revision Center** to practice missed concepts or questions due according to SM-2 spaced repetition intervals.
4. Export results as CSV or print an official report.

---

## Environment Configuration

Create a `.env` file in the root directory:
```env
APP_NAME=QuizForge
DATABASE_URL=sqlite:///./quizforge.db
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
SECRET_KEY=quizforge-secret-key-change-in-production
```

---

## License

MIT License. Designed and engineered for professional and personal learning environments.
#   Q u i z F o r g e  
 