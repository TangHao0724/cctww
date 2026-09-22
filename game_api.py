"""Small server-authoritative game session for the CCTV guessing page."""

import asyncio
import secrets
import time
from dataclasses import dataclass, field

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from cctv import Camera, get_catalog

router = APIRouter(prefix="/api/game", tags=["game"])
SESSION_TTL_SECONDS = 3600
MAX_LIFE = 3
_rng = secrets.SystemRandom()
_sessions: dict[str, "Session"] = {}
_question_owner: dict[str, str] = {}
_lock = asyncio.Lock()


@dataclass
class Question:
    id: str
    camera_id: str
    options: list[dict[str, str]]
    correct_id: str
    result: dict | None = None


@dataclass
class Session:
    life: int = MAX_LIFE
    correct_count: int = 0
    touched_at: float = field(default_factory=time.monotonic)
    question: Question | None = None


class AnswerBody(BaseModel):
    gameID: str
    questionID: str
    ansID: str | None = None
    timestamp: int | None = None


class SkipBody(BaseModel):
    gameID: str
    questionID: str


def location_name(camera: Camera) -> str:
    # RoadSection is empty in the current official catalog, so only show
    # verified road names. Never invent a section from a kilometer marker.
    return camera.road_name


def _prune() -> None:
    now = time.monotonic()
    expired = [game_id for game_id, session in _sessions.items() if now - session.touched_at > SESSION_TTL_SECONDS]
    for game_id in expired:
        question = _sessions[game_id].question
        if question:
            _question_owner.pop(question.id, None)
        del _sessions[game_id]


def _new_question(cameras: list[Camera]) -> Question:
    usable = [camera for camera in cameras if camera.road_name]
    locations: dict[str, list[Camera]] = {}
    for camera in usable:
        locations.setdefault(location_name(camera), []).append(camera)
    if len(locations) < 4:
        raise HTTPException(status_code=503, detail="可用的國道地點不足四個")

    correct_name = secrets.choice(tuple(locations))
    camera = secrets.choice(locations[correct_name])
    wrong_names = _rng.sample([name for name in locations if name != correct_name], 3)
    names = [correct_name, *wrong_names]
    _rng.shuffle(names)
    options = [{"id": secrets.token_urlsafe(9), "name": name} for name in names]
    answer = next(option["id"] for option in options if option["name"] == correct_name)
    return Question(secrets.token_urlsafe(18), camera.id, options, answer)


def _get_session(game_id: str) -> Session:
    session = _sessions.get(game_id)
    if session is None:
        raise HTTPException(status_code=404, detail="遊戲紀錄不存在或已過期")
    session.touched_at = time.monotonic()
    return session


@router.post("/start")
async def start_game():
    await get_catalog()
    async with _lock:
        _prune()
        game_id = secrets.token_urlsafe(24)
        _sessions[game_id] = Session()
    return {"gameID": game_id, "life": MAX_LIFE, "correctCount": 0}


@router.post("/sign")
async def sign_game():
    result = await start_game()
    return {"OK": True, **result}


@router.get("/question")
async def get_question(gameID: str = Query(min_length=1, max_length=120)):
    cameras = list((await get_catalog()).values())
    async with _lock:
        _prune()
        session = _get_session(gameID)
        if session.life == 0:
            return {"life": 0, "correctCount": session.correct_count}
        if session.question is None or session.question.result is not None:
            if session.question:
                _question_owner.pop(session.question.id, None)
            session.question = _new_question(cameras)
            _question_owner[session.question.id] = gameID
        question = session.question
        return {
            "life": session.life,
            "correctCount": session.correct_count,
            "questionID": question.id,
            "question_cctvUUID": question.camera_id,
            "options": question.options,
        }


@router.post("/send")
async def send_answer(body: AnswerBody):
    async with _lock:
        game_id = _question_owner.get(body.questionID)
        if game_id is None or game_id != body.gameID:
            raise HTTPException(status_code=404, detail="題目不存在或已過期")
        session = _get_session(game_id)
        question = session.question
        if question is None or question.id != body.questionID:
            raise HTTPException(status_code=404, detail="題目不存在或已過期")
        if question.result is not None:
            return question.result
        option_ids = {option["id"] for option in question.options}
        if body.ansID is not None and body.ansID not in option_ids:
            raise HTTPException(status_code=400, detail="答案不屬於這題")
        is_right = body.ansID == question.correct_id
        if is_right:
            session.correct_count += 1
        else:
            session.life = max(0, session.life - 1)
        question.result = {"isRight": is_right, "life": session.life, "correctCount": session.correct_count, "answer": question.correct_id}
        return question.result


@router.post("/skip")
async def skip_unavailable_camera(body: SkipBody):
    """Replace a camera that the browser could not show, without using a life."""
    async with _lock:
        game_id = _question_owner.get(body.questionID)
        if game_id is None or game_id != body.gameID:
            raise HTTPException(status_code=404, detail="題目不存在或已過期")
        session = _get_session(game_id)
        question = session.question
        if question is None or question.id != body.questionID or question.result is not None:
            raise HTTPException(status_code=409, detail="此題已完成")
        _question_owner.pop(question.id, None)
        session.question = None
        return {"life": session.life}
