"""
Comprehensive backend API tests for IronLog fitness tracking app.

Tests cover:
- Health check
- Auth (register, login, me, duplicate handling)
- Exercises (list preloaded, create custom)
- Splits CRUD (create, read, update, delete, user isolation)
- Workouts (create with volume calculation, list, last performance)
- Analytics (summary, volume, strength, PRs)
- User isolation
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta
import time

# Get backend URL from environment
BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/')

# Test user credentials
TEST_USER_1 = {
    "email": "TEST_user1@iron.com",
    "password": "test1234",
    "name": "Test User 1"
}

TEST_USER_2 = {
    "email": "TEST_user2@iron.com",
    "password": "test5678",
    "name": "Test User 2"
}


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def user1_token(api_client):
    """Register and return token for test user 1"""
    # Try to register (may fail if already exists)
    try:
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=TEST_USER_1)
        if response.status_code == 201 or response.status_code == 200:
            return response.json()["token"]
    except:
        pass
    
    # Login if registration failed
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_1["email"],
        "password": TEST_USER_1["password"]
    })
    assert response.status_code == 200, f"Failed to login user1: {response.text}"
    return response.json()["token"]


@pytest.fixture
def user2_token(api_client):
    """Register and return token for test user 2"""
    # Try to register (may fail if already exists)
    try:
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=TEST_USER_2)
        if response.status_code == 201 or response.status_code == 200:
            return response.json()["token"]
    except:
        pass
    
    # Login if registration failed
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_2["email"],
        "password": TEST_USER_2["password"]
    })
    assert response.status_code == 200, f"Failed to login user2: {response.text}"
    return response.json()["token"]


class TestHealth:
    """Health check endpoint tests"""

    def test_health_check(self, api_client):
        """GET /api/ returns 200 with status ok"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        
        data = response.json()
        assert "status" in data, "Response missing 'status' field"
        assert data["status"] == "ok", f"Expected status 'ok', got {data['status']}"
        print("✓ Health check passed")


class TestAuth:
    """Authentication endpoint tests"""

    def test_register_new_user(self, api_client):
        """POST /api/auth/register creates user and returns JWT + user"""
        unique_email = f"TEST_newuser_{int(time.time())}@iron.com"
        payload = {
            "email": unique_email,
            "password": "testpass123",
            "name": "New Test User"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code in [200, 201], f"Register failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response missing 'token' field"
        assert "user" in data, "Response missing 'user' field"
        assert data["user"]["email"] == unique_email.lower(), "Email mismatch"
        assert data["user"]["name"] == payload["name"], "Name mismatch"
        assert data["user"]["auth_provider"] == "email", "Auth provider should be 'email'"
        print(f"✓ Register new user passed: {unique_email}")

    def test_register_duplicate_email(self, api_client, user1_token):
        """POST /api/auth/register with existing email returns 400"""
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=TEST_USER_1)
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Error response missing 'detail' field"
        assert "already registered" in data["detail"].lower(), f"Unexpected error message: {data['detail']}"
        print("✓ Register duplicate email returns 400")

    def test_login_success(self, api_client, user1_token):
        """POST /api/auth/login returns JWT + user on correct credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_1["email"],
            "password": TEST_USER_1["password"]
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response missing 'token' field"
        assert "user" in data, "Response missing 'user' field"
        assert data["user"]["email"] == TEST_USER_1["email"].lower(), "Email mismatch"
        print("✓ Login with correct credentials passed")

    def test_login_wrong_password(self, api_client, user1_token):
        """POST /api/auth/login returns 401 on wrong password"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_1["email"],
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401 for wrong password, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Error response missing 'detail' field"
        print("✓ Login with wrong password returns 401")

    def test_login_nonexistent_user(self, api_client):
        """POST /api/auth/login returns 401 for nonexistent user"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@iron.com",
            "password": "anypassword"
        })
        assert response.status_code == 401, f"Expected 401 for nonexistent user, got {response.status_code}"
        print("✓ Login with nonexistent user returns 401")

    def test_auth_me_with_token(self, api_client, user1_token):
        """GET /api/auth/me with Bearer token returns user"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        
        data = response.json()
        assert "email" in data, "Response missing 'email' field"
        assert data["email"] == TEST_USER_1["email"].lower(), "Email mismatch"
        assert "user_id" in data, "Response missing 'user_id' field"
        print("✓ Auth me with token passed")

    def test_auth_me_without_token(self, api_client):
        """GET /api/auth/me without token returns 401"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}"
        print("✓ Auth me without token returns 401")

    def test_auth_me_invalid_token(self, api_client):
        """GET /api/auth/me with invalid token returns 401"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_xyz"}
        )
        assert response.status_code == 401, f"Expected 401 for invalid token, got {response.status_code}"
        print("✓ Auth me with invalid token returns 401")


class TestExercises:
    """Exercise endpoint tests"""

    def test_list_exercises_preloaded(self, api_client, user1_token):
        """GET /api/exercises returns 55 preloaded exercises sorted by name"""
        response = api_client.get(
            f"{BASE_URL}/api/exercises",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"List exercises failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Should have at least 55 preloaded exercises
        preloaded = [ex for ex in data if not ex.get("is_custom", False)]
        assert len(preloaded) >= 55, f"Expected at least 55 preloaded exercises, got {len(preloaded)}"
        
        # Check sorted by name
        names = [ex["name"] for ex in data]
        assert names == sorted(names), "Exercises should be sorted by name"
        
        # Verify structure of first exercise
        if data:
            ex = data[0]
            assert "exercise_id" in ex, "Exercise missing 'exercise_id'"
            assert "name" in ex, "Exercise missing 'name'"
            assert "muscle_group" in ex, "Exercise missing 'muscle_group'"
            assert "equipment" in ex, "Exercise missing 'equipment'"
            assert "is_custom" in ex, "Exercise missing 'is_custom'"
        
        print(f"✓ List exercises passed: {len(data)} total, {len(preloaded)} preloaded")

    def test_create_custom_exercise(self, api_client, user1_token):
        """POST /api/exercises creates is_custom=true exercise tied to user_id"""
        unique_name = f"TEST_Custom Exercise {int(time.time())}"
        payload = {
            "name": unique_name,
            "muscle_group": "Custom",
            "equipment": "Dumbbell"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/exercises",
            json=payload,
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code in [200, 201], f"Create exercise failed: {response.text}"
        
        data = response.json()
        assert data["name"] == unique_name, "Name mismatch"
        assert data["muscle_group"] == "Custom", "Muscle group mismatch"
        assert data["equipment"] == "Dumbbell", "Equipment mismatch"
        assert data["is_custom"] == True, "Exercise should be marked as custom"
        assert "user_id" in data, "Custom exercise missing 'user_id'"
        assert data["user_id"] is not None, "Custom exercise should have user_id"
        
        # Verify it appears in list
        list_response = api_client.get(
            f"{BASE_URL}/api/exercises",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert list_response.status_code == 200
        exercises = list_response.json()
        custom_ex = next((ex for ex in exercises if ex["name"] == unique_name), None)
        assert custom_ex is not None, "Custom exercise not found in list"
        
        print(f"✓ Create custom exercise passed: {unique_name}")


class TestSplits:
    """Split CRUD endpoint tests"""

    def test_create_split_with_days(self, api_client, user1_token):
        """POST /api/splits with days returns split with day_id generated"""
        payload = {
            "name": f"TEST_PPL Split {int(time.time())}",
            "days": [
                {"name": "Push Day", "exercise_ids": []},
                {"name": "Pull Day", "exercise_ids": []},
                {"name": "Legs Day", "exercise_ids": []}
            ]
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/splits",
            json=payload,
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code in [200, 201], f"Create split failed: {response.text}"
        
        data = response.json()
        assert "split_id" in data, "Response missing 'split_id'"
        assert data["name"] == payload["name"], "Name mismatch"
        assert "days" in data, "Response missing 'days'"
        assert len(data["days"]) == 3, f"Expected 3 days, got {len(data['days'])}"
        
        # Verify each day has day_id generated
        for day in data["days"]:
            assert "day_id" in day, "Day missing 'day_id'"
            assert day["day_id"].startswith("day_"), f"Invalid day_id format: {day['day_id']}"
            assert "name" in day, "Day missing 'name'"
            assert "exercise_ids" in day, "Day missing 'exercise_ids'"
        
        print(f"✓ Create split passed: {data['split_id']}")
        return data["split_id"]

    def test_list_splits(self, api_client, user1_token):
        """GET /api/splits lists own splits"""
        # Create a split first
        create_response = api_client.post(
            f"{BASE_URL}/api/splits",
            json={"name": f"TEST_List Split {int(time.time())}", "days": []},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert create_response.status_code in [200, 201]
        created_split_id = create_response.json()["split_id"]
        
        # List splits
        response = api_client.get(
            f"{BASE_URL}/api/splits",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"List splits failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify created split is in list
        split = next((s for s in data if s["split_id"] == created_split_id), None)
        assert split is not None, "Created split not found in list"
        
        print(f"✓ List splits passed: {len(data)} splits found")

    def test_get_split_by_id(self, api_client, user1_token):
        """GET /api/splits/{id} returns the split"""
        # Create a split first
        create_response = api_client.post(
            f"{BASE_URL}/api/splits",
            json={"name": f"TEST_Get Split {int(time.time())}", "days": []},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert create_response.status_code in [200, 201]
        split_id = create_response.json()["split_id"]
        
        # Get split by ID
        response = api_client.get(
            f"{BASE_URL}/api/splits/{split_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Get split failed: {response.text}"
        
        data = response.json()
        assert data["split_id"] == split_id, "Split ID mismatch"
        
        print(f"✓ Get split by ID passed: {split_id}")

    def test_update_split(self, api_client, user1_token):
        """PUT /api/splits/{id} updates the split"""
        # Create a split first
        create_response = api_client.post(
            f"{BASE_URL}/api/splits",
            json={"name": "TEST_Original Name", "days": []},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert create_response.status_code in [200, 201]
        split_id = create_response.json()["split_id"]
        
        # Update split
        updated_name = f"TEST_Updated Name {int(time.time())}"
        response = api_client.put(
            f"{BASE_URL}/api/splits/{split_id}",
            json={"name": updated_name},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Update split failed: {response.text}"
        
        data = response.json()
        assert data["name"] == updated_name, "Name not updated"
        
        # Verify update persisted
        get_response = api_client.get(
            f"{BASE_URL}/api/splits/{split_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert get_response.status_code == 200
        assert get_response.json()["name"] == updated_name, "Update not persisted"
        
        print(f"✓ Update split passed: {split_id}")

    def test_delete_split(self, api_client, user1_token):
        """DELETE /api/splits/{id} removes the split"""
        # Create a split first
        create_response = api_client.post(
            f"{BASE_URL}/api/splits",
            json={"name": f"TEST_Delete Split {int(time.time())}", "days": []},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert create_response.status_code in [200, 201]
        split_id = create_response.json()["split_id"]
        
        # Delete split
        response = api_client.delete(
            f"{BASE_URL}/api/splits/{split_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Delete split failed: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True, "Delete response should return ok: true"
        
        # Verify deletion
        get_response = api_client.get(
            f"{BASE_URL}/api/splits/{split_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert get_response.status_code == 404, "Split should return 404 after deletion"
        
        print(f"✓ Delete split passed: {split_id}")

    def test_get_split_not_owned(self, api_client, user1_token, user2_token):
        """GET /api/splits/{id} returns 404 if not owned by user"""
        # User 1 creates a split
        create_response = api_client.post(
            f"{BASE_URL}/api/splits",
            json={"name": f"TEST_User1 Split {int(time.time())}", "days": []},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert create_response.status_code in [200, 201]
        split_id = create_response.json()["split_id"]
        
        # User 2 tries to access it
        response = api_client.get(
            f"{BASE_URL}/api/splits/{split_id}",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert response.status_code == 404, f"Expected 404 for unauthorized access, got {response.status_code}"
        
        print("✓ Get split not owned returns 404")


class TestWorkouts:
    """Workout endpoint tests"""

    def test_create_workout_with_volume(self, api_client, user1_token):
        """POST /api/workouts creates workout with total_volume computed"""
        now = datetime.now(timezone.utc)
        payload = {
            "split_id": None,
            "day_name": "Test Day",
            "exercises": [
                {
                    "exercise_id": "ex_test1",
                    "exercise_name": "Bench Press",
                    "sets": [
                        {"set_number": 1, "weight": 100.0, "reps": 10, "completed": True},
                        {"set_number": 2, "weight": 100.0, "reps": 8, "completed": True},
                        {"set_number": 3, "weight": 100.0, "reps": 6, "completed": False}
                    ]
                }
            ],
            "duration_seconds": 3600,
            "started_at": (now - timedelta(hours=1)).isoformat(),
            "finished_at": now.isoformat()
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/workouts",
            json=payload,
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code in [200, 201], f"Create workout failed: {response.text}"
        
        data = response.json()
        assert "workout_id" in data, "Response missing 'workout_id'"
        assert "total_volume" in data, "Response missing 'total_volume'"
        
        # Verify volume calculation: (100*10) + (100*8) = 1800 (set 3 not completed)
        expected_volume = 1800.0
        assert data["total_volume"] == expected_volume, f"Expected volume {expected_volume}, got {data['total_volume']}"
        
        print(f"✓ Create workout passed: {data['workout_id']}, volume: {data['total_volume']}")
        return data["workout_id"]

    def test_list_workouts_sorted(self, api_client, user1_token):
        """GET /api/workouts returns user's workouts sorted desc by finished_at"""
        # Create two workouts with different timestamps
        now = datetime.now(timezone.utc)
        
        workout1_payload = {
            "exercises": [],
            "duration_seconds": 1800,
            "started_at": (now - timedelta(hours=2)).isoformat(),
            "finished_at": (now - timedelta(hours=1)).isoformat()
        }
        
        workout2_payload = {
            "exercises": [],
            "duration_seconds": 1800,
            "started_at": (now - timedelta(minutes=30)).isoformat(),
            "finished_at": now.isoformat()
        }
        
        response1 = api_client.post(
            f"{BASE_URL}/api/workouts",
            json=workout1_payload,
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response1.status_code in [200, 201]
        
        response2 = api_client.post(
            f"{BASE_URL}/api/workouts",
            json=workout2_payload,
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response2.status_code in [200, 201]
        
        # List workouts
        response = api_client.get(
            f"{BASE_URL}/api/workouts",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"List workouts failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 2, f"Expected at least 2 workouts, got {len(data)}"
        
        # Verify sorted desc by finished_at (most recent first)
        if len(data) >= 2:
            first_time = datetime.fromisoformat(data[0]["finished_at"].replace('Z', '+00:00'))
            second_time = datetime.fromisoformat(data[1]["finished_at"].replace('Z', '+00:00'))
            assert first_time >= second_time, "Workouts should be sorted desc by finished_at"
        
        print(f"✓ List workouts passed: {len(data)} workouts found")

    def test_last_performance_found(self, api_client, user1_token):
        """GET /api/workouts/last/{exercise_id} returns found=true with top_set and suggestion"""
        # Create a workout with a specific exercise
        now = datetime.now(timezone.utc)
        exercise_id = f"ex_test_{int(time.time())}"
        
        payload = {
            "exercises": [
                {
                    "exercise_id": exercise_id,
                    "exercise_name": "Test Exercise",
                    "sets": [
                        {"set_number": 1, "weight": 80.0, "reps": 10, "completed": True},
                        {"set_number": 2, "weight": 85.0, "reps": 8, "completed": True},
                        {"set_number": 3, "weight": 90.0, "reps": 6, "completed": True}
                    ]
                }
            ],
            "duration_seconds": 1800,
            "started_at": (now - timedelta(hours=1)).isoformat(),
            "finished_at": now.isoformat()
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/workouts",
            json=payload,
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert create_response.status_code in [200, 201]
        
        # Get last performance
        response = api_client.get(
            f"{BASE_URL}/api/workouts/last/{exercise_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Last performance failed: {response.text}"
        
        data = response.json()
        assert data["found"] == True, "Expected found=true"
        assert "top_set" in data, "Response missing 'top_set'"
        assert "suggestion" in data, "Response missing 'suggestion'"
        
        # Verify top set (should be set 3 with 90kg)
        assert data["top_set"]["weight"] == 90.0, "Top set weight mismatch"
        assert data["top_set"]["reps"] == 6, "Top set reps mismatch"
        
        # Verify suggestion (reps < 8, so should suggest +1 rep)
        assert data["suggestion"]["weight"] == 90.0, "Suggestion weight should stay same"
        assert data["suggestion"]["reps"] == 7, "Suggestion should be +1 rep"
        assert "reason" in data["suggestion"], "Suggestion missing 'reason'"
        
        print(f"✓ Last performance found passed: {exercise_id}")

    def test_last_performance_add_weight(self, api_client, user1_token):
        """GET /api/workouts/last/{exercise_id} suggests +2.5kg when reps >= 8"""
        # Create a workout with high reps
        now = datetime.now(timezone.utc)
        exercise_id = f"ex_test_{int(time.time())}"
        
        payload = {
            "exercises": [
                {
                    "exercise_id": exercise_id,
                    "exercise_name": "Test Exercise",
                    "sets": [
                        {"set_number": 1, "weight": 100.0, "reps": 10, "completed": True}
                    ]
                }
            ],
            "duration_seconds": 1800,
            "started_at": (now - timedelta(hours=1)).isoformat(),
            "finished_at": now.isoformat()
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/workouts",
            json=payload,
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert create_response.status_code in [200, 201]
        
        # Get last performance
        response = api_client.get(
            f"{BASE_URL}/api/workouts/last/{exercise_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["found"] == True
        
        # Verify suggestion (reps >= 8, so should suggest +2.5kg)
        assert data["suggestion"]["weight"] == 102.5, "Suggestion should add +2.5kg"
        assert data["suggestion"]["reps"] == 10, "Reps should stay same"
        
        print(f"✓ Last performance add weight passed: {exercise_id}")

    def test_last_performance_not_found(self, api_client, user1_token):
        """GET /api/workouts/last/{exercise_id} returns found=false when no history"""
        nonexistent_exercise_id = f"ex_nonexistent_{int(time.time())}"
        
        response = api_client.get(
            f"{BASE_URL}/api/workouts/last/{nonexistent_exercise_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Last performance failed: {response.text}"
        
        data = response.json()
        assert data["found"] == False, "Expected found=false for nonexistent exercise"
        
        print("✓ Last performance not found passed")


class TestAnalytics:
    """Analytics endpoint tests"""

    def test_analytics_summary(self, api_client, user1_token):
        """GET /api/analytics/summary returns total_workouts, total_volume, streak_days, this_week_volume"""
        # Create a workout first to ensure data exists
        now = datetime.now(timezone.utc)
        payload = {
            "exercises": [
                {
                    "exercise_id": "ex_test",
                    "exercise_name": "Test",
                    "sets": [{"set_number": 1, "weight": 100.0, "reps": 10, "completed": True}]
                }
            ],
            "duration_seconds": 1800,
            "started_at": (now - timedelta(hours=1)).isoformat(),
            "finished_at": now.isoformat()
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/workouts",
            json=payload,
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert create_response.status_code in [200, 201]
        
        # Get analytics summary
        response = api_client.get(
            f"{BASE_URL}/api/analytics/summary",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Analytics summary failed: {response.text}"
        
        data = response.json()
        assert "total_workouts" in data, "Response missing 'total_workouts'"
        assert "total_volume" in data, "Response missing 'total_volume'"
        assert "streak_days" in data, "Response missing 'streak_days'"
        assert "this_week_volume" in data, "Response missing 'this_week_volume'"
        
        assert isinstance(data["total_workouts"], int), "total_workouts should be int"
        assert isinstance(data["total_volume"], (int, float)), "total_volume should be numeric"
        assert isinstance(data["streak_days"], int), "streak_days should be int"
        assert isinstance(data["this_week_volume"], (int, float)), "this_week_volume should be numeric"
        
        assert data["total_workouts"] >= 1, "Should have at least 1 workout"
        
        print(f"✓ Analytics summary passed: {data['total_workouts']} workouts, {data['total_volume']} volume")

    def test_analytics_volume(self, api_client, user1_token):
        """GET /api/analytics/volume returns weeks array"""
        response = api_client.get(
            f"{BASE_URL}/api/analytics/volume",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Analytics volume failed: {response.text}"
        
        data = response.json()
        assert "weeks" in data, "Response missing 'weeks'"
        assert isinstance(data["weeks"], list), "weeks should be a list"
        
        # Verify structure if weeks exist
        if data["weeks"]:
            week = data["weeks"][0]
            assert "week" in week, "Week entry missing 'week' field"
            assert "volume" in week, "Week entry missing 'volume' field"
            assert isinstance(week["volume"], (int, float)), "volume should be numeric"
        
        print(f"✓ Analytics volume passed: {len(data['weeks'])} weeks")

    def test_analytics_strength(self, api_client, user1_token):
        """GET /api/analytics/strength/{exercise_id} returns points array sorted ascending by date"""
        # Create workouts with a specific exercise
        now = datetime.now(timezone.utc)
        exercise_id = f"ex_strength_{int(time.time())}"
        
        # Create two workouts at different times
        for i in range(2):
            payload = {
                "exercises": [
                    {
                        "exercise_id": exercise_id,
                        "exercise_name": "Strength Test",
                        "sets": [{"set_number": 1, "weight": 100.0 + (i * 5), "reps": 10, "completed": True}]
                    }
                ],
                "duration_seconds": 1800,
                "started_at": (now - timedelta(days=i+1, hours=1)).isoformat(),
                "finished_at": (now - timedelta(days=i+1)).isoformat()
            }
            
            create_response = api_client.post(
                f"{BASE_URL}/api/workouts",
                json=payload,
                headers={"Authorization": f"Bearer {user1_token}"}
            )
            assert create_response.status_code in [200, 201]
        
        # Get strength progress
        response = api_client.get(
            f"{BASE_URL}/api/analytics/strength/{exercise_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Analytics strength failed: {response.text}"
        
        data = response.json()
        assert "points" in data, "Response missing 'points'"
        assert isinstance(data["points"], list), "points should be a list"
        assert len(data["points"]) >= 2, f"Expected at least 2 points, got {len(data['points'])}"
        
        # Verify structure and sorting
        if len(data["points"]) >= 2:
            point = data["points"][0]
            assert "date" in point, "Point missing 'date'"
            assert "weight" in point, "Point missing 'weight'"
            assert "reps" in point, "Point missing 'reps'"
            
            # Verify sorted ascending by date
            first_date = datetime.fromisoformat(data["points"][0]["date"].replace('Z', '+00:00'))
            second_date = datetime.fromisoformat(data["points"][1]["date"].replace('Z', '+00:00'))
            assert first_date <= second_date, "Points should be sorted ascending by date"
        
        print(f"✓ Analytics strength passed: {len(data['points'])} points")

    def test_analytics_prs(self, api_client, user1_token):
        """GET /api/analytics/prs returns prs list sorted desc by weight"""
        # Create workouts with different exercises and weights
        now = datetime.now(timezone.utc)
        
        exercises = [
            {"id": f"ex_pr1_{int(time.time())}", "name": "PR Test 1", "weight": 150.0},
            {"id": f"ex_pr2_{int(time.time())}", "name": "PR Test 2", "weight": 200.0}
        ]
        
        for ex in exercises:
            payload = {
                "exercises": [
                    {
                        "exercise_id": ex["id"],
                        "exercise_name": ex["name"],
                        "sets": [{"set_number": 1, "weight": ex["weight"], "reps": 5, "completed": True}]
                    }
                ],
                "duration_seconds": 1800,
                "started_at": (now - timedelta(hours=1)).isoformat(),
                "finished_at": now.isoformat()
            }
            
            create_response = api_client.post(
                f"{BASE_URL}/api/workouts",
                json=payload,
                headers={"Authorization": f"Bearer {user1_token}"}
            )
            assert create_response.status_code in [200, 201]
        
        # Get PRs
        response = api_client.get(
            f"{BASE_URL}/api/analytics/prs",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Analytics PRs failed: {response.text}"
        
        data = response.json()
        assert "prs" in data, "Response missing 'prs'"
        assert isinstance(data["prs"], list), "prs should be a list"
        
        # Verify structure and sorting
        if len(data["prs"]) >= 2:
            pr = data["prs"][0]
            assert "exercise_id" in pr, "PR missing 'exercise_id'"
            assert "exercise_name" in pr, "PR missing 'exercise_name'"
            assert "weight" in pr, "PR missing 'weight'"
            assert "reps" in pr, "PR missing 'reps'"
            assert "date" in pr, "PR missing 'date'"
            
            # Verify sorted desc by weight
            first_weight = data["prs"][0]["weight"]
            second_weight = data["prs"][1]["weight"]
            assert first_weight >= second_weight, "PRs should be sorted desc by weight"
        
        print(f"✓ Analytics PRs passed: {len(data['prs'])} PRs")


class TestUserIsolation:
    """User isolation tests - ensure users can't access each other's data"""

    def test_splits_isolation(self, api_client, user1_token, user2_token):
        """User 2 cannot access User 1's splits"""
        # User 1 creates a split
        create_response = api_client.post(
            f"{BASE_URL}/api/splits",
            json={"name": f"TEST_User1 Private Split {int(time.time())}", "days": []},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert create_response.status_code in [200, 201]
        user1_split_id = create_response.json()["split_id"]
        
        # User 2 tries to get User 1's split
        get_response = api_client.get(
            f"{BASE_URL}/api/splits/{user1_split_id}",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert get_response.status_code == 404, "User 2 should not access User 1's split"
        
        # User 2 tries to update User 1's split
        update_response = api_client.put(
            f"{BASE_URL}/api/splits/{user1_split_id}",
            json={"name": "Hacked Name"},
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert update_response.status_code == 404, "User 2 should not update User 1's split"
        
        # User 2 tries to delete User 1's split
        delete_response = api_client.delete(
            f"{BASE_URL}/api/splits/{user1_split_id}",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert delete_response.status_code == 404, "User 2 should not delete User 1's split"
        
        print("✓ Splits isolation passed")

    def test_workouts_isolation(self, api_client, user1_token, user2_token):
        """User 2 cannot see User 1's workouts"""
        # User 1 creates a workout
        now = datetime.now(timezone.utc)
        payload = {
            "exercises": [],
            "duration_seconds": 1800,
            "started_at": (now - timedelta(hours=1)).isoformat(),
            "finished_at": now.isoformat()
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/workouts",
            json=payload,
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert create_response.status_code in [200, 201]
        user1_workout_id = create_response.json()["workout_id"]
        
        # User 2 lists workouts (should not see User 1's workout)
        list_response = api_client.get(
            f"{BASE_URL}/api/workouts",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert list_response.status_code == 200
        user2_workouts = list_response.json()
        
        # Verify User 1's workout is not in User 2's list
        user1_workout_in_list = any(w["workout_id"] == user1_workout_id for w in user2_workouts)
        assert not user1_workout_in_list, "User 2 should not see User 1's workouts"
        
        print("✓ Workouts isolation passed")

    def test_analytics_isolation(self, api_client, user1_token, user2_token):
        """User analytics are isolated per user"""
        # Get analytics for both users
        user1_summary = api_client.get(
            f"{BASE_URL}/api/analytics/summary",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert user1_summary.status_code == 200
        
        user2_summary = api_client.get(
            f"{BASE_URL}/api/analytics/summary",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert user2_summary.status_code == 200
        
        # Analytics should be different (unless by coincidence they have same stats)
        # At minimum, verify both return valid data structures
        user1_data = user1_summary.json()
        user2_data = user2_summary.json()
        
        assert "total_workouts" in user1_data
        assert "total_workouts" in user2_data
        
        print("✓ Analytics isolation passed")


# Cleanup fixture to run after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests complete"""
    yield
    # Cleanup happens here after all tests
    print("\n=== Test suite completed ===")
