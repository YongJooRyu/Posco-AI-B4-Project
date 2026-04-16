import { useState, useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import SharedHeader from "../components/SharedHeader"

// 더미 집중도 구간 데이터
// 🔌 TODO(백엔드): GET /api/lecture/:id/focus-segments → [{ start, end, status }] (초 단위)
const DUMMY_SEGMENTS = [
  { start:0,   end:120,  status:"focus"   },
  { start:120, end:200,  status:"unfocus" },
  { start:200, end:350,  status:"focus"   },
  { start:350, end:420,  status:"drowsy"  },
  { start:420, end:600,  status:"focus"   },
]
const TOTAL_DURATION = 600

const STATUS_COLOR = {
  focus:   "#22c98a",
  unfocus: "#f5c518",
  drowsy:  "#f06060",
}

const QUIZZES = [
  { id: 1, subject: "수학", question: "미분의 기본 정의는?",   difficulty: "중" },
  { id: 2, subject: "영어", question: "현재완료 용법 3가지?",  difficulty: "하" },
  { id: 3, subject: "물리", question: "뉴턴 제2법칙 F=?",     difficulty: "하" },
  { id: 4, subject: "화학", question: "몰(mol)의 정의는?",    difficulty: "상" },
]

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0")
  const s = String(sec % 60).padStart(2, "0")
  return `${m}:${s}`
}

export default function LecturePage() {
  const [focusScore, setFocusScore] = useState(82)
  const [pomMode, setPomMode]       = useState("공부")
  const [pomTime, setPomTime]       = useState(25 * 60)
  const [pomRunning, setPomRunning] = useState(false)
  const [quests, setQuests]         = useState([
    { id:1, title:"강의 30분 수강", done:true  },
    { id:2, title:"퀴즈 1개 풀기",  done:false },
    { id:3, title:"집중도 80점↑",   done:false },
  ])
  const [petOpen, setPetOpen]   = useState(false)
  // in-page 다시보기 seek (초 단위)
  const [seekTime, setSeekTime] = useState(null)

  const location = useLocation()
  const seekTo   = location.state?.seekTo   // Dashboard 다시보기에서 전달되는 시간 문자열

  // 뽀모도로 타이머
  useEffect(() => {
    if (!pomRunning) return
    const t = setInterval(() => {
      setPomTime(p => {
        if (p <= 1) { clearInterval(t); setPomRunning(false); return 0 }
        return p - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [pomRunning])

  // 🔌 TODO(백엔드): CV 집중도 polling (5초마다) → GET /api/cv/focus-score
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res  = await fetch("백엔드주소/api/cv/focus-score")
        const data = await res.json()
        setFocusScore(data.score)
      } catch {
        setFocusScore(Math.floor(60 + Math.random() * 35))
      }
    }, 5000)
    return () => clearInterval(t)
  }, [])

  const mins     = String(Math.floor(pomTime / 60)).padStart(2, "0")
  const secs     = String(pomTime % 60).padStart(2, "0")
  const total    = pomMode === "공부" ? 25*60 : pomMode === "휴식" ? 5*60 : 15*60
  const progress = ((total - pomTime) / total) * 100

  const completedCount = quests.filter(q => q.done).length

  // 미집중/졸음 구간만 추출
  const badSegments = DUMMY_SEGMENTS.filter(s => s.status !== "focus")

  // 배너: Dashboard의 seekTo 또는 in-page seekTime 중 하나 표시
  const showBanner    = seekTo || seekTime !== null
  const bannerTimeStr = seekTime !== null ? formatTime(seekTime) : seekTo

  return (
    <div style={{ width:"100%", height:"100%", background:"#0b1220",
                  color:"#fff", fontFamily:"'Noto Sans KR',sans-serif",
                  display:"flex", flexDirection:"column", overflow:"hidden",
                  position:"relative" }}>

      <SharedHeader showHome />

      {/* 다시보기 배너 */}
      {showBanner && (
        <div style={{ background:"rgba(245,197,24,0.15)", borderBottom:"1px solid #f5c518",
                      padding:"8px 20px", fontSize:12, color:"#f5c518",
                      display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          ▶ <strong>{bannerTimeStr}</strong> 구간으로 이동했습니다. 해당 구간을 다시 확인해보세요!
          {seekTime !== null && (
            <button onClick={() => setSeekTime(null)}
              style={{ marginLeft:"auto", background:"none", border:"1px solid #f5c518",
                       borderRadius:5, padding:"2px 8px", color:"#f5c518",
                       fontSize:11, cursor:"pointer" }}>✕ 닫기</button>
          )}
        </div>
      )}

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* 왼쪽 — 강의 영상 + 타임라인 + 다시보기 */}
        <div style={{ flex:1, display:"flex", flexDirection:"column",
                      padding:16, gap:12, overflow:"auto" }}>

          {/* 강의 영상 영역 */}
          {/* 🔌 TODO(백엔드): 실제 동영상 플레이어 삽입, seekTime 으로 currentTime 제어 */}
          <div style={{ background:"#1a2a3a", borderRadius:10,
                        border:"1px solid #2a3a5a",
                        aspectRatio:"16/9", display:"flex",
                        alignItems:"center", justifyContent:"center",
                        fontSize:40, color:"#2a3a5a", position:"relative" }}>
            📺
            {seekTime !== null && (
              <div style={{ position:"absolute", top:12, left:12,
                            background:"rgba(245,197,24,0.18)", border:"1px solid #f5c518",
                            borderRadius:7, padding:"4px 10px",
                            fontSize:11, color:"#f5c518", fontWeight:700 }}>
                ▶ {formatTime(seekTime)} 구간 재생중
              </div>
            )}
            <div style={{ position:"absolute", bottom:12, left:12,
                          fontSize:12, color:"#aaa" }}>
              강의 화면 (영상 연결 전)
            </div>
          </div>

          {/* 집중도 타임라인 */}
          <div style={{ background:"#1a2a3a", borderRadius:10,
                        border:"1px solid #2a3a5a", padding:14 }}>
            <div style={{ fontSize:12, color:"#7ec8f5", fontWeight:700, marginBottom:8 }}>
              집중도 타임라인
            </div>

            {/* 타임라인 바 */}
            <div style={{ display:"flex", height:24, borderRadius:6, overflow:"hidden", gap:2,
                          marginBottom:8 }}>
              {DUMMY_SEGMENTS.map((seg, i) => {
                const w = ((seg.end - seg.start) / TOTAL_DURATION * 100) + "%"
                return (
                  <div key={i}
                    onClick={() => seg.status !== "focus" && setSeekTime(seg.start)}
                    title={`${formatTime(seg.start)} ~ ${formatTime(seg.end)}: ${seg.status}`}
                    style={{ width:w, background:STATUS_COLOR[seg.status],
                             cursor: seg.status !== "focus" ? "pointer" : "default",
                             opacity: seekTime === seg.start ? 1 : 0.82,
                             outline: seekTime === seg.start ? `2px solid #fff` : "none",
                             transition:"opacity 0.15s" }}
                    onMouseEnter={e => e.target.style.opacity = 1}
                    onMouseLeave={e => { e.target.style.opacity = seekTime === seg.start ? 1 : 0.82 }} />
                )
              })}
            </div>

            {/* 범례 */}
            <div style={{ display:"flex", gap:16, marginBottom:12 }}>
              {Object.entries(STATUS_COLOR).map(([k, v]) => (
                <div key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:v }} />
                  <span style={{ color:"#aaa" }}>
                    {k === "focus" ? "집중" : k === "unfocus" ? "미집중" : "졸음"}
                  </span>
                </div>
              ))}
            </div>

            {/* 미집중/졸음 구간 다시보기 목록 */}
            <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700, marginBottom:8 }}>
              📌 미집중/졸음 구간 다시보기
            </div>
            {badSegments.map((seg, i) => (
              <div key={i}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                          padding:"8px 10px", marginBottom:6, borderRadius:8,
                          background:"#0d1825",
                          border:`1px solid ${STATUS_COLOR[seg.status]}44` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%",
                                background:STATUS_COLOR[seg.status], flexShrink:0 }} />
                  <span style={{ fontSize:11, color:STATUS_COLOR[seg.status], fontWeight:700 }}>
                    {seg.status === "unfocus" ? "미집중" : "졸음 감지"}
                  </span>
                  <span style={{ fontSize:11, color:"#aaa" }}>
                    {formatTime(seg.start)} ~ {formatTime(seg.end)}
                  </span>
                  <span style={{ fontSize:10, color:"#555" }}>
                    ({Math.round((seg.end - seg.start) / 60)}분)
                  </span>
                </div>
                {/* 🔌 TODO(백엔드): seekTime 으로 실제 플레이어 seek 연동 */}
                <button
                  onClick={() => setSeekTime(seg.start)}
                  style={{ background: seekTime === seg.start
                              ? "#f5c518" : "rgba(30,70,140,0.6)",
                           border: `1px solid ${seekTime === seg.start ? "#f5c518" : "#4a8ade"}`,
                           borderRadius:6, padding:"4px 12px", fontSize:11,
                           color: seekTime === seg.start ? "#000" : "#7ec8f5",
                           fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                  {seekTime === seg.start ? "▶ 재생중" : "▶ 다시보기"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽 사이드바 */}
        <div style={{ width:280, display:"flex", flexDirection:"column",
                      gap:10, padding:"12px 12px 12px 0", overflow:"hidden" }}>

          {/* 웹캠 */}
          <WebcamPanel
            focusScore={focusScore}
            setFocusScore={setFocusScore}
          />

          {/* 뽀모도로 */}
          <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                        borderRadius:10, padding:12, flexShrink:0 }}>
            <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700,
                          marginBottom:8 }}>뽀모도로🍅</div>
            <div style={{ display:"flex", gap:4, marginBottom:10 }}>
              {["공부","휴식","파워냅"].map(m => (
                <button key={m} onClick={() => {
                  setPomMode(m); setPomRunning(false)
                  setPomTime(m==="공부"?25*60:m==="휴식"?5*60:15*60)
                }} style={{ flex:1, padding:"3px 0", fontSize:10,
                             fontWeight:700,
                             background: pomMode===m ? "#f5c518" : "transparent",
                             color: pomMode===m ? "#000" : "#aaa",
                             border:"1px solid",
                             borderColor: pomMode===m ? "#f5c518" : "#2a3a5a",
                             borderRadius:5, cursor:"pointer" }}>
                  {m}
                </button>
              ))}
            </div>
            <div style={{ textAlign:"center", fontSize:22, fontWeight:700,
                          color:"#f5c518" }}>
              {mins}:{secs}
            </div>
            {/* 진행 바 */}
            <div style={{ height:4, background:"#1a2a4a", borderRadius:2,
                          overflow:"hidden", margin:"6px 0 8px" }}>
              <div style={{ width:progress+"%", height:"100%",
                            background:"linear-gradient(90deg,#f5c518,#e0a800)",
                            borderRadius:2, transition: pomRunning ? "width 1s linear" : "none" }} />
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => setPomRunning(r=>!r)}
                style={{ flex:1, padding:"5px 0", fontSize:11, fontWeight:700,
                          background:"#f5c518", border:"none", borderRadius:6,
                          cursor:"pointer", color:"#000" }}>
                {pomRunning ? "⏸ 정지" : "▶ 시작"}
              </button>
              <button onClick={() => {
                setPomRunning(false)
                setPomTime(pomMode==="공부"?25*60:pomMode==="휴식"?5*60:15*60)
              }} style={{ padding:"5px 10px", fontSize:11, background:"#1a2a4a",
                          border:"1px solid #2a3a5a", borderRadius:6,
                          cursor:"pointer", color:"#aaa" }}>↺</button>
            </div>
          </div>

          {/* 퀘스트 진행 — X/Y 형태 */}
          <div style={{ background:"#1a2a3a", borderRadius:10,
                        border:"1px solid #2a3a5a", padding:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between",
                          alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#7ec8f5" }}>
                퀘스트 진행 현황
              </div>
              <div style={{ fontSize:11, fontWeight:700,
                            color: completedCount === quests.length ? "#22c98a" : "#f5c518" }}>
                {completedCount}/{quests.length}
              </div>
            </div>
            {quests.map(q => (
              <div key={q.id}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                         fontSize:11, padding:"5px 0", borderBottom:"1px solid #1a2a4a" }}>
                <span style={{ color: q.done ? "#aaa" : "#fff",
                               textDecoration: q.done ? "line-through" : "none" }}>
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

      {/* 고정 펫 캐릭터 (우측 하단) */}
      {/* 🔌 TODO(백엔드): 마을의 펫과 동일 인스턴스로 동기화 */}
      <PetCharFixed onOpen={() => setPetOpen(true)} />
      {petOpen && <PetPopup onClose={() => setPetOpen(false)} />}
    </div>
  )
}
// ── 웹캠 패널 ──────────────────────────────────────────
function WebcamPanel({ focusScore, setFocusScore }) {
  const [cvActive,    setCvActive]    = useState(false)
  const [focusLabel,  setFocusLabel]  = useState("focus")
  const [loading,     setLoading]     = useState(false)
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const intervalRef = useRef(null)
  const imgRef      = useRef(null)

  const BASE = "https://stonewall-rival-sternum.ngrok-free.dev/api/chat"

  const STATUS_LABEL = {
    focused:   "집중 중",
    unfocused: "미집중",
    drowsy:    "졸음 감지",
    writing:   "필기 중",
  }
  const STATUS_COLOR_MAP = {
    focused:   "#22c98a",
    unfocused: "#f5c518",
    drowsy:    "#f06060",
    writing:   "#7c6ff7",
  }

  // ── 웹캠 켜기 ───────────────────────────
  async function startWebcam() {
    setLoading(true)
    try {
      const stream = await navigator.mediaDevices
        .getUserMedia({ video: true })
      videoRef.current.srcObject = stream
      setCvActive(true)

      // 200ms마다 프레임 백엔드로 전송
      intervalRef.current = setInterval(async () => {
        const canvas = canvasRef.current
        const video  = videoRef.current
        if (!canvas || !video) return

        canvas.width  = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext("2d").drawImage(video, 0, 0)

        canvas.toBlob(async (blob) => {
          try {
            const formData = new FormData()
            formData.append("file", blob, "frame.jpg")

            const res = await fetch(`${BASE}/api/cv/analyze`, {
              method: "POST",
              body:   formData,
            })

            // 백엔드 처리 이미지 화면에 표시
            const imgBlob = await res.blob()
            const imgUrl  = URL.createObjectURL(imgBlob)
            if (imgRef.current) {
              // 이전 URL 메모리 해제
              if (imgRef.current._prevUrl) {
                URL.revokeObjectURL(imgRef.current._prevUrl)
              }
              imgRef.current.src      = imgUrl
              imgRef.current._prevUrl = imgUrl
            }

            // 헤더에서 집중도 읽기
            const score = parseInt(res.headers.get("X-Focus-Score") || "50")
            const label = res.headers.get("X-Focus-Label") || "focused"
            setFocusScore(score)
            setFocusLabel(label)

          } catch {
            // 백엔드 연결 실패 시 더미
            setFocusScore(Math.floor(60 + Math.random() * 35))
          }
        }, "image/jpeg")

      }, 200)

    } catch {
      alert("웹캠 접근 실패. 카메라 권한을 확인해주세요.")
    } finally {
      setLoading(false)
    }
  }

  // ── 웹캠 끄기 ───────────────────────────
  function stopWebcam() {
    clearInterval(intervalRef.current)
    intervalRef.current = null

    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }

    if (imgRef.current?._prevUrl) {
      URL.revokeObjectURL(imgRef.current._prevUrl)
    }

    setCvActive(false)
    setFocusScore(0)
    setFocusLabel("focused")
  }

  // 언마운트 시 자동 정리
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current)
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const curColor = STATUS_COLOR_MAP[focusLabel] ?? "#22c98a"
  const curLabel = STATUS_LABEL[focusLabel]     ?? focusLabel

  return (
    <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                  borderRadius:10, padding:12, flexShrink:0 }}>

      {/* 헤더 */}
      <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700,
                    marginBottom:8 }}>
        웹캠 상태
      </div>

      {/* 숨겨진 video — 웹캠 원본 */}
      <video ref={videoRef} autoPlay muted
        style={{ display:"none" }} />

      {/* 숨겨진 canvas — 프레임 캡처용 */}
      <canvas ref={canvasRef} style={{ display:"none" }} />

      {/* 백엔드 처리 이미지 */}
      <div style={{ position:"relative", borderRadius:8,
                    overflow:"hidden", background:"#0d1520",
                    minHeight:120 }}>
        <img ref={imgRef}
          style={{ width:"100%", borderRadius:8,
                   display: cvActive ? "block" : "none",
                   minHeight:120, objectFit:"cover" }}
          alt="CV 처리 화면" />

        {/* 꺼진 상태 */}
        {!cvActive && !loading && (
          <div style={{ height:120, display:"flex",
                        flexDirection:"column",
                        alignItems:"center", justifyContent:"center",
                        color:"#2a3a5a" }}>
            <div style={{ fontSize:32 }}>📷</div>
            <div style={{ fontSize:10, color:"#555", marginTop:4 }}>
              켜기 버튼을 눌러주세요
            </div>
          </div>
        )}

        {/* 로딩 상태 */}
        {loading && (
          <div style={{ height:120, display:"flex",
                        flexDirection:"column",
                        alignItems:"center", justifyContent:"center",
                        color:"#7ec8f5" }}>
            <div style={{ fontSize:20 }}>⏳</div>
            <div style={{ fontSize:10, marginTop:4 }}>연결 중...</div>
          </div>
        )}

        {/* 켜진 상태 — 상태 뱃지 */}
        {cvActive && (
          <div style={{ position:"absolute", top:6, left:6,
                        background:"rgba(0,0,0,0.65)",
                        borderRadius:5, padding:"2px 8px",
                        display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:"50%",
                          background: curColor,
                          animation:"pulse 1.5s infinite" }} />
            <span style={{ fontSize:9, color: curColor, fontWeight:700 }}>
              {curLabel}
            </span>
          </div>
        )}
      </div>

      {/* 집중도 점수 */}
      <div style={{ marginTop:8, display:"flex",
                    justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:11, color:"#aaa" }}>실시간 집중도</div>
        <div style={{ fontSize:14, fontWeight:700,
                      color: cvActive ? curColor : "#555" }}>
          {cvActive ? `${focusScore}점` : "--"}
        </div>
      </div>

      {/* 점수 바 */}
      <div style={{ height:4, background:"#0d1520",
                    borderRadius:2, marginTop:5, overflow:"hidden" }}>
        <div style={{ width: cvActive ? `${focusScore}%` : "0%",
                      height:"100%", background: curColor,
                      borderRadius:2,
                      transition:"width 0.3s ease, background 0.5s ease" }} />
      </div>

      {/* 켜기 / 끄기 버튼 */}
      <button
        onClick={cvActive ? stopWebcam : startWebcam}
        disabled={loading}
        style={{ width:"100%", marginTop:8, padding:"6px 0",
                 background: loading   ? "#333"
                            : cvActive ? "#f06060"
                            :            "#22c98a",
                 border:"none", borderRadius:6,
                 color:"#fff", fontWeight:700,
                 cursor: loading ? "not-allowed" : "pointer",
                 fontSize:12, opacity: loading ? 0.7 : 1,
                 transition:"background 0.2s" }}>
        {loading ? "연결 중..." : cvActive ? "⏹ 끄기" : "▶ 켜기"}
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity:1; }
          50%       { opacity:0.3; }
        }
      `}</style>
    </div>
  )
}
// ── 고정 펫 캐릭터 (우측 하단) ──

function PetCharFixed({ onOpen }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ position:"fixed", bottom:24, right:24, zIndex:100,
               cursor:"pointer", display:"flex", flexDirection:"column",
               alignItems:"center", userSelect:"none" }}>
      {hov && (
        <div style={{ position:"relative", marginBottom:5 }}>
          <div style={{ background:"#fff", color:"#222", fontSize:9, fontWeight:600,
                        padding:"3px 8px", borderRadius:7, border:"1px solid #ccc",
                        whiteSpace:"nowrap" }}>
            포석호와 대화하기 😊
          </div>
          <div style={{ position:"absolute", bottom:-5, left:"50%",
                        transform:"translateX(-50%)", width:0, height:0,
                        borderLeft:"4px solid transparent",
                        borderRight:"4px solid transparent",
                        borderTop:"5px solid #ccc" }} />
        </div>
      )}
      <div style={{ transform: hov ? "translateY(-6px)" : "none",
                    transition:"transform 0.18s ease",
                    display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ fontSize:8, color:"#7ec8f5", fontWeight:700, marginBottom:3,
                      background:"rgba(13,21,32,0.9)", padding:"1px 6px",
                      borderRadius:6, border:"1px solid #2a3a5a" }}>포석호</div>
        <div style={{ fontSize:24, lineHeight:1 }}>🐻‍❄️</div>
        <div style={{ width:18, height:13, background:"#e8843a", marginTop:1,
                      borderRadius:"3px 3px 0 0",
                      boxShadow:"inset 0 -2px 0 rgba(0,0,0,0.22)" }} />
        <div style={{ display:"flex", gap:2 }}>
          {[0,1].map(i => (
            <div key={i} style={{ width:7, height:10, background:"#c05a20",
                                   borderRadius:"0 0 2px 2px" }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 펫 팝업 (질문하기 / 퀴즈 풀기) ──

function PetPopup({ onClose }) {
  const [mode, setMode]               = useState("question")
  const [messages, setMessages]       = useState([
    { type:"npc", text:"안녕하세요! 궁금한 게 있으면 물어보세요. 퀴즈도 풀 수 있어요 😊" }
  ])
  const [input, setInput]             = useState("")
  const [loading, setLoading]         = useState(false)
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const chatRef                         = useRef(null)

  function scrollBottom() {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }

  async function sendMsg(text) {
    if (!text?.trim() || loading) return
    const txt = text.trim()
    if (txt === input) setInput("")
    setMessages(prev => [...prev, { type:"user", text:txt }])
    setLoading(true)
    try {
      // 🔌 TODO(백엔드): 실제 LLM 엔드포인트로 교체
      const res = await fetch("https://stonewall-rival-sternum.ngrok-free.dev", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "ngrok-skip-browser-warning":"true" },
        body:JSON.stringify({ message:txt }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { type:"npc", text:data.reply }])
    } catch {
      setMessages(prev => [...prev, { type:"npc", text:"(더미 응답) 네, 이해했어요!" }])
    } finally {
      setLoading(false)
      setTimeout(scrollBottom, 50)
    }
  }

  function startQuiz(quiz) {
    setSelectedQuiz(quiz)
    sendMsg(`[${quiz.subject}] "${quiz.question}" 퀴즈를 풀고 싶어요!`)
  }

  return (
    <>
      <div onClick={onClose}
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:200 }} />
      <div style={{ position:"fixed", top:"50%", left:"50%",
                    transform:"translate(-50%,-50%)",
                    background:"#0d1520", border:"1px solid #2a3a5a",
                    borderRadius:14, padding:24, zIndex:201,
                    width:"min(520px,92vw)", maxHeight:"88vh", overflowY:"auto" }}>
        <button onClick={onClose}
          style={{ position:"absolute", top:12, right:14, background:"none",
                   border:"none", color:"#555", fontSize:18, cursor:"pointer" }}>✕</button>

        <div style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>🐻‍❄️ 포석호</div>

        {/* 모드 탭 */}
        <div style={{ display:"flex", gap:6, marginBottom:14 }}>
          {[
            { key:"question", label:"❓ 질문하기",  activeColor:"#f5c518", activeText:"#000" },
            { key:"quiz",     label:"📝 퀴즈 풀기", activeColor:"#7c6ff7", activeText:"#fff" },
          ].map(t => (
            <button key={t.key} onClick={() => setMode(t.key)}
              style={{ flex:1, padding:"8px 0", fontSize:12, fontWeight:700,
                       background: mode===t.key ? t.activeColor : "#1a2a3a",
                       color: mode===t.key ? t.activeText : "#aaa",
                       border:`1px solid ${mode===t.key ? t.activeColor : "#2a3a5a"}`,
                       borderRadius:8, cursor:"pointer", transition:"all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 퀴즈 모드: 목록 */}
        {mode === "quiz" && (
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:12 }}>
            {QUIZZES.map(q => (
              <div key={q.id}
                onClick={() => startQuiz(q)}
                style={{ padding:"8px 12px", borderRadius:8, cursor:"pointer",
                         display:"flex", justifyContent:"space-between", alignItems:"center",
                         background: selectedQuiz?.id===q.id ? "#1e3050" : "#1a2a3a",
                         border:`1px solid ${selectedQuiz?.id===q.id ? "#7c6ff7" : "#2a3a5a"}`,
                         transition:"all 0.15s" }}>
                <span style={{ fontSize:12 }}>
                  <span style={{ color:"#7ec8f5", marginRight:6, fontSize:11 }}>[{q.subject}]</span>
                  {q.question}
                </span>
                <span style={{ fontSize:10, padding:"2px 6px", borderRadius:8, marginLeft:8, flexShrink:0,
                               background: q.difficulty==="하"?"#1a4a2a":q.difficulty==="중"?"#4a3a1a":"#4a1a1a",
                               color: q.difficulty==="하"?"#22c98a":q.difficulty==="중"?"#f5c518":"#ff6b6b" }}>
                  {q.difficulty}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 채팅 영역 */}
        <div ref={chatRef}
          style={{ height:200, overflowY:"auto", display:"flex",
                   flexDirection:"column", gap:6, marginBottom:10,
                   borderTop:"1px solid #2a3a5a", paddingTop:10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display:"flex",
                                   justifyContent: m.type==="user" ? "flex-end" : "flex-start",
                                   alignItems:"flex-end", gap:4 }}>
              {m.type === "npc" && <span style={{ fontSize:14, flexShrink:0 }}>🐻‍❄️</span>}
              <div style={{ maxWidth:"78%", padding:"7px 11px", borderRadius:10,
                             fontSize:12, lineHeight:1.5,
                             background: m.type==="user" ? "#f5c518" : "#1a2a4a",
                             color: m.type==="user" ? "#000" : "#fff" }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ fontSize:11, color:"#555", paddingLeft:22 }}>입력 중...</div>
          )}
        </div>

        {/* 입력창 */}
        <div style={{ display:"flex", gap:6 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==="Enter" && sendMsg(input)}
            placeholder={mode==="question" ? "궁금한 것을 물어보세요..." : "답변을 입력하세요..."}
            disabled={loading}
            style={{ flex:1, background:"#1a2a4a", border:"1px solid #2a3a5a",
                     borderRadius:8, padding:"8px 12px", color:"#fff",
                     fontSize:12, outline:"none", opacity:loading?0.6:1 }} />
          <button onClick={() => sendMsg(input)} disabled={loading}
            style={{ background:"#f5c518", border:"none", borderRadius:8,
                     padding:"8px 16px", fontWeight:700,
                     cursor:loading?"not-allowed":"pointer",
                     fontSize:12, opacity:loading?0.6:1 }}>전송</button>
        </div>
      </div>
    </>
  )
}
