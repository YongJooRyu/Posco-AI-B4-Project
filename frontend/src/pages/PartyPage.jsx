import { useState, useEffect, useRef } from "react"
import SharedHeader from "../components/SharedHeader"

// 🔌 TODO(백엔드): GET /api/party/members
const INIT_MEMBERS = [
  { id:1, name:"영환", score:88, status:"focus",   emoji:"🦊", bodyColor:"#8a4af5", legColor:"#5a2af5", isMe:false, studyTime:"01:23", focusTime:"01:05" },
  { id:2, name:"아름", score:72, status:"unfocus",  emoji:"🐱", bodyColor:"#2ab8a8", legColor:"#1a8878", isMe:false, studyTime:"00:58", focusTime:"00:42" },
  { id:3, name:"준서", score:91, status:"focus",   emoji:"🐻", bodyColor:"#3a7af5", legColor:"#1a5ad5", isMe:false, studyTime:"01:45", focusTime:"01:38" },
  { id:4, name:"용주", score:45, status:"unfocus",  emoji:"🐶", bodyColor:"#d4903a", legColor:"#a06020", isMe:false, studyTime:"00:32", focusTime:"00:10" },
  { id:5, name:"효은", score:82, status:"focus",   emoji:"🐰", bodyColor:"#4a6af5", legColor:"#2a4ae0", isMe:true,  studyTime:"01:12", focusTime:"00:58" },
]

const INIT_CHAT = [
  { id:1, name:"영환", text:"다들 화이팅!", time:"14:23" },
  { id:2, name:"용주", text:"저 잠깐 쉬어야겠어요 ㅠㅠ", time:"14:24" },
  { id:3, name:"효은", text:"저도요 ㅋㅋ 힘내요!", time:"14:25" },
  { id:4, name:"준서", text:"뽀모도로 25분 남았어요!", time:"14:26" },
]

// 🔌 TODO(백엔드): GET /api/party/team-missions
const TEAM_MISSIONS = [
  {
    id: 1,
    title: "모두 20분이상 집중 유지",
    desc: "파티원 전원 20분 이상 집중 상태를 유지하세요",
    progress: { current: 3, total: 5, unit: "명 성공" },
    rewards: [{ type: "EXP", amount: 20, emoji: "⚡" }, { type: "GOLD", amount: 10, emoji: "💰" }],
    status: "진행중",
  },
  {
    id: 2,
    title: "팀 평균 집중도 80점 달성",
    desc: "파티원 집중도 평균이 80점 이상을 달성하세요",
    progress: { current: 1, total: 1, unit: "달성" },
    rewards: [{ type: "EXP", amount: 50, emoji: "⚡" }],
    status: "완료",
  },
]

// 🔌 TODO(백엔드): GET /api/party/individual-missions
const INDIVIDUAL_MISSIONS = [
  { id: 1, title: "집중 25분 연속 성공",   rewards: [{ type: "EXP",  amount: 10, emoji: "⚡" }] },
  { id: 2, title: "퀴즈 1문제 풀기",       rewards: [{ type: "GOLD", amount: 5,  emoji: "💰" }] },
  { id: 3, title: "세션 중 미집중 0회",    rewards: [{ type: "EXP",  amount: 15, emoji: "⚡" }] },
]

// 졸음 제외 — focus / unfocus 2종
const STATUS_COLOR = { focus: "#22c98a", unfocus: "#f5c518" }

const CIRCUMFERENCE = 2 * Math.PI * 44  // r=44

// 내 상태 메시지 (pomMode 기반)
function getMyStatusMsg(pomMode) {
  if (pomMode === "휴식") return "휴식중 ☕"
  return "집중중 💪"
}

// 다른 팀원 상태 메시지
function getMemberStatusMsg(status) {
  if (status === "focus")   return "집중중 💪"
  return "미집중 😅"
}

export default function PartyPage() {
  const [members, setMembers]       = useState(INIT_MEMBERS)
  const [messages, setMessages]     = useState(INIT_CHAT)
  const [input, setInput]           = useState("")

  // 내 뽀모도로만 — 공부/휴식 2종 (파워냅 제거)
  const [pomMode, setPomMode]       = useState("공부")
  const [pomTime, setPomTime]       = useState(25 * 60)
  const [pomRunning, setPomRunning] = useState(false)
  const [pomCount, setPomCount]     = useState(2)
  const pomGoal                     = 4

  const chatRef = useRef(null)

  // 뽀모도로 타이머 (내 것만)
  useEffect(() => {
    if (!pomRunning) return
    const t = setInterval(() => {
      setPomTime(p => {
        if (p <= 1) {
          clearInterval(t)
          setPomRunning(false)
          // 🔌 TODO(백엔드): POST /api/party/pomodoro-complete
          setPomCount(c => Math.min(c + 1, pomGoal))
          return 0
        }
        return p - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [pomRunning])

  // 다른 팀원 점수 더미 업데이트 (5초마다) — 70점 기준 status 자동 반영
  useEffect(() => {
    const t = setInterval(() => {
      setMembers(prev => prev.map(m => {
        if (m.isMe) return m
        const newScore = Math.max(20, Math.min(100, m.score + Math.floor((Math.random() - 0.5) * 12)))
        return {
          ...m,
          score:  newScore,
          status: newScore >= 70 ? "focus" : "unfocus",
        }
      }))
    }, 5000)
    return () => clearInterval(t)
  }, [])

  function sendChat() {
    if (!input.trim()) return
    const now  = new Date()
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`
    setMessages(prev => [...prev, { id: Date.now(), name: "나", text: input, time }])
    setInput("")
    setTimeout(() => {
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
    }, 50)
  }

  // 모드 전환 (공부 ↔ 휴식)
  function switchMode(mode) {
    setPomMode(mode)
    setPomRunning(false)
    setPomTime(mode === "공부" ? 25*60 : 5*60)
  }

  const total       = pomMode === "공부" ? 25*60 : 5*60
  const pomProgress = (total - pomTime) / total
  const pomOffset   = CIRCUMFERENCE * (1 - pomProgress)
  const modeColor   = pomMode === "공부" ? "#f5c518" : "#22c98a"
  const mins        = String(Math.floor(pomTime / 60)).padStart(2, "0")
  const secs        = String(pomTime % 60).padStart(2, "0")
  const sorted      = [...members].sort((a, b) => b.score - a.score)

  return (
    <div style={{ width:"100%", height:"100%", background:"#0b1220", color:"#fff",
                  fontFamily:"'Noto Sans KR',sans-serif", display:"flex",
                  flexDirection:"column", overflow:"hidden", position:"relative" }}>

      <SharedHeader showHome />

      {/* 서브 헤더 */}
      <div style={{ display:"flex", alignItems:"center", padding:"7px 16px",
                    background:"#0d1825", borderBottom:"1px solid #1a2a4a",
                    gap:12, flexShrink:0 }}>
        <div style={{ fontWeight:700, fontSize:13 }}>🍅 토마토 농장 파티</div>
        <div style={{ marginLeft:"auto", fontSize:11, color:"#22c98a", fontWeight:700 }}>
          {members.length}명 접속중
        </div>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* 캐릭터 맵 */}
        <div style={{
          padding:"20px 24px 0",
          background:"linear-gradient(180deg,#0d2244 0%,#1a3a1a 100%)",
          display:"flex", alignItems:"flex-end", gap:20, flexWrap:"wrap",
          justifyContent:"center", flexShrink:0, position:"relative", minHeight:240,
        }}>
          {members.map(m => (
            <PartyChar key={m.id} member={m} pomMode={m.isMe ? pomMode : "공부"} />
          ))}
          {/* 잔디 */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:18,
                        background:"linear-gradient(#3a7a3a,#2a5a2a)",
                        borderTop:"2px solid #4a9a4a", pointerEvents:"none" }} />
        </div>

        {/* 3열 레이아웃 */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* ── 왼쪽: 랭킹 + 개인미션 ── */}
          <div style={{ width:248, display:"flex", flexDirection:"column",
                        gap:10, padding:12, overflow:"auto", flexShrink:0 }}>

            {/* 집중도 랭킹 */}
            <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a", borderRadius:10, padding:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#7ec8f5", marginBottom:10 }}>
                🏆 집중도 점수 랭킹
              </div>
              {sorted.map((m, i) => (
                <div key={m.id}
                  style={{ display:"flex", alignItems:"center", gap:8,
                            padding:"6px 0", borderBottom:"1px solid #1a2a4a",
                            background: m.isMe ? "rgba(245,197,24,0.05)" : "none" }}>
                  <div style={{ width:18, fontSize:11, fontWeight:700, textAlign:"center",
                                 color: i===0?"#f5c518":i===1?"#aaa":i===2?"#cd7f32":"#555" }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize:18 }}>{m.emoji}</div>
                  <div style={{ flex:1, fontSize:11,
                                 color: m.isMe ? "#f5c518" : "#fff",
                                 fontWeight: m.isMe ? 700 : 400 }}>{m.name}</div>
                  <div style={{ fontSize:11, color: STATUS_COLOR[m.status] ?? "#aaa" }}>
                    {m.score}점
                  </div>
                </div>
              ))}
            </div>

            {/* 개인 미션 */}
            <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a", borderRadius:10, padding:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#7ec8f5", marginBottom:10 }}>
                ⚔️ 개인 미션
              </div>
              {INDIVIDUAL_MISSIONS.map((m, idx) => {
                const achieved = idx === 1
                return (
                  <div key={m.id}
                    style={{ padding:"8px 0", borderBottom:"1px solid #1a2a4a",
                              display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontSize:11, color: achieved ? "#aaa" : "#fff",
                                     textDecoration: achieved ? "line-through" : "none" }}>
                        {m.title}
                      </div>
                      <div style={{ fontSize:9, color:"#555", marginTop:2 }}>
                        {m.rewards.map(r => `${r.emoji} +${r.amount} ${r.type}`).join(" · ")}
                      </div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, flexShrink:0, marginLeft:6,
                                   color: achieved ? "#22c98a" : "#f5c518" }}>
                      {achieved ? "완료" : "진행중"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 중앙: 팀 미션 ── */}
          <div style={{ flex:1, padding:12, overflow:"auto", minWidth:0,
                        display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a", borderRadius:10, padding:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#7ec8f5", marginBottom:12 }}>
                🛡️ 팀 미션
              </div>
              {TEAM_MISSIONS.map(tm => {
                const pct = Math.min(100, Math.round(tm.progress.current / tm.progress.total * 100))
                return (
                  <div key={tm.id}
                    style={{ marginBottom:14, padding:14, borderRadius:10,
                              background:"#0d1825", border:"1px solid #2a3a4a" }}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                                   alignItems:"flex-start", marginBottom:6 }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>{tm.title}</div>
                      <span style={{ fontSize:10, padding:"3px 9px", borderRadius:8, fontWeight:700,
                                      flexShrink:0, marginLeft:8,
                                      background: tm.status==="완료" ? "#1a4a2a" : "#3a2a0a",
                                      color: tm.status==="완료" ? "#22c98a" : "#f5c518" }}>
                        {tm.status}
                      </span>
                    </div>
                    <div style={{ fontSize:11, color:"#aaa", marginBottom:10 }}>{tm.desc}</div>
                    <div style={{ display:"flex", justifyContent:"space-between",
                                   fontSize:10, color:"#aaa", marginBottom:5 }}>
                      <span>진행률</span>
                      <span style={{ color:"#fff" }}>
                        {tm.progress.current} / {tm.progress.total} {tm.progress.unit}
                      </span>
                    </div>
                    <div style={{ height:8, background:"#1a2a3a", borderRadius:4,
                                   overflow:"hidden", marginBottom:12, border:"1px solid #2a3a4a" }}>
                      <div style={{ width: pct+"%", height:"100%",
                                     background: tm.status==="완료"
                                       ? "linear-gradient(90deg,#22c98a,#1aa870)"
                                       : "linear-gradient(90deg,#f5c518,#e0a800)",
                                     borderRadius:4, transition:"width 0.6s ease" }} />
                    </div>
                    <div style={{ fontSize:10, color:"#aaa", marginBottom:8 }}>🎁 성공 보상</div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {tm.rewards.map((r, i) => (
                        <div key={i}
                          style={{ display:"flex", alignItems:"center", gap:6,
                                    background:"#1a2a3a", padding:"6px 10px",
                                    borderRadius:7, border:"1px solid #2a3a5a" }}>
                          <span style={{ fontSize:18 }}>{r.emoji}</span>
                          <div>
                            <div style={{ fontSize:9, color:"#aaa" }}>{r.type}</div>
                            <div style={{ fontSize:14, fontWeight:700, color:"#f5c518" }}>+{r.amount}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 오른쪽: 웹캠 + 내 뽀모도로 + 채팅 ── */}
          <div style={{ width:278, display:"flex", flexDirection:"column",
                        gap:10, padding:12, overflow:"hidden", flexShrink:0 }}>

            {/* 웹캠 */}
            <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                          borderRadius:10, padding:12, flexShrink:0 }}>
              <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700, marginBottom:6 }}>
                웹캠
              </div>
              <div style={{ background:"#0d1520", borderRadius:8, height:74,
                            display:"flex", alignItems:"center",
                            justifyContent:"center", fontSize:24, color:"#2a3a5a" }}>📷</div>
              {/* 🔌 TODO(백엔드): GET /focus/tick → focus_score */}
              <div style={{ marginTop:6, fontSize:11, textAlign:"center",
                            color:"#22c98a", fontWeight:700 }}>실시간 집중도: 82점</div>
            </div>

            {/* 내 뽀모도로 (공부 / 휴식 2종만) */}
            <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                          borderRadius:10, padding:12, flexShrink:0 }}>

              {/* 헤더 */}
              <div style={{ display:"flex", alignItems:"center",
                            justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700 }}>
                  뽀모도로 🍅
                </div>
                <div style={{ fontSize:10, color:"#aaa" }}>
                  🍅 <span style={{ color:"#f5c518", fontWeight:700 }}>{pomCount}/{pomGoal}회</span>
                </div>
              </div>

              {/* 모드 탭 — 공부 / 휴식만 */}
              <div style={{ display:"flex", gap:4, marginBottom:10 }}>
                {["공부","휴식"].map(m => (
                  <button key={m} onClick={() => switchMode(m)}
                    style={{ flex:1, padding:"4px 0", fontSize:10, fontWeight:700,
                             background: pomMode===m ? modeColor : "transparent",
                             color: pomMode===m ? "#000" : "#aaa",
                             border:"1px solid",
                             borderColor: pomMode===m ? modeColor : "#2a3a5a",
                             borderRadius:5, cursor:"pointer" }}>
                    {m === "공부" ? "📚 공부" : "☕ 휴식"}
                  </button>
                ))}
              </div>

              {/* 원형 타이머 */}
              <div style={{ display:"flex", justifyContent:"center",
                            position:"relative", marginBottom:6 }}>
                <svg width={110} height={110} style={{ display:"block" }}>
                  <circle cx={55} cy={55} r={44} fill="none" stroke="#1a2a4a" strokeWidth={9} />
                  <circle cx={55} cy={55} r={44} fill="none" stroke={modeColor} strokeWidth={9}
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={pomOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 55 55)"
                    style={{ transition: pomRunning ? "stroke-dashoffset 1s linear" : "none" }} />
                </svg>
                <div style={{ position:"absolute", top:"50%", left:"50%",
                              transform:"translate(-50%,-50%)", textAlign:"center" }}>
                  <div style={{ fontSize:19, fontWeight:700, color:modeColor,
                                fontFamily:"monospace", lineHeight:1 }}>
                    {mins}:{secs}
                  </div>
                  <div style={{ fontSize:9, color:"#555", marginTop:2 }}>
                    {pomMode === "공부" ? "25분 집중" : "5분 휴식"}
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => setPomRunning(r => !r)}
                  style={{ flex:1, padding:"6px 0", fontSize:11, fontWeight:700,
                           background:modeColor, border:"none", borderRadius:6,
                           cursor:"pointer", color:"#000" }}>
                  {pomRunning ? "⏸ 정지" : "▶ 시작"}
                </button>
                <button onClick={() => { setPomRunning(false); setPomTime(pomMode==="공부"?25*60:5*60) }}
                  style={{ padding:"6px 10px", fontSize:11, background:"#1a2a4a",
                           border:"1px solid #2a3a5a", borderRadius:6,
                           cursor:"pointer", color:"#aaa" }}>↺</button>
              </div>
            </div>

            {/* 채팅방 */}
            <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                          borderRadius:10, padding:12, flex:1,
                          display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700, marginBottom:8 }}>
                채팅방
              </div>
              <div ref={chatRef}
                style={{ flex:1, overflowY:"auto", display:"flex",
                          flexDirection:"column", gap:6, marginBottom:8 }}>
                {messages.map(msg => (
                  <div key={msg.id}
                    style={{ display:"flex", flexDirection:"column",
                              alignItems: msg.name==="나" ? "flex-end" : "flex-start" }}>
                    {msg.name !== "나" && (
                      <div style={{ fontSize:10, color:"#555", marginBottom:2 }}>{msg.name}</div>
                    )}
                    <div style={{ maxWidth:"85%", padding:"6px 10px", borderRadius:10, fontSize:12,
                                   background: msg.name==="나" ? "#f5c518" : "#0d1520",
                                   color: msg.name==="나" ? "#000" : "#fff" }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize:10, color:"#444", marginTop:2 }}>{msg.time}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && sendChat()}
                  placeholder="메시지..."
                  style={{ flex:1, background:"#0d1520", border:"1px solid #2a3a5a",
                           borderRadius:6, padding:"6px 8px", color:"#fff",
                           fontSize:12, outline:"none" }} />
                <button onClick={sendChat}
                  style={{ background:"#f5c518", border:"none", borderRadius:6,
                           padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                  전송
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 파티 캐릭터 ──
function PartyChar({ member: m, pomMode }) {
  // 내 캐릭터는 pomMode 반영, 다른 팀원은 status 기반
  const msg      = m.isMe ? getMyStatusMsg(pomMode) : getMemberStatusMsg(m.status)
  const msgColor = m.isMe
    ? (pomMode === "휴식" ? "#22c98a" : "#f5c518")
    : (m.status === "focus" ? "#22c98a" : "#f5c518")

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                  marginBottom:20, userSelect:"none" }}>

      {/* 상태 말풍선 */}
      <div style={{ position:"relative", marginBottom:3 }}>
        <div style={{ background:"rgba(13,21,32,0.92)", border:`1px solid ${msgColor}`,
                      borderRadius:7, padding:"2px 8px", fontSize:9, fontWeight:700,
                      color:msgColor, whiteSpace:"nowrap" }}>
          {msg}
        </div>
        <div style={{ position:"absolute", bottom:-5, left:"50%",
                      transform:"translateX(-50%)", width:0, height:0,
                      borderLeft:"4px solid transparent",
                      borderRight:"4px solid transparent",
                      borderTop:`5px solid ${msgColor}` }} />
      </div>

      {/* 이름 태그 */}
      <div style={{ background: m.isMe ? "#f5c518" : "rgba(0,0,0,0.78)",
                    color: m.isMe ? "#000" : "#fff",
                    fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:8,
                    border:`1px solid ${m.isMe ? "#c0900a" : "#3a4a6a"}`,
                    marginBottom:4, whiteSpace:"nowrap" }}>
        {m.name}
      </div>

      {/* 캐릭터 몸통 */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                    border: m.isMe ? "2px solid #f5c518" : "none",
                    borderRadius: m.isMe ? 8 : 0,
                    padding: m.isMe ? 3 : 0 }}>
        <div style={{ fontSize:28, lineHeight:1 }}>{m.emoji}</div>
        <div style={{ width:22, height:16, background:m.bodyColor, marginTop:1,
                      borderRadius:"3px 3px 0 0",
                      boxShadow:"inset 0 -3px 0 rgba(0,0,0,0.22)" }} />
        <div style={{ display:"flex", gap:2 }}>
          {[0,1].map(i => (
            <div key={i} style={{ width:9, height:13, background:m.legColor,
                                   borderRadius:"0 0 3px 3px",
                                   boxShadow:"inset 0 -2px 0 rgba(0,0,0,0.28)" }} />
          ))}
        </div>
      </div>

      {/* 공부시간 미니 버블 */}
      <div style={{ marginTop:5, background:"#0d1a2e", border:"1px solid #2a3a5a",
                    borderRadius:7, padding:"3px 8px", fontSize:9,
                    textAlign:"center", minWidth:84 }}>
        <div style={{ color:"#f5c518" }}>📚 {m.studyTime}</div>
        <div style={{ color:"#22c98a" }}>🎯 {m.focusTime}</div>
      </div>
    </div>
  )
}