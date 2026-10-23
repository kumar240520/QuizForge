import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.core.database import engine, Base, SessionLocal
from backend.app.api.v1.api_router import api_v1_router
from backend.app.models.question_bank import QuestionBank, Subject, Topic
from backend.app.models.question import Question
from backend.app.models.quiz import Quiz

# Eager table creation for serverless environments (Vercel)
try:
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure all tables exist on startup
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="Professional AI-Powered Assessment & Learning Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Support both /api/v1 (standard) and /v1 (Vercel serverless rewrite)
app.include_router(api_v1_router, prefix=settings.API_V1_STR)
app.include_router(api_v1_router, prefix="/v1")

@app.get("/")
@app.get("/api")
@app.get("/api/")
def root():
    return {
        "app": settings.APP_NAME,
        "docs_url": "/docs",
        "api_v1": f"{settings.API_V1_STR}/health"
    }
