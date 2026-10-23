from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard")
def get_dashboard_summary(db: Session = Depends(get_db)):
    return AnalyticsService.get_dashboard_summary(db)

@router.get("/performance")
def get_performance_analytics(db: Session = Depends(get_db)):
    return AnalyticsService.get_performance_analytics(db)
