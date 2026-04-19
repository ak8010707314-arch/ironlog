from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt as pyjwt
import requests

from exercises_seed import PRELOADED_EXERCISES


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Config
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRE_DAYS = int(os.environ.get('JWT_EXPIRE_DAYS', '30'))
EMERGENT_AUTH_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# =========================
# Models
# =========================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str = "email"  # "email" or "google"
    created_at: datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionRequest(BaseModel):
    session_id: str


class TokenResponse(BaseModel):
    token: str
    user: User


class Exercise(BaseModel):
    exercise_id: str
    name: str
    muscle_group: str
    equipment: str
    is_custom: bool = False
    user_id: Optional[str] = None
    created_at: datetime


class ExerciseCreate(BaseModel):
    name: str
    muscle_group: str
    equipment: str = "Other"


class SplitDay(BaseModel):
    day_id: str
    name: str  # e.g. "Chest Day", "Push"
    exercise_ids: List[str] = []


class Split(BaseModel):
    split_id: str
    user_id: str
    name: str
    days: List[SplitDay] = []
    created_at: datetime


class SplitCreate(BaseModel):
    name: str
    days: List[dict] = []  # [{name, exercise_ids}]


class SplitUpdate(BaseModel):
    name: Optional[str] = None
    days: Optional[List[dict]] = None


class WorkoutSet(BaseModel):
    set_number: int
    weight: float
    reps: int
    completed: bool = True


class WorkoutExercise(BaseModel):
    exercise_id: str
    exercise_name: str
    sets: List[WorkoutSet] = []


class Workout(BaseModel):
    workout_id: str
    user_id: str
    split_id: Optional[str] = None
    day_name: Optional[str] = None
    exercises: List[WorkoutExercise] = []
    duration_seconds: int = 0
    started_at: datetime
    finished_at: datetime
    total_volume: float = 0.0


class WorkoutCreate(BaseModel):
    split_id: Optional[str] = None
    day_name: Optional[str] = None
    exercises: List[WorkoutExercise] = []
    duration_seconds: int = 0
    started_at: datetime
    finished_at: datetime


# =========================
# Auth helpers
# =========================

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_jwt(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": user_id,
        "iat": now,
        "exp": now + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    token = authorization.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**doc)


# =========================
# Seed exercises on startup
# =========================

async def seed_exercises():
    count = await db.exercises.count_documents({"is_custom": False})
    if count >= len(PRELOADED_EXERCISES):
        return
    # Clear and re-seed preloaded only
    await db.exercises.delete_many({"is_custom": False})
    docs = []
    for ex in PRELOADED_EXERCISES:
        docs.append({
            "exercise_id": f"ex_{uuid.uuid4().hex[:12]}",
            "name": ex["name"],
            "muscle_group": ex["muscle_group"],
            "equipment": ex["equipment"],
            "is_custom": False,
            "user_id": None,
            "created_at": datetime.now(timezone.utc),
        })
    if docs:
        await db.exercises.insert_many(docs)
    logger.info(f"Seeded {len(docs)} preloaded exercises")


@app.on_event("startup")
async def on_startup():
    await seed_exercises()


# =========================
# Auth endpoints
# =========================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    email = req.email.lower().strip()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": req.name.strip() or email.split("@")[0],
        "picture": None,
        "auth_provider": "email",
        "password_hash": hash_password(req.password),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    token = create_jwt(user_id)
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return TokenResponse(token=token, user=User(**user_doc))


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    email = req.email.lower().strip()
    doc = await db.users.find_one({"email": email})
    if not doc or not doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(req.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt(doc["user_id"])
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return TokenResponse(token=token, user=User(**doc))


@api_router.post("/auth/google-session", response_model=TokenResponse)
async def google_session(req: GoogleSessionRequest):
    """Exchange Emergent session_id for our JWT. Create/update user."""
    try:
        resp = requests.get(
            EMERGENT_AUTH_SESSION_URL,
            headers={"X-Session-ID": req.session_id},
            timeout=10,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = resp.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google session error: {e}")
        raise HTTPException(status_code=500, detail="Auth service error")

    email = data.get("email", "").lower().strip()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    if not email:
        raise HTTPException(status_code=400, detail="Invalid auth data")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc),
        })

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    token = create_jwt(user_id)
    return TokenResponse(token=token, user=User(**user_doc))


@api_router.get("/auth/me", response_model=User)
async def get_me(current: User = Depends(get_current_user)):
    return current


# =========================
# Exercise endpoints
# =========================

@api_router.get("/exercises", response_model=List[Exercise])
async def list_exercises(current: User = Depends(get_current_user)):
    cursor = db.exercises.find(
        {"$or": [{"is_custom": False}, {"user_id": current.user_id}]},
        {"_id": 0},
    ).sort("name", 1)
    items = await cursor.to_list(length=1000)
    return [Exercise(**i) for i in items]


@api_router.post("/exercises", response_model=Exercise)
async def create_exercise(req: ExerciseCreate, current: User = Depends(get_current_user)):
    doc = {
        "exercise_id": f"ex_{uuid.uuid4().hex[:12]}",
        "name": req.name.strip(),
        "muscle_group": req.muscle_group.strip() or "Other",
        "equipment": req.equipment.strip() or "Other",
        "is_custom": True,
        "user_id": current.user_id,
        "created_at": datetime.now(timezone.utc),
    }
    await db.exercises.insert_one(doc)
    doc.pop("_id", None)
    return Exercise(**doc)


# =========================
# Split endpoints
# =========================

def _normalize_days(raw_days: List[dict]) -> List[dict]:
    out = []
    for d in raw_days or []:
        out.append({
            "day_id": d.get("day_id") or f"day_{uuid.uuid4().hex[:8]}",
            "name": d.get("name", "Day"),
            "exercise_ids": list(d.get("exercise_ids") or []),
        })
    return out


@api_router.get("/splits", response_model=List[Split])
async def list_splits(current: User = Depends(get_current_user)):
    cursor = db.splits.find({"user_id": current.user_id}, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(length=200)
    return [Split(**i) for i in items]


@api_router.post("/splits", response_model=Split)
async def create_split(req: SplitCreate, current: User = Depends(get_current_user)):
    doc = {
        "split_id": f"spl_{uuid.uuid4().hex[:12]}",
        "user_id": current.user_id,
        "name": req.name.strip() or "My Split",
        "days": _normalize_days(req.days),
        "created_at": datetime.now(timezone.utc),
    }
    await db.splits.insert_one(doc)
    doc.pop("_id", None)
    return Split(**doc)


@api_router.put("/splits/{split_id}", response_model=Split)
async def update_split(split_id: str, req: SplitUpdate, current: User = Depends(get_current_user)):
    update = {}
    if req.name is not None:
        update["name"] = req.name.strip()
    if req.days is not None:
        update["days"] = _normalize_days(req.days)
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    result = await db.splits.find_one_and_update(
        {"split_id": split_id, "user_id": current.user_id},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Split not found")
    return Split(**result)


@api_router.delete("/splits/{split_id}")
async def delete_split(split_id: str, current: User = Depends(get_current_user)):
    res = await db.splits.delete_one({"split_id": split_id, "user_id": current.user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Split not found")
    return {"ok": True}


@api_router.get("/splits/{split_id}", response_model=Split)
async def get_split(split_id: str, current: User = Depends(get_current_user)):
    doc = await db.splits.find_one({"split_id": split_id, "user_id": current.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Split not found")
    return Split(**doc)


# =========================
# Workout endpoints
# =========================

def _compute_volume(exercises: List[WorkoutExercise]) -> float:
    total = 0.0
    for ex in exercises:
        for s in ex.sets:
            if s.completed:
                total += float(s.weight) * int(s.reps)
    return round(total, 2)


@api_router.post("/workouts", response_model=Workout)
async def create_workout(req: WorkoutCreate, current: User = Depends(get_current_user)):
    workout_id = f"wk_{uuid.uuid4().hex[:12]}"
    volume = _compute_volume(req.exercises)
    doc = {
        "workout_id": workout_id,
        "user_id": current.user_id,
        "split_id": req.split_id,
        "day_name": req.day_name,
        "exercises": [ex.dict() for ex in req.exercises],
        "duration_seconds": req.duration_seconds,
        "started_at": req.started_at,
        "finished_at": req.finished_at,
        "total_volume": volume,
    }
    await db.workouts.insert_one(doc)
    doc.pop("_id", None)
    return Workout(**doc)


@api_router.get("/workouts", response_model=List[Workout])
async def list_workouts(current: User = Depends(get_current_user), limit: int = 50):
    cursor = db.workouts.find({"user_id": current.user_id}, {"_id": 0}).sort("finished_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return [Workout(**i) for i in items]


@api_router.get("/workouts/last/{exercise_id}")
async def last_performance(exercise_id: str, current: User = Depends(get_current_user)):
    """Return the most recent performance for the given exercise for suggestion logic."""
    cursor = db.workouts.find(
        {"user_id": current.user_id, "exercises.exercise_id": exercise_id},
        {"_id": 0},
    ).sort("finished_at", -1).limit(1)
    items = await cursor.to_list(length=1)
    if not items:
        return {"found": False}
    w = items[0]
    last_ex = next((ex for ex in w["exercises"] if ex["exercise_id"] == exercise_id), None)
    if not last_ex:
        return {"found": False}
    # compute top set (max weight) and suggestion
    top_set = None
    for s in last_ex.get("sets", []):
        if not s.get("completed", True):
            continue
        if top_set is None or s["weight"] > top_set["weight"] or (
            s["weight"] == top_set["weight"] and s["reps"] > top_set["reps"]
        ):
            top_set = s
    suggestion = None
    if top_set:
        # If last top set reps >= 8 -> add 2.5kg, else same weight +1 rep
        if top_set["reps"] >= 8:
            suggestion = {"weight": round(top_set["weight"] + 2.5, 2), "reps": top_set["reps"], "reason": "Add +2.5kg"}
        else:
            suggestion = {"weight": top_set["weight"], "reps": top_set["reps"] + 1, "reason": "Add +1 rep"}
    return {
        "found": True,
        "finished_at": w["finished_at"],
        "sets": last_ex.get("sets", []),
        "top_set": top_set,
        "suggestion": suggestion,
    }


# =========================
# Analytics endpoints
# =========================

@api_router.get("/analytics/strength/{exercise_id}")
async def strength_progress(exercise_id: str, current: User = Depends(get_current_user)):
    cursor = db.workouts.find(
        {"user_id": current.user_id, "exercises.exercise_id": exercise_id},
        {"_id": 0},
    ).sort("finished_at", 1).limit(500)
    workouts = await cursor.to_list(length=500)
    points = []
    for w in workouts:
        ex = next((e for e in w["exercises"] if e["exercise_id"] == exercise_id), None)
        if not ex:
            continue
        max_w = 0.0
        max_reps = 0
        for s in ex.get("sets", []):
            if not s.get("completed", True):
                continue
            if s["weight"] > max_w:
                max_w = s["weight"]
                max_reps = s["reps"]
        if max_w > 0:
            points.append({
                "date": w["finished_at"].isoformat() if isinstance(w["finished_at"], datetime) else w["finished_at"],
                "weight": max_w,
                "reps": max_reps,
            })
    return {"points": points}


@api_router.get("/analytics/volume")
async def weekly_volume(current: User = Depends(get_current_user)):
    # Last 8 weeks
    now = datetime.now(timezone.utc)
    start = now - timedelta(weeks=8)
    cursor = db.workouts.find(
        {"user_id": current.user_id, "finished_at": {"$gte": start}},
        {"_id": 0, "finished_at": 1, "total_volume": 1},
    ).sort("finished_at", 1).limit(1000)
    items = await cursor.to_list(length=1000)
    # bucket by ISO week
    buckets: dict = {}
    for w in items:
        dt = w["finished_at"]
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        y, wk, _ = dt.isocalendar()
        key = f"{y}-W{wk:02d}"
        buckets[key] = buckets.get(key, 0.0) + float(w.get("total_volume", 0))
    weeks = sorted(buckets.keys())
    return {"weeks": [{"week": k, "volume": round(buckets[k], 2)} for k in weeks]}


@api_router.get("/analytics/prs")
async def personal_records(current: User = Depends(get_current_user)):
    """Return max weight lifted per exercise (PR)."""
    cursor = db.workouts.find(
        {"user_id": current.user_id},
        {"_id": 0, "exercises": 1, "finished_at": 1},
    ).limit(2000)
    workouts = await cursor.to_list(length=2000)
    prs: dict = {}
    for w in workouts:
        for ex in w.get("exercises", []):
            eid = ex["exercise_id"]
            for s in ex.get("sets", []):
                if not s.get("completed", True):
                    continue
                cur = prs.get(eid)
                if cur is None or s["weight"] > cur["weight"]:
                    prs[eid] = {
                        "exercise_id": eid,
                        "exercise_name": ex["exercise_name"],
                        "weight": s["weight"],
                        "reps": s["reps"],
                        "date": w["finished_at"].isoformat() if isinstance(w["finished_at"], datetime) else w["finished_at"],
                    }
    # Return sorted desc by weight
    out = sorted(prs.values(), key=lambda x: -x["weight"])
    return {"prs": out}


@api_router.get("/analytics/summary")
async def summary(current: User = Depends(get_current_user)):
    """Return totals + streak for dashboard."""
    cursor = db.workouts.find(
        {"user_id": current.user_id},
        {"_id": 0, "finished_at": 1, "total_volume": 1},
    ).limit(2000)
    items = await cursor.to_list(length=2000)
    total_workouts = len(items)
    total_volume = sum(float(w.get("total_volume", 0)) for w in items)
    # compute streak: consecutive days with at least one workout, ending today or yesterday
    dates = set()
    for w in items:
        dt = w["finished_at"]
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dates.add(dt.date())
    today = datetime.now(timezone.utc).date()
    streak = 0
    cursor_day = today
    # allow starting from yesterday if today has no workout yet
    if cursor_day not in dates:
        cursor_day = cursor_day - timedelta(days=1)
    while cursor_day in dates:
        streak += 1
        cursor_day = cursor_day - timedelta(days=1)

    # this week volume
    week_start = today - timedelta(days=today.weekday())
    this_week_vol = 0.0
    for w in items:
        dt = w["finished_at"]
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if dt.date() >= week_start:
            this_week_vol += float(w.get("total_volume", 0))

    return {
        "total_workouts": total_workouts,
        "total_volume": round(total_volume, 2),
        "streak_days": streak,
        "this_week_volume": round(this_week_vol, 2),
    }


# =========================
# Root + router wiring
# =========================

@api_router.get("/")
async def root():
    return {"message": "IronLog API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)