import pytest
import pyotp
from backend.app.core.config import settings
from backend.app.models.user import User
from backend.app.models.quiz import Quiz
from backend.app.models.question import Question
from backend.app.models.result import QuizResult
from backend.app.services.session_service import SessionService
from backend.app.services.scoring_service import ScoringService

def generate_totp():
    return pyotp.TOTP(settings.MASTER_ADMIN_TOTP_SECRET).now()

def test_single_device_auto_eviction(client, db_session):
    # 1. Register a user
    totp = generate_totp()
    reg_res = client.post("/api/v1/auth/signup", json={
        "username": "deviceuser",
        "email": "deviceuser@example.com",
        "password": "Password123!",
        "admin_totp_code": totp,
        "role": "candidate"
    })
    assert reg_res.status_code == 200
    token_device_1 = reg_res.json()["access_token"]

    # Verify device 1 is authenticated
    me1 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_device_1}"})
    assert me1.status_code == 200
    assert me1.json()["username"] == "deviceuser"

    # 2. Login on device 2
    login_res = client.post("/api/v1/auth/login", json={
        "email_or_username": "deviceuser",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token_device_2 = login_res.json()["access_token"]
    assert token_device_1 != token_device_2

    # Verify device 2 is authenticated
    me2 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_device_2}"})
    assert me2.status_code == 200

    # 3. Verify device 1 is now kicked / evicted (HTTP 401 with SESSION_SUPERSEDED)
    evicted_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_device_1}"})
    assert evicted_res.status_code == 401
    assert "SESSION_SUPERSEDED" in evicted_res.json()["detail"]

    # 4. Explicit logout on device 2
    logout_res = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token_device_2}"})
    assert logout_res.status_code == 200

    # Verify device 2 is now expired too
    logged_out_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_device_2}"})
    assert logged_out_res.status_code == 401
    assert "SESSION_EXPIRED" in logged_out_res.json()["detail"]

def test_user_data_isolation(client, db_session):
    totp = generate_totp()
    # Create User A
    u1_res = client.post("/api/v1/auth/signup", json={
        "username": "alice",
        "email": "alice@example.com",
        "password": "Password123!",
        "admin_totp_code": totp,
        "role": "candidate"
    })
    assert u1_res.status_code == 200
    alice_token = u1_res.json()["access_token"]
    alice_id = u1_res.json()["user"]["id"]

    # Create User B (Friend)
    totp = generate_totp()
    u2_res = client.post("/api/v1/auth/signup", json={
        "username": "bob",
        "email": "bob@example.com",
        "password": "Password123!",
        "admin_totp_code": totp,
        "role": "candidate"
    })
    assert u2_res.status_code == 200
    bob_token = u2_res.json()["access_token"]
    bob_id = u2_res.json()["user"]["id"]

    # Setup a Question & Quiz
    q = Question(
        question_text="What is 5 + 5?",
        question_type="single_choice",
        options=[{"id": "A", "text": "10"}, {"id": "B", "text": "15"}],
        correct_answer=["A"],
        points=1.0,
        negative_marks=0.0
    )
    db_session.add(q)
    db_session.commit()

    quiz = Quiz(
        title="Maths Assessment",
        mode="exam",
        timing_mode="total_duration",
        duration_minutes=10,
        positive_marks=1.0,
        negative_marks=0.0,
        question_ids=[q.id]
    )
    db_session.add(quiz)
    db_session.commit()

    # User A (Alice) starts session and completes test
    s_res = client.post(
        "/api/v1/sessions/start",
        json={"quiz_id": quiz.id},
        headers={"Authorization": f"Bearer {alice_token}"}
    )
    assert s_res.status_code == 200
    session_token = s_res.json()["session_token"]

    # Alice answers
    ans_res = client.post(
        f"/api/v1/sessions/{session_token}/answer",
        json={"question_id": q.id, "user_answer": ["A"], "time_spent_seconds": 5},
        headers={"Authorization": f"Bearer {alice_token}"}
    )
    assert ans_res.status_code == 200

    # Bob tries to submit Alice's session -> must be 403 Forbidden!
    bob_hack = client.post(
        f"/api/v1/sessions/{session_token}/submit",
        headers={"Authorization": f"Bearer {bob_token}"}
    )
    assert bob_hack.status_code == 403

    # Alice submits
    sub_res = client.post(
        f"/api/v1/sessions/{session_token}/submit",
        headers={"Authorization": f"Bearer {alice_token}"}
    )
    assert sub_res.status_code == 200
    result_id = sub_res.json()["result_id"]

    # Alice checks dashboard -> shows 1 assessment taken
    alice_dash = client.get("/api/v1/analytics/dashboard", headers={"Authorization": f"Bearer {alice_token}"})
    assert alice_dash.status_code == 200
    assert alice_dash.json()["total_assessments_taken"] == 1

    # Bob checks dashboard -> MUST BE 0 assessments taken!
    bob_dash = client.get("/api/v1/analytics/dashboard", headers={"Authorization": f"Bearer {bob_token}"})
    assert bob_dash.status_code == 200
    assert bob_dash.json()["total_assessments_taken"] == 0
    assert len(bob_dash.json()["recent_results"]) == 0

    # Alice lists results -> 1 result
    alice_results = client.get("/api/v1/results", headers={"Authorization": f"Bearer {alice_token}"})
    assert alice_results.status_code == 200
    assert len(alice_results.json()) == 1

    # Bob lists results -> 0 results! (Bob cannot see Alice's results)
    bob_results = client.get("/api/v1/results", headers={"Authorization": f"Bearer {bob_token}"})
    assert bob_results.status_code == 200
    assert len(bob_results.json()) == 0

    # Bob tries to directly access Alice's result ID -> 403 Forbidden!
    bob_view = client.get(f"/api/v1/results/{result_id}", headers={"Authorization": f"Bearer {bob_token}"})
    assert bob_view.status_code == 403
