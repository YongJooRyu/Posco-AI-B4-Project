import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

// 더미 집중도 데이터
const DUMMY_SEGMENTS = [
  { start:0,   end:120,  status:"focus"   },
  { start:120, end:200,  status:"unfocus" },
  { start:200, end:350,  status:"focus"   },
  { start:350, end:420,  status:"drowsy"  },
  { start:420, end:600,  status:"focus"   },
]

const STATUS_COLOR = {
  focus:   "#22c98a",
  unfocus: "#f5c518",
  drowsy:  "#f06060",
}

export default function LecturePage() {
  const [focusScore, setFocusScore] = useState(82)
  const [status, setStatus]         = useState("focus")
  const [pomMode, setPomMode]       = useState("공부")   // 공부 / 휴식 / 파워냅
  const [pomTime, setPomTime]       = useState(25 * 60)  // 초
  const [pomRunning, setPomRunning] = useState(false)
  const [quests, setQuests]         = useState([
    { id:1, title:"강의 30분 수강", done:true  },
    { id:2, title:"퀴즈 1개 풀기",  done:false },
    { id:3, title:"집중도 80점↑",   done:false },
  ])

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

  // CV 집중도 polling (5초마다)
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res  = await fetch("백엔드주소/api/cv/focus-score")
        const data = await res.json()
        setFocusScore(data.score)
        setStatus(data.status)
      } catch {
        // 백엔드 없을 때 더미
        setFocusScore(Math.floor(60 + Math.random() * 35))
      }
    }, 5000)
    return () => clearInterval(t)
  }, [])

  const mins = String(Math.floor(pomTime / 60)).padStart(2, "0")
  const secs = String(pomTime % 60).padStart(2, "0")
  const total = pomMode === "공부" ? 25*60 : pomMode === "휴식" ? 5*60 : 15*60
  const progress = ((total - pomTime) / total) * 100

  return (
    <div style={{ width:"100%", height:"100%", background:"#0b1220",
                  color:"#fff", fontFamily:"'Noto Sans KR',sans-serif",
                  display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* 상단 프로필 */}
      <TopBar />

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* 왼쪽 — 강의 영상 + 타임라인 */}
        <div style={{ flex:1, display:"flex", flexDirection:"column",
                      padding:16, gap:12, overflow:"auto" }}>

          {/* 강의 영상 영역 */}
          <div style={{ background:"#1a2a3a", borderRadius:10,
                        border:"1px solid #2a3a5a",
                        aspectRatio:"16/9", display:"flex",
                        alignItems:"center", justifyContent:"center",
                        fontSize:40, color:"#2a3a5a", position:"relative" }}>
            📺
            <div style={{ position:"absolute", bottom:12, left:12,
                          fontSize:12, color:"#aaa" }}>
              강의 화면 (영상 연결 전)
            </div>
          </div>

          {/* 집중도 타임라인 */}
          <div style={{ background:"#1a2a3a", borderRadius:10,
                        border:"1px solid #2a3a5a", padding:14 }}>
            <div style={{ fontSize:12, color:"#aaa", marginBottom:8 }}>
              강의 종료 후 집중도 타임라인
            </div>
            <div style={{ display:"flex", height:24, borderRadius:6,
                          overflow:"hidden", gap:2 }}>
              {DUMMY_SEGMENTS.map((seg, i) => {
                const total = 600
                const width = ((seg.end - seg.start) / total * 100) + "%"
                return (
                  <div key={i}
                    title={`${seg.start}초~${seg.end}초: ${seg.status}`}
                    style={{ width, background: STATUS_COLOR[seg.status],
                             cursor:"pointer", opacity:0.85,
                             transition:"opacity 0.15s" }}
                    onMouseEnter={e => e.target.style.opacity = 1}
                    onMouseLeave={e => e.target.style.opacity = 0.85}
                  />
                )
              })}
            </div>
            {/* 범례 */}
            <div style={{ display:"flex", gap:16, marginTop:8 }}>
              {Object.entries(STATUS_COLOR).map(([k,v]) => (
                <div key={k} style={{ display:"flex", alignItems:"center",
                                      gap:4, fontSize:11 }}>
                  <div style={{ width:10, height:10, borderRadius:2,
                                background:v }} />
                  <span style={{ color:"#aaa" }}>
                    {k === "focus" ? "집중" : k === "unfocus" ? "미집중" : "졸음"}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop:8, fontSize:11, color:"#666" }}>
              미집중 구간 시간대를 추출하여 다시보기 추천
            </div>
          </div>
        </div>

        {/* 오른쪽 사이드바 */}
        <div style={{ width:280, display:"flex", flexDirection:"column",
                      gap:12, padding:"16px 16px 16px 0", overflow:"auto" }}>

          {/* 웹캠 */}
          <div style={{ background:"#1a2a3a", borderRadius:10,
                        border:"1px solid #2a3a5a", padding:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#7ec8f5",
                          marginBottom:8 }}>웹캠 상태</div>
            <div style={{ background:"#0d1520", borderRadius:8, height:120,
                          display:"flex", alignItems:"center",
                          justifyContent:"center", color:"#2a3a5a",
                          fontSize:32 }}>
              📷
            </div>
          </div>

          {/* 실시간 집중도 */}
          <div style={{ background:"#1a2a3a", borderRadius:10,
                        border:"1px solid #2a3a5a", padding:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#7ec8f5",
                          marginBottom:8 }}>실시간 집중도</div>
            <div style={{ fontSize:36, fontWeight:700, textAlign:"center",
                          color: focusScore >= 70 ? "#22c98a"
                               : focusScore >= 40 ? "#f5c518" : "#f06060" }}>
              {focusScore}점
            </div>
            <div style={{ textAlign:"center", fontSize:11,
                          color: STATUS_COLOR[status], marginTop:4 }}>
              {status === "focus" ? "집중 중" : status === "unfocus"
                ? "미집중" : "졸음 감지"}
            </div>

            {/* 뽀모도로 */}
            <div style={{ marginTop:12, borderTop:"1px solid #2a3a5a",
                          paddingTop:12 }}>
              <div style={{ fontSize:11, color:"#aaa", marginBottom:8 }}>
                동적 뽀모도로
              </div>

              {/* 모드 탭 */}
              <div style={{ display:"flex", gap:4, marginBottom:10 }}>
                {["공부","휴식","파워냅"].map(m => (
                  <button key={m} onClick={() => {
                    setPomMode(m)
                    setPomRunning(false)
                    setPomTime(m==="공부"?25*60:m==="휴식"?5*60:15*60)
                  }} style={{
                    flex:1, padding:"4px 0", fontSize:10, fontWeight:700,
                    background: pomMode===m ? "#f5c518" : "transparent",
                    color: pomMode===m ? "#000" : "#aaa",
                    border:"1px solid",
                    borderColor: pomMode===m ? "#f5c518" : "#2a3a5a",
                    borderRadius:5, cursor:"pointer"
                  }}>{m}</button>
                ))}
              </div>

              {/* SVG 원형 타이머 */}
              <div style={{ position:"relative", width:100, height:100,
                            margin:"0 auto" }}>
                <svg width="100" height="100">
                  <circle cx="50" cy="50" r="42"
                    fill="none" stroke="#1a2a4a" strokeWidth="8"/>
                  <circle cx="50" cy="50" r="42"
                    fill="none" stroke="#f5c518" strokeWidth="8"
                    strokeDasharray={`${2*Math.PI*42}`}
                    strokeDashoffset={`${2*Math.PI*42*(1-progress/100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                    style={{ transition:"stroke-dashoffset 1s linear" }}/>
                </svg>
                <div style={{ position:"absolute", inset:0,
                              display:"flex", flexDirection:"column",
                              alignItems:"center", justifyContent:"center" }}>
                  <div style={{ fontSize:18, fontWeight:700 }}>
                    {mins}:{secs}
                  </div>
                </div>
              </div>

              {/* 시작/정지 버튼 */}
              <div style={{ display:"flex", gap:6, marginTop:10 }}>
                <button onClick={() => setPomRunning(r => !r)}
                  style={{ flex:1, padding:"6px 0", fontSize:11,
                           fontWeight:700, background:"#f5c518",
                           border:"none", borderRadius:6,
                           cursor:"pointer", color:"#000" }}>
                  {pomRunning ? "⏸ 정지" : "▶ 시작"}
                </button>
                <button onClick={() => {
                  setPomRunning(false)
                  setPomTime(pomMode==="공부"?25*60:pomMode==="휴식"?5*60:15*60)
                }} style={{ padding:"6px 10px", fontSize:11,
                            background:"#1a2a4a", border:"1px solid #2a3a5a",
                            borderRadius:6, cursor:"pointer", color:"#aaa" }}>
                  ↺
                </button>
              </div>
            </div>
          </div>

          {/* 퀘스트 진행 */}
          <div style={{ background:"#1a2a3a", borderRadius:10,
                        border:"1px solid #2a3a5a", padding:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#7ec8f5",
                          marginBottom:8 }}>퀘스트 진행 현황</div>
            {quests.map(q => (
              <div key={q.id}
                style={{ display:"flex", justifyContent:"space-between",
                         alignItems:"center", fontSize:11, padding:"5px 0",
                         borderBottom:"1px solid #1a2a4a" }}>
                <span style={{ color: q.done ? "#aaa" : "#fff",
                               textDecoration: q.done ? "line-through" : "none" }}>
                  {q.title}
                </span>
                <span style={{ color: q.done ? "#22c98a" : "#f5c518",
                               fontWeight:700 }}>
                  {q.done ? "완료" : "진행중"}
                </span>
              </div>
            ))}
          </div>

          {/* 펫 챗봇 */}
          <div style={{ background:"#1a2a3a", borderRadius:10,
                        border:"1px solid #2a3a5a", padding:12,
                        fontSize:12, color:"#aaa", lineHeight:1.6 }}>
            <div style={{ fontWeight:700, color:"#f5c518", marginBottom:6 }}>
              🐾 펫 (챗봇)
            </div>
            집중도 여기서 내가 헷갈리는 개념들을 모아서 사용자 상태 판단.
            강의 끝나면 팝업으로 퀴즈 제출.
          </div>
        </div>
      </div>
    </div>
  )
}

function TopBar() {
  const navigate = useNavigate()
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"10px 16px", background:"#0d1520",
                  borderBottom:"1px solid #1a2a4a", flexShrink:0 }}>
      <button onClick={() => navigate("/town")}
        style={{ background:"#1a2a3a", border:"1px solid #2a3a5a", borderRadius:8,
                 padding:"6px 12px", color:"#aaa", fontSize:12, cursor:"pointer",
                 display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
        🏠 홈
      </button>
      <div style={{ width:36, height:36, background:"#2a3a5a",
                    borderRadius:8, display:"flex", alignItems:"center",
                    justifyContent:"center" }}>🧑</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:13 }}>닉네임</div>
        <div style={{ height:4, background:"#1a2a4a", borderRadius:2,
                      marginTop:3, width:150 }}>
          <div style={{ width:"60%", height:"100%", background:"#f5c518",
                        borderRadius:2 }} />
        </div>
      </div>
      <div style={{ fontSize:11, color:"#aaa" }}>오늘 날짜</div>
      <div style={{ fontSize:11, color:"#f5c518", fontWeight:700 }}>
        연속 7일 도전중
      </div>
    </div>
  )
}