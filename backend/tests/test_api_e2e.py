import pytest

def test_full_platform_api_workflow(client):
    # 1. Health check
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    # 2. Settings check
    ai_res = client.get("/api/v1/settings/ai")
    assert ai_res.status_code == 200
    assert "available_models" in ai_res.json()

    # 3. Create Question Bank
    bank_res = client.post("/api/v1/banks", json={
        "title": "E2E Automated Bank",
        "description": "Integration testing question bank",
        "is_default": False
    })
    assert bank_res.status_code == 200
    bank_id = bank_res.json()["id"]

    # 4. Import Text Questions
    sample_text = """
1. What is the time complexity of searching an element in a balanced binary search tree?
A. O(n)
B. O(log n)
C. O(1)
D. O(n log n)
Answer: B
Explanation: A balanced BST has height O(log n), making search logarithmic.

2. In Python, dictionary keys must be hashable.
True
False
Answer: TRUE
Explanation: Dictionary keys in Python are looked up using hash tables.
    """
    import_res = client.post("/api/v1/imports/text", json={"content": sample_text, "bank_id": bank_id})
    assert import_res.status_code == 200
    job_data = import_res.json()
    assert job_data["total_detected"] == 2
    job_id = job_data["id"]

    # 5. Approve questions to bank
    approve_res = client.post(f"/api/v1/imports/jobs/{job_id}/approve", json={
        "job_id": job_id,
        "bank_id": bank_id,
        "questions": job_data["parsed_questions"]
    })
    assert approve_res.status_code == 200
    assert approve_res.json()["imported_count"] == 2

    # Query questions from bank
    q_list_res = client.get(f"/api/v1/questions?bank_id={bank_id}")
    assert q_list_res.status_code == 200
    saved_questions = q_list_res.json()
    assert len(saved_questions) == 2
    q1_id = saved_questions[0]["id"]
    q2_id = saved_questions[1]["id"]

    # 6. Create Quiz
    quiz_res = client.post("/api/v1/quizzes", json={
        "title": "E2E Automated Test Assessment",
        "description": "Testing full session and scoring lifecycle",
        "mode": "exam",
        "timing_mode": "total_duration",
        "duration_minutes": 20,
        "positive_marks": 2.0,
        "negative_marks": 0.5,
        "partial_credit": True,
        "question_ids": [q1_id, q2_id]
    })
    assert quiz_res.status_code == 200
    quiz_id = quiz_res.json()["id"]

    # 7. Start Session
    start_res = client.post("/api/v1/sessions/start", json={"quiz_id": quiz_id})
    assert start_res.status_code == 200
    session_data = start_res.json()
    token = session_data["session_token"]
    assert token is not None
    assert session_data["total_questions"] == 2
    assert session_data["current_question_index"] == 0

    # In exam mode, verify correct answers are hidden from client view
    assert session_data["current_question"]["correct_answer"] is None

    # 8. Submit Answer for Q1
    curr_q_id = session_data["current_question"]["id"]
    # Look up correct option for this question
    target_q = next(q for q in saved_questions if q["id"] == curr_q_id)
    correct_opt = target_q["correct_answer"][0]
    ans_res = client.post(f"/api/v1/sessions/{token}/answer", json={
        "question_id": curr_q_id,
        "user_answer": [correct_opt],
        "time_spent_seconds": 15
    })
    assert ans_res.status_code == 200

    # 9. Navigate to question 2
    nav_res = client.post(f"/api/v1/sessions/{token}/navigate", json={"target_index": 1})
    assert nav_res.status_code == 200
    assert nav_res.json()["current_question_index"] == 1
    q2_active_id = nav_res.json()["current_question"]["id"]
    target_q2 = next(q for q in saved_questions if q["id"] == q2_active_id)
    correct_opt_2 = target_q2["correct_answer"][0]

    # Submit answer for Q2
    ans2_res = client.post(f"/api/v1/sessions/{token}/answer", json={
        "question_id": q2_active_id,
        "user_answer": [correct_opt_2],
        "time_spent_seconds": 10
    })
    assert ans2_res.status_code == 200

    # 10. Submit & Evaluate Assessment
    submit_res = client.post(f"/api/v1/sessions/{token}/submit")
    assert submit_res.status_code == 200
    result_id = submit_res.json()["result_id"]

    # 11. Get Results Report
    result_res = client.get(f"/api/v1/results/{result_id}")
    assert result_res.status_code == 200
    res_data = result_res.json()
    assert res_data["total_questions"] == 2
    assert res_data["correct_count"] == 2
    assert res_data["percentage"] == 100.0
    assert res_data["score"] == 4.0 # 2 questions * 2.0 pts
    assert len(res_data["attempt_details"]) == 2

    # 12. Export CSV
    csv_res = client.get(f"/api/v1/results/{result_id}/export-csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Question No" in csv_res.text

    # 13. Spaced Revision items updated
    rev_res = client.get("/api/v1/revision/items")
    assert rev_res.status_code == 200

    # 14. Dashboard summary
    dash_res = client.get("/api/v1/analytics/dashboard")
    assert dash_res.status_code == 200
    assert dash_res.json()["total_assessments_taken"] >= 1

    # 15. Verify Assessment Question Bank Isolation
    # Questions assigned to the quiz should NOT appear when unassigned_only is requested
    unassigned_res = client.get("/api/v1/questions?unassigned_only=true")
    assert unassigned_res.status_code == 200
    unassigned_ids = [q["id"] for q in unassigned_res.json()]
    assert q1_id not in unassigned_ids
    assert q2_id not in unassigned_ids

    # Querying the quiz's individual questions directly returns them
    quiz_q_res = client.get(f"/api/v1/quizzes/{quiz_id}/questions")
    assert quiz_q_res.status_code == 200
    assert len(quiz_q_res.json()) == 2

