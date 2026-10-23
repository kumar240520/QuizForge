from fastapi import APIRouter

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "QuizForge AI Assessment & Learning Platform",
        "version": "1.0.0"
    }
