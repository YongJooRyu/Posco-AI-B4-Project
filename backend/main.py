"""
게임형 집중도 학습 AI Agent — FastAPI 백엔드 (v5)
=================================================
- CV-A 모듈 (집중도), CV-B 모듈 (필기 감지) stub 연결 → 실제 모듈 납품 시 교체
- DB: SQLite (app.db)
- 인증 없음 MVP — X-User-Id 헤더로 user_id 전달 (기본값 1)
- 실행: uvicorn main:app --reload

v5 변경사항:
- focus_log에 is_writing / hand_movement / playback_rate / hand_model_version 컬럼 추가
- /focus/tick 응답에 is_writing / suggested_playback_rate 추가
- /admin 엔드포인트 3개 신설 (필기 감지 토글, 배속 민감도, 실험 로그)
- CV-B stub 추가 (predict_hand)
- 프론트 → 이미지 스냅샷(base64) → 백엔드에서 MediaPipe 실행 방식 지원
"""

from __future__ import annotations

import random
import statistics
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, create_engine, func,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# ──────────────────────────────────────────────────────────────
# 0. DB 설정
# ──────────────────────────────────────────────────────────────

DATABASE_URL = "sqlite:///./app.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ──────────────────────────────────────────────────────────────
# 1. ORM 모델 (DB 스키마)
# ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Lecture(Base):
    __tablename__ = "lectures"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    subject      = Column(String, nullable=False)   # "수학", "영어", "과학"
    title        = Column(String, nullable=False)
    video_url    = Column(String, nullable=False)
    duration_sec = Column(Integer, nullable=False)
    transcript   = Column(Text, nullable=False)


class LectureSession(Base):
    __tablename__ = "lecture_sessions"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    lecture_id = Column(Integer, ForeignKey("lectures.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at   = Column(DateTime, nullable=True)
    avg_focus  = Column(Float, nullable=True)


class FocusLog(Base):
    __tablename__ = "focus_log"
    id                 = Column(Integer, primary_key=True, autoincrement=True)
    session_id         = Column(Integer, ForeignKey("lecture_sessions.id"), nullable=False)
    video_time_sec     = Column(Integer, nullable=False)
    focus_score        = Column(Float, nullable=False)       # 0.0 ~ 1.0
    label              = Column(String, nullable=False)      # focused / drowsy / distracted
    is_writing         = Column(Boolean, default=False)      # v5: 필기 중 여부 (CV-B)
    hand_movement      = Column(Float, nullable=True)        # v5: 손 움직임 강도 (분석용)
    playback_rate      = Column(Float, default=1.0)          # v5: 이 시점의 배속
    model_version      = Column(String, nullable=True)       # CV-A 모델 버전
    hand_model_version = Column(String, nullable=True)       # v5: CV-B 모델 버전
    created_at         = Column(DateTime, default=datetime.utcnow)


class Quiz(Base):
    __tablename__ = "quizzes"
    id                    = Column(Integer, primary_key=True, autoincrement=True)
    session_id            = Column(Integer, ForeignKey("lecture_sessions.id"), nullable=False)
    question              = Column(Text, nullable=False)
    expected_answer       = Column(Text, nullable=True)
    has_intentional_error = Column(Boolean, default=False)
    chunk_video_time_sec  = Column(Integer, nullable=True)
    created_at            = Column(DateTime, default=datetime.utcnow)


class QuizResult(Base):
    __tablename__ = "quiz_results"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    quiz_id        = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_answer    = Column(Text, nullable=False)
    is_correct     = Column(Boolean, nullable=False)
    llm_feedback   = Column(Text, nullable=True)
    answered_at    = Column(DateTime, default=datetime.utcnow)
    next_review_at = Column(DateTime, nullable=True)


class Quest(Base):
    __tablename__ = "quests"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    quest_type   = Column(String, nullable=False)   # daily | weekly
    code         = Column(String, nullable=False)   # focus_2h | lecture_1 | quiz_correct_3
    title        = Column(String, nullable=False)
    description  = Column(Text, nullable=True)
    reward       = Column(String, nullable=True)
    progress     = Column(Integer, default=0)
    target       = Column(Integer, nullable=False)
    is_completed = Column(Boolean, default=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class Reward(Base):
    __tablename__ = "rewards"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    crop_type   = Column(String, nullable=False)
    obtained_at = Column(DateTime, default=datetime.utcnow)


# 테이블 생성
Base.metadata.create_all(bind=engine)


# ──────────────────────────────────────────────────────────────
# 2. FastAPI 앱 + CORS
# ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="집중도 학습 AI Agent API",
    description="게임형 집중도 기반 학습 서비스 백엔드. /docs 에서 전체 명세 확인 가능.",
    version="0.2.0",  # v5 반영
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 중 전체 허용, 배포 시 특정 도메인으로 교체
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────
# 관리자 설정 (in-memory, 서버 재시작 시 초기화)
# /admin 엔드포인트로 런타임에 변경 가능
# ──────────────────────────────────────────────────────────────
admin_settings = {
    "hand_detection_enabled": True,   # 필기 감지 on/off 토글
    "writing_delay_sec": 2,           # 필기 지속 N초 후 배속 0.8 적용
    "restore_delay_sec": 3,           # 필기 중단 N초 후 배속 1.0 복귀
    "focus_model_version": "focus_v1",
    "hand_model_version": "hand_v1",
    "rag_enabled": False,             # LLM RAG 모드 토글
    "prompt_version": "quiz_v1",
}


# ──────────────────────────────────────────────────────────────
# 3. 의존성 주입 헬퍼
# ──────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user_id(x_user_id: int = Header(default=1)) -> int:
    """MVP: X-User-Id 헤더로 user_id 전달. 없으면 1 사용."""
    return x_user_id


# ──────────────────────────────────────────────────────────────
# 4. CV 모듈 Stub  (CV 담당자가 실제 모듈 납품 시 이 함수 교체)
# ──────────────────────────────────────────────────────────────

def cv_predict(landmarks: list | None) -> dict:
    """
    CV-A 모듈 stub (집중도 분류).
    실제 CV-A 모듈 납품 시 → predict(landmarks) -> {"score": float, "label": str} 로 교체.
    현재는 랜덤 더미값 반환.
    """
    score = round(random.uniform(0.3, 1.0), 3)
    if score >= 0.7:
        label = "focused"
    elif score >= 0.4:
        label = "drowsy"
    else:
        label = "distracted"
    return {"score": score, "label": label}


# ──────────────────────────────────────────────────────────────
# 4-B. CV-B 모듈 Stub  (CV-B 담당자가 실제 모듈 납품 시 이 함수 교체)
# ──────────────────────────────────────────────────────────────

# 배속 히스테리시스 상태 (세션별 관리)
_writing_state: dict[int, dict] = {}  # {session_id: {is_writing, duration_sec}}


def cv_predict_hand(landmarks_seq: list | None, focus_score: float, session_id: int) -> dict:
    """
    CV-B 모듈 stub (필기 감지).
    실제 CV-B 모듈 납품 시 → predict_hand(landmarks_seq) -> {"is_writing": bool, "hand_movement": float} 로 교체.

    히스테리시스 룰 (v5 스펙):
    - writing 2초 지속 → suggested_playback_rate: 0.8
    - not_writing 3초 지속 → suggested_playback_rate: 1.0
    - focus_score < 0.4 (졸음/딴짓)이면 writing 판정 억제
    """
    if not admin_settings["hand_detection_enabled"]:
        return {"is_writing": False, "hand_movement": 0.0, "suggested_playback_rate": 1.0}

    # 집중도 낮으면 writing 판정 억제 (CV-A 연동 룰)
    if focus_score < 0.4:
        return {"is_writing": False, "hand_movement": 0.0, "suggested_playback_rate": 1.0}

    # stub: 랜덤으로 is_writing 결정 (실제 모듈로 교체 시 이 부분만 변경)
    hand_movement = round(random.uniform(0.0, 1.0), 3)
    is_writing = hand_movement > 0.5

    # 히스테리시스 상태 갱신
    state = _writing_state.setdefault(session_id, {"is_writing": False, "duration": 0})
    if is_writing == state["is_writing"]:
        state["duration"] += 2  # 2초 폴링
    else:
        state["is_writing"] = is_writing
        state["duration"] = 2

    # 배속 결정
    writing_delay = admin_settings["writing_delay_sec"]
    restore_delay = admin_settings["restore_delay_sec"]
    if state["is_writing"] and state["duration"] >= writing_delay:
        suggested_rate = 0.8
    elif not state["is_writing"] and state["duration"] >= restore_delay:
        suggested_rate = 1.0
    else:
        # 전환 대기 중 → 이전 배속 유지 (기본 1.0)
        suggested_rate = 0.8 if state["is_writing"] else 1.0

    return {
        "is_writing": is_writing,
        "hand_movement": hand_movement,
        "suggested_playback_rate": suggested_rate,
    }


# ──────────────────────────────────────────────────────────────
# 5. LLM 모듈 Stub  (LLM 담당자가 실제 모듈 납품 시 이 함수 교체)
# ──────────────────────────────────────────────────────────────

def llm_generate_quiz(transcript_chunk: str, has_error: bool = False) -> dict:
    """
    LLM 모듈 stub.
    실제 LLM 모듈 납품 시 → generate_quiz(chunk, has_error) -> {question, expected_answer, has_intentional_error} 로 교체.
    """
    return {
        "question": f"[STUB] 다음 내용을 설명해보세요: '{transcript_chunk[:40]}...'",
        "expected_answer": "핵심 개념을 포함한 서술형 답변",
        "has_intentional_error": has_error,
    }


def llm_grade_answer(question: str, expected_answer: str, user_answer: str) -> dict:
    """
    LLM 모듈 stub.
    실제 LLM 모듈 납품 시 → grade_answer(q, expected, user_ans) -> {is_correct, feedback, follow_up} 로 교체.
    """
    is_correct = len(user_answer) > 10  # 임시: 10자 이상이면 정답 처리
    return {
        "is_correct": is_correct,
        "feedback": "잘 답변하셨습니다!" if is_correct else "핵심 키워드가 빠져 있어요. 다시 한 번 생각해보세요.",
        "follow_up": None,
    }


# ──────────────────────────────────────────────────────────────
# 6. Pydantic 요청/응답 스키마
# ──────────────────────────────────────────────────────────────

# --- 사용자 ---
class UserResponse(BaseModel):
    id: int
    name: str
    today_focus_sec: int
    streak_days: int
    total_crops: int


# --- 강의 ---
class LectureResponse(BaseModel):
    id: int
    subject: str
    title: str
    video_url: str
    duration_sec: int


class SessionStartResponse(BaseModel):
    session_id: int
    message: str


class SessionEndRequest(BaseModel):
    session_id: int


class LowFocusSegment(BaseModel):
    start_sec: int
    end_sec: int
    avg_score: float


class SessionEndResponse(BaseModel):
    session_id: int
    avg_focus: float
    total_sec: int
    low_focus_segments: list[LowFocusSegment]


# --- 집중도 ---
class FocusTickRequest(BaseModel):
    session_id: int
    video_time_sec: int
    landmarks: Optional[list] = None      # MediaPipe 랜드마크 좌표 (Option A: JS에서 전송)
    image_base64: Optional[str] = None   # v5: 프레임 스냅샷 base64 (Option B: Python에서 MediaPipe 실행)


class FocusTickResponse(BaseModel):
    focus_score: float
    label: str                            # focused / drowsy / distracted
    is_writing: bool                      # v5: 필기 중 여부 (CV-B)
    hand_movement: float                  # v5: 손 움직임 강도
    suggested_playback_rate: float        # v5: 권장 배속 (1.0 or 0.8)
    pomodoro_warning: bool                # 최근 5분 평균 < 0.4이면 True
    model_version: str                    # CV-A 모델 버전
    hand_model_version: str              # v5: CV-B 모델 버전


class FocusTimelineResponse(BaseModel):
    session_id: int
    logs: list[dict]    # [{video_time_sec, focus_score, label}, ...]


# --- 퀴즈 ---
class QuizGenerateRequest(BaseModel):
    session_id: int
    low_focus_timestamps: list[int]  # 저점수 구간 시작 초 리스트


class QuizGenerateResponse(BaseModel):
    quiz_id: int
    question: str
    has_intentional_error: bool


class QuizAnswerRequest(BaseModel):
    quiz_id: int
    user_answer: str


class QuizAnswerResponse(BaseModel):
    is_correct: bool
    feedback: str
    follow_up: Optional[str]
    next_review_at: Optional[str]


class ReviewQueueItem(BaseModel):
    quiz_id: int
    question: str
    lecture_title: str
    next_review_at: str


# --- 퀘스트 ---
class QuestResponse(BaseModel):
    id: int
    quest_type: str
    code: str
    title: str
    description: Optional[str]
    reward: Optional[str]
    progress: int
    target: int
    is_completed: bool


class QuestClaimResponse(BaseModel):
    message: str
    reward: Optional[str]


# --- 스케줄 ---
class ScheduleRecommendResponse(BaseModel):
    recommended_subject: str
    reason: str
    lectures: list[LectureResponse]


# --- 보상 ---
class RewardResponse(BaseModel):
    id: int
    crop_type: str
    obtained_at: str


# --- 관리자 (v5 신설) ---
class AdminSettingsResponse(BaseModel):
    hand_detection_enabled: bool
    writing_delay_sec: int
    restore_delay_sec: int
    focus_model_version: str
    hand_model_version: str
    rag_enabled: bool
    prompt_version: str


class HandDetectionToggleRequest(BaseModel):
    enabled: bool


class PlaybackSensitivityRequest(BaseModel):
    writing_delay_sec: int    # 필기 지속 N초 후 0.8배 적용 (기본 2)
    restore_delay_sec: int    # 필기 중단 N초 후 1.0배 복귀 (기본 3)


class HandExperimentRow(BaseModel):
    run_id: str
    model: str
    features: str
    acc: float
    false_positive_pct: float
    inf_ms: float
    note: str


# ──────────────────────────────────────────────────────────────
# 7. 유틸 함수
# ──────────────────────────────────────────────────────────────

def get_today_focus_sec(user_id: int, db: Session) -> int:
    """오늘 focus_log에서 집중(focused) 상태 시간을 합산."""
    today = datetime.utcnow().date()
    sessions = db.query(LectureSession).filter(
        LectureSession.user_id == user_id,
        func.date(LectureSession.started_at) == today,
    ).all()
    session_ids = [s.id for s in sessions]
    if not session_ids:
        return 0
    count = db.query(FocusLog).filter(
        FocusLog.session_id.in_(session_ids),
        FocusLog.label == "focused",
    ).count()
    return count * 2  # 2초 폴링이므로 row 수 × 2 = 초


def get_streak_days(user_id: int, db: Session) -> int:
    """연속 공부일 수 계산 (세션이 있는 날 기준)."""
    sessions = db.query(
        func.date(LectureSession.started_at).label("study_date")
    ).filter(LectureSession.user_id == user_id).distinct().all()
    dates = sorted({s.study_date for s in sessions}, reverse=True)
    if not dates:
        return 0
    streak = 0
    check = datetime.utcnow().date()
    for d in dates:
        if str(d) == str(check - timedelta(days=streak)):
            streak += 1
        else:
            break
    return streak


def auto_update_quests(user_id: int, db: Session):
    """
    focus_log가 쌓일 때마다 퀘스트 progress 자동 갱신.
    코드별 진행률 계산 후 완료 처리.
    """
    today_sec = get_today_focus_sec(user_id, db)
    quests = db.query(Quest).filter(
        Quest.user_id == user_id,
        Quest.is_completed == False,
    ).all()
    for q in quests:
        if q.code == "focus_2h":
            q.progress = min(today_sec // 60, q.target)  # 분 단위
        elif q.code == "lecture_1":
            count = db.query(LectureSession).filter(
                LectureSession.user_id == user_id,
                LectureSession.ended_at.isnot(None),
                func.date(LectureSession.started_at) == datetime.utcnow().date(),
            ).count()
            q.progress = min(count, q.target)
        if q.progress >= q.target:
            q.is_completed = True
            q.completed_at = datetime.utcnow()
    db.commit()


def give_crop_reward(user_id: int, db: Session):
    """집중 누적 2시간마다 당근 1개 지급."""
    today_sec = get_today_focus_sec(user_id, db)
    earned = today_sec // 7200  # 7200초 = 2시간
    existing = db.query(Reward).filter(
        Reward.user_id == user_id,
        Reward.crop_type == "carrot",
        func.date(Reward.obtained_at) == datetime.utcnow().date(),
    ).count()
    to_give = earned - existing
    for _ in range(max(0, to_give)):
        db.add(Reward(user_id=user_id, crop_type="carrot"))
    if to_give > 0:
        db.commit()


# ──────────────────────────────────────────────────────────────
# 8. API 엔드포인트
# ──────────────────────────────────────────────────────────────

# ── 헬스체크 ──────────────────────────────────────────────────

@app.get("/health", tags=["시스템"])
def health_check():
    """서버 상태 확인. 프론트엔드 연동 전 가장 먼저 테스트."""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ── 사용자 ────────────────────────────────────────────────────

@app.get("/users/me", response_model=UserResponse, tags=["사용자"])
def get_me(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """현재 사용자 프로필 + 오늘 집중시간 + 연속일 + 보유 작물 수."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    total_crops = db.query(Reward).filter(Reward.user_id == user_id).count()
    return UserResponse(
        id=user.id,
        name=user.name,
        today_focus_sec=get_today_focus_sec(user_id, db),
        streak_days=get_streak_days(user_id, db),
        total_crops=total_crops,
    )


# ── 강의 ──────────────────────────────────────────────────────

@app.get("/lectures", response_model=list[LectureResponse], tags=["강의"])
def list_lectures(
    subject: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """강의 목록 조회. subject 파라미터로 과목 필터링 가능."""
    query = db.query(Lecture)
    if subject:
        query = query.filter(Lecture.subject == subject)
    return [
        LectureResponse(
            id=l.id, subject=l.subject, title=l.title,
            video_url=l.video_url, duration_sec=l.duration_sec,
        )
        for l in query.all()
    ]


@app.get("/lectures/{lecture_id}", response_model=LectureResponse, tags=["강의"])
def get_lecture(lecture_id: int, db: Session = Depends(get_db)):
    """강의 상세 조회."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")
    return LectureResponse(
        id=lecture.id, subject=lecture.subject, title=lecture.title,
        video_url=lecture.video_url, duration_sec=lecture.duration_sec,
    )


@app.post("/lectures/{lecture_id}/start", response_model=SessionStartResponse, tags=["강의"])
def start_lecture(
    lecture_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    강의 시작 → 새 수강 세션 생성 → session_id 반환.
    프론트는 이 session_id를 이후 /focus/tick 등에 사용.
    """
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")
    session = LectureSession(user_id=user_id, lecture_id=lecture_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionStartResponse(
        session_id=session.id,
        message=f"'{lecture.title}' 수강을 시작합니다.",
    )


@app.post("/lectures/end", response_model=SessionEndResponse, tags=["강의"])
def end_lecture(
    body: SessionEndRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    강의 종료 → avg_focus 계산 및 저장 → 저집중 구간 리스트 반환.
    반환된 low_focus_segments를 /quiz/generate에 전달하면 됨.
    """
    session = db.query(LectureSession).filter(
        LectureSession.id == body.session_id,
        LectureSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    logs = db.query(FocusLog).filter(
        FocusLog.session_id == body.session_id
    ).order_by(FocusLog.video_time_sec).all()

    avg_focus = round(statistics.mean([l.focus_score for l in logs]), 3) if logs else 0.0
    session.ended_at = datetime.utcnow()
    session.avg_focus = avg_focus
    db.commit()

    # 저점수 구간 추출 (연속 10초 이상 focus_score < 0.4)
    low_segments: list[LowFocusSegment] = []
    segment_start = None
    segment_scores = []
    for log in logs:
        if log.focus_score < 0.4:
            if segment_start is None:
                segment_start = log.video_time_sec
            segment_scores.append(log.focus_score)
        else:
            if segment_start is not None:
                duration = (log.video_time_sec - segment_start)
                if duration >= 10:
                    low_segments.append(LowFocusSegment(
                        start_sec=segment_start,
                        end_sec=log.video_time_sec,
                        avg_score=round(statistics.mean(segment_scores), 3),
                    ))
                segment_start = None
                segment_scores = []

    # 퀘스트 갱신 및 작물 지급
    auto_update_quests(user_id, db)
    give_crop_reward(user_id, db)

    return SessionEndResponse(
        session_id=body.session_id,
        avg_focus=avg_focus,
        total_sec=len(logs) * 2,
        low_focus_segments=low_segments,
    )


# ── 집중도 ────────────────────────────────────────────────────

@app.post("/focus/tick", response_model=FocusTickResponse, tags=["집중도"])
def focus_tick(
    body: FocusTickRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    2초마다 프론트가 호출.
    - 프레임 스냅샷(base64) 또는 랜드마크 좌표 전송
    - CV-A(집중도) + CV-B(필기 감지) 동시 실행
    - 응답: focus_score, is_writing, suggested_playback_rate
    pomodoro_warning=True 이면 프론트에서 "잠깐 쉬어갈까요?" 토스트 표시.
    """
    # CV-A 모듈 호출 (집중도)
    focus_result = cv_predict(body.landmarks)
    score = focus_result["score"]
    label = focus_result["label"]

    # CV-B 모듈 호출 (필기 감지) — CV-A 결과(focus_score)를 연동하여 억제 룰 적용
    hand_result = cv_predict_hand(body.landmarks, score, body.session_id)

    # DB 저장 (v5: 새 컬럼 포함)
    db.add(FocusLog(
        session_id=body.session_id,
        video_time_sec=body.video_time_sec,
        focus_score=score,
        label=label,
        is_writing=hand_result["is_writing"],
        hand_movement=hand_result["hand_movement"],
        playback_rate=hand_result["suggested_playback_rate"],
        model_version=admin_settings["focus_model_version"],
        hand_model_version=admin_settings["hand_model_version"],
    ))
    db.commit()

    # 뽀모도로 경고: 최근 5분(150초) 평균 < 0.4
    recent_cutoff = max(0, body.video_time_sec - 150)
    recent_logs = db.query(FocusLog).filter(
        FocusLog.session_id == body.session_id,
        FocusLog.video_time_sec >= recent_cutoff,
    ).all()
    pomodoro_warning = False
    if len(recent_logs) >= 10:
        avg = statistics.mean([l.focus_score for l in recent_logs])
        pomodoro_warning = avg < 0.4

    # 퀘스트 주기적 갱신 (30초마다)
    if body.video_time_sec % 30 == 0:
        auto_update_quests(user_id, db)

    return FocusTickResponse(
        focus_score=score,
        label=label,
        is_writing=hand_result["is_writing"],
        hand_movement=hand_result["hand_movement"],
        suggested_playback_rate=hand_result["suggested_playback_rate"],
        pomodoro_warning=pomodoro_warning,
        model_version=admin_settings["focus_model_version"],
        hand_model_version=admin_settings["hand_model_version"],
    )


@app.get("/focus/session/{session_id}", response_model=FocusTimelineResponse, tags=["집중도"])
def get_focus_timeline(
    session_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """강의 하단 집중도 타임라인 바 렌더링용 전체 로그 반환."""
    session = db.query(LectureSession).filter(
        LectureSession.id == session_id,
        LectureSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    logs = db.query(FocusLog).filter(
        FocusLog.session_id == session_id
    ).order_by(FocusLog.video_time_sec).all()
    return FocusTimelineResponse(
        session_id=session_id,
        logs=[
            {"video_time_sec": l.video_time_sec, "focus_score": l.focus_score, "label": l.label}
            for l in logs
        ],
    )


# ── 퀴즈 ──────────────────────────────────────────────────────

@app.post("/quiz/generate", response_model=QuizGenerateResponse, tags=["퀴즈"])
def generate_quiz(
    body: QuizGenerateRequest,
    db: Session = Depends(get_db),
):
    """
    강의 종료 후 저집중 구간 타임스탬프를 받아 퀴즈 생성.
    LLM 모듈 호출 (stub) → quiz DB 저장 → quiz_id 반환.
    """
    session = db.query(LectureSession).filter(
        LectureSession.id == body.session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    lecture = db.query(Lecture).filter(Lecture.id == session.lecture_id).first()
    transcript = lecture.transcript if lecture else "강의 내용"

    # 저점수 구간의 자막 chunk 추출 (단순화: 전체 자막을 chuck로 사용)
    # 실제 구현에서는 timestamp 기반으로 자막 분할 필요
    chunk = transcript[:200] if transcript else "강의 핵심 내용"

    # 80% 확률로 의도적 오류 포함 (Protégé 효과)
    has_error = random.random() < 0.8

    # LLM 모듈 호출 (stub → 실제 모듈로 교체)
    llm_result = llm_generate_quiz(chunk, has_error)

    first_timestamp = body.low_focus_timestamps[0] if body.low_focus_timestamps else None
    quiz = Quiz(
        session_id=body.session_id,
        question=llm_result["question"],
        expected_answer=llm_result["expected_answer"],
        has_intentional_error=llm_result["has_intentional_error"],
        chunk_video_time_sec=first_timestamp,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    return QuizGenerateResponse(
        quiz_id=quiz.id,
        question=quiz.question,
        has_intentional_error=quiz.has_intentional_error,
    )


@app.post("/quiz/answer", response_model=QuizAnswerResponse, tags=["퀴즈"])
def answer_quiz(
    body: QuizAnswerRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    사용자 답변 제출 → LLM 평가 → DB 저장 → 피드백 반환.
    망각곡선: 정답=+7일, 오답=+1일 후 재출제.
    """
    quiz = db.query(Quiz).filter(Quiz.id == body.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="퀴즈를 찾을 수 없습니다.")

    # LLM 평가 (stub → 실제 모듈로 교체)
    eval_result = llm_grade_answer(
        question=quiz.question,
        expected_answer=quiz.expected_answer or "",
        user_answer=body.user_answer,
    )

    # 망각곡선 스케줄
    now = datetime.utcnow()
    review_days = 7 if eval_result["is_correct"] else 1

    # 재오답 체크: 이전에 오답이었으면 3일
    prev_result = db.query(QuizResult).filter(
        QuizResult.quiz_id == body.quiz_id,
        QuizResult.user_id == user_id,
        QuizResult.is_correct == False,
    ).first()
    if prev_result and not eval_result["is_correct"]:
        review_days = 3

    next_review = now + timedelta(days=review_days)

    result = QuizResult(
        quiz_id=body.quiz_id,
        user_id=user_id,
        user_answer=body.user_answer,
        is_correct=eval_result["is_correct"],
        llm_feedback=eval_result["feedback"],
        next_review_at=next_review,
    )
    db.add(result)
    db.commit()

    # 퀴즈 정답 퀘스트 갱신
    auto_update_quests(user_id, db)

    return QuizAnswerResponse(
        is_correct=eval_result["is_correct"],
        feedback=eval_result["feedback"],
        follow_up=eval_result.get("follow_up"),
        next_review_at=next_review.isoformat(),
    )


@app.get("/quiz/review-queue", response_model=list[ReviewQueueItem], tags=["퀴즈"])
def get_review_queue(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """오늘 복습해야 할 퀴즈 목록 (next_review_at <= 오늘)."""
    now = datetime.utcnow()
    results = db.query(QuizResult).filter(
        QuizResult.user_id == user_id,
        QuizResult.next_review_at <= now,
        QuizResult.is_correct == False,
    ).all()

    queue = []
    for r in results:
        quiz = db.query(Quiz).filter(Quiz.id == r.quiz_id).first()
        if not quiz:
            continue
        session = db.query(LectureSession).filter(
            LectureSession.id == quiz.session_id
        ).first()
        lecture = db.query(Lecture).filter(
            Lecture.id == session.lecture_id
        ).first() if session else None
        queue.append(ReviewQueueItem(
            quiz_id=quiz.id,
            question=quiz.question,
            lecture_title=lecture.title if lecture else "알 수 없음",
            next_review_at=r.next_review_at.isoformat(),
        ))
    return queue


# ── 퀘스트 ────────────────────────────────────────────────────

@app.get("/quests", response_model=list[QuestResponse], tags=["퀘스트"])
def get_quests(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """현재 사용자의 퀘스트 목록 (데일리/위클리)."""
    quests = db.query(Quest).filter(Quest.user_id == user_id).all()
    return [
        QuestResponse(
            id=q.id, quest_type=q.quest_type, code=q.code,
            title=q.title, description=q.description, reward=q.reward,
            progress=q.progress, target=q.target, is_completed=q.is_completed,
        )
        for q in quests
    ]


@app.post("/quests/{quest_id}/claim", response_model=QuestClaimResponse, tags=["퀘스트"])
def claim_quest(
    quest_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """완료된 퀘스트 보상 수령."""
    quest = db.query(Quest).filter(
        Quest.id == quest_id,
        Quest.user_id == user_id,
    ).first()
    if not quest:
        raise HTTPException(status_code=404, detail="퀘스트를 찾을 수 없습니다.")
    if not quest.is_completed:
        raise HTTPException(status_code=400, detail="아직 완료되지 않은 퀘스트입니다.")

    # 보상 지급 (작물)
    if quest.reward:
        db.add(Reward(user_id=user_id, crop_type=quest.reward))
        db.commit()

    return QuestClaimResponse(message="보상을 수령했습니다!", reward=quest.reward)


# ── 스케줄 추천 ───────────────────────────────────────────────

@app.get("/schedule/recommend", response_model=ScheduleRecommendResponse, tags=["스케줄"])
def recommend_schedule(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    룰 기반 과목 추천.
    현재 시간대 기준 과목별 평균 집중도 → 가장 낮은 과목을 이 시간에 배치 추천.
    (수학 못하는 학생은 집중도 높은 시간에 수학 추천)
    """
    current_hour = datetime.utcnow().hour
    # 과목별 평균 집중도 계산
    lectures = db.query(Lecture).all()
    subject_scores: dict[str, list[float]] = {}

    for lecture in lectures:
        sessions = db.query(LectureSession).filter(
            LectureSession.user_id == user_id,
            LectureSession.lecture_id == lecture.id,
            LectureSession.avg_focus.isnot(None),
        ).all()
        for s in sessions:
            subject_scores.setdefault(lecture.subject, []).append(s.avg_focus)

    if not subject_scores:
        # 데이터 없을 때 기본 추천
        first_lecture = db.query(Lecture).first()
        subject = first_lecture.subject if first_lecture else "수학"
        reason = "아직 수강 데이터가 없어서 첫 번째 강의를 추천합니다."
    else:
        # 평균 집중도가 낮은 과목 → 현재 시간(집중 높은 시간 가정)에 배치
        avg_by_subject = {
            subj: round(statistics.mean(scores), 3)
            for subj, scores in subject_scores.items()
        }
        subject = min(avg_by_subject, key=avg_by_subject.get)
        reason = (
            f"오전 시간대({current_hour}시)는 집중도가 높아요. "
            f"평소 집중도가 낮은 '{subject}' 수강을 추천합니다."
        )

    lectures_for_subject = db.query(Lecture).filter(
        Lecture.subject == subject
    ).limit(3).all()

    return ScheduleRecommendResponse(
        recommended_subject=subject,
        reason=reason,
        lectures=[
            LectureResponse(
                id=l.id, subject=l.subject, title=l.title,
                video_url=l.video_url, duration_sec=l.duration_sec,
            )
            for l in lectures_for_subject
        ],
    )


# ── 관리자 (v5 신설) ─────────────────────────────────────────

@app.get("/admin/settings", response_model=AdminSettingsResponse, tags=["관리자"])
def get_admin_settings():
    """현재 관리자 설정 전체 조회. 발표 시 실험 토글 확인용."""
    return AdminSettingsResponse(**admin_settings)


@app.post("/admin/hand-detection/toggle", response_model=AdminSettingsResponse, tags=["관리자"])
def toggle_hand_detection(body: HandDetectionToggleRequest):
    """
    필기 감지 on/off 토글.
    발표 시 "/admin 페이지에서 필기 감지를 끄면 배속 조정이 멈춥니다" 시연용.
    """
    admin_settings["hand_detection_enabled"] = body.enabled
    return AdminSettingsResponse(**admin_settings)


@app.post("/admin/playback-sensitivity", response_model=AdminSettingsResponse, tags=["관리자"])
def set_playback_sensitivity(body: PlaybackSensitivityRequest):
    """
    자동 배속 민감도 조정.
    writing_delay_sec: 필기 지속 N초 후 0.8배 적용 (기본 2, 범위 1~5)
    restore_delay_sec: 필기 중단 N초 후 1.0배 복귀 (기본 3, 범위 1~5)
    """
    if not (1 <= body.writing_delay_sec <= 5):
        raise HTTPException(status_code=400, detail="writing_delay_sec는 1~5 사이여야 합니다.")
    if not (1 <= body.restore_delay_sec <= 5):
        raise HTTPException(status_code=400, detail="restore_delay_sec는 1~5 사이여야 합니다.")
    admin_settings["writing_delay_sec"] = body.writing_delay_sec
    admin_settings["restore_delay_sec"] = body.restore_delay_sec
    return AdminSettingsResponse(**admin_settings)


@app.get("/admin/hand-experiments", response_model=list[HandExperimentRow], tags=["관리자"])
def get_hand_experiments():
    """
    CV-B 필기 감지 실험 로그 조회.
    실제 구현: hand_experiments.csv 파일을 읽어 반환.
    현재는 더미 데이터 반환.
    """
    # TODO: CV-B 담당자가 hand_experiments.csv 파일 생성 후 아래 코드로 교체
    # import csv
    # with open("hand_experiments.csv") as f:
    #     rows = list(csv.DictReader(f))
    # return rows
    return [
        HandExperimentRow(
            run_id="hand_001",
            model="룰 기반 (속도 임계값)",
            features="tip_speed_3sec",
            acc=0.68,
            false_positive_pct=18.0,
            inf_ms=1.0,
            note="baseline — ML 없이 룰만",
        ),
        HandExperimentRow(
            run_id="hand_002",
            model="LogisticRegression",
            features="tip_speed + direction",
            acc=0.74,
            false_positive_pct=12.0,
            inf_ms=4.0,
            note="stub — CV-B 모듈 납품 후 실제값으로 교체",
        ),
    ]


# ── 보상 / 작물 ───────────────────────────────────────────────

@app.get("/rewards", response_model=list[RewardResponse], tags=["보상"])
def get_rewards(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """보유 작물(보상) 목록 조회."""
    rewards = db.query(Reward).filter(Reward.user_id == user_id).all()
    return [
        RewardResponse(
            id=r.id,
            crop_type=r.crop_type,
            obtained_at=r.obtained_at.isoformat(),
        )
        for r in rewards
    ]


# ──────────────────────────────────────────────────────────────
# 9. 시드 데이터 (최초 실행 시 DB가 비어 있으면 삽입)
# ──────────────────────────────────────────────────────────────

def seed_data():
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            return  # 이미 시드 완료

        # 사용자
        user = User(name="학습자")
        db.add(user)
        db.flush()

        # 강의 (트랜스크립트는 더미 텍스트)
        lectures_data = [
            ("수학", "미분의 기초", "https://www.youtube.com/embed/dQw4w9WgXcQ", 1200,
             "미분이란 함수의 순간 변화율을 구하는 방법입니다. f'(x) = lim(h→0) [f(x+h)-f(x)]/h 로 정의됩니다."),
            ("수학", "적분의 개념", "https://www.youtube.com/embed/dQw4w9WgXcQ", 1500,
             "적분은 미분의 역연산으로, 넓이와 부피를 구하는 데 활용됩니다."),
            ("영어", "영어 독해 전략", "https://www.youtube.com/embed/dQw4w9WgXcQ", 1800,
             "Topic sentence를 먼저 파악하고, 핵심 어휘를 중심으로 문장 구조를 분석합니다."),
            ("과학", "뉴턴의 운동 법칙", "https://www.youtube.com/embed/dQw4w9WgXcQ", 1350,
             "F=ma, 관성의 법칙, 작용-반작용의 법칙이 뉴턴의 3대 운동 법칙입니다."),
            ("영어", "문법 - 시제 완전 정복", "https://www.youtube.com/embed/dQw4w9WgXcQ", 900,
             "현재완료(have+p.p.)는 과거에 시작된 일이 현재까지 이어질 때 사용합니다."),
        ]
        for subj, title, url, dur, transcript in lectures_data:
            db.add(Lecture(
                subject=subj, title=title, video_url=url,
                duration_sec=dur, transcript=transcript,
            ))
        db.flush()

        # 퀘스트
        quests_data = [
            (user.id, "daily", "focus_2h",      "오늘 2시간 집중하기",    "오늘 하루 집중 시간 2시간을 채워보세요!", "carrot",  0, 120),
            (user.id, "daily", "lecture_1",     "오늘 강의 1개 완강",     "강의를 끝까지 들어보세요.",               "tomato",  0, 1),
            (user.id, "daily", "quiz_correct_3","퀴즈 3문제 맞추기",      "오늘 퀴즈를 3문제 이상 맞춰보세요!",      "carrot",  0, 3),
            (user.id, "weekly","streak_5",      "5일 연속 출석",          "이번 주 5일 이상 공부해보세요.",           "pumpkin", 0, 5),
            (user.id, "weekly","focus_10h",     "주간 집중 10시간 달성",  "이번 주 총 집중시간 10시간을 목표로!",     "wheat",   0, 600),
        ]
        for uid, qtype, code, title, desc, reward, prog, target in quests_data:
            db.add(Quest(
                user_id=uid, quest_type=qtype, code=code,
                title=title, description=desc, reward=reward,
                progress=prog, target=target,
            ))

        db.commit()
        print("✅ 시드 데이터 삽입 완료")
    except Exception as e:
        db.rollback()
        print(f"⚠️ 시드 오류: {e}")
    finally:
        db.close()


seed_data()

# ──────────────────────────────────────────────────────────────
# 10. 실행 진입점
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
