import { useState, useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import SharedHeader, { PIX, LIME_HI, LIME_MAIN, LIME_DARK, BODY_HI, BODY_MAIN, BODY_DARK, pixClip, sideShadow } from "../components/SharedHeader"
import { startLecture, endLecture, postFocusTick, getLectures, getReviewQueue } from "../api/index.js"


// ── Design Tokens (colors imported from SharedHeader) ──
const hdrGrad  = `linear-gradient(180deg,${PIX} 0,${PIX} 3px,${LIME_MAIN} 3px,${LIME_MAIN} calc(100% - 6px),${LIME_DARK} calc(100% - 6px),${LIME_DARK} calc(100% - 3px),${PIX} calc(100% - 3px),${PIX} 100%)`
const bodyGrad = `linear-gradient(180deg,${BODY_HI} 0,${BODY_HI} 3px,${BODY_MAIN} 3px,${BODY_MAIN} calc(100% - 6px),${BODY_DARK} calc(100% - 6px),${BODY_DARK} calc(100% - 3px),${PIX} calc(100% - 3px),${PIX} 100%)`

// ── 퀴즈 점수 색상 (저/중/고) ──
// 고 70+: 초록 / 중 40~69: 주황 / 저 0~39: 빨강
const SCORE_HI  = "#3e8948"   // 진한 초록
const SCORE_MID = "#f77622"   // 주황
const SCORE_LOW = "#e43b44"   // 빨강
// bar 트랙 색 (배경)
const SCORE_HI_BG  = "#cceaaa"  // 연초록
const SCORE_MID_BG = "#ffd16b"  // 연노랑/주황
const SCORE_LOW_BG = "#ee686e"  // 연한 빨강

// 점수율(0~1) → 색상
const scoreColor   = (ratio) => ratio >= 0.7 ? SCORE_HI    : ratio >= 0.4 ? SCORE_MID    : SCORE_LOW
const scoreColorBg = (ratio) => ratio >= 0.7 ? SCORE_HI_BG : ratio >= 0.4 ? SCORE_MID_BG : SCORE_LOW_BG
// 절대 점수(0~100) → 색상
const totalColor   = (total) => total >= 70 ? SCORE_HI    : total >= 40 ? SCORE_MID    : SCORE_LOW
const PANEL = {
  wrap: { overflow:"hidden", boxShadow:"0 4px 16px rgba(0,0,0,0.4)",
          clipPath:"polygon(3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px),0 3px)" },
  header: { background:hdrGrad, boxShadow:sideShadow, padding:"9px 12px",
            display:"flex", alignItems:"center", gap:8 },
  headerText: { fontSize:12, fontWeight:700, color:"#2a1a0a", fontFamily:"monospace" },
  body: { background:bodyGrad, boxShadow:sideShadow, padding:"12px", color:"#2a1a0a", fontFamily:"monospace" },
}

const FLOOR_TILE_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABJUlEQVR4nNVXyRGDQAwDZkvgSyUpI5WlRr7UQPJaZlF8yObIRD9AMjYyxvSv5+PdGZiXtZvGwaKEeAhVMS+reRzlhRPAarTqWJ6GghlP40BVpfGk8xIqr/d6AJHx2tLQkTJeMxo6gYzXjGbXA61/lpea15Ze47o9EPU8yj88B7J8N4Go59l58DUHJDCzwuIjWn3BTFkPPY4Xp14bWgEGyCAaZ0vg6EzPxinSe6tlbXnPfEMkzq4HpGzRS62ithALeP3UfYD9ElIJYDBrH2B4Gv5rH2B9jmhC+0AbhJ2gnua2fUCbjLftA1WHXGofwGrO4FZQc4Dp7EyPmAlE32/GbwmX7AOSRtMX7bFFZ7qWgPdHtdsH6snMTMcbs3Eu2QciT/Ln+8AHEGJSk+T1pdgAAAAASUVORK5CYII="
const PLAYER_IMG      = "/assets/Cute_Fantasy_Free/Player/Player.png"
const STATUS_COLOR = { focus:"#22c98a", unfocus:"#f06060" }
const STATUS_LABEL = { focus:"집중",    unfocus:"미집중"   }
const FOCUS_THRESHOLD = 70  // 집중 판정 기준점수
const LLM_BASE = "http://localhost:8001"  // LLM 서버 주소

// 과목명 → LLM 강의 파일명 매핑 (필요시 추가)
const SUBJECT_TO_FILE = {
  "생명과학": "bio_1.json",
  "지구과학": "ear_1.json",
  "경제":     "peo_1.json",
}

function formatTime(sec) {
  if (!sec && sec !== 0) return "--:--"
  const m = String(Math.floor(sec / 60)).padStart(2, "0")
  const s = String(sec % 60).padStart(2, "0")
  return `${m}:${s}`
}

// 연속된(인접하거나 겹치는) segment들을 하나로 병합
// 입력: [{start, end, status}, ...]
// 출력: [{start, end, status, count}] (count = 합쳐진 분 수)
function mergeContinuousSegments(segs, gapTolerance = 1) {
  if (!segs || segs.length === 0) return []
  // start 기준 정렬
  const sorted = [...segs].sort((a, b) => a.start - b.start)
  const merged = []
  let cur = { ...sorted[0], count: 1 }
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]
    // 인접하거나 겹치면 병합 (end ≥ next.start - gapTolerance)
    if (next.start <= cur.end + gapTolerance) {
      cur.end = Math.max(cur.end, next.end)
      cur.count += 1
    } else {
      merged.push(cur)
      cur = { ...next, count: 1 }
    }
  }
  merged.push(cur)
  return merged
}

export default function LecturePage() {
  const [sessionId, setSessionId]         = useState(null)
  const [isStarted, setIsStarted]         = useState(false)
  const [playbackRate, setPlaybackRate]   = useState(1.0)
  const videoRef                          = useRef(null)
  const [focusScore, setFocusScore]       = useState(0)

  const [quests, setQuests]               = useState([
    { id:1, title:"강의 30분 수강", done:false },
    { id:2, title:"퀴즈 1개 풀기",  done:false },
    { id:3, title:"집중도 80점↑",   done:false },
  ])
  const [seekTime, setSeekTime]           = useState(null)

  // 강의 선택
  const [lectures, setLectures]               = useState([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [filteredLectures, setFilteredLectures] = useState([])
  const [selectedLecture, setSelectedLecture]   = useState(null)

  // 실시간 타임라인
  const [segments, setSegments]               = useState([])
  const [focusScores, setFocusScores]         = useState([]) // 분당 점수 [{minute, score}]
  const [videoDuration, setVideoDuration]     = useState(0)
  const [currentVideoTime, setCurrentVideoTime] = useState(0)

  // 웹캠 자동 시작
  const [autoStartWebcam, setAutoStartWebcam] = useState(false)
  const [pauseWebcam, setPauseWebcam]         = useState(false)
  const webcamStartRef = useRef(null) // WebcamPanel의 startWebcam 함수 참조

  // 팝업
  const [quizPopupOpen, setQuizPopupOpen]   = useState(false)
  const [quizSegments, setQuizSegments]     = useState([])
  const [reviewOpen, setReviewOpen]         = useState(false)
  const [reviewQueue, setReviewQueue]       = useState([])

  const location = useLocation()
  const seekTo   = location.state?.seekTo

  // 강의 목록
  useEffect(() => {
    getLectures().then(res => setLectures(res.data)).catch(() => {})
  }, [])

  // 복습 큐 확인 (페이지 진입 시)
  useEffect(() => {
    getReviewQueue()
      .then(res => {
        if (res.data?.length > 0) {
          setReviewQueue(res.data)
          setReviewOpen(true)
        }
      })
      .catch(() => {})
  }, [])

  // 과목 선택 → 강의 필터링
  useEffect(() => {
    setFilteredLectures(selectedSubject
      ? lectures.filter(l => l.subject === selectedSubject)
      : lectures)
    setSelectedLecture(null)
    setIsStarted(false)
    setSessionId(null)
    setSegments([])
    setVideoDuration(0)
  }, [selectedSubject, lectures])

  // 강의 선택 → 세션 시작
  const handleLectureSelect = (lecture) => {
    setSelectedLecture(lecture)
    setSegments([])
    startLecture(lecture.id)
      .then(res => { setSessionId(res.data.session_id); setIsStarted(true) })
      .catch(err => console.error('세션 시작 실패:', err))
  }

  // 강의 종료
  const handleLectureEnd = () => {
    if (!isStarted && !sessionId) return

    // 미집중 구간 → 그룹화 후 각 구간의 시작 분만 LLM에 전달
    const grouped = mergeContinuousSegments(segments.filter(s => s.status === "unfocus"))
    const focusTimestamps = grouped.map(g => Math.round(g.start / 60))

    endLecture({ session_id: sessionId })
      .then(() => {
        setQuizSegments(focusTimestamps)
        setQuizPopupOpen(true)
      })
      .catch(() => {
        setQuizSegments(focusTimestamps)
        setQuizPopupOpen(true)
      })
  }

  // 영상 종료 이벤트
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onEnded = () => handleLectureEnd()
    video.addEventListener("ended", onEnded)
    return () => video.removeEventListener("ended", onEnded)
  }, [sessionId, segments])

  // 현재 재생 위치 추적
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTimeUpdate = () => setCurrentVideoTime(Math.floor(video.currentTime))
    video.addEventListener("timeupdate", onTimeUpdate)
    return () => video.removeEventListener("timeupdate", onTimeUpdate)
  }, [])

  // seekTime → 영상 이동
  useEffect(() => {
    if (seekTime === null || !videoRef.current) return
    videoRef.current.currentTime = seekTime
    videoRef.current.play()
  }, [seekTime])

  // Dashboard seekTo → 영상 이동
  useEffect(() => {
    if (!seekTo || !videoRef.current) return
    const [m, s] = seekTo.split(":").map(Number)
    videoRef.current.currentTime = m * 60 + s
    videoRef.current.play()
  }, [seekTo])


  const subjects       = [...new Set(lectures.map(l => l.subject))]
  const badSegments    = segments.filter(s => s.status === "unfocus")
  // 연속된 미집중 구간 그룹화 (인접/겹치는 segment를 하나로 병합)
  const groupedBadSegments = mergeContinuousSegments(badSegments)
  const completedCount = quests.filter(q => q.done).length
  const showBanner     = seekTo || seekTime !== null
  const bannerTimeStr  = seekTime !== null ? formatTime(seekTime) : seekTo

  return (
    <div style={{ width:"100%", height:"100vh", display:"flex", flexDirection:"column",
                  color:"#2a1a0a", fontFamily:"monospace",
                  backgroundImage:`url(${FLOOR_TILE_DATA})`,
                  backgroundRepeat:"repeat", backgroundSize:"96px 96px",
                  imageRendering:"pixelated" }}>
      {/* SharedHeader */}
      <SharedHeader showHome />
      <style>{`
        .lecture-right-panel::-webkit-scrollbar { width: 10px; }
        .lecture-right-panel::-webkit-scrollbar-track {
          background: ${BODY_DARK};
          border-left: 2px solid ${PIX};
        }
        .lecture-right-panel::-webkit-scrollbar-thumb {
          background: ${LIME_DARK};
          border: 2px solid ${PIX};
        }
        .lecture-right-panel::-webkit-scrollbar-thumb:hover {
          background: ${LIME_MAIN};
        }
        /* 우측 패널 안 자식들이 컨텐츠 높이 유지해야 스크롤이 정상 동작 */
        .lecture-right-panel > * { flex-shrink: 0; }
      `}</style>

      {showBanner && (
        <div style={{ background:"rgba(198,228,114,0.12)", borderBottom:`2px solid ${PIX}`,
                      padding:"8px 20px", fontSize:12, color:"#3a5a10",
                      display:"flex", alignItems:"center", gap:8, fontFamily:"monospace" }}>
          ▶ <strong>{bannerTimeStr}</strong> 구간으로 이동했습니다.
          {seekTime !== null && (
            <button onClick={() => setSeekTime(null)}
              style={{ marginLeft:"auto", background:LIME_HI, border:`2px solid ${PIX}`,
                       padding:"2px 8px", color:"#2a4a08", fontSize:11, cursor:"pointer",
                       fontFamily:"monospace", clipPath:pixClip }}>✕ 닫기</button>
          )}
        </div>
      )}

      <div style={{ position:"relative", flex:1, overflow:"hidden" }}>

        {/* 왼쪽만 흰 배경 — 오른쪽은 타일 유지 */}
        <div style={{
          position:"absolute", top:0, bottom:0, left:0, right:525,
          background:"#ffffff",
          pointerEvents:"none", zIndex:0,
        }} />

        <div style={{ position:"relative", display:"flex", height:"100%", minHeight:0, overflow:"hidden", zIndex:1 }}>

        {/* 왼쪽 */}
        <div style={{ flex:1, overflowY:"hidden", overflowX:"hidden", padding:16, display:"flex", flexDirection:"column" }}>

          {/* 드롭박스 + 상태 뱃지 한 행으로 */}
          <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"stretch" }}>
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
              style={{ flex:"0 0 140px", background:BODY_MAIN, border:`2px solid ${PIX}`, borderRadius:0,
                       padding:"8px 12px", color:"#2a1a0a", fontSize:12, cursor:"pointer", outline:"none",
                       fontFamily:"monospace",
                       boxShadow:`inset 0 2px 0 ${BODY_HI}, inset 0 -2px 0 ${BODY_DARK}`,
                       clipPath:pixClip }}>
              <option value="">📚 과목 선택</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={selectedLecture?.id || ""}
              onChange={e => {
                const lec = filteredLectures.find(l => l.id === Number(e.target.value))
                if (lec) handleLectureSelect(lec)
              }}
              disabled={!selectedSubject}
              style={{ flex:"0 0 240px", background:BODY_MAIN, border:`2px solid ${PIX}`, borderRadius:0,
                       padding:"8px 12px", color: selectedSubject ? "#2a1a0a" : LIME_DARK,
                       fontSize:12, cursor: selectedSubject ? "pointer" : "not-allowed",
                       outline:"none", opacity: selectedSubject ? 1 : 0.5,
                       fontFamily:"monospace",
                       boxShadow:`inset 0 2px 0 ${BODY_HI}, inset 0 -2px 0 ${BODY_DARK}`,
                       clipPath:pixClip }}>
              <option value="">🎬 강의 선택</option>
              {filteredLectures.map(l => (
                <option key={l.id} value={l.id}>{l.title} ({Math.floor(l.duration_sec/60)}분)</option>
              ))}
            </select>

            {selectedLecture && (
              <div style={{ flex:1, padding:"6px 12px", background:LIME_HI,
                            border:`2px solid ${PIX}`,
                            fontSize:11, color:"#2a4a08", display:"flex", alignItems:"center", gap:8, minWidth:0,
                            fontFamily:"monospace", clipPath:pixClip }}>
                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0 }}>
                  📖 {selectedLecture.subject} · {selectedLecture.title}
                </span>
                {isStarted
                  ? <span style={{ color:LIME_DARK, fontWeight:700, marginLeft:"auto", flexShrink:0 }}>● 수강 중</span>
                  : <span style={{ color:"#3a5a10", marginLeft:"auto", flexShrink:0 }}>강의를 선택해주세요</span>}
              </div>
            )}
          </div>

          {/* 영상 */}
          <div style={{ ...PANEL.wrap, position:"relative", marginBottom:12, flex:"0 0 auto", maxHeight:"55%", display:"flex", flexDirection:"column" }}>
            <video ref={videoRef} src={selectedLecture?.video_url || "/test.webm"} controls
              style={{ width:"100%", flex:1, minHeight:0, objectFit:"contain" }}
              onLoadedMetadata={() => {
                if (videoRef.current) setVideoDuration(Math.floor(videoRef.current.duration))
              }}
              onPlay={() => {
                // 영상 재생 시 웹캠 측정 자동 시작/재개
                if (isStarted) setAutoStartWebcam(true)
              }}
              onPause={() => {
                // 영상 일시정지 → 집중도 측정 일시정지
                setPauseWebcam(true)
              }} />

            {seekTime !== null && (
              <div style={{ position:"absolute", top:12, left:12, background:"rgba(198,228,114,0.2)",
                            border:`2px solid ${PIX}`, padding:"4px 10px",
                            fontSize:11, color:"#3a5a10", fontWeight:700, fontFamily:"monospace",
                            clipPath:pixClip }}>
                ▶ {formatTime(seekTime)} 구간 재생중
              </div>
            )}
            {isStarted && (
              <button onClick={handleLectureEnd}
                style={{ position:"absolute", bottom:12, right:12,
                          background:LIME_MAIN, border:`2px solid ${PIX}`,
                          borderBottom:`4px solid ${PIX}`,
                          boxShadow:`inset 0 2px 0 ${LIME_HI}`,
                          padding:"5px 14px", color:"#2a1a0a",
                          fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"monospace",
                          clipPath:pixClip }}>
                강의 종료 →
              </button>
            )}
          </div>

          {/* 실시간 타임라인 */}
          <div style={{ ...PANEL.wrap, flex:1, minHeight:0, overflowY:"auto", marginBottom:0 }}>
            <div style={PANEL.header}>
              <span style={PANEL.headerText}>📊 집중도 타임라인</span>
              {videoDuration > 0 && (
                <span style={{ marginLeft:"auto", fontSize:10, color:"#2a4a08", fontFamily:"monospace" }}>
                  {formatTime(currentVideoTime)} / {formatTime(videoDuration)}
                </span>
              )}
            </div>
            <div style={{ ...PANEL.body, padding:14 }}>
            {videoDuration === 0 ? (
              <div style={{ height:60, background:LIME_HI, border:`2px solid ${PIX}`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:10, color:"#3a5a10", fontFamily:"monospace",
                            clipPath:pixClip }}>
                강의를 선택하면 타임라인이 표시돼요
              </div>
            ) : (
              <FocusTimeline
                segments={segments}
                focusScores={focusScores}
                videoDuration={videoDuration}
                currentVideoTime={currentVideoTime}
                seekTime={seekTime}
                onSeek={setSeekTime}
              />
            )}

            <div style={{ display:"flex", gap:16, marginBottom:12 }}>
              {Object.entries(STATUS_COLOR).map(([k,v]) => (
                <div key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:v }} />
                  <span style={{ color:"#3a5a10", fontFamily:"monospace" }}>{STATUS_LABEL[k]}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize:11, color:"#3a5a10", fontWeight:700, marginBottom:8, fontFamily:"monospace" }}>
              📌 미집중 구간 다시보기
            </div>
            {groupedBadSegments.length === 0 ? (
              <div style={{ fontSize:11, color:"#3a5a10", fontFamily:"monospace" }}>
                {isStarted ? "미집중 구간이 없어요 🎉" : "강의 수강 중 1분마다 업데이트돼요"}
              </div>
            ) : groupedBadSegments.slice(-5).map((seg, i) => {
              const startMin = Math.floor(seg.start / 60)
              const endMin   = Math.ceil(seg.end / 60)
              const durMin   = endMin - startMin
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between",
                                      alignItems:"center", padding:"8px 10px", marginBottom:6,
                                      background:LIME_HI, border:`2px solid ${PIX}`,
                                      boxShadow:sideShadow, clipPath:pixClip }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:STATUS_COLOR.unfocus }} />
                    <span style={{ fontSize:11, color:"#3a5a10", fontWeight:700, fontFamily:"monospace" }}>미집중</span>
                    <span style={{ fontSize:11, color:"#2a4a08", fontFamily:"monospace" }}>
                      {startMin}분 ~ {endMin}분
                    </span>
                    {durMin >= 2 && (
                      <span style={{ fontSize:9, color:"#2a4a08", background:LIME_MAIN,
                                     border:`2px solid ${PIX}`, padding:"1px 5px", fontWeight:700,
                                     fontFamily:"monospace", clipPath:pixClip }}>
                        {durMin}분 연속
                      </span>
                    )}
                  </div>
                  <button onClick={() => setSeekTime(seg.start)}
                    style={{ background: seekTime===seg.start ? LIME_HI : LIME_MAIN,
                             border:`2px solid ${PIX}`,
                             borderBottom: seekTime===seg.start ? `2px solid ${PIX}` : `4px solid ${PIX}`,
                             boxShadow: seekTime===seg.start ? "none" : `inset 0 2px 0 ${LIME_HI}`,
                             padding:"4px 12px", fontSize:11, color:"#2a4a08", fontWeight:700,
                             cursor:"pointer", fontFamily:"monospace", clipPath:pixClip }}>
                    {seekTime===seg.start ? "▶ 재생중" : "▶ 다시보기"}
                  </button>
                </div>
              )
            })}
            </div>{/* PANEL.body */}
          </div>{/* PANEL.wrap */}
        </div>{/* 왼쪽 컬럼 */}

        {/* 오른쪽 */}
        <div className="lecture-right-panel"
             style={{ width:500, display:"flex", flexDirection:"column",
                      gap:10, padding:"12px",
                      overflowY:"scroll", overflowX:"hidden",
                      flexShrink:0, minHeight:0,
                      height:"100%", maxHeight:"100%" }}>
          <WebcamPanel
            focusScore={focusScore} setFocusScore={setFocusScore}
            sessionId={sessionId} isStarted={isStarted}
            videoRef={videoRef} setPlaybackRate={setPlaybackRate}
            autoStart={autoStartWebcam}
            onAutoStartDone={() => setAutoStartWebcam(false)}
            registerStart={(fn) => { webcamStartRef.current = fn }}
            pauseTick={pauseWebcam}
            onPauseDone={() => setPauseWebcam(false)}
            onFocusTick={(data, startSec, endSec) => {
              // video.currentTime 분 경계 기준 집계 → 배속과 무관하게 영상 시간과 일치
              const status = data.label === "focused" ? "focus" : "unfocus"
              const score       = Math.round(data.focus_score * 100)
              const minute      = data.minute
              const videoTimeSec = data.videoTimeSec ?? (minute * 60)
              setSegments(prev => [...prev, { start: startSec, end: endSec, status }])
              setFocusScores(prev => [...prev, { minute, score, videoTimeSec }])
            }}
          />

          {/* 적응형 뽀모도로 타이머 */}
          <PomodoroPanel focusScores={focusScores} isStarted={isStarted} />

          {/* 퀘스트 */}
          <div style={{ ...PANEL.wrap, flexShrink:0 }}>
            <div style={PANEL.header}>
              <div style={{ width:28, height:28, flexShrink:0,
                            backgroundImage:`url(${PLAYER_IMG})`,
                            backgroundRepeat:"no-repeat",
                            backgroundSize:`${192*1.3}px ${320*1.3}px`,
                            backgroundPosition:"0px 0px",
                            imageRendering:"pixelated" }} />
              <span style={PANEL.headerText}>퀘스트 현황</span>
              <div style={{ marginLeft:"auto", background:LIME_DARK, border:`2px solid ${PIX}`,
                            padding:"1px 8px",
                            fontSize:11, fontWeight:700, color:"#2a1a0a",
                            fontFamily:"monospace", clipPath:pixClip }}>
                {completedCount}/{quests.length}
              </div>
            </div>
            <div style={{ ...PANEL.body }}>
            {quests.map(q => (
              <div key={q.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                                       fontSize:11, padding:"6px 0", borderBottom:`2px solid ${LIME_HI}` }}>
                <span style={{ color: q.done ? LIME_DARK : "#2a1a0a", textDecoration: q.done ? "line-through" : "none",
                               fontFamily:"monospace" }}>
                  {q.title}
                </span>
                <span style={{ color:"#2a4a08", fontWeight:700,
                               fontSize:10, background: q.done ? LIME_HI : BODY_MAIN,
                               border:`2px solid ${PIX}`,
                               padding:"1px 6px", fontFamily:"monospace", clipPath:pixClip }}>
                  {q.done ? "완료" : "진행중"}
                </span>
              </div>
            ))}
            </div>{/* PANEL.body */}
          </div>{/* PANEL.wrap */}
        </div>
        </div>{/* flex wrapper */}
      </div>{/* relative outer */}

      {quizPopupOpen && (
        <QuizAfterLecture onClose={() => setQuizPopupOpen(false)}
          sessionId={sessionId} lecture={selectedLecture} segments={quizSegments}
          filename={
            selectedLecture?.filename ||
            (selectedLecture?.subject?.includes("생명") ? "bio_1.json" :
             selectedLecture?.subject?.includes("지구") ? "ear_1.json" :
             selectedLecture?.subject?.includes("사회") ? "peo_1.json" : "bio_1.json")
          }
          subject={selectedLecture?.subject ?? "고등학교 생명과학"} />
      )}

      {reviewOpen && reviewQueue.length > 0 && (
        <ReviewQueuePopup queue={reviewQueue} onClose={() => setReviewOpen(false)} sessionId={sessionId} />
      )}
    </div>
  )
}

// ── 집중도 타임라인 라인차트 ──
function FocusTimeline({ segments, focusScores, videoDuration, currentVideoTime, seekTime, onSeek }) {
  const W      = 600
  const H      = 120
  const PAD    = { top:16, right:12, bottom:28, left:36 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top  - PAD.bottom
  const dur    = Math.max(1, videoDuration)  // 초 단위 전체 길이
  const yTicks = [0, 25, 50, 75, 100]

  // X축: 초 단위 (videoDuration 기준), Y축: 점수(0~100)
  const toX = (sec)   => PAD.left + (sec / dur) * innerW
  const toY = (score) => PAD.top  + innerH - (score / 100) * innerH

  // 세그먼트 배경
  const segRects = segments.map(seg => ({
    x:     toX(seg.start),
    width: Math.max(1, toX(seg.end) - toX(seg.start)),
    color: seg.status === "focus" ? "#22c98a22" : "#f0606022",
    status: seg.status,
    start:  seg.start,
  }))

  // 라인 포인트 — videoTimeSec 우선, 없으면 minute*60
  const pts = focusScores.map(({ minute, score, videoTimeSec }) => {
    const sec = videoTimeSec ?? (minute * 60)
    return { x: toX(sec), y: toY(score), score, sec }
  })

  // 중복 x 방지: 같은 sec는 마지막 값만 사용
  const ptsUniq = pts.filter((p, i) =>
    i === pts.length - 1 || pts[i+1].sec !== p.sec
  )

  const linePath = ptsUniq.length > 1
    ? "M " + ptsUniq.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")
    : null

  // 현재 재생위치 커서
  const cursorX = videoDuration > 0 ? toX(currentVideoTime) : null

  // X축 눈금: 분 단위
  const totalMin = Math.ceil(dur / 60)
  const xTickMins = Array.from({ length: totalMin + 1 }, (_, i) => i)
    .filter(m => totalMin <= 10 || m % Math.ceil(totalMin / 8) === 0)

  return (
    <div style={{ marginBottom:8 }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}
        style={{ display:"block", overflow:"visible" }}>

        {/* 세그먼트 배경 */}
        {segRects.map((r, i) => (
          <rect key={i}
            x={r.x} y={PAD.top} width={Math.max(r.width, 1)} height={innerH}
            fill={r.color}
            style={{ cursor: r.status === "unfocus" ? "pointer" : "default" }}
            onClick={() => r.status === "unfocus" && onSeek(r.start)} />
        ))}

        {/* 그리드 수평선 */}
        {yTicks.map(t => (
          <g key={t}>
            <line x1={PAD.left} y1={toY(t)} x2={PAD.left + innerW} y2={toY(t)}
              stroke={t === 70 ? LIME_DARK : LIME_HI + "55"}
              strokeWidth={t === 70 ? 1 : 0.5}
              strokeDasharray={t === 70 ? "4,3" : "0"} />
            <text x={PAD.left - 4} y={toY(t) + 3.5}
              textAnchor="end" fontSize="8" fill="#3a5a10">{t}</text>
          </g>
        ))}

        {/* X축 눈금 (분 단위) */}
        {xTickMins.map(m => (
          <g key={m}>
            <line x1={toX(m*60)} y1={PAD.top + innerH}
              x2={toX(m*60)} y2={PAD.top + innerH + 3}
              stroke={LIME_HI} strokeWidth="0.5" />
            <text x={toX(m*60)} y={PAD.top + innerH + 11}
              textAnchor="middle" fontSize="8" fill="#3a5a10">{m}분</text>
          </g>
        ))}

        {/* 축 테두리 */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH}
          stroke={LIME_DARK} strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top + innerH}
          x2={PAD.left + innerW} y2={PAD.top + innerH}
          stroke={LIME_DARK} strokeWidth="1" />

        {/* 집중도 라인 — 영역 채우기 + 선 */}
        {linePath && (
          <>
            {/* 아래쪽 채움 */}
            <path
              d={linePath + ` L ${ptsUniq[ptsUniq.length-1].x.toFixed(1)},${(PAD.top+innerH).toFixed(1)} L ${ptsUniq[0].x.toFixed(1)},${(PAD.top+innerH).toFixed(1)} Z`}
              fill="url(#focusGrad)" opacity="0.35" />
            {/* 선 */}
            <path d={linePath} fill="none" stroke={LIME_DARK}
              strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}

        {/* 그라데이션 정의 */}
        <defs>
          <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LIME_MAIN} stopOpacity="0.8"/>
            <stop offset="100%" stopColor={LIME_HI} stopOpacity="0.1"/>
          </linearGradient>
        </defs>

        {/* 데이터 포인트 */}
        {ptsUniq.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4"
              fill={p.score >= 70 ? "#22c98a" : "#f06060"}
              stroke={BODY_HI} strokeWidth="1.5" />
            <title>{Math.round(p.sec/60)}분: {p.score}점</title>
          </g>
        ))}

        {/* 현재 재생 위치 커서 */}
        {cursorX && (
          <line x1={cursorX} y1={PAD.top} x2={cursorX} y2={PAD.top + innerH}
            stroke={LIME_DARK} strokeWidth="1.5" opacity="0.8"
            strokeDasharray="3,2" />
        )}

      </svg>

      {/* 데이터 없을 때 안내 */}
      {focusScores.length === 0 && (
        <div style={{ textAlign:"center", fontSize:10, color:"#3a5a10", marginTop:4, fontFamily:"monospace" }}>
          수강 시작 후 1분마다 집중도 포인트가 표시돼요
        </div>
      )}
    </div>
  )
}

// ── 실시간 집중도 라인차트 (최근 60초, 1초 단위) ──
function LiveFocusChart({ scores, threshold = 70 }) {
  const W = 240, H = 50
  const PAD = { top:4, right:4, bottom:4, left:4 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  // 60개 슬롯 기준 (오른쪽이 가장 최근)
  const N = 60
  const startIdx = Math.max(0, N - scores.length)

  const toX = (i) => PAD.left + (i / (N - 1)) * innerW
  const toY = (s) => PAD.top + innerH - (s / 100) * innerH
  const yThreshold = toY(threshold)

  // 패스 생성
  const pts = scores.map((p, i) => ({ x: toX(startIdx + i), y: toY(p.score), score: p.score }))
  const linePath = pts.length > 1
    ? "M " + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")
    : ""

  // 영역 채우기 (라인 아래)
  const areaPath = pts.length > 1
    ? linePath + ` L ${pts[pts.length-1].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)}`
                + ` L ${pts[0].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`
    : ""

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
         style={{ display:"block", background:BODY_MAIN, borderRadius:0 }}>
      {/* 격자 */}
      <line x1={PAD.left} y1={toY(100)} x2={W-PAD.right} y2={toY(100)} stroke={LIME_HI} strokeWidth="0.5" />
      <line x1={PAD.left} y1={toY(50)}  x2={W-PAD.right} y2={toY(50)}  stroke={LIME_HI} strokeWidth="0.5" strokeDasharray="2,2" />
      <line x1={PAD.left} y1={toY(0)}   x2={W-PAD.right} y2={toY(0)}   stroke={LIME_HI} strokeWidth="0.5" />

      {/* 임계선 */}
      <line x1={PAD.left} y1={yThreshold} x2={W-PAD.right} y2={yThreshold}
            stroke={LIME_DARK} strokeWidth="0.6" strokeDasharray="3,2" opacity="0.7" />

      {/* 영역 */}
      {areaPath && <path d={areaPath} fill={LIME_MAIN} opacity="0.18" />}

      {/* 라인 */}
      {linePath && <path d={linePath} fill="none" stroke={LIME_DARK} strokeWidth="1.5"
                          strokeLinejoin="round" strokeLinecap="round" />}

      {/* 가장 최근 점 강조 */}
      {pts.length > 0 && (() => {
        const last = pts[pts.length - 1]
        const isHigh = last.score >= threshold
        return (
          <circle cx={last.x} cy={last.y} r="2.5"
                  fill={isHigh ? LIME_DARK : "#e43b44"}
                  stroke={BODY_HI} strokeWidth="1" />
        )
      })()}
    </svg>
  )
}

// ── 웹캠 패널 ──
function WebcamPanel({ focusScore, setFocusScore, sessionId, isStarted,
                       videoRef: lectureVideoRef, setPlaybackRate, onFocusTick,
                       autoStart, onAutoStartDone, registerStart,
                       pauseTick, onPauseDone }) {
  const [cvActive, setCvActive]     = useState(false)
  const [focusLabel, setFocusLabel] = useState("focused")
  const [isWriting, setIsWriting]   = useState(false)
  const [loading, setLoading]       = useState(false)
  const [tickCount, setTickCount]   = useState(0)
  const [liveScores, setLiveScores] = useState([])  // 1초마다 받는 실시간 점수 [{t, score}] (최근 60초만 유지)
  const [currentScore, setCurrentScore] = useState(0)  // 가장 최근 1초 점수

  const tickBufferRef  = useRef([])
  const tickCountRef   = useRef(0)
  const webcamVideoRef = useRef(null)
  const canvasRef      = useRef(null)
  const intervalRef    = useRef(null)
  const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const COLOR = { focused:"#22c98a", unfocused:"#f06060" }
  const LABEL = { focused:"집중 중",  unfocused:"미집중"   }

  async function startWebcam() {
    setLoading(true)
    tickBufferRef.current = []; tickCountRef.current = 0; setTickCount(0)  // videoTime reset
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      webcamVideoRef.current.srcObject = stream
      setCvActive(true)
    } catch { console.warn("웹캠 없음 → 더미 모드"); setCvActive(true) }
    finally { setLoading(false) }
    startPolling()
  }

  // 영상 재생 → 웹캠 자동 ON / 재개
  useEffect(() => {
    if (!autoStart) return
    if (!cvActive) {
      // 처음 시작
      startWebcam()
    } else if (!intervalRef.current) {
      // 일시정지 후 재개 — 폴링만 다시 시작
      startPolling()
    }
    if (onAutoStartDone) onAutoStartDone()
  }, [autoStart])

  // 영상 일시정지 → 폴링 중단, 재생 → 재개
  useEffect(() => {
    if (pauseTick && cvActive) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      if (onPauseDone) onPauseDone()
    }
  }, [pauseTick])

  // 부모에 startWebcam 함수 등록
  useEffect(() => {
    if (registerStart) registerStart(startWebcam)
  }, [])

  function startPolling() {
    if (intervalRef.current) return

    let segStartTime  = lectureVideoRef?.current
      ? Math.floor(lectureVideoRef.current.currentTime) : 0
    let periodStart   = Date.now()  // 1분 구간 시작 실시간

    intervalRef.current = setInterval(async () => {
      const canvas = canvasRef.current
      const video  = webcamVideoRef.current
      if (canvas && video && video.srcObject) {
        canvas.width = video.videoWidth || 320; canvas.height = video.videoHeight || 240
        canvas.getContext("2d").drawImage(video, 0, 0)
      } else { canvas.width = 320; canvas.height = 240 }

      const base64    = canvas.toDataURL("image/jpeg", 0.7)
      const videoTime = lectureVideoRef?.current
        ? Math.floor(lectureVideoRef.current.currentTime) : 0

      // 실제 경과 시간 계산 (ms)
      const elapsed = Date.now() - periodStart
      setTickCount(Math.min(60, Math.floor(elapsed / 1000)))  // 0~60 표시

      try {
        const res = await fetch(`${BASE}/focus/tick`, {
          method:"POST", headers:{ "Content-Type":"application/json", "X-User-Id":"1" },
          body: JSON.stringify({ session_id: sessionId, image_base64: base64, video_time_sec: videoTime }),
        })
        const data = await res.json()

        // 필기 감지 + 배속은 1초마다 즉시 반영
        setIsWriting(data.is_writing ?? false)
        if (lectureVideoRef?.current)
          lectureVideoRef.current.playbackRate = data.suggested_playback_rate ?? 1.0
        if (setPlaybackRate) setPlaybackRate(data.suggested_playback_rate ?? 1.0)

        // 실시간 1초 점수 차트용 (최근 60초만 유지)
        const liveScore = Math.round((data.focus_score ?? 0) * 100)
        setCurrentScore(liveScore)
        setLiveScores(prev => {
          const next = [...prev, { t: Date.now(), score: liveScore }]
          return next.length > 60 ? next.slice(-60) : next
        })

        // 버퍼에 label 추가
        const rawLabel = data.label === "focused" ? "focused" : "unfocused"
        tickBufferRef.current.push(rawLabel)

        // 실제 경과 60초 기준 집계
        if (elapsed >= 60000) {
          const buf          = tickBufferRef.current
          const focusedCount = buf.filter(l => l === "focused").length
          const finalPct     = Math.round(focusedCount / buf.length * 100)
          const finalLabel   = finalPct >= FOCUS_THRESHOLD ? "focused" : "unfocused"
          const minute       = Math.round(videoTime / 60)

          setFocusScore(finalPct)
          setFocusLabel(finalLabel)
          if (onFocusTick) onFocusTick(
            { focus_score: finalPct / 100, label: finalLabel, minute, videoTimeSec: videoTime },
            segStartTime, videoTime
          )

          // 초기화
          tickBufferRef.current = []
          periodStart  = Date.now()
          segStartTime = videoTime
          setTickCount(0)
        }

      } catch {
        // 백엔드 연결 실패 시 더미
        const dummyLabel = Math.random() > (1 - FOCUS_THRESHOLD / 100) ? "focused" : "unfocused"
        tickBufferRef.current.push(dummyLabel)

        // 더미 모드에서도 실시간 1초 점수 차트 갱신
        const dummyLiveScore = dummyLabel === "focused"
          ? 70 + Math.floor(Math.random() * 30)
          : Math.floor(Math.random() * 60)
        setCurrentScore(dummyLiveScore)
        setLiveScores(prev => {
          const next = [...prev, { t: Date.now(), score: dummyLiveScore }]
          return next.length > 60 ? next.slice(-60) : next
        })

        if (elapsed >= 60000) {
          const buf      = tickBufferRef.current
          const dummyPct = Math.round(buf.filter(l => l === "focused").length / buf.length * 100)
          const dummyLbl = dummyPct >= FOCUS_THRESHOLD ? "focused" : "unfocused"
          const minute   = Math.round(videoTime / 60)

          setFocusScore(dummyPct)
          setFocusLabel(dummyLbl)
          if (onFocusTick) onFocusTick(
            { focus_score: dummyPct / 100, label: dummyLbl, minute, videoTimeSec: videoTime },
            segStartTime, videoTime
          )

          tickBufferRef.current = []
          periodStart  = Date.now()
          segStartTime = videoTime
          setTickCount(0)
        }
      }
    }, 1000)
  }


  function stopWebcam() {
    clearInterval(intervalRef.current); intervalRef.current = null
    tickBufferRef.current = []; tickCountRef.current = 0; setTickCount(0)
    setLiveScores([]); setCurrentScore(0)
    if (webcamVideoRef.current?.srcObject) {
      webcamVideoRef.current.srcObject.getTracks().forEach(t => t.stop())
      webcamVideoRef.current.srcObject = null
    }
    setCvActive(false); setFocusScore(0); setFocusLabel("focused"); setIsWriting(false)
    if (setPlaybackRate) setPlaybackRate(1.0)
    if (lectureVideoRef?.current) lectureVideoRef.current.playbackRate = 1.0
  }

  useEffect(() => () => {
    clearInterval(intervalRef.current)
    if (webcamVideoRef.current?.srcObject)
      webcamVideoRef.current.srcObject.getTracks().forEach(t => t.stop())
  }, [])

  const curColor = COLOR[focusLabel] ?? LIME_DARK
  const curLabel = LABEL[focusLabel] ?? "집중 중"

  return (
    <div style={{ ...PANEL.wrap, flexShrink:0 }}>
      {/* 웹캠 헤더 */}
      <div style={PANEL.header}>
        <span style={PANEL.headerText}>📷 웹캠</span>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, fontSize:10 }}>
          {/* 배속 표시 */}
          {cvActive && (
            <span style={{ background:PIX, borderRadius:0,
                           padding:"1px 6px", color:LIME_HI, fontWeight:700, fontSize:10,
                           fontFamily:"monospace" }}>
              {lectureVideoRef?.current?.playbackRate?.toFixed(1) ?? "1.0"}x
            </span>
          )}
          {loading ? (
            <span style={{ color:LIME_MAIN, fontFamily:"monospace" }}>⏳ 연결 중...</span>
          ) : cvActive && intervalRef.current ? (
            <>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#f06060",
                            animation:"pulse 1.5s infinite" }} />
              <span style={{ color:"#f06060", fontWeight:700, fontFamily:"monospace" }}>측정 중</span>
              {isWriting && <span style={{ color:LIME_MAIN, fontFamily:"monospace" }}>✏️</span>}
            </>
          ) : cvActive ? (
            <span style={{ color:LIME_MAIN, fontFamily:"monospace" }}>⏸ 일시정지</span>
          ) : (
            <span style={{ color:LIME_DARK, fontWeight:700, fontFamily:"monospace" }}>대기 중</span>
          )}
        </div>
      </div>
      <div style={{ ...PANEL.body, padding:"10px" }}>
      {/* 웹캠 화면 */}
      <canvas ref={canvasRef} style={{ display:"none" }} />
      <div style={{ position:"relative", overflow:"hidden",
                    background:"#2a1a0a", height:300, flexShrink:0 }}>
        <video ref={webcamVideoRef} autoPlay muted
          style={{ width:"100%", height:"100%",
                   display: cvActive ? "block" : "none",
                   objectFit:"cover" }} />
        {!cvActive && !loading && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", color:LIME_DARK }}>
            <div style={{ fontSize:32 }}>📷</div>
            <div style={{ fontSize:10, color:LIME_DARK, marginTop:4, fontFamily:"monospace" }}>영상 재생 시 자동 시작</div>
          </div>
        )}
        {loading && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", color:LIME_DARK }}>
            <div style={{ fontSize:20 }}>⏳</div>
            <div style={{ fontSize:10, color:LIME_DARK, marginTop:4, fontFamily:"monospace" }}>웹캠 연결 중...</div>
          </div>
        )}
        {isWriting && cvActive && (
          <div style={{ position:"absolute", top:6, right:6, background:PIX,
                        border:`2px solid ${LIME_DARK}`,
                        padding:"2px 8px", fontSize:9, color:LIME_HI, fontWeight:700,
                        fontFamily:"monospace" }}>
            ✏️ 필기 중
          </div>
        )}
      </div>

      {/* 실시간 집중도 차트 (1초마다 업데이트, 최근 60초) */}
      {cvActive && (
        <div style={{ marginTop:10, padding:"8px 10px", background:LIME_HI,
                      border:`2px solid ${PIX}`, clipPath:pixClip }}>
          <div style={{ display:"flex", justifyContent:"space-between",
                        alignItems:"center", marginBottom:4 }}>
            <span style={{ fontSize:10, color:"#3a5a10", fontWeight:700, fontFamily:"monospace" }}>📈 실시간 집중도</span>
            <span style={{ fontSize:14, fontWeight:700,
                            color: currentScore >= FOCUS_THRESHOLD ? "#22c98a" : "#f06060" }}>
              {currentScore}점
            </span>
          </div>
          <LiveFocusChart scores={liveScores} threshold={FOCUS_THRESHOLD} />
          <div style={{ display:"flex", justifyContent:"space-between",
                        fontSize:8, color:"#3a5a10", marginTop:2, fontFamily:"monospace" }}>
            <span>-60초</span>
            <span>지금</span>
          </div>
        </div>
      )}

      {/* 1분 집계 진행 바 */}
      {cvActive && (
        <div style={{ marginTop:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between",
                        fontSize:9, color:LIME_DARK, marginBottom:3, fontFamily:"monospace" }}>
            <span>1분 집계</span>
            <span>{tickCount}/60초</span>
          </div>
          <div style={{ height:3, background:LIME_HI, borderRadius:0, overflow:"hidden" }}>
            <div style={{ width:`${(tickCount/60)*100}%`, height:"100%",
                          background:LIME_DARK,
                          transition:"width 1s linear" }} />
          </div>
          {focusScore > 0 && (
            <div style={{ marginTop:6, display:"flex", justifyContent:"space-between",
                          alignItems:"center" }}>
              <span style={{ fontSize:10, color:LIME_DARK, fontFamily:"monospace" }}>최근 1분</span>
              <span style={{ fontSize:13, fontWeight:700, color: curColor }}>
                {focusScore}점
              </span>
            </div>
          )}
        </div>
      )}


      <button onClick={cvActive ? stopWebcam : startWebcam} disabled={loading}
        style={{ width:"100%", marginTop:8, padding:"6px 0",
                 background: loading ? "#c0cbdc" : cvActive ? "#e43b44" : LIME_MAIN,
                 border:`2px solid ${PIX}`, borderBottom:`4px solid ${PIX}`,
                 boxShadow:`inset 0 2px 0 ${loading?"#ffffff":cvActive?"#ee686e":LIME_HI}`,
                 color: loading ? "#8b9bb4" : cvActive ? "#FFFDD0" : "#2a1a0a",
                 fontWeight:700, cursor:loading?"not-allowed":"pointer", fontSize:12,
                 fontFamily:"monospace", clipPath:pixClip, opacity:loading?0.7:1 }}>
        {loading ? "연결 중..." : cvActive ? "⏹ 끄기" : "▶ 켜기"}
      </button>
      </div>{/* PANEL.body */}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}

// ── 적응형 뽀모도로 타이머 ──
// 분당 점수(focusScores)를 기반으로 동작:
//  - 10분 연속 미집중(< FOCUS_THRESHOLD) → 자동으로 휴식 모드 전환
//  - 10분 연속 집중(>= FOCUS_THRESHOLD) → 집중 시간 자동 5분 연장 (1회당 1번)
//  - on/off 토글
//  - 오늘의 뽀모도로 횟수 (localStorage에 저장, 자정 리셋)
function PomodoroPanel({ focusScores, isStarted }) {
  const FOCUS_DURATION_DEFAULT = 25 * 60   // 25분
  const BREAK_DURATION         = 5  * 60   // 5분
  const STREAK_THRESHOLD       = 10        // 연속 10분 기준
  const EXTEND_BY              = 5  * 60   // 연장 5분

  const [enabled, setEnabled]               = useState(true)
  const [mode, setMode]                     = useState("focus")  // "focus" | "break"
  const [secondsLeft, setSecondsLeft]       = useState(FOCUS_DURATION_DEFAULT)
  const [running, setRunning]               = useState(false)
  const [todayCount, setTodayCount]         = useState(0)
  const [extendCount, setExtendCount]       = useState(0)  // 현재 사이클에서 연장 횟수
  const [autoEvent, setAutoEvent]           = useState("") // 최근 자동 동작 표시
  const lastProcessedMinuteRef              = useRef(-1)
  const extendedAtRef                       = useRef(new Set())  // 어떤 minute에서 연장했는지 (중복 방지)

  // 오늘 횟수 로드 (localStorage, 날짜별)
  useEffect(() => {
    const key = `pomodoro_${new Date().toISOString().slice(0,10)}`
    const saved = parseInt(localStorage.getItem(key) || "0", 10)
    setTodayCount(saved)
  }, [])

  // 횟수 증가 → localStorage 저장
  function incrementTodayCount() {
    const key = `pomodoro_${new Date().toISOString().slice(0,10)}`
    setTodayCount(prev => {
      const next = prev + 1
      localStorage.setItem(key, String(next))
      return next
    })
  }

  // 강의 시작 → 자동으로 타이머 시작
  useEffect(() => {
    if (enabled && isStarted && !running && secondsLeft > 0) {
      setRunning(true)
    }
  }, [isStarted, enabled])

  // 1초 카운트다운
  useEffect(() => {
    if (!enabled || !running) return
    const t = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          // 시간 끝 → 모드 전환
          if (mode === "focus") {
            incrementTodayCount()
            setMode("break")
            setExtendCount(0)
            extendedAtRef.current = new Set()
            setAutoEvent("⏸ 휴식 시작")
            return BREAK_DURATION
          } else {
            setMode("focus")
            setAutoEvent("▶ 집중 시간 시작")
            return FOCUS_DURATION_DEFAULT
          }
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [enabled, running, mode])

  // 분당 점수 변화 감지 → 적응형 동작
  useEffect(() => {
    if (!enabled || focusScores.length === 0) return
    const latest = focusScores[focusScores.length - 1]
    if (latest.minute === lastProcessedMinuteRef.current) return
    lastProcessedMinuteRef.current = latest.minute

    // 최근 STREAK_THRESHOLD분 추출
    if (focusScores.length < STREAK_THRESHOLD) return
    const recent = focusScores.slice(-STREAK_THRESHOLD)
    const allUnfocus = recent.every(s => s.score < FOCUS_THRESHOLD)
    const allFocus   = recent.every(s => s.score >= FOCUS_THRESHOLD)

    // 10분 연속 미집중 → 휴식 자동 전환 (focus 모드일 때만)
    if (allUnfocus && mode === "focus" && running) {
      setMode("break")
      setSecondsLeft(BREAK_DURATION)
      setExtendCount(0)
      extendedAtRef.current = new Set()
      setAutoEvent("⚠ 10분 연속 미집중 → 자동 휴식")
      return
    }

    // 10분 연속 집중 → 집중 시간 연장 (focus 모드일 때만, 같은 minute에서 중복 연장 방지)
    if (allFocus && mode === "focus" && running && !extendedAtRef.current.has(latest.minute)) {
      extendedAtRef.current.add(latest.minute)
      setSecondsLeft(prev => prev + EXTEND_BY)
      setExtendCount(prev => prev + 1)
      setAutoEvent(`✨ 10분 연속 집중 → +5분 연장`)
    }
  }, [focusScores, mode, running, enabled])

  // 자동 이벤트 메시지 5초 후 자동 제거
  useEffect(() => {
    if (!autoEvent) return
    const t = setTimeout(() => setAutoEvent(""), 5000)
    return () => clearTimeout(t)
  }, [autoEvent])

  function toggleEnabled() {
    if (enabled) {
      // 끄기 → 정지 + 리셋
      setRunning(false)
      setMode("focus")
      setSecondsLeft(FOCUS_DURATION_DEFAULT)
      setExtendCount(0)
      extendedAtRef.current = new Set()
      setAutoEvent("")
    }
    setEnabled(prev => !prev)
  }

  function toggleRunning() {
    if (!enabled) return
    setRunning(prev => !prev)
  }

  function resetTimer() {
    setMode("focus")
    setSecondsLeft(FOCUS_DURATION_DEFAULT)
    setExtendCount(0)
    extendedAtRef.current = new Set()
    setRunning(false)
    setAutoEvent("")
  }

  const minutes      = Math.floor(secondsLeft / 60)
  const seconds      = secondsLeft % 60
  const totalForMode = mode === "focus" ? FOCUS_DURATION_DEFAULT + extendCount * EXTEND_BY : BREAK_DURATION
  const progress     = ((totalForMode - secondsLeft) / totalForMode) * 100

  return (
    <div style={{ ...PANEL.wrap, flexShrink:0 }}>
      <div style={PANEL.header}>
        <span style={PANEL.headerText}>🍅 적응형 뽀모도로</span>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:10, color:LIME_MAIN, fontFamily:"monospace" }}>오늘 {todayCount}회</span>
          {/* on/off 토글 */}
          <button onClick={toggleEnabled}
            style={{ width:36, height:18,
                     background: enabled ? LIME_MAIN : "#c0cbdc",
                     border:`2px solid ${PIX}`, position:"relative",
                     cursor:"pointer", padding:0, clipPath:pixClip }}>
            <div style={{ position:"absolute", top:2, left: enabled ? 18 : 2,
                          width:12, height:12,
                          background: enabled ? "#2a4a08" : "#8b9bb4",
                          border:`1px solid ${PIX}`, transition:"left 0.2s" }} />
          </button>
        </div>
      </div>
      <div style={{ ...PANEL.body, padding:"12px" }}>
        {!enabled ? (
          <div style={{ textAlign:"center", padding:"16px 0", fontSize:11, color:"#3a5a10", fontFamily:"monospace" }}>
            뽀모도로가 꺼져 있어요
          </div>
        ) : (
          <>
            {/* 원형 뽀모도로 타이머 */}
            {(() => {
              const R = 50, CX = 75, CY = 75, SW = 12
              const CIRC = 2 * Math.PI * R
              const offset = CIRC * (1 - progress / 100)
              const trackColor = mode === "focus" ? LIME_HI : BODY_MAIN
              const fillColor  = mode === "focus" ? LIME_DARK : BODY_DARK
              return (
                <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}>
                  <svg width={150} height={150} viewBox="0 0 150 150" style={{ display:"block" }}>
                    {/* 중앙 배경 */}
                    <circle cx={CX} cy={CY} r={R - SW/2 - 3} fill={BODY_MAIN} />
                    <circle cx={CX} cy={CY} r={R - SW/2 - 3} fill="none" stroke={PIX} strokeWidth={2} />
                    {/* 외곽 경계 */}
                    <circle cx={CX} cy={CY} r={R + SW/2 + 2} fill="none" stroke={PIX} strokeWidth={2} />
                    {/* 트랙 */}
                    <circle cx={CX} cy={CY} r={R} fill="none" stroke={trackColor} strokeWidth={SW} />
                    {/* 진행 호 */}
                    <circle cx={CX} cy={CY} r={R} fill="none"
                      stroke={fillColor} strokeWidth={SW}
                      strokeDasharray={CIRC} strokeDashoffset={offset}
                      strokeLinecap="butt"
                      style={{ transform:`rotate(-90deg)`, transformOrigin:`${CX}px ${CY}px`,
                               transition:"stroke-dashoffset 1s linear" }} />
                    {/* 모드 */}
                    <text x={CX} y={CY - 8} textAnchor="middle"
                      fontSize={9} fontWeight={700} fill="#3a5a10" fontFamily="monospace">
                      {mode === "focus" ? "집중 시간" : "휴식 시간"}{mode === "focus" && extendCount > 0 ? ` +${extendCount*5}분` : ""}
                    </text>
                    {/* 시간 */}
                    <text x={CX} y={CY + 14} textAnchor="middle" dominantBaseline="middle"
                      fontSize={24} fontWeight={700} fill="#2a1a0a" fontFamily="'Courier New',monospace">
                      {String(minutes).padStart(2,"0")}:{String(seconds).padStart(2,"0")}
                    </text>
                  </svg>
                </div>
              )
            })()}

            {/* 자동 이벤트 메시지 */}
            {autoEvent && (
              <div style={{ fontSize:10, color:"#2a4a08", textAlign:"center",
                            background:LIME_HI, border:`2px solid ${PIX}`,
                            clipPath:pixClip, padding:"4px 6px", marginBottom:8,
                            fontFamily:"monospace" }}>
                {autoEvent}
              </div>
            )}

            {/* 컨트롤 버튼 */}
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={toggleRunning}
                style={{ flex:1, padding:"6px 0",
                         background: running ? "#e43b44" : LIME_MAIN,
                         border:`2px solid ${PIX}`, borderBottom:`4px solid ${PIX}`,
                         boxShadow:`inset 0 2px 0 ${running ? "#ee686e" : LIME_HI}`,
                         color: running ? "#FFFDD0" : "#2a1a0a",
                         fontWeight:700, cursor:"pointer", fontSize:11,
                         fontFamily:"monospace", clipPath:pixClip }}>
                {running ? "⏸ 일시정지" : "▶ 시작"}
              </button>
              <button onClick={resetTimer}
                style={{ padding:"6px 12px", background:BODY_MAIN,
                         border:`2px solid ${PIX}`, borderBottom:`4px solid ${PIX}`,
                         boxShadow:`inset 0 2px 0 ${BODY_HI}`,
                         color:"#2a4a08", fontWeight:700, cursor:"pointer", fontSize:11,
                         fontFamily:"monospace", clipPath:pixClip }}>
                ↺
              </button>
            </div>

            {/* 안내 */}
            <div style={{ marginTop:8, fontSize:9, color:"#3a5a10", lineHeight:1.5, fontFamily:"monospace" }}>
              💡 10분 연속 집중 시 자동 +5분 연장<br/>
              💡 10분 연속 미집중 시 자동 휴식 전환
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── 공통 팝업 컴포넌트 ──
function LecturePopup({ children, onClose, wide, title, icon }) {
  const px = 3
  const hdrBg = `linear-gradient(180deg,${LIME_HI} 0,${LIME_HI} ${px}px,${LIME_MAIN} ${px}px,${LIME_MAIN} calc(100% - ${px*2}px),${LIME_DARK} calc(100% - ${px*2}px),${LIME_DARK} calc(100% - ${px}px),${PIX} calc(100% - ${px}px),${PIX} 100%)`
  const bodyBg = `linear-gradient(180deg,${BODY_HI} 0,${BODY_HI} ${px}px,${BODY_MAIN} ${px}px,${BODY_MAIN} calc(100% - ${px*2}px),${BODY_DARK} calc(100% - ${px*2}px),${BODY_DARK} calc(100% - ${px}px),${PIX} calc(100% - ${px}px),${PIX} 100%)`
  const hdrClip = `polygon(${px}px 0,calc(100% - ${px}px) 0,100% ${px}px,100% 100%,0 100%,0 ${px}px)`
  const bodyClip = `polygon(0 0,100% 0,100% calc(100% - ${px}px),calc(100% - ${px}px) calc(100% - ${px}px),calc(100% - ${px}px) 100%,${px}px 100%,${px}px calc(100% - ${px}px),0 calc(100% - ${px}px))`
  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(20,10,0,0.55)", zIndex:200 }} />
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
                    zIndex:201, width: wide ? "min(700px,94vw)" : "min(480px,92vw)",
                    maxHeight:"92vh", display:"flex", flexDirection:"column",
                    boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
        <div style={{ background:hdrBg, boxShadow:sideShadow, padding:`${px*3}px ${px*4}px`,
                      minHeight:48, display:"flex", alignItems:"center", gap:8, clipPath:hdrClip }}>
          {icon && <span style={{ fontSize:18, lineHeight:1 }}>{icon}</span>}
          <span style={{ fontSize:14, fontWeight:700, color:"#2a1a0a", fontFamily:"monospace",
                         flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{title}</span>
          <button onClick={onClose} style={{
            flexShrink:0, width:26, height:26, background:"#e43b44",
            border:`2px solid ${PIX}`,
            boxShadow:"inset 0 2px 0 #ee686e, inset 0 -2px 0 #9e2835",
            color:"#fff", fontSize:14, fontWeight:900, cursor:"pointer", outline:"none", padding:0,
            display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1,
            clipPath:"polygon(3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px),0 3px)",
          }}>✕</button>
        </div>
        <div style={{ background:bodyBg, boxShadow:sideShadow,
                      padding:`${px*4}px ${px*5}px ${px*5}px`,
                      color:"#2a1a0a", fontFamily:"monospace",
                      overflowY:"auto", maxHeight:"85vh", flex:1, clipPath:bodyClip }}>
          {children}
        </div>
      </div>
    </>
  )
}

// ── 강의 종료 후 퀴즈 팝업 ──
// segments prop = 미집중 구간 분 단위 timestamps 배열 (예: [3, 7, 12])
function QuizAfterLecture({ onClose, sessionId, lecture, segments }) {
  const [step, setStep]             = useState("intro")
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState("")
  const [loading, setLoading]       = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [scoreData, setScoreData]   = useState(null)
  const chatRef = useRef(null)

  function scrollBottom() { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }

  // 퀴즈 시작 — LLM 세션 초기화
  async function startQuiz() {
    setStep("chat"); setLoading(true)
    try {
      const filename = SUBJECT_TO_FILE[lecture?.subject] ?? "bio_1.json"
      const res = await fetch(`${LLM_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lecture_filename:  filename,
          subject:           lecture?.subject ?? "강의",
          focus_timestamps:  segments,          // 분 단위 배열
        }),
      })
      const data = await res.json()
      setMessages([{ type:"npc", text: (data.reply ?? "").replace(/\s*\[/g, "\n\n[") }])
    } catch(e) {
      setMessages([{ type:"npc", text:"강의 내용을 퀴즈로 확인해볼게요! 준비됐으면 답해보세요 😊" }])
    } finally { setLoading(false); setTimeout(scrollBottom, 50) }
  }

  // 답변 전송 — LLM에 메시지 전달
  async function sendAnswer() {
    if (!input.trim() || loading || isFinished) return
    const txt = input.trim(); setInput("")
    setMessages(prev => [...prev, { type:"user", text:txt }])
    setLoading(true)
    try {
      const res = await fetch(`${LLM_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: txt }),
      })
      const data = await res.json()

      // 재질문 알림
      if (data.is_reask) {
        setMessages(prev => [...prev, { type:"system", text:"🔁 이해도가 낮았던 내용을 다시 질문할게요" }])
      }

      // NPC 응답
      setMessages(prev => [...prev, { type:"npc", text: (data.reply ?? "").replace(/\s*\[/g, "\n\n[") }])

      // ── 점수 카드: 오른쪽 패널(scoreData)에만 표시 + 백엔드 저장 ──
      if (data.score_data) {
        const sd = data.score_data
        setScoreData(sd)

        // 백엔드에 점수 저장
        fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/quiz/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": "1" },
          body: JSON.stringify({
            lecture_title:    lecture?.title ?? "강의",
            total:            sd.total,
            concept:          sd.concept,
            accuracy:         sd.accuracy,
            detail:           sd.detail,
            similarity:       sd.similarity ?? 0,
            matched_keywords: sd.matched_keywords ?? [],
            missing_keywords: sd.missing_keywords ?? [],
            match_result:     sd.match ?? "",
            comment:          sd.comment ?? "",
          }),
        }).catch(() => {})
      }

      // 종료 처리
      if (data.is_finished) {
        setIsFinished(true)
        setTimeout(() => setStep("done"), 800)
      }
    } catch(e) {
      setMessages(prev => [...prev, { type:"npc", text:"(연결 오류) LLM 서버를 확인해주세요." }])
    } finally { setLoading(false); setTimeout(scrollBottom, 50) }
  }

  return (
    <LecturePopup onClose={onClose} wide title="강의 퀴즈" icon="🐾">
      {step === "intro" && (
        <div style={{ textAlign:"center", paddingBottom:"20px" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🐻‍❄️</div>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:8, color:"#2a1a0a" }}>강의 수고하셨어요!</div>
          <div style={{ fontSize:13, color:"#3a5a10", marginBottom:20, lineHeight:1.6 }}>
            {lecture?.title ?? "강의"} 수강이 완료됐어요.<br/>
            미집중 구간 <strong style={{ color:LIME_DARK }}>{segments.length}개</strong>가 감지됐어요.<br/>
            포석호와 함께 퀴즈로 복습해볼까요?
          </div>
          {segments.length > 0 && (
            <div style={{ background:LIME_HI, border:`2px solid ${PIX}`, clipPath:pixClip,
                          boxShadow:sideShadow, padding:"10px 14px", marginBottom:20, textAlign:"left" }}>
              <div style={{ fontSize:11, color:"#3a5a10", fontWeight:700, marginBottom:6 }}>📌 미집중 구간</div>
              {segments.slice(0,3).map((seg,i) => (
                <div key={i} style={{ fontSize:11, color:"#2a4a08", padding:"3px 0" }}>
                  {formatTime(seg.start ?? 0)} ~ {formatTime(seg.end ?? 0)}
                </div>
              ))}
            </div>
          )}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose}
              style={{ flex:1, padding:"10px 0", background:BODY_MAIN, border:`2px solid ${PIX}`,
                       color:"#2a4a08", fontSize:13, cursor:"pointer", clipPath:pixClip,
                       fontFamily:"monospace" }}>
              📅 나중에 하기
            </button>
            <button onClick={startQuiz}
              style={{ flex:2, padding:"10px 0", background:LIME_MAIN, border:`2px solid ${PIX}`,
                       borderBottom:`4px solid ${PIX}`,
                       boxShadow:`inset 0 2px 0 ${LIME_HI}`,
                       color:"#2a1a0a", fontSize:13, fontWeight:700, cursor:"pointer",
                       clipPath:pixClip, fontFamily:"monospace" }}>
              🐾 퀴즈 시작하기
            </button>
          </div>
          <div style={{ marginTop:10, fontSize:10, color:"#555", fontFamily:"monospace" }}>
            나중에 하기 → 홈 포석호에서 다시 풀 수 있어요
          </div>
        </div>
      )}

      {step === "chat" && (
        <div>
          {/* 헤더 */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ fontSize:24 }}>🐻‍❄️</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#2a1a0a" }}>포석호와 퀴즈</div>
            <div style={{ marginLeft:"auto", fontSize:11,
                          color: isFinished ? LIME_DARK : "#3a5a10", fontFamily:"monospace" }}>
              {isFinished ? "완료 ✅" : "진행중..."}
            </div>
          </div>
          <div style={{ height:4, background:LIME_HI, overflow:"hidden", marginBottom:12 }}>
            <div style={{ width: isFinished ? "100%" : "50%", height:"100%",
                          background:LIME_DARK, transition:"width 0.4s" }} />
          </div>

          {/* ── 2컬럼 레이아웃: 채팅(좌) + 분석(우) ── */}
          <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>

            {/* 왼쪽: 채팅 영역 */}
            <div style={{ flex:"1 1 0", minWidth:0, display:"flex", flexDirection:"column" }}>
              <div ref={chatRef}
                style={{ height:360, overflowY:"auto", display:"flex", flexDirection:"column", gap:6,
                         borderTop:`3px solid ${PIX}`, paddingTop:10, marginBottom:10 }}>
                {messages.map((m,i) => (
                  <div key={i} style={{ display:"flex",
                                         justifyContent: m.type==="user" ? "flex-end"
                                                       : m.type==="system" ? "center"
                                                       : "flex-start",
                                         alignItems:"flex-end", gap:4 }}>
                    {m.type==="npc" && <span style={{ fontSize:14, flexShrink:0 }}>🐻‍❄️</span>}
                    {m.type==="system" && (
                      <div style={{ fontSize:10, color:"#3a5a10", background:LIME_HI,
                                    border:`2px solid ${PIX}`, clipPath:pixClip,
                                    padding:"3px 10px", fontFamily:"monospace" }}>{m.text}</div>
                    )}
                    {(m.type==="npc" || m.type==="user") && (
                      <div style={{ maxWidth:"82%", padding:"7px 11px", fontSize:12, lineHeight:1.5,
                                     whiteSpace:"pre-wrap", wordBreak:"break-word",
                                     background: m.type==="user" ? LIME_MAIN : BODY_MAIN,
                                     color:"#2a1a0a",
                                     border:`2px solid ${PIX}`, clipPath:pixClip,
                                     fontFamily:"monospace" }}>{m.text}</div>
                    )}
                  </div>
                ))}
                {loading && <div style={{ fontSize:11, color:"#3a5a10", paddingLeft:22,
                                          fontFamily:"monospace" }}>포석호가 생각 중...</div>}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && sendAnswer()}
                  placeholder="답변을 입력하세요..." disabled={loading}
                  style={{ flex:1, background:BODY_HI, border:`2px solid ${PIX}`, borderRadius:0,
                           padding:"8px 12px", color:"#2a1a0a", fontSize:12, outline:"none",
                           opacity:loading?0.6:1, fontFamily:"monospace", clipPath:pixClip }} />
                <button onClick={sendAnswer} disabled={loading}
                  style={{ background:LIME_MAIN, border:`2px solid ${PIX}`,
                           borderBottom:`4px solid ${PIX}`,
                           boxShadow:`inset 0 2px 0 ${LIME_HI}`,
                           padding:"8px 16px", fontWeight:700,
                           cursor:loading?"not-allowed":"pointer", fontSize:12,
                           color:"#2a1a0a", fontFamily:"monospace",
                           clipPath:pixClip, opacity:loading?0.6:1 }}>전송</button>
              </div>
            </div>

            {/* 오른쪽: 분석 결과 패널 */}
            <div style={{ width:210, flexShrink:0, display:"flex", flexDirection:"column", gap:8 }}>
              {/* 고정 헤더 */}
              <div style={{ background:LIME_MAIN, border:`2px solid ${PIX}`,
                            clipPath:pixClip, padding:"7px 10px", textAlign:"center" }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#2a1a0a", fontFamily:"monospace" }}>
                  📊 퀴즈 분석 결과
                </span>
              </div>

              {/* 결과가 없을 때 */}
              {!scoreData && (
                <div style={{ background:LIME_HI, border:`2px solid ${PIX}`,
                              clipPath:pixClip, padding:"20px 10px", textAlign:"center" }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>🐾</div>
                  <div style={{ fontSize:10, color:"#3a5a10", lineHeight:1.5, fontFamily:"monospace" }}>
                    답변을 제출하면<br/>분석 결과가<br/>여기에 표시돼요
                  </div>
                </div>
              )}

              {/* 결과 카드 */}
              {scoreData && (
                <div style={{ background: BODY_MAIN,
                              border: `2px solid ${PIX}`,
                              clipPath: pixClip,
                              padding:"12px 10px", fontSize:11 }}>
                  {/* 총점 */}
                  <div style={{ textAlign:"center", marginBottom:10 }}>
                    <div style={{ fontSize:28, fontWeight:700, lineHeight:1,
                                  color: totalColor(scoreData.total) }}>
                      {scoreData.total}점
                    </div>
                    <div style={{ marginTop:4 }}>
                      <span style={{ fontSize:9, fontWeight:700, padding:"2px 10px",
                                     background: scoreData.match==="일치" ? SCORE_HI_BG
                                               : scoreData.match==="부분일치" ? SCORE_MID_BG
                                               : SCORE_LOW_BG,
                                     color:"#2a1a0a",
                                     border:`2px solid ${PIX}`, clipPath:pixClip,
                                     fontFamily:"monospace" }}>
                        {scoreData.match || "채점됨"}
                      </span>
                    </div>
                  </div>

                  {/* 항목별 바 */}
                  <div style={{ borderTop:`2px solid ${LIME_HI}`, paddingTop:8, marginBottom:8 }}>
                    {[
                      { label:"핵심개념", val:scoreData.concept,  max:40 },
                      { label:"정확성",   val:scoreData.accuracy, max:40 },
                      { label:"구체성",   val:scoreData.detail,   max:20 },
                    ].map(item => {
                      const ratio = item.val / item.max
                      return (
                        <div key={item.label} style={{ marginBottom:7 }}>
                          <div style={{ display:"flex", justifyContent:"space-between",
                                        fontSize:10, color:"#2a4a08", marginBottom:2, fontFamily:"monospace" }}>
                            <span>{item.label}</span>
                            <span style={{ fontWeight:700, color: scoreColor(ratio) }}>
                              {item.val}/{item.max}
                            </span>
                          </div>
                          <div style={{ height:6, background: scoreColorBg(ratio), overflow:"hidden",
                                        border:`1px solid ${PIX}` }}>
                            <div style={{ width:`${ratio*100}%`, height:"100%",
                                          background: scoreColor(ratio),
                                          transition:"width 0.6s ease" }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 핵심 키워드 (전체) */}
                  {((scoreData.matched_keywords?.length ?? 0) + (scoreData.missing_keywords?.length ?? 0)) > 0 && (
                    <div style={{ borderTop:`2px solid ${LIME_HI}`, paddingTop:8, marginBottom:8 }}>
                      <div style={{ fontSize:9, color:"#3a5a10", fontWeight:700, marginBottom:4, fontFamily:"monospace" }}>🔑 핵심 키워드</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                        {[...(scoreData.matched_keywords ?? []), ...(scoreData.missing_keywords ?? [])].map(k => (
                          <span key={k} style={{ background:LIME_HI, color:"#2a4a08",
                                                 border:`2px solid ${PIX}`,
                                                 padding:"1px 6px", fontSize:9, fontWeight:600,
                                                 clipPath:pixClip, fontFamily:"monospace" }}>
                            #{k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 맞춤 / 누락 상세 */}
                  {((scoreData.matched_keywords?.length ?? 0) > 0 || (scoreData.missing_keywords?.length ?? 0) > 0) && (
                    <div style={{ borderTop:`2px solid ${LIME_HI}`, paddingTop:8, marginBottom:8 }}>
                      <div style={{ fontSize:9, color:"#3a5a10", fontWeight:700, marginBottom:4, fontFamily:"monospace" }}>답변 분석</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                        {scoreData.matched_keywords?.map(k => (
                          <span key={`m-${k}`} style={{ background:LIME_HI, color:"#2a4a08",
                                                 border:`2px solid ${PIX}`,
                                                 padding:"1px 6px", fontSize:9,
                                                 clipPath:pixClip, fontFamily:"monospace" }}>✓ {k}</span>
                        ))}
                        {scoreData.missing_keywords?.map(k => (
                          <span key={`x-${k}`} style={{ background:"#fff0f0", color:"#c42f1c",
                                                 border:`2px solid ${PIX}`,
                                                 padding:"1px 6px", fontSize:9,
                                                 clipPath:pixClip, fontFamily:"monospace" }}>✗ {k}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 코멘트 */}
                  {scoreData.comment && (
                    <div style={{ borderTop:`2px solid ${LIME_HI}`, paddingTop:8,
                                  fontSize:10, color:"#3a5a10", lineHeight:1.5, fontFamily:"monospace" }}>
                      💬 {scoreData.comment}
                    </div>
                  )}

                  {/* 유사도 */}
                  {scoreData.similarity != null && (
                    <div style={{ marginTop:6, fontSize:10, color:LIME_DARK, textAlign:"right", fontFamily:"monospace" }}>
                      유사도 {Math.round(scoreData.similarity * 100)}%
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "done" && (
        <div style={{ textAlign:"center", padding:"20px 0" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:8, color:"#2a1a0a" }}>퀴즈 완료!</div>
          <div style={{ fontSize:13, color:"#3a5a10", marginBottom:16 }}>
            오늘도 열심히 공부했어요!<br/>대시보드에서 학습 리포트를 확인해보세요.
          </div>
          {scoreData && (
            <div style={{ background:BODY_MAIN, border:`2px solid ${PIX}`, clipPath:pixClip,
                          padding:"12px 16px", marginBottom:16, textAlign:"left" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#3a5a10", marginBottom:8, fontFamily:"monospace" }}>📊 최종 이해도</div>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
                <div style={{ fontSize:32, fontWeight:700,
                              color: totalColor(scoreData.total) }}>
                  {scoreData.total}점
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {[
                  { label:"핵심 개념", value: scoreData.concept, max:40 },
                  { label:"설명 정확성", value: scoreData.accuracy, max:40 },
                  { label:"표현 구체성", value: scoreData.detail, max:20 },
                ].map(item => {
                  const ratio = item.value / item.max
                  return (
                    <div key={item.label}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10,
                                    color:"#3a5a10", marginBottom:2, fontFamily:"monospace" }}>
                        <span>{item.label}</span>
                        <span style={{ fontWeight:700, color: scoreColor(ratio) }}>
                          {item.value}/{item.max}
                        </span>
                      </div>
                      <div style={{ height:6, background: scoreColorBg(ratio), overflow:"hidden",
                                    border:`1px solid ${PIX}` }}>
                        <div style={{ width:`${ratio*100}%`, height:"100%",
                                      background: scoreColor(ratio),
                                      transition:"width 0.5s" }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              {scoreData.comment && (
                <div style={{ marginTop:10, fontSize:11, color:"#3a5a10", fontStyle:"italic",
                              fontFamily:"monospace" }}>
                  💬 {scoreData.comment}
                </div>
              )}
            </div>
          )}
          <button onClick={onClose}
            style={{ padding:"10px 32px", background:LIME_MAIN, border:`2px solid ${PIX}`,
                     borderBottom:`4px solid ${PIX}`,
                     boxShadow:`inset 0 2px 0 ${LIME_HI}`,
                     color:"#2a1a0a", fontSize:13, fontWeight:700, cursor:"pointer",
                     clipPath:pixClip, fontFamily:"monospace" }}>확인</button>
        </div>
      )}
    </LecturePopup>
  )
}

// ── 복습 큐 팝업 (나중에하기 → 재진입 시 자동 표시) ──
function ReviewQueuePopup({ queue, onClose, sessionId }) {
  const [messages, setMessages] = useState([
    { type:"npc", text:`이전에 미뤄둔 퀴즈가 ${queue.length}개 있어요! 지금 풀어볼까요? 😊` }
  ])
  const [input, setInput]     = useState("")
  const [loading, setLoading] = useState(false)
  const [current, setCurrent] = useState(0)
  const [done, setDone]       = useState(false)
  const chatRef = useRef(null)
  const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

  function scrollBottom() { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }

  async function sendAnswer() {
    if (!input.trim() || loading) return
    const txt = input.trim(); setInput("")
    setMessages(prev => [...prev, { type:"user", text:txt }]); setLoading(true)
    try {
      const res = await fetch(`${BASE}/quiz/answer`, {
        method:"POST", headers:{ "Content-Type":"application/json", "X-User-Id":"1" },
        body: JSON.stringify({ quiz_id: queue[current]?.id, user_answer: txt }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { type:"npc", text: data.llm_feedback ?? "(더미) 잘 했어요!" }])
      const next = current + 1
      if (next >= queue.length) { setTimeout(() => setDone(true), 600) }
      else {
        setCurrent(next)
        setTimeout(() => {
          setMessages(prev => [...prev, { type:"npc",
            text:`다음 문제예요!\n[${queue[next].subject}] ${queue[next].question}` }])
          setLoading(false); setTimeout(scrollBottom, 50)
        }, 600)
        return
      }
    } catch { setMessages(prev => [...prev, { type:"npc", text:"(더미) 좋은 답변이에요!" }]) }
    finally { setLoading(false); setTimeout(scrollBottom, 50) }
  }

  return (
    <LecturePopup onClose={onClose} title="미뤄둔 퀴즈 복습" icon="🐻‍❄️">
      {!done ? (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ fontSize:11, color:"#3a5a10", fontWeight:700, fontFamily:"monospace" }}>{current+1}/{queue.length}</div>
          </div>
          <div style={{ background:LIME_HI, border:`2px solid ${PIX}`, clipPath:pixClip,
                        padding:"10px 14px", marginBottom:12 }}>
            <div style={{ fontSize:10, color:"#3a5a10", fontWeight:700, marginBottom:4, fontFamily:"monospace" }}>[{queue[current]?.subject}]</div>
            <div style={{ fontSize:13, fontWeight:700, color:"#2a1a0a" }}>{queue[current]?.question}</div>
          </div>
          <div ref={chatRef}
            style={{ height:150, overflowY:"auto", display:"flex", flexDirection:"column", gap:6,
                     marginBottom:10, borderTop:`3px solid ${PIX}`, paddingTop:10 }}>
            {messages.map((m,i) => (
              <div key={i} style={{ display:"flex", justifyContent: m.type==="user" ? "flex-end" : "flex-start",
                                     alignItems:"flex-end", gap:4 }}>
                {m.type==="npc" && <span style={{ fontSize:14, flexShrink:0 }}>🐻‍❄️</span>}
                {m.type === "system"
                  ? <div style={{ width:"100%", textAlign:"center", fontSize:10,
                                  color:"#3a5a10", padding:"4px 0", fontStyle:"italic",
                                  fontFamily:"monospace" }}>{m.text}</div>
                  : <div style={{ maxWidth:"78%", padding:"7px 11px", fontSize:12, lineHeight:1.5,
                                   background: m.type==="user" ? LIME_MAIN : BODY_MAIN,
                                   color:"#2a1a0a",
                                   border:`2px solid ${PIX}`, clipPath:pixClip,
                                   fontFamily:"monospace" }}>{m.text}</div>
                }
              </div>
            ))}
            {loading && <div style={{ fontSize:11, color:"#3a5a10", paddingLeft:22,
                                      fontFamily:"monospace" }}>입력 중...</div>}
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && sendAnswer()}
              placeholder="답변을 입력하세요..." disabled={loading}
              style={{ flex:1, background:BODY_HI, border:`2px solid ${PIX}`, borderRadius:0,
                       padding:"8px 12px", color:"#2a1a0a", fontSize:12, outline:"none",
                       opacity:loading?0.6:1, fontFamily:"monospace", clipPath:pixClip }} />
            <button onClick={sendAnswer} disabled={loading}
              style={{ background:LIME_MAIN, border:`2px solid ${PIX}`,
                       borderBottom:`4px solid ${PIX}`,
                       boxShadow:`inset 0 2px 0 ${LIME_HI}`,
                       padding:"8px 16px",
                       fontWeight:700, cursor:loading?"not-allowed":"pointer",
                       fontSize:12, color:"#2a1a0a",
                       fontFamily:"monospace", clipPath:pixClip,
                       opacity:loading?0.6:1 }}>전송</button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign:"center", padding:"20px 0" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:8, color:"#2a1a0a" }}>복습 완료!</div>
          <div style={{ fontSize:12, color:"#3a5a10", marginBottom:20, fontFamily:"monospace" }}>미뤄둔 퀴즈를 모두 풀었어요.</div>
          <button onClick={onClose}
            style={{ padding:"10px 32px", background:LIME_MAIN, border:`2px solid ${PIX}`,
                     borderBottom:`4px solid ${PIX}`,
                     boxShadow:`inset 0 2px 0 ${LIME_HI}`,
                     color:"#2a1a0a", fontSize:13, fontWeight:700, cursor:"pointer",
                     clipPath:pixClip, fontFamily:"monospace" }}>확인</button>
        </div>
      )}
    </LecturePopup>
  )
}