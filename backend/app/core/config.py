import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

def get_default_db_url() -> str:
    env_url = os.environ.get("DATABASE_URL")
    if env_url:
        return env_url
    # If running on Vercel Serverless (read-only filesystem, use /tmp)
    if os.environ.get("VERCEL") == "1":
        return "sqlite:////tmp/quizforge.db"
    return "sqlite:///./quizforge.db"

class Settings(BaseSettings):
    APP_NAME: str = "QuizForge"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = get_default_db_url()
    
    # Gemini AI configuration
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Upload limits
    MAX_UPLOAD_SIZE_MB: int = 25
    SECRET_KEY: str = "quizforge-dev-secret-key-389146"
    
    # JWT and Google Authenticator TOTP Gatekeeper
    JWT_SECRET_KEY: str = "quizforge-jwt-super-secret-key-9281728391"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days for mobile / persistent access
    MASTER_ADMIN_TOTP_SECRET: str = "JBSWY3DPEHPK3PXP" # Base32 secret for Google Authenticator
    
    _root_env: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))
    
    model_config = SettingsConfigDict(
        env_file=(_root_env, ".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
