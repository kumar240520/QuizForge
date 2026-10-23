from fastapi import APIRouter
from backend.app.api.v1.health import router as health_router
from backend.app.api.v1.settings_api import router as settings_router
from backend.app.api.v1.question_banks import router as banks_router
from backend.app.api.v1.questions import router as questions_router
from backend.app.api.v1.imports import router as imports_router
from backend.app.api.v1.generation import router as generation_router
from backend.app.api.v1.quizzes import router as quizzes_router
from backend.app.api.v1.sessions import router as sessions_router
from backend.app.api.v1.results import router as results_router
from backend.app.api.v1.revision import router as revision_router
from backend.app.api.v1.analytics import router as analytics_router
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.admin_users import router as admin_users_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(admin_users_router)
api_v1_router.include_router(health_router)
api_v1_router.include_router(settings_router)
api_v1_router.include_router(banks_router)
api_v1_router.include_router(questions_router)
api_v1_router.include_router(imports_router)
api_v1_router.include_router(generation_router)
api_v1_router.include_router(quizzes_router)
api_v1_router.include_router(sessions_router)
api_v1_router.include_router(results_router)
api_v1_router.include_router(revision_router)
api_v1_router.include_router(analytics_router)
