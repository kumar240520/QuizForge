from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.result import QuizResult, QuestionAttemptResult
from backend.app.models.quiz import Quiz
from backend.app.models.revision import RevisionItem

class AnalyticsService:
    @classmethod
    def get_dashboard_summary(cls, db: Session, user_id: Optional[int] = None) -> Dict[str, Any]:
        query = db.query(QuizResult)
        if user_id is not None:
            query = query.filter(QuizResult.user_id == user_id)
        else:
            query = query.filter(QuizResult.user_id == None)
        results = query.order_by(QuizResult.completed_at.desc()).all()
        
        total_attempts = len(results)
        if total_attempts == 0:
            return {
                "total_assessments_taken": 0,
                "total_questions_answered": 0,
                "average_percentage": 0.0,
                "best_percentage": 0.0,
                "accuracy_rate": 0.0,
                "weak_topics": [],
                "recent_results": [],
                "mastery_counts": {"new": 0, "learning": 0, "needs_revision": 0, "mastered": 0}
            }
            
        total_questions = sum(r.total_questions for r in results)
        total_correct = sum(r.correct_count for r in results)
        avg_pct = round(sum(r.percentage for r in results) / total_attempts, 1)
        best_pct = max(r.percentage for r in results)
        overall_accuracy = round((total_correct / total_questions * 100), 1) if total_questions > 0 else 0.0
        
        # Aggregate topic performance across all results
        topic_totals: Dict[str, Dict[str, int]] = {}
        for r in results:
            if r.breakdown and "topics" in r.breakdown:
                for topic, stats in r.breakdown["topics"].items():
                    if topic not in topic_totals:
                        topic_totals[topic] = {"total": 0, "correct": 0}
                    topic_totals[topic]["total"] += stats.get("total", 0)
                    topic_totals[topic]["correct"] += stats.get("correct", 0)
                    
        weak_topics = []
        for topic, st in topic_totals.items():
            if st["total"] >= 2: # At least 2 questions to classify
                acc = round((st["correct"] / st["total"] * 100), 1)
                if acc < 60.0:
                    weak_topics.append({"topic": topic, "accuracy": acc, "total_questions": st["total"]})
        weak_topics.sort(key=lambda x: x["accuracy"])
        
        # Recent results
        recent_results = []
        for r in results[:5]:
            recent_results.append({
                "id": r.id,
                "quiz_title": r.quiz.title if r.quiz else "Assessment",
                "score": r.score,
                "max_score": r.max_score,
                "percentage": r.percentage,
                "total_questions": r.total_questions,
                "correct_count": r.correct_count,
                "time_taken_seconds": r.time_taken_seconds,
                "completed_at": r.completed_at.isoformat()
            })

        # Mastery items count scoped to user
        rev_query = db.query(RevisionItem)
        if user_id is not None:
            rev_query = rev_query.filter(RevisionItem.user_id == user_id)
        else:
            rev_query = rev_query.filter(RevisionItem.user_id == None)
        rev_items = rev_query.all()
        mastery_counts = {"new": 0, "learning": 0, "needs_revision": 0, "mastered": 0}
        for item in rev_items:
            st = item.mastery_state
            if st in mastery_counts:
                mastery_counts[st] += 1

        return {
            "total_assessments_taken": total_attempts,
            "total_questions_answered": total_questions,
            "average_percentage": avg_pct,
            "best_percentage": best_pct,
            "accuracy_rate": overall_accuracy,
            "weak_topics": weak_topics[:5],
            "recent_results": recent_results,
            "mastery_counts": mastery_counts
        }

    @classmethod
    def get_performance_analytics(cls, db: Session, user_id: Optional[int] = None) -> Dict[str, Any]:
        query = db.query(QuizResult)
        if user_id is not None:
            query = query.filter(QuizResult.user_id == user_id)
        else:
            query = query.filter(QuizResult.user_id == None)
        results = query.order_by(QuizResult.completed_at.asc()).all()
        
        # Trend over time
        trends = []
        topic_aggregates: Dict[str, Dict[str, int]] = {}
        difficulty_aggregates: Dict[str, Dict[str, int]] = {}
        type_aggregates: Dict[str, Dict[str, int]] = {}

        for idx, r in enumerate(results, 1):
            trends.append({
                "attempt_number": idx,
                "quiz_title": r.quiz.title if r.quiz else f"Quiz {idx}",
                "percentage": r.percentage,
                "score": r.score,
                "max_score": r.max_score,
                "correct_count": r.correct_count,
                "incorrect_count": r.incorrect_count,
                "date": r.completed_at.strftime("%b %d")
            })

            if r.breakdown:
                for top, st in r.breakdown.get("topics", {}).items():
                    if top not in topic_aggregates:
                        topic_aggregates[top] = {"total": 0, "correct": 0}
                    topic_aggregates[top]["total"] += st.get("total", 0)
                    topic_aggregates[top]["correct"] += st.get("correct", 0)

                for diff, st in r.breakdown.get("difficulty", {}).items():
                    if diff not in difficulty_aggregates:
                        difficulty_aggregates[diff] = {"total": 0, "correct": 0}
                    difficulty_aggregates[diff]["total"] += st.get("total", 0)
                    difficulty_aggregates[diff]["correct"] += st.get("correct", 0)

                for qtype, st in r.breakdown.get("question_types", {}).items():
                    if qtype not in type_aggregates:
                        type_aggregates[qtype] = {"total": 0, "correct": 0}
                    type_aggregates[qtype]["total"] += st.get("total", 0)
                    type_aggregates[qtype]["correct"] += st.get("correct", 0)

        topic_chart = [
            {"topic": t, "accuracy": round(v["correct"] / v["total"] * 100, 1) if v["total"] > 0 else 0, "total": v["total"]}
            for t, v in topic_aggregates.items()
        ]
        topic_chart.sort(key=lambda x: x["accuracy"])

        diff_chart = [
            {"difficulty": d, "accuracy": round(v["correct"] / v["total"] * 100, 1) if v["total"] > 0 else 0, "total": v["total"]}
            for d, v in difficulty_aggregates.items()
        ]

        type_chart = [
            {"type": t.replace("_", " ").title(), "accuracy": round(v["correct"] / v["total"] * 100, 1) if v["total"] > 0 else 0, "total": v["total"]}
            for t, v in type_aggregates.items()
        ]

        return {
            "trends": trends,
            "topic_accuracy": topic_chart,
            "difficulty_accuracy": diff_chart,
            "type_accuracy": type_chart,
            "total_attempts": len(results)
        }
