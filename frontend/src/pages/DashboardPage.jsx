import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import SharedHeader from "../components/SharedHeader"

const HOURLY = [45,30,20,10,5,0,0,60,75,82,88,70,65,80,85,90,72,60,55,40,30,20,10,5]
const SUBJECTS = [
  { name:"수학",  score:85, color:"#7c6ff7" },
  { name:"영어",  score:72, color:"#22c98a" },
  { name:"물리",  score:60, color:"#38a4f8" },
  { name:"화학",  score:90, color:"#f5a623" },
]
const UNFOCUSED = [
  { time:"09:23", duration:"3분", lecture:"수학 - 미분 기초" },
  { time:"11:45", duration:"5분", lecture:"영어 - 독해 전략" },
  { time:"14:12", duration:"2분", lecture:"물리 - 운동 법칙" },
]

const QUIZZES = [
  { id:1, subject:"수학",  question:"미분의 기본 정의는?",  difficulty:"중" },
  { id:2, subject:"영어",  question:"현재완료 용법 3가지?", difficulty:"하" },
  { id:3, subject:"물리",  question:"뉴턴 제2법칙 F=?",    difficulty:"하" },
  { id:4, subject:"화학",  question:"몰(mol)의 정의는?",   difficulty:"상" },
]

export default function DashboardPage() {
  const [tab, setTab]           = useState("오늘")
  const [quizOpen, setQuizOpen] = useState(false)
  const navigate                = useNavigate()

  return (
    <div style={{ width:"100%", height:"100%", background:"#0b1220",
                  color:"#fff", fontFamily:"'Noto Sans KR',sans-serif",
                  overflow:"auto", display:"flex", flexDirection:"column" }}>

      <SharedHeader showHome />

      {/* 서브 헤더 */}
      <div style={{ padding:"12px 20px", borderBottom:"1px solid #1a2a4a",
                    display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontWeight:700, fontSize:16 }}>📊 학습 리포트</div>
        <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
          {["오늘","이번 주","이번 달"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding:"4px 12px", fontSize:11, fontWeight:700,
                       background: tab===t ? "#f5c518" : "transparent",
                       color: tab===t ? "#000" : "#aaa",
                       border:"1px solid", borderColor: tab===t ? "#f5c518" : "#2a3a5a",
                       borderRadius:20, cursor:"pointer" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>

        {/* 요약 카드 4개 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {[
            { label:"오늘 집중도 점수", value:"82점",  color:"#7c6ff7" },
            { label:"오늘 집중 시간",   value:"3h 20m",color:"#22c98a" },
            { label:"오늘 미집중 시간", value:"40m",   color:"#f5c518" },
            { label:"졸음 감지",        value:"2회",   color:"#f06060" },
          ].map((c,i) => (
            <div key={i} style={{ background:"#1a2a3a", border:`1px solid ${c.color}44`,
                                   borderRadius:10, padding:14, textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#aaa", marginBottom:6 }}>{c.label}</div>
              <div style={{ fontSize:26, fontWeight:700, color:c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* 시간대별 집중도 바 차트 */}
        <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                      borderRadius:10, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:"#7ec8f5" }}>
            오늘 전체 타임라인 (시간대별 집중도)
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", height:80, gap:2 }}>
            {HOURLY.map((v,i) => (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
                                    alignItems:"center", gap:2 }}>
                <div style={{ width:"100%", height:v===0?2:`${v}%`,
                               background:v>=70?"#22c98a":v>=40?"#f5c518":"#f06060",
                               borderRadius:"3px 3px 0 0", transition:"height 0.3s",
                               opacity:v===0?0.2:0.85 }} />
                {i%4===0 && <div style={{ fontSize:9, color:"#555" }}>{i}시</div>}
              </div>
            ))}
          </div>
        </div>

        {/* 과목별 집중도 */}
        <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                      borderRadius:10, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:"#7ec8f5" }}>
            과목별 집중도 점수
          </div>
          {SUBJECTS.map((s,i) => {
            const grade = s.score>=90?"S":s.score>=80?"A":s.score>=70?"B":s.score>=60?"C":"D"
            return (
              <div key={i} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between",
                               fontSize:12, marginBottom:4 }}>
                  <span>{s.name}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ color:s.color, fontWeight:700 }}>{s.score}점</span>
                    <span style={{ background:s.color+"33", color:s.color, fontSize:10,
                                   fontWeight:700, padding:"1px 6px", borderRadius:4 }}>
                      {grade}
                    </span>
                  </div>
                </div>
                <div style={{ height:6, background:"#0d1520", borderRadius:3 }}>
                  <div style={{ width:`${s.score}%`, height:"100%", background:s.color,
                                borderRadius:3, transition:"width 0.5s" }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* 미집중 구간 + 퀴즈 대시보드 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>

          {/* 미집중 구간 */}
          <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                        borderRadius:10, padding:16 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:"#7ec8f5" }}>
              미집중 구간 모음
            </div>
            {UNFOCUSED.map((u,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                                     alignItems:"center", padding:"8px 0",
                                     borderBottom:"1px solid #1a2a4a", fontSize:12 }}>
                <div>
                  <div style={{ color:"#f5c518" }}>{u.time}</div>
                  <div style={{ color:"#aaa", fontSize:11 }}>{u.lecture}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ color:"#f06060" }}>{u.duration}</span>
                  <button
                    onClick={() => navigate("/lecture", { state:{ seekTo: u.time } })}
                    style={{ fontSize:10, background:"#f5c518", border:"none",
                             borderRadius:5, padding:"3px 8px",
                             cursor:"pointer", fontWeight:700 }}>
                    다시보기
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 퀴즈 대시보드 */}
          <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                        borderRadius:10, padding:16 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:"#7ec8f5" }}>
              퀴즈 대시보드
            </div>
            {[
              { label:"오늘 푼 퀴즈", value:"5개",  color:"#22c98a" },
              { label:"정답률",       value:"80%",  color:"#f5c518" },
              { label:"획득 경험치",  value:"450",  color:"#7c6ff7" },
            ].map((s,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                                     padding:"8px 0", borderBottom:"1px solid #1a2a4a",
                                     fontSize:12 }}>
                <span style={{ color:"#aaa" }}>{s.label}</span>
                <span style={{ color:s.color, fontWeight:700 }}>{s.value}</span>
              </div>
            ))}
            <button
              onClick={() => setQuizOpen(true)}
              style={{ width:"100%", marginTop:12, padding:"8px 0",
                       background:"#7c6ff7", border:"none",
                       borderRadius:8, color:"#fff", fontSize:12,
                       fontWeight:700, cursor:"pointer" }}>
              🐾 펫이랑 퀴즈 풀기 →
            </button>
          </div>
        </div>
      </div>

      {/* 펫 퀴즈 팝업 */}
      {quizOpen && <PetQuizPopup onClose={() => setQuizOpen(false)} />}
    </div>
  )
}

// ── 펫 퀴즈 팝업 (대시보드용) ──

function PetQuizPopup({ onClose }) {
  const [messages, setMessages]       = useState([])
  const [input, setInput]             = useState("")
  const [loading, setLoading]         = useState(true)
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const chatRef                         = useRef(null)

  // 마운트 시 펫 자동 연결
  useState(() => {
    async function connectPet() {
      try {
        const res = await fetch("https://stonewall-rival-sternum.ngrok-free.dev", {
          method:"POST",
          headers:{ "Content-Type":"application/json", "ngrok-skip-browser-warning":"true" },
          body:JSON.stringify({ message:"퀴즈 대시보드 연결" }),
        })
        const data = await res.json()
        setMessages([{ type:"npc", text:data.reply }])
      } catch {
        setMessages([{ type:"npc", text:"안녕하세요! 📊 오늘의 퀴즈 대시보드입니다. 퀴즈를 선택해 다시 풀어볼까요?" }])
      } finally {
        setLoading(false)
      }
    }
    connectPet()
  })

  function scrollBottom() {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }

  function selectQuiz(quiz) {
    if (selectedQuiz?.id === quiz.id || loading) return
    setSelectedQuiz(quiz)
    const msg = `[${quiz.subject}] "${quiz.question}" 다시 풀고 싶어요!`
    setMessages(prev => [...prev, { type:"user", text:msg }])
    setLoading(true)
    fetch("https://stonewall-rival-sternum.ngrok-free.dev", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "ngrok-skip-browser-warning":"true" },
      body:JSON.stringify({ message:msg }),
    })
      .then(r => r.json())
      .then(data => { setMessages(prev => [...prev, { type:"npc", text:data.reply }]); setTimeout(scrollBottom,50) })
      .catch(() => { setMessages(prev => [...prev, { type:"npc", text:`"${quiz.question}" — 한 번 더 답해보세요! 😊` }]); setTimeout(scrollBottom,50) })
      .finally(() => setLoading(false))
  }

  async function sendMessage() {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput("")
    setMessages(prev => [...prev, { type:"user", text }])
    setLoading(true)
    try {
      const res = await fetch("https://stonewall-rival-sternum.ngrok-free.dev", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "ngrok-skip-browser-warning":"true" },
        body:JSON.stringify({ message:text }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { type:"npc", text:data.reply }])
    } catch {
      setMessages(prev => [...prev, { type:"npc", text:"(더미) 잘 했어요! 다음 문제로 넘어가볼까요?" }])
    } finally {
      setLoading(false)
      setTimeout(scrollBottom, 50)
    }
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

        <div style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>🐾 펫 퀴즈 복습</div>

        {/* 연결 상태 */}
        <div style={{ fontSize:10, color:"#555", marginBottom:12,
                      display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:7, height:7, borderRadius:"50%",
                        background:loading?"#f5c518":"#22c98a",
                        boxShadow:loading?"0 0 6px #f5c518":"0 0 6px #22c98a" }} />
          {loading ? "펫 연결 중..." : "펫 연결됨"}
        </div>

        {/* 퀴즈 목록 */}
        <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:14 }}>
          {QUIZZES.map(q => (
            <div key={q.id} onClick={() => selectQuiz(q)}
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
                             background:q.difficulty==="하"?"#1a4a2a":q.difficulty==="중"?"#4a3a1a":"#4a1a1a",
                             color:q.difficulty==="하"?"#22c98a":q.difficulty==="중"?"#f5c518":"#ff6b6b" }}>
                {q.difficulty}
              </span>
            </div>
          ))}
        </div>

        {/* 채팅 */}
        <div ref={chatRef}
          style={{ height:180, overflowY:"auto", display:"flex",
                   flexDirection:"column", gap:6, marginBottom:10,
                   borderTop:"1px solid #2a3a5a", paddingTop:10 }}>
          {messages.map((m,i) => (
            <div key={i} style={{ display:"flex",
                                   justifyContent:m.type==="user"?"flex-end":"flex-start",
                                   alignItems:"flex-end", gap:4 }}>
              {m.type==="npc" && <span style={{ fontSize:14, flexShrink:0 }}>🐾</span>}
              <div style={{ maxWidth:"78%", padding:"7px 11px", borderRadius:10,
                             fontSize:12, lineHeight:1.5,
                             background:m.type==="user"?"#f5c518":"#1a2a4a",
                             color:m.type==="user"?"#000":"#fff" }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && messages.length>0 && (
            <div style={{ fontSize:11, color:"#555", paddingLeft:22 }}>입력 중...</div>
          )}
        </div>

        <div style={{ display:"flex", gap:6 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==="Enter" && sendMessage()}
            placeholder={selectedQuiz ? "답변을 입력하세요..." : "퀴즈를 선택하고 시작하세요..."}
            disabled={loading}
            style={{ flex:1, background:"#1a2a4a", border:"1px solid #2a3a5a",
                     borderRadius:8, padding:"8px 12px", color:"#fff",
                     fontSize:12, outline:"none", opacity:loading?0.6:1 }} />
          <button onClick={sendMessage} disabled={loading}
            style={{ background:"#7c6ff7", border:"none", borderRadius:8,
                     padding:"8px 16px", fontWeight:700,
                     cursor:loading?"not-allowed":"pointer",
                     fontSize:12, color:"#fff", opacity:loading?0.6:1 }}>전송</button>
        </div>
      </div>
    </>
  )
}
