import { useState, useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import SharedHeader from "../components/SharedHeader"
import { startLecture, endLecture, postFocusTick, getLectures, generateQuiz, getReviewQueue } from "../api/index.js"

const STATUS_COLOR = { focus:"#22c98a", unfocus:"#f5c518" }
const STATUS_LABEL = { focus:"집중",    unfocus:"미집중"   }

function formatTime(sec) {
  if (!sec && sec !== 0) return "--:--"
  const m = String(Math.floor(sec / 60)).padStart(2, "0")
  const s = String(sec % 60).padStart(2, "0")
  return `${m}:${s}`
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
  const [petOpen, setPetOpen]             = useState(false)
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
    if (!sessionId) return
    setPomRunning(false)
    endLecture({ session_id: sessionId })
      .then(res => {
        const segs = res.data?.low_focus_segments || segments.filter(s => s.status === "unfocus")
        setQuizSegments(segs)
        setQuizPopupOpen(true)
      })
      .catch(() => {
        setQuizSegments(segments.filter(s => s.status === "unfocus"))
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
  const completedCount = quests.filter(q => q.done).length
  const showBanner     = seekTo || seekTime !== null
  const bannerTimeStr  = seekTime !== null ? formatTime(seekTime) : seekTo

  return (
    <div style={{ width:"100%", height:"100%", background:"#0b1220", color:"#fff",
                  fontFamily:"'Noto Sans KR',sans-serif", display:"flex",
                  flexDirection:"column", overflow:"hidden", position:"relative" }}>
      <SharedHeader showHome />

      {showBanner && (
        <div style={{ background:"rgba(245,197,24,0.15)", borderBottom:"1px solid #f5c518",
                      padding:"8px 20px", fontSize:12, color:"#f5c518",
                      display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          ▶ <strong>{bannerTimeStr}</strong> 구간으로 이동했습니다.
          {seekTime !== null && (
            <button onClick={() => setSeekTime(null)}
              style={{ marginLeft:"auto", background:"none", border:"1px solid #f5c518",
                       borderRadius:5, padding:"2px 8px", color:"#f5c518",
                       fontSize:11, cursor:"pointer" }}>✕ 닫기</button>
          )}
        </div>
      )}

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* 왼쪽 */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", padding:16, gap:12, overflow:"auto" }}>

          {/* 드롭박스 */}
          <div style={{ display:"flex", gap:8 }}>
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
              style={{ flex:1, background:"#1a2a3a", border:"1px solid #2a3a5a", borderRadius:8,
                       padding:"8px 12px", color:"#fff", fontSize:12, cursor:"pointer", outline:"none" }}>
              <option value="">📚 과목 선택</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={selectedLecture?.id || ""}
              onChange={e => {
                const lec = filteredLectures.find(l => l.id === Number(e.target.value))
                if (lec) handleLectureSelect(lec)
              }}
              disabled={!selectedSubject}
              style={{ flex:2, background:"#1a2a3a", border:"1px solid #2a3a5a", borderRadius:8,
                       padding:"8px 12px", color: selectedSubject ? "#fff" : "#555",
                       fontSize:12, cursor: selectedSubject ? "pointer" : "not-allowed",
                       outline:"none", opacity: selectedSubject ? 1 : 0.5 }}>
              <option value="">🎬 강의 선택</option>
              {filteredLectures.map(l => (
                <option key={l.id} value={l.id}>{l.title} ({Math.floor(l.duration_sec/60)}분)</option>
              ))}
            </select>
          </div>

          {selectedLecture && (
            <div style={{ padding:"6px 12px", background:"rgba(126,200,245,0.1)",
                          border:"1px solid #2a3a5a", borderRadius:8, fontSize:11, color:"#7ec8f5",
                          display:"flex", alignItems:"center", gap:8 }}>
              📖 {selectedLecture.subject} · {selectedLecture.title}
              {isStarted
                ? <span style={{ color:"#22c98a", marginLeft:"auto" }}>● 수강 중</span>
                : <span style={{ color:"#555", marginLeft:"auto" }}>강의를 선택해주세요</span>}
            </div>
          )}

          {/* 영상 */}
          <div style={{ background:"#1a2a3a", borderRadius:10, border:"1px solid #2a3a5a", position:"relative" }}>
            <video ref={videoRef} src={selectedLecture?.video_url || "/test.webm"} controls
              style={{ width:"100%", borderRadius:10 }}
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
              <div style={{ position:"absolute", top:12, left:12, background:"rgba(245,197,24,0.18)",
                            border:"1px solid #f5c518", borderRadius:7, padding:"4px 10px",
                            fontSize:11, color:"#f5c518", fontWeight:700 }}>
                ▶ {formatTime(seekTime)} 구간 재생중
              </div>
            )}
            {isStarted && (
              <button onClick={handleLectureEnd}
                style={{ position:"absolute", bottom:12, right:12, background:"#7c6ff7",
                          border:"none", borderRadius:6, padding:"5px 12px", color:"#fff",
                          fontSize:11, fontWeight:700, cursor:"pointer" }}>
                강의 종료 →
              </button>
            )}
          </div>

          {/* 실시간 타임라인 */}
          <div style={{ background:"#1a2a3a", borderRadius:10, border:"1px solid #2a3a5a", padding:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:12, color:"#7ec8f5", fontWeight:700 }}>집중도 타임라인</div>
              {videoDuration > 0 && (
                <div style={{ fontSize:10, color:"#555" }}>
                  {formatTime(currentVideoTime)} / {formatTime(videoDuration)}
                </div>
              )}
            </div>

            {videoDuration === 0 ? (
              <div style={{ height:60, background:"#1a2a4a", borderRadius:6,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:10, color:"#555" }}>
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
                  <span style={{ color:"#aaa" }}>{STATUS_LABEL[k]}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700, marginBottom:8 }}>
              📌 미집중 구간 다시보기
            </div>
            {badSegments.length === 0 ? (
              <div style={{ fontSize:11, color:"#555" }}>
                {isStarted ? "미집중 구간이 없어요 🎉" : "강의 수강 중 1분마다 업데이트돼요"}
              </div>
            ) : badSegments.slice(-5).map((seg, i) => {
              const startMin = Math.floor(seg.start / 60)
              const endMin   = Math.ceil(seg.end / 60)
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between",
                                      alignItems:"center", padding:"8px 10px", marginBottom:6,
                                      borderRadius:8, background:"#0d1825",
                                      border:`1px solid ${STATUS_COLOR.unfocus}44` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:STATUS_COLOR.unfocus }} />
                    <span style={{ fontSize:11, color:STATUS_COLOR.unfocus, fontWeight:700 }}>미집중</span>
                    <span style={{ fontSize:11, color:"#aaa" }}>
                      {startMin}분 ~ {endMin}분
                    </span>
                  </div>
                  <button onClick={() => setSeekTime(seg.start)}
                    style={{ background: seekTime===seg.start ? "#f5c518" : "rgba(30,70,140,0.6)",
                             border:`1px solid ${seekTime===seg.start ? "#f5c518" : "#4a8ade"}`,
                             borderRadius:6, padding:"4px 12px", fontSize:11,
                             color: seekTime===seg.start ? "#000" : "#7ec8f5",
                             fontWeight:700, cursor:"pointer" }}>
                    {seekTime===seg.start ? "▶ 재생중" : "▶ 다시보기"}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* 오른쪽 */}
        <div style={{ width:280, display:"flex", flexDirection:"column",
                      gap:10, padding:"12px 12px 12px 0", overflow:"hidden" }}>
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
              const score  = Math.round(data.focus_score * 100)
              const minute = data.minute  // 현재 몇 분인지
              setSegments(prev => [...prev, { start: startSec, end: endSec, status }])
              setFocusScores(prev => [...prev, { minute, score }])
            }}
          />


          {/* 퀘스트 */}
          <div style={{ background:"#1a2a3a", borderRadius:10, border:"1px solid #2a3a5a", padding:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#7ec8f5" }}>퀘스트 진행 현황</div>
              <div style={{ fontSize:11, fontWeight:700, color: completedCount===quests.length ? "#22c98a" : "#f5c518" }}>
                {completedCount}/{quests.length}
              </div>
            </div>
            {quests.map(q => (
              <div key={q.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                                       fontSize:11, padding:"5px 0", borderBottom:"1px solid #1a2a4a" }}>
                <span style={{ color: q.done ? "#aaa" : "#fff", textDecoration: q.done ? "line-through" : "none" }}>
                  {q.title}
                </span>
                <span style={{ color: q.done ? "#22c98a" : "#f5c518", fontWeight:700 }}>
                  {q.done ? "완료" : "진행중"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PetCharFixed onOpen={() => setPetOpen(true)} />
      {petOpen && <PetPopup onClose={() => setPetOpen(false)} sessionId={sessionId} />}

      {quizPopupOpen && (
        <QuizAfterLecture onClose={() => setQuizPopupOpen(false)}
          sessionId={sessionId} lecture={selectedLecture} segments={quizSegments} />
      )}

      {reviewOpen && reviewQueue.length > 0 && (
        <ReviewQueuePopup queue={reviewQueue} onClose={() => setReviewOpen(false)} sessionId={sessionId} />
      )}
    </div>
  )
}

// ── 집중도 타임라인 라인차트 ──
function FocusTimeline({ segments, focusScores, videoDuration, currentVideoTime, seekTime, onSeek }) {
  const W         = 600   // viewBox 너비
  const H         = 120   // viewBox 높이
  const PAD       = { top:16, right:12, bottom:28, left:36 }
  const innerW    = W - PAD.left - PAD.right
  const innerH    = H - PAD.top  - PAD.bottom
  const totalMin  = Math.max(1, Math.ceil(videoDuration / 60))
  const yTicks    = [0, 25, 50, 75, 100]

  // 좌표 변환
  const toX = (min)   => PAD.left + (min / totalMin) * innerW
  const toY = (score) => PAD.top  + innerH - (score / 100) * innerH

  // 세그먼트를 배경 rect로
  const segRects = segments.map(seg => ({
    x:     PAD.left + (seg.start / videoDuration) * innerW,
    width: ((seg.end - seg.start) / videoDuration) * innerW,
    color: seg.status === "focus" ? "#22c98a22" : "#f5c51822",
    borderColor: seg.status === "focus" ? "#22c98a44" : "#f5c51844",
    status: seg.status,
    start:  seg.start,
  }))

  // 라인 포인트
  const pts = focusScores.map(({ minute, score }) => ({
    x: toX(minute), y: toY(score), score, minute,
    color: score >= 70 ? "#22c98a" : "#f5c518",
  }))

  const linePath = pts.length > 1
    ? "M " + pts.map(p => `${p.x},${p.y}`).join(" L ")
    : null

  // 현재 재생위치 x
  const cursorX = videoDuration > 0
    ? PAD.left + (currentVideoTime / videoDuration) * innerW
    : null

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
              stroke={t === 70 ? "#3a5a7a" : "#1e2e40"}
              strokeWidth={t === 70 ? 1 : 0.5}
              strokeDasharray={t === 70 ? "4,3" : "0"} />
            <text x={PAD.left - 4} y={toY(t) + 3.5}
              textAnchor="end" fontSize="8" fill="#555">{t}</text>
          </g>
        ))}

        {/* X축 눈금 (분 단위) */}
        {Array.from({ length: totalMin + 1 }, (_, i) => i)
          .filter(m => totalMin <= 10 || m % Math.ceil(totalMin / 8) === 0)
          .map(m => (
            <g key={m}>
              <line x1={toX(m)} y1={PAD.top + innerH}
                x2={toX(m)} y2={PAD.top + innerH + 3}
                stroke="#2a3a5a" strokeWidth="0.5" />
              <text x={toX(m)} y={PAD.top + innerH + 11}
                textAnchor="middle" fontSize="8" fill="#555">{m}분</text>
            </g>
          ))
        }

        {/* 축 테두리 */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH}
          stroke="#2a3a5a" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top + innerH}
          x2={PAD.left + innerW} y2={PAD.top + innerH}
          stroke="#2a3a5a" strokeWidth="1" />

        {/* 집중도 라인 */}
        {linePath && (
          <path d={linePath} fill="none" stroke="#7ec8f5"
            strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* 데이터 포인트 */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4"
              fill={p.color} stroke="#0d1520" strokeWidth="1" />
            <title>{p.minute}분: {p.score}점</title>
          </g>
        ))}

        {/* 현재 재생 위치 커서 */}
        {cursorX && (
          <line x1={cursorX} y1={PAD.top} x2={cursorX} y2={PAD.top + innerH}
            stroke="#fff" strokeWidth="1" opacity="0.5"
            strokeDasharray="3,2" />
        )}

      </svg>

      {/* 데이터 없을 때 안내 */}
      {focusScores.length === 0 && (
        <div style={{ textAlign:"center", fontSize:10, color:"#555", marginTop:4 }}>
          수강 시작 후 1분마다 집중도 포인트가 표시돼요
        </div>
      )}
    </div>
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

  const tickBufferRef  = useRef([])
  const tickCountRef   = useRef(0)
  const webcamVideoRef = useRef(null)
  const canvasRef      = useRef(null)
  const intervalRef    = useRef(null)
  const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const COLOR = { focused:"#22c98a", unfocused:"#f5c518" }
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
            { focus_score: finalPct / 100, label: finalLabel, minute },
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

        if (elapsed >= 60000) {
          const buf      = tickBufferRef.current
          const dummyPct = Math.round(buf.filter(l => l === "focused").length / buf.length * 100)
          const dummyLbl = dummyPct >= FOCUS_THRESHOLD ? "focused" : "unfocused"
          const minute   = Math.round(videoTime / 60)

          setFocusScore(dummyPct)
          setFocusLabel(dummyLbl)
          if (onFocusTick) onFocusTick(
            { focus_score: dummyPct / 100, label: dummyLbl, minute },
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

  const curColor = COLOR[focusLabel] ?? "#22c98a"
  const curLabel = LABEL[focusLabel] ?? "집중 중"

  return (
    <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a", borderRadius:10, padding:12, flexShrink:0 }}>
      {/* 헤더 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700 }}>웹캠</div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10 }}>
          {/* 배속 표시 */}
          {cvActive && (
            <span style={{ background:"rgba(0,0,0,0.5)", borderRadius:4,
                           padding:"1px 6px", color:"#f5c518", fontWeight:700, fontSize:10 }}>
              {lectureVideoRef?.current?.playbackRate?.toFixed(1) ?? "1.0"}x
            </span>
          )}
          {loading ? (
            <span style={{ color:"#f5c518" }}>⏳ 연결 중...</span>
          ) : cvActive && intervalRef.current ? (
            <>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#22c98a",
                            animation:"pulse 1.5s infinite" }} />
              <span style={{ color:"#22c98a", fontWeight:700 }}>측정 중</span>
              {isWriting && <span style={{ color:"#7c6ff7" }}>✏️</span>}
            </>
          ) : cvActive ? (
            <span style={{ color:"#f5c518" }}>⏸ 일시정지</span>
          ) : (
            <span style={{ color:"#555" }}>대기 중</span>
          )}
        </div>
      </div>

      {/* 웹캠 화면 */}
      <canvas ref={canvasRef} style={{ display:"none" }} />
      <div style={{ position:"relative", borderRadius:8, overflow:"hidden",
                    background:"#0d1520", minHeight:120 }}>
        <video ref={webcamVideoRef} autoPlay muted
          style={{ width:"100%", borderRadius:8,
                   display: cvActive ? "block" : "none",
                   minHeight:120, objectFit:"cover" }} />
        {!cvActive && !loading && (
          <div style={{ height:120, display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", color:"#2a3a5a" }}>
            <div style={{ fontSize:32 }}>📷</div>
            <div style={{ fontSize:10, color:"#555", marginTop:4 }}>영상 재생 시 자동 시작</div>
          </div>
        )}
        {loading && (
          <div style={{ height:120, display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", color:"#7ec8f5" }}>
            <div style={{ fontSize:20 }}>⏳</div>
            <div style={{ fontSize:10, marginTop:4 }}>웹캠 연결 중...</div>
          </div>
        )}
        {isWriting && cvActive && (
          <div style={{ position:"absolute", top:6, right:6, background:"rgba(124,111,247,0.85)",
                        borderRadius:5, padding:"2px 8px", fontSize:9, color:"#fff", fontWeight:700 }}>
            ✏️ 필기 중
          </div>
        )}
      </div>

      {/* 1분 집계 진행 바 */}
      {cvActive && (
        <div style={{ marginTop:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between",
                        fontSize:9, color:"#555", marginBottom:3 }}>
            <span>1분 집계</span>
            <span>{tickCount}/60초</span>
          </div>
          <div style={{ height:3, background:"#0d1520", borderRadius:2, overflow:"hidden" }}>
            <div style={{ width:`${(tickCount/60)*100}%`, height:"100%",
                          background:"#3a5a7a", borderRadius:2,
                          transition:"width 1s linear" }} />
          </div>
          {focusScore > 0 && (
            <div style={{ marginTop:6, display:"flex", justifyContent:"space-between",
                          alignItems:"center" }}>
              <span style={{ fontSize:10, color:"#aaa" }}>최근 1분</span>
              <span style={{ fontSize:13, fontWeight:700, color: curColor }}>
                {focusScore}점
              </span>
            </div>
          )}
        </div>
      )}


      <button onClick={cvActive ? stopWebcam : startWebcam} disabled={loading}
        style={{ width:"100%", marginTop:8, padding:"6px 0",
                 background: loading ? "#333" : cvActive ? "#f06060" : "#22c98a",
                 border:"none", borderRadius:6, color:"#fff", fontWeight:700,
                 cursor: loading ? "not-allowed" : "pointer", fontSize:12, opacity: loading ? 0.7 : 1 }}>
        {loading ? "연결 중..." : cvActive ? "⏹ 끄기" : "▶ 켜기"}
      </button>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}

// ── 강의 종료 후 퀴즈 팝업 ──
function QuizAfterLecture({ onClose, sessionId, lecture, segments }) {
  const [step, setStep]           = useState("intro")
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState("")
  const [loading, setLoading]     = useState(false)
  const [quizCount, setQuizCount] = useState(0)
  const chatRef = useRef(null)
  const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

  function scrollBottom() { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }

  async function startQuiz() {
    setStep("chat"); setLoading(true)
    try {
      const res = await fetch(`${BASE}/quiz/generate`, {
        method:"POST", headers:{ "Content-Type":"application/json", "X-User-Id":"1" },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json()
      setMessages([{ type:"npc", text: data.question ?? "강의에서 배운 내용을 퀴즈로 확인해볼게요! 😊" }])
    } catch { setMessages([{ type:"npc", text:"강의 내용을 퀴즈로 확인해볼게요! 준비됐으면 답해보세요 😊" }]) }
    finally { setLoading(false); setTimeout(scrollBottom, 50) }
  }

  async function sendAnswer() {
    if (!input.trim() || loading) return
    const txt = input.trim(); setInput("")
    setMessages(prev => [...prev, { type:"user", text:txt }]); setLoading(true)
    try {
      const res = await fetch(`${BASE}/quiz/answer`, {
        method:"POST", headers:{ "Content-Type":"application/json", "X-User-Id":"1" },
        body: JSON.stringify({ session_id: sessionId, user_answer: txt }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { type:"npc", text: data.llm_feedback ?? "(더미) 잘 했어요!" }])
      const next = quizCount + 1; setQuizCount(next)
      if (next >= 3) { setTimeout(() => setStep("done"), 800) }
      else {
        setTimeout(async () => {
          try {
            const r2 = await fetch(`${BASE}/quiz/generate`, {
              method:"POST", headers:{ "Content-Type":"application/json", "X-User-Id":"1" },
              body: JSON.stringify({ session_id: sessionId }),
            })
            const d2 = await r2.json()
            setMessages(prev => [...prev, { type:"npc", text: d2.question ?? "다음 문제예요!" }])
          } catch { setMessages(prev => [...prev, { type:"npc", text:"다음 문제예요! 😊" }]) }
          setLoading(false); setTimeout(scrollBottom, 50)
        }, 600)
        return
      }
    } catch { setMessages(prev => [...prev, { type:"npc", text:"(더미) 좋은 답변이에요!" }]) }
    finally { setLoading(false); setTimeout(scrollBottom, 50) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:200 }} />
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
                    background:"#0d1520", border:"1px solid #7c6ff7", borderRadius:16, padding:28,
                    zIndex:201, width:"min(520px,92vw)", maxHeight:"88vh", overflowY:"auto" }}>
        <button onClick={onClose}
          style={{ position:"absolute", top:12, right:14, background:"none", border:"none", color:"#555", fontSize:18, cursor:"pointer" }}>✕</button>

        {step === "intro" && (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🐻‍❄️</div>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>강의 수고하셨어요!</div>
            <div style={{ fontSize:13, color:"#aaa", marginBottom:20, lineHeight:1.6 }}>
              {lecture?.title ?? "강의"} 수강이 완료됐어요.<br/>
              미집중 구간 <strong style={{ color:"#f5c518" }}>{segments.length}개</strong>가 감지됐어요.<br/>
              포석호와 함께 퀴즈로 복습해볼까요?
            </div>
            {segments.length > 0 && (
              <div style={{ background:"#1a2a3a", borderRadius:8, padding:"10px 14px", marginBottom:20, textAlign:"left" }}>
                <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700, marginBottom:6 }}>📌 미집중 구간</div>
                {segments.slice(0,3).map((seg,i) => (
                  <div key={i} style={{ fontSize:11, color:"#aaa", padding:"3px 0" }}>
                    {formatTime(seg.start ?? 0)} ~ {formatTime(seg.end ?? 0)}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={onClose}
                style={{ flex:1, padding:"10px 0", background:"transparent", border:"1px solid #2a3a5a",
                         borderRadius:8, color:"#aaa", fontSize:13, cursor:"pointer" }}>
                📅 나중에 하기
              </button>
              <button onClick={startQuiz}
                style={{ flex:2, padding:"10px 0", background:"#7c6ff7", border:"none",
                         borderRadius:8, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                🐾 퀴즈 시작하기
              </button>
            </div>
            <div style={{ marginTop:10, fontSize:10, color:"#555" }}>
              나중에 하기 → 홈 포석호에서 다시 풀 수 있어요
            </div>
          </div>
        )}

        {step === "chat" && (
          <>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ fontSize:24 }}>🐻‍❄️</div>
              <div style={{ fontSize:15, fontWeight:700 }}>포석호와 퀴즈</div>
              <div style={{ marginLeft:"auto", fontSize:11, color:"#aaa" }}>{quizCount}/3 완료</div>
            </div>
            <div style={{ height:4, background:"#1a2a4a", borderRadius:2, overflow:"hidden", marginBottom:14 }}>
              <div style={{ width:`${(quizCount/3)*100}%`, height:"100%", background:"#7c6ff7", transition:"width 0.4s" }} />
            </div>
            <div ref={chatRef}
              style={{ height:240, overflowY:"auto", display:"flex", flexDirection:"column", gap:6,
                       marginBottom:10, borderTop:"1px solid #2a3a5a", paddingTop:10 }}>
              {messages.map((m,i) => (
                <div key={i} style={{ display:"flex", justifyContent: m.type==="user" ? "flex-end" : "flex-start",
                                       alignItems:"flex-end", gap:4 }}>
                  {m.type==="npc" && <span style={{ fontSize:14, flexShrink:0 }}>🐻‍❄️</span>}
                  <div style={{ maxWidth:"78%", padding:"7px 11px", borderRadius:10, fontSize:12, lineHeight:1.5,
                                 background: m.type==="user" ? "#f5c518" : "#1a2a4a",
                                 color: m.type==="user" ? "#000" : "#fff" }}>{m.text}</div>
                </div>
              ))}
              {loading && <div style={{ fontSize:11, color:"#555", paddingLeft:22 }}>입력 중...</div>}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && sendAnswer()}
                placeholder="답변을 입력하세요..." disabled={loading}
                style={{ flex:1, background:"#1a2a4a", border:"1px solid #2a3a5a", borderRadius:8,
                         padding:"8px 12px", color:"#fff", fontSize:12, outline:"none", opacity:loading?0.6:1 }} />
              <button onClick={sendAnswer} disabled={loading}
                style={{ background:"#7c6ff7", border:"none", borderRadius:8, padding:"8px 16px",
                         fontWeight:700, cursor:loading?"not-allowed":"pointer", fontSize:12, color:"#fff", opacity:loading?0.6:1 }}>전송</button>
            </div>
          </>
        )}

        {step === "done" && (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>퀴즈 완료!</div>
            <div style={{ fontSize:13, color:"#aaa", marginBottom:20 }}>
              오늘도 열심히 공부했어요!<br/>대시보드에서 학습 리포트를 확인해보세요.
            </div>
            <button onClick={onClose}
              style={{ padding:"10px 32px", background:"#22c98a", border:"none", borderRadius:8,
                       color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>확인</button>
          </div>
        )}
      </div>
    </>
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
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:200 }} />
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
                    background:"#0d1520", border:"1px solid #f5c518", borderRadius:16, padding:24,
                    zIndex:201, width:"min(480px,92vw)", maxHeight:"85vh", overflowY:"auto" }}>
        <button onClick={onClose}
          style={{ position:"absolute", top:12, right:14, background:"none", border:"none", color:"#555", fontSize:18, cursor:"pointer" }}>✕</button>
        {!done ? (
          <>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ fontSize:22 }}>🐻‍❄️</div>
              <div style={{ fontSize:14, fontWeight:700 }}>미뤄둔 퀴즈 복습</div>
              <div style={{ marginLeft:"auto", fontSize:11, color:"#aaa" }}>{current+1}/{queue.length}</div>
            </div>
            <div style={{ background:"#1a2a3a", borderRadius:8, padding:"10px 14px", marginBottom:12, border:"1px solid #f5c51844" }}>
              <div style={{ fontSize:10, color:"#7ec8f5", marginBottom:4 }}>[{queue[current]?.subject}]</div>
              <div style={{ fontSize:13, fontWeight:700 }}>{queue[current]?.question}</div>
            </div>
            <div ref={chatRef}
              style={{ height:150, overflowY:"auto", display:"flex", flexDirection:"column", gap:6,
                       marginBottom:10, borderTop:"1px solid #2a3a5a", paddingTop:10 }}>
              {messages.map((m,i) => (
                <div key={i} style={{ display:"flex", justifyContent: m.type==="user" ? "flex-end" : "flex-start",
                                       alignItems:"flex-end", gap:4 }}>
                  {m.type==="npc" && <span style={{ fontSize:14, flexShrink:0 }}>🐻‍❄️</span>}
                  <div style={{ maxWidth:"78%", padding:"7px 11px", borderRadius:10, fontSize:12, lineHeight:1.5,
                                 background: m.type==="user" ? "#f5c518" : "#1a2a4a",
                                 color: m.type==="user" ? "#000" : "#fff" }}>{m.text}</div>
                </div>
              ))}
              {loading && <div style={{ fontSize:11, color:"#555", paddingLeft:22 }}>입력 중...</div>}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && sendAnswer()}
                placeholder="답변을 입력하세요..." disabled={loading}
                style={{ flex:1, background:"#1a2a4a", border:"1px solid #2a3a5a", borderRadius:8,
                         padding:"8px 12px", color:"#fff", fontSize:12, outline:"none", opacity:loading?0.6:1 }} />
              <button onClick={sendAnswer} disabled={loading}
                style={{ background:"#f5c518", border:"none", borderRadius:8, padding:"8px 16px",
                         fontWeight:700, cursor:loading?"not-allowed":"pointer", fontSize:12, color:"#000", opacity:loading?0.6:1 }}>전송</button>
            </div>
          </>
        ) : (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>복습 완료!</div>
            <div style={{ fontSize:12, color:"#aaa", marginBottom:20 }}>미뤄둔 퀴즈를 모두 풀었어요.</div>
            <button onClick={onClose}
              style={{ padding:"10px 32px", background:"#22c98a", border:"none", borderRadius:8,
                       color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>확인</button>
          </div>
        )}
      </div>
    </>
  )
}

// ── 고정 펫 ──
function PetCharFixed({ onOpen }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onOpen} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ position:"fixed", bottom:24, right:24, zIndex:100, cursor:"pointer",
               display:"flex", flexDirection:"column", alignItems:"center", userSelect:"none" }}>
      {hov && (
        <div style={{ position:"relative", marginBottom:5 }}>
          <div style={{ background:"#fff", color:"#222", fontSize:9, fontWeight:600,
                        padding:"3px 8px", borderRadius:7, border:"1px solid #ccc", whiteSpace:"nowrap" }}>
            포석호와 대화하기 😊</div>
          <div style={{ position:"absolute", bottom:-5, left:"50%", transform:"translateX(-50%)",
                        width:0, height:0, borderLeft:"4px solid transparent",
                        borderRight:"4px solid transparent", borderTop:"5px solid #ccc" }} />
        </div>
      )}
      <div style={{ transform: hov ? "translateY(-6px)" : "none", transition:"transform 0.18s ease",
                    display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ fontSize:8, color:"#7ec8f5", fontWeight:700, marginBottom:3,
                      background:"rgba(13,21,32,0.9)", padding:"1px 6px",
                      borderRadius:6, border:"1px solid #2a3a5a" }}>포석호</div>
        <div style={{ fontSize:24, lineHeight:1 }}>🐻‍❄️</div>
        <div style={{ width:18, height:13, background:"#e8843a", marginTop:1,
                      borderRadius:"3px 3px 0 0", boxShadow:"inset 0 -2px 0 rgba(0,0,0,0.22)" }} />
        <div style={{ display:"flex", gap:2 }}>
          {[0,1].map(i => <div key={i} style={{ width:7, height:10, background:"#c05a20", borderRadius:"0 0 2px 2px" }} />)}
        </div>
      </div>
    </div>
  )
}

// ── 펫 팝업 (질문 전용) ──
function PetPopup({ onClose, sessionId }) {
  const [messages, setMessages] = useState([
    { type:"npc", text:"안녕하세요! 궁금한 게 있으면 물어보세요 😊\n퀴즈는 강의 종료 후 자동으로 시작돼요!" }
  ])
  const [input, setInput]     = useState("")
  const [loading, setLoading] = useState(false)
  const chatRef               = useRef(null)

  async function sendMsg() {
    if (!input.trim() || loading) return
    const txt = input.trim(); setInput("")
    setMessages(prev => [...prev, { type:"user", text:txt }]); setLoading(true)
    try {
      const res = await generateQuiz({ session_id: sessionId, question: txt })
      setMessages(prev => [...prev, { type:"npc", text: res.data.question ?? "(더미) 좋은 질문이에요!" }])
    } catch { setMessages(prev => [...prev, { type:"npc", text:"(더미 응답) 네, 이해했어요!" }]) }
    finally { setLoading(false); if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:200 }} />
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
                    background:"#0d1520", border:"1px solid #2a3a5a", borderRadius:14, padding:24,
                    zIndex:201, width:"min(440px,92vw)", maxHeight:"80vh", overflowY:"auto" }}>
        <button onClick={onClose}
          style={{ position:"absolute", top:12, right:14, background:"none", border:"none", color:"#555", fontSize:18, cursor:"pointer" }}>✕</button>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>🐻‍❄️ 포석호에게 질문하기</div>
        <div ref={chatRef}
          style={{ height:180, overflowY:"auto", display:"flex", flexDirection:"column", gap:6,
                   marginBottom:10, borderTop:"1px solid #2a3a5a", paddingTop:10 }}>
          {messages.map((m,i) => (
            <div key={i} style={{ display:"flex", justifyContent: m.type==="user" ? "flex-end" : "flex-start", alignItems:"flex-end", gap:4 }}>
              {m.type==="npc" && <span style={{ fontSize:14, flexShrink:0 }}>🐻‍❄️</span>}
              <div style={{ maxWidth:"78%", padding:"7px 11px", borderRadius:10, fontSize:12, lineHeight:1.5,
                             background: m.type==="user" ? "#f5c518" : "#1a2a4a",
                             color: m.type==="user" ? "#000" : "#fff" }}>{m.text}</div>
            </div>
          ))}
          {loading && <div style={{ fontSize:11, color:"#555", paddingLeft:22 }}>입력 중...</div>}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==="Enter" && sendMsg()} placeholder="궁금한 것을 물어보세요..." disabled={loading}
            style={{ flex:1, background:"#1a2a4a", border:"1px solid #2a3a5a", borderRadius:8,
                     padding:"8px 12px", color:"#fff", fontSize:12, outline:"none", opacity:loading?0.6:1 }} />
          <button onClick={sendMsg} disabled={loading}
            style={{ background:"#f5c518", border:"none", borderRadius:8, padding:"8px 16px",
                     fontWeight:700, cursor:loading?"not-allowed":"pointer", fontSize:12, opacity:loading?0.6:1 }}>전송</button>
        </div>
      </div>
    </>
  )
}