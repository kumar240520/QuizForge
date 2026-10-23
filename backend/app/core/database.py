from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from backend.app.core.config import settings

# Normalize database URL
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# SQLite connection args
connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    echo=False
)

# Enable foreign keys for SQLite
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_schema_migrations():
    """
    Ensure newly added columns exist in existing SQLite/Postgres tables.
    Runs idempotently on backend startup so EC2 deployments don't crash.
    """
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        with engine.begin() as conn:
            # 1. users table: active_session_id, last_login_at, gemini_model
            if "users" in tables:
                user_cols = [c["name"] for c in inspector.get_columns("users")]
                if "active_session_id" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN active_session_id VARCHAR(64)"))
                if "last_login_at" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP"))
                if "gemini_model" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN gemini_model VARCHAR(100) DEFAULT 'gemini-2.5-flash'"))

            # 2. quizzes table: user_id
            if "quizzes" in tables:
                quiz_cols = [c["name"] for c in inspector.get_columns("quizzes")]
                if "user_id" not in quiz_cols:
                    conn.execute(text("ALTER TABLE quizzes ADD COLUMN user_id INTEGER"))

            # 3. question_banks table: user_id
            if "question_banks" in tables:
                bank_cols = [c["name"] for c in inspector.get_columns("question_banks")]
                if "user_id" not in bank_cols:
                    conn.execute(text("ALTER TABLE question_banks ADD COLUMN user_id INTEGER"))

            # 4. questions table: user_id
            if "questions" in tables:
                q_cols = [c["name"] for c in inspector.get_columns("questions")]
                if "user_id" not in q_cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN user_id INTEGER"))

            # 5. import_jobs table: user_id
            if "import_jobs" in tables:
                job_cols = [c["name"] for c in inspector.get_columns("import_jobs")]
                if "user_id" not in job_cols:
                    conn.execute(text("ALTER TABLE import_jobs ADD COLUMN user_id INTEGER"))

            # 6. quiz_sessions table: user_id
            if "quiz_sessions" in tables:
                qs_cols = [c["name"] for c in inspector.get_columns("quiz_sessions")]
                if "user_id" not in qs_cols:
                    conn.execute(text("ALTER TABLE quiz_sessions ADD COLUMN user_id INTEGER"))

            # 7. quiz_results table: user_id
            if "quiz_results" in tables:
                qr_cols = [c["name"] for c in inspector.get_columns("quiz_results")]
                if "user_id" not in qr_cols:
                    conn.execute(text("ALTER TABLE quiz_results ADD COLUMN user_id INTEGER"))

            # 8. revision_items table: user_id
            if "revision_items" in tables:
                rev_cols = [c["name"] for c in inspector.get_columns("revision_items")]
                if "user_id" not in rev_cols:
                    conn.execute(text("ALTER TABLE revision_items ADD COLUMN user_id INTEGER"))

            # 9. Clean up legacy global gemini key in system_settings if any to prevent cross-account leak
            if "system_settings" in tables:
                conn.execute(text("DELETE FROM system_settings WHERE key = 'gemini_api_key'"))
    except Exception as e:
        print(f"[Migration Warning] Auto-migration check: {e}")

