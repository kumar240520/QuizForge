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

def test_quiz_and_bank_and_question_isolation(client, db_session):
    totp = generate_totp()
    # Register Alice
    u1 = client.post("/api/v1/auth/signup", json={
        "username": "alice_quiz",
        "email": "alice_quiz@example.com",
        "password": "Password123!",
        "admin_totp_code": totp,
        "role": "candidate"
    }).json()
    alice_token = u1["access_token"]

    # Register Bob
    totp = generate_totp()
    u2 = client.post("/api/v1/auth/signup", json={
        "username": "bob_quiz",
        "email": "bob_quiz@example.com",
        "password": "Password123!",
        "admin_totp_code": totp,
        "role": "candidate"
    }).json()
    bob_token = u2["access_token"]

    # 1. Alice creates a Quiz
    qz_res = client.post("/api/v1/quizzes", json={
        "title": "Alice Physics Exam",
        "mode": "exam",
        "timing_mode": "total_duration",
        "duration_minutes": 20
    }, headers={"Authorization": f"Bearer {alice_token}"})
    assert qz_res.status_code == 200
    alice_quiz_id = qz_res.json()["id"]

    # 2. Alice creates a Question Bank
    bank_res = client.post("/api/v1/banks", json={
        "title": "Alice Physics Bank",
        "description": "Mechanics and thermodynamics"
    }, headers={"Authorization": f"Bearer {alice_token}"})
    assert bank_res.status_code == 200
    alice_bank_id = bank_res.json()["id"]

    # 3. Alice creates a Question
    q_res = client.post("/api/v1/questions", json={
        "question_text": "What is acceleration?",
        "question_type": "single_choice",
        "bank_id": alice_bank_id,
        "options": [{"id": "A", "text": "Rate of change of velocity"}, {"id": "B", "text": "Force"}],
        "correct_answer": ["A"]
    }, headers={"Authorization": f"Bearer {alice_token}"})
    assert q_res.status_code == 200
    alice_q_id = q_res.json()["id"]

    # 4. Bob lists quizzes -> Alice's quiz must NOT appear!
    bob_quizzes = client.get("/api/v1/quizzes", headers={"Authorization": f"Bearer {bob_token}"}).json()
    assert all(q["id"] != alice_quiz_id for q in bob_quizzes)

    # 5. Bob lists questions -> Alice's question must NOT appear!
    bob_questions = client.get("/api/v1/questions", headers={"Authorization": f"Bearer {bob_token}"}).json()
    assert all(q["id"] != alice_q_id for q in bob_questions)

    # 6. Bob lists banks -> Alice's bank must NOT appear!
    bob_banks = client.get("/api/v1/banks", headers={"Authorization": f"Bearer {bob_token}"}).json()
    assert all(b["id"] != alice_bank_id for b in bob_banks)

    # 7. Bob attempts unauthorized update on Alice's quiz -> 403 Forbidden!
    hack_quiz = client.put(f"/api/v1/quizzes/{alice_quiz_id}", json={
        "title": "Hacked Title"
    }, headers={"Authorization": f"Bearer {bob_token}"})
    assert hack_quiz.status_code == 403

    # 8. Bob attempts unauthorized delete on Alice's quiz -> 403 Forbidden!
    del_quiz = client.delete(f"/api/v1/quizzes/{alice_quiz_id}", headers={"Authorization": f"Bearer {bob_token}"})
    assert del_quiz.status_code == 403

    # 9. Bob attempts unauthorized delete on Alice's question -> 403 Forbidden!
    del_q = client.delete(f"/api/v1/questions/{alice_q_id}", headers={"Authorization": f"Bearer {bob_token}"})
    assert del_q.status_code == 403

def test_gemini_api_key_isolation(client, db_session):
    totp = generate_totp()
    # Register Alice
    u1 = client.post("/api/v1/auth/signup", json={
        "username": "alice_ai",
        "email": "alice_ai@example.com",
        "password": "Password123!",
        "admin_totp_code": totp,
        "role": "candidate"
    }).json()
    alice_token = u1["access_token"]

    # Register Bob
    totp = generate_totp()
    u2 = client.post("/api/v1/auth/signup", json={
        "username": "bob_ai",
        "email": "bob_ai@example.com",
        "password": "Password123!",
        "admin_totp_code": totp,
        "role": "candidate"
    }).json()
    bob_token = u2["access_token"]

    # 1. Alice sets her Gemini API Key
    alice_save_key = client.post("/api/v1/settings/ai", json={
        "api_key": "AIzaSyAliceSecretKey1234567890",
        "model_name": "gemini-2.5-flash"
    }, headers={"Authorization": f"Bearer {alice_token}"})
    assert alice_save_key.status_code == 200

    # Alice reads her AI settings -> Key configured
    alice_ai = client.get("/api/v1/settings/ai", headers={"Authorization": f"Bearer {alice_token}"}).json()
    assert alice_ai["is_key_configured"] is True
    assert "AIzaSy" in alice_ai["masked_key"]

    # 2. Bob reads AI settings -> MUST BE FALSE AND EMPTY! (No cross-user key leakage)
    bob_ai = client.get("/api/v1/settings/ai", headers={"Authorization": f"Bearer {bob_token}"}).json()
    assert bob_ai["is_key_configured"] is False
    assert bob_ai["masked_key"] is None

    # 3. Bob sets his own key
    bob_save_key = client.post("/api/v1/settings/ai", json={
        "api_key": "AIzaSyBobSecretKey9876543210",
        "model_name": "gemini-2.5-pro"
    }, headers={"Authorization": f"Bearer {bob_token}"})
    assert bob_save_key.status_code == 200

    # Bob reads his settings
    bob_ai_new = client.get("/api/v1/settings/ai", headers={"Authorization": f"Bearer {bob_token}"}).json()
    assert bob_ai_new["is_key_configured"] is True
    assert bob_ai_new["model_name"] == "gemini-2.5-pro"

    # Alice's key remains completely isolated and unchanged
    alice_ai_still = client.get("/api/v1/settings/ai", headers={"Authorization": f"Bearer {alice_token}"}).json()
    assert alice_ai_still["is_key_configured"] is True
    assert alice_ai_still["model_name"] == "gemini-2.5-flash"

def test_admin_user_directory_and_cascade_delete(client, db_session):
    totp = generate_totp()
    # 1. Register an Admin
    admin_res = client.post("/api/v1/auth/signup", json={
        "username": "superadmin",
        "email": "superadmin@example.com",
        "password": "Password123!",
        "admin_totp_code": totp,
        "role": "admin"
    }).json()
    admin_token = admin_res["access_token"]
    admin_id = admin_res["user"]["id"]

    # 2. Register Candidate Charlie
    totp = generate_totp()
    charlie_res = client.post("/api/v1/auth/signup", json={
        "username": "charlie",
        "email": "charlie@example.com",
        "password": "Password123!",
        "admin_totp_code": totp,
        "role": "candidate"
    }).json()
    charlie_token = charlie_res["access_token"]
    charlie_id = charlie_res["user"]["id"]

    # Charlie creates a quiz and question
    client.post("/api/v1/quizzes", json={"title": "Charlie Chemistry Quiz"}, headers={"Authorization": f"Bearer {charlie_token}"})
    client.post("/api/v1/questions", json={
        "question_text": "What is H2O?",
        "question_type": "single_choice",
        "options": [{"id": "A", "text": "Water"}],
        "correct_answer": ["A"]
    }, headers={"Authorization": f"Bearer {charlie_token}"})

    # 3. Charlie attempts to access /admin/users -> 403 Forbidden!
    c_admin = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {charlie_token}"})
    assert c_admin.status_code == 403

    # 4. Admin accesses /admin/users -> succeeds and shows Charlie with his resources
    admin_list = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_list.status_code == 200
    users = admin_list.json()
    charlie_entry = next((u for u in users if u["id"] == charlie_id), None)
    assert charlie_entry is not None
    assert charlie_entry["username"] == "charlie"
    assert charlie_entry["quizzes_count"] >= 1
    assert charlie_entry["questions_count"] >= 1

    # 5. Admin tries to delete themselves -> 400 Bad Request
    self_del = client.delete(f"/api/v1/admin/users/{admin_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert self_del.status_code == 400

    # 6. Admin deletes Charlie -> 200 OK
    del_charlie = client.delete(f"/api/v1/admin/users/{charlie_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert del_charlie.status_code == 200

    # 7. Charlie is gone from the database, along with all his quizzes and questions
    assert db_session.query(User).filter(User.id == charlie_id).first() is None
    assert db_session.query(Quiz).filter(Quiz.user_id == charlie_id).count() == 0
    assert db_session.query(Question).filter(Question.user_id == charlie_id).count() == 0
