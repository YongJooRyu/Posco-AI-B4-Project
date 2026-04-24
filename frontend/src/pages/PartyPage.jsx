import { useState, useEffect, useRef } from "react"
import SharedHeader from "../components/SharedHeader"

// 🔌 TODO(백엔드): GET /api/party/members
const INIT_MEMBERS = [
  { id:1, name:"영환", score:88, status:"focus",   emoji:"🦊", bodyColor:"#895129", legColor:"#895129", isMe:false, studyTime:"01:23", focusTime:"01:05" },
  { id:2, name:"아름", score:72, status:"unfocus",  emoji:"🐱", bodyColor:"#895129", legColor:"#895129", isMe:false, studyTime:"00:58", focusTime:"00:42" },
  { id:3, name:"준서", score:91, status:"focus",   emoji:"🐻", bodyColor:"#895129", legColor:"#895129", isMe:false, studyTime:"01:45", focusTime:"01:38" },
  { id:4, name:"용주", score:45, status:"unfocus",  emoji:"🐶", bodyColor:"#c89100", legColor:"#895129", isMe:false, studyTime:"00:32", focusTime:"00:10" },
  { id:5, name:"효은", score:82, status:"focus",   emoji:"🐰", bodyColor:"#895129", legColor:"#6b3d1f", isMe:true,  studyTime:"01:12", focusTime:"00:58" },
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

// ── TownPage 팝업 스타일 공통 ──
const PANEL = {
  wrap: {
    background: "#F9E076",
    border: "4px solid #c89100",
    borderBottom: "6px solid #c89100",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  },
  header: {
    background: "linear-gradient(180deg, #F9E076 0%, #e8c550 100%)",
    borderBottom: "3px solid #c89100",
    padding: "8px 14px",
    display: "flex", alignItems: "center", gap: 8,
  },
  headerText: {
    fontSize: 12, fontWeight: 700, color: "#2a1a0a",
    textShadow: "none",
  },
  body: {
    background: "#FFFDD0",
    padding: "12px",
    color: "#2a1a0a",
  },
}
const FLOOR_TILE_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABJUlEQVR4nNVXyRGDQAwDZkvgSyUpI5WlRr7UQPJaZlF8yObIRD9AMjYyxvSv5+PdGZiXtZvGwaKEeAhVMS+reRzlhRPAarTqWJ6GghlP40BVpfGk8xIqr/d6AJHx2tLQkTJeMxo6gYzXjGbXA61/lpea15Ze47o9EPU8yj88B7J8N4Go59l58DUHJDCzwuIjWn3BTFkPPY4Xp14bWgEGyCAaZ0vg6EzPxinSe6tlbXnPfEMkzq4HpGzRS62ithALeP3UfYD9ElIJYDBrH2B4Gv5rH2B9jmhC+0AbhJ2gnua2fUCbjLftA1WHXGofwGrO4FZQc4Dp7EyPmAlE32/GbwmX7AOSRtMX7bFFZ7qWgPdHtdsH6snMTMcbs3Eu2QciT/Ln+8AHEGJSk+T1pdgAAAAASUVORK5CYII="
const PLAYER_IMG = "/assets/Cute_Fantasy_Free/Player/Player.png"
const FARMER_IMG = "/assets/Cute_Fantasy/NPCs (Premade)/Farmer_Bob.png"
const STATUS_COLOR = { focus: "#FFC107", unfocus: "#FFC107" }

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
  const modeColor   = pomMode === "공부" ? "#FFC107" : "#FFC107"
  const mins        = String(Math.floor(pomTime / 60)).padStart(2, "0")
  const secs        = String(pomTime % 60).padStart(2, "0")
  const sorted      = [...members].sort((a, b) => b.score - a.score)

  return (
    <div style={{ width:"100%", height:"100%", color:"#2a1a0a",
                  fontFamily:"'Noto Sans KR',sans-serif", display:"flex",
                  flexDirection:"column", overflow:"hidden", position:"relative",
                  backgroundImage:`url(${FLOOR_TILE_DATA})`,
                  backgroundRepeat:"repeat", backgroundSize:"96px 96px",
                  imageRendering:"pixelated" }}>

      <div style={{ position:"relative", zIndex:10, flexShrink:0 }}>
        <SharedHeader showHome />
      </div>

      {/* 서브 헤더 */}
      <div style={{ display:"flex", alignItems:"center", padding:"8px 16px",
                    background:"linear-gradient(180deg, #F9E076 0%, #e8c550 100%)",
                    borderBottom:"3px solid #c89100",
                    gap:12, flexShrink:0, position:"relative", zIndex:9 }}>
        <div style={{ fontWeight:700, fontSize:13, color:"#2a1a0a", textShadow:"none" }}>🍅 토마토 농장 파티</div>
        <div style={{ marginLeft:"auto", fontSize:11, color:"#2a1a0a", fontWeight:700 }}>
          {members.length}명 접속중
        </div>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* 캐릭터 맵 */}
        <div style={{
          padding:"20px 24px 0",
          background:"linear-gradient(180deg,#2a1a0a 0%,#2a1a0a 100%)",
          display:"flex", alignItems:"flex-end", gap:20, flexWrap:"wrap",
          justifyContent:"center", flexShrink:0, position:"relative", minHeight:240,
        }}>
          {members.map(m => (
            <PartyChar key={m.id} member={m} pomMode={m.isMe ? pomMode : "공부"} />
          ))}
          {/* 잔디 */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:18,
                        background:"linear-gradient(#a86838,#895129)",
                        borderTop:"2px solid #c89100", pointerEvents:"none" }} />
        </div>

        {/* 3열 레이아웃 */}
        <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative", zIndex:1 }}>

          {/* ── 왼쪽: 랭킹 + 개인미션 ── */}
          <div style={{ width:248, display:"flex", flexDirection:"column",
                        gap:10, padding:12, overflow:"auto", flexShrink:0 }}>

            {/* 집중도 랭킹 */}
            <div style={{ ...PANEL.wrap }}>
              <div style={PANEL.header}>
                <span style={PANEL.headerText}>🏆 집중도 점수 랭킹</span>
              </div>
              <div style={{ ...PANEL.body, padding:"10px" }}>
              {sorted.map((m, i) => (
                <div key={m.id}
                  style={{ display:"flex", alignItems:"center", gap:8,
                            padding:"6px 0", borderBottom:"1px solid #e8c550",
                            background: m.isMe ? "rgba(200,144,10,0.12)" : "none" }}>
                  <div style={{ width:18, fontSize:11, fontWeight:700, textAlign:"center",
                                 color: i===0?"#c89100":i===1?"#c89100":i===2?"#895129":"#c89100" }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize:18 }}>{m.emoji}</div>
                  <div style={{ flex:1, fontSize:11,
                                 color: m.isMe ? "#c89100" : "#2a1a0a",
                                 fontWeight: m.isMe ? 700 : 400 }}>{m.name}</div>
                  <div style={{ fontSize:11, color: m.status==="focus" ? "#895129" : "#895129", fontWeight:700 }}>
                    {m.score}점
                  </div>
                </div>
              ))}
              </div>{/* body */}
            </div>{/* PANEL */}

            {/* 개인 미션 */}
            <div style={{ ...PANEL.wrap }}>
              <div style={PANEL.header}>
                <span style={PANEL.headerText}>⚔️ 개인 미션</span>
              </div>
              <div style={{ ...PANEL.body, padding:"10px" }}>
              {INDIVIDUAL_MISSIONS.map((m, idx) => {
                const achieved = idx === 1
                return (
                  <div key={m.id}
                    style={{ padding:"8px 0", borderBottom:"1px solid #e8c550",
                              display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontSize:11, color: achieved ? "#c89100" : "#2a1a0a",
                                     textDecoration: achieved ? "line-through" : "none" }}>
                        {m.title}
                      </div>
                      <div style={{ fontSize:9, color:"#a86838", marginTop:2 }}>
                        {m.rewards.map(r => `${r.emoji} +${r.amount} ${r.type}`).join(" · ")}
                      </div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, flexShrink:0, marginLeft:6,
                                   fontSize:10, background: achieved ? "#fff4a0" : "#F9E076",
                                   border:`1px solid ${achieved ? "#c89100" : "#895129"}`,
                                   borderRadius:3, padding:"1px 6px",
                                   color: achieved ? "#895129" : "#895129" }}>
                      {achieved ? "완료" : "진행중"}
                    </span>
                  </div>
                )
              })}
              </div>{/* body */}
            </div>{/* PANEL */}
          </div>{/* 왼쪽 컬럼 */}

          {/* ── 중앙: 팀 미션 ── */}
          <div style={{ flex:1, padding:12, overflow:"auto", minWidth:0,
                        display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ ...PANEL.wrap }}>
              <div style={PANEL.header}>
                <span style={PANEL.headerText}>🛡️ 팀 미션</span>
              </div>
              <div style={{ ...PANEL.body, padding:"14px" }}>
              {TEAM_MISSIONS.map(tm => {
                const pct = Math.min(100, Math.round(tm.progress.current / tm.progress.total * 100))
                return (
                  <div key={tm.id}
                    style={{ marginBottom:14, padding:14, borderRadius:8,
                              background:"#fff4a0", border:"1px solid #c89100" }}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                                   alignItems:"flex-start", marginBottom:6 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#2a1a0a" }}>{tm.title}</div>
                      <span style={{ fontSize:10, padding:"3px 9px", borderRadius:8, fontWeight:700,
                                      flexShrink:0, marginLeft:8,
                                      background: tm.status==="완료" ? "#fff4a0" : "#F9E076",
                                      border:`1px solid ${tm.status==="완료" ? "#c89100" : "#895129"}`,
                                      color: tm.status==="완료" ? "#895129" : "#895129" }}>
                        {tm.status}
                      </span>
                    </div>
                    <div style={{ fontSize:11, color:"#6b3d1f", marginBottom:10 }}>{tm.desc}</div>
                    <div style={{ display:"flex", justifyContent:"space-between",
                                   fontSize:10, color:"#c89100", marginBottom:5 }}>
                      <span>진행률</span>
                      <span style={{ color:"#2a1a0a", fontWeight:700 }}>
                        {tm.progress.current} / {tm.progress.total} {tm.progress.unit}
                      </span>
                    </div>
                    <div style={{ height:8, background:"#e8c550", borderRadius:4,
                                   overflow:"hidden", marginBottom:12 }}>
                      <div style={{ width: pct+"%", height:"100%",
                                     background: tm.status==="완료"
                                       ? "linear-gradient(90deg,#FFC107,#c89100)"
                                       : "linear-gradient(90deg,#FFC107,#c89100)",
                                     borderRadius:4, transition:"width 0.6s ease" }} />
                    </div>
                    <div style={{ fontSize:10, color:"#6b3d1f", fontWeight:700, marginBottom:8 }}>🎁 성공 보상</div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {tm.rewards.map((r, i) => (
                        <div key={i}
                          style={{ display:"flex", alignItems:"center", gap:6,
                                    background:"#F9E076", padding:"6px 10px",
                                    borderRadius:7, border:"1px solid #c89100" }}>
                          <span style={{ fontSize:18 }}>{r.emoji}</span>
                          <div>
                            <div style={{ fontSize:9, color:"#c89100" }}>{r.type}</div>
                            <div style={{ fontSize:14, fontWeight:700, color:"#FFC107" }}>+{r.amount}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              </div>{/* PANEL.body */}
            </div>{/* PANEL.wrap */}
          </div>

          {/* ── 오른쪽: 웹캠 + 내 뽀모도로 + 채팅 ── */}
          <div style={{ width:278, display:"flex", flexDirection:"column",
                        gap:10, padding:12, overflow:"hidden", flexShrink:0 }}>

            {/* 웹캠 */}
            <div style={{ ...PANEL.wrap, flexShrink:0 }}>
              <div style={PANEL.header}>
                <span style={PANEL.headerText}>📷 웹캠</span>
              </div>
              <div style={{ ...PANEL.body, padding:"10px" }}>
                <div style={{ background:"#2a1a0a", borderRadius:8, height:74,
                              display:"flex", alignItems:"center",
                              justifyContent:"center", fontSize:24, color:"#c89100" }}>📷</div>
                <div style={{ marginTop:6, fontSize:11, textAlign:"center",
                              color:"#895129", fontWeight:700 }}>실시간 집중도: 82점</div>
              </div>
            </div>

            {/* 내 뽀모도로 */}
            <div style={{ ...PANEL.wrap, flexShrink:0 }}>

              <div style={PANEL.header}>
                <span style={PANEL.headerText}>🍅 뽀모도로</span>
                <div style={{ marginLeft:"auto", fontSize:10, color:"#F9E076" }}>
                  <span style={{ color:"#FFC107", fontWeight:700 }}>{pomCount}/{pomGoal}회</span>
                </div>
              </div>
              <div style={{ ...PANEL.body, padding:"10px" }}>

              {/* 모드 탭 — 공부 / 휴식만 */}
              <div style={{ display:"flex", gap:4, marginBottom:10 }}>
                {["공부","휴식"].map(m => (
                  <button key={m} onClick={() => switchMode(m)}
                    style={{ flex:1, padding:"4px 0", fontSize:10, fontWeight:700,
                             background: pomMode===m ? "linear-gradient(180deg,#c89100,#c89100)" : "#fff4a0",
                             color: pomMode===m ? "#FFFDD0" : "#c89100",
                             border:"2px solid",
                             borderColor: pomMode===m ? "#c89100" : "#e8c550",
                             borderBottom: pomMode===m ? "3px solid #c89100" : "2px solid #e8c550",
                             borderRadius:5, cursor:"pointer" }}>
                    {m === "공부" ? "📚 공부" : "☕ 휴식"}
                  </button>
                ))}
              </div>

              {/* 원형 타이머 */}
              <div style={{ display:"flex", justifyContent:"center",
                            position:"relative", marginBottom:6 }}>
                <svg width={110} height={110} style={{ display:"block" }}>
                  <circle cx={55} cy={55} r={44} fill="none" stroke="#2a1a0a" strokeWidth={9} />
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
                  <div style={{ fontSize:9, color:"#c89100", marginTop:2 }}>
                    {pomMode === "공부" ? "25분 집중" : "5분 휴식"}
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => setPomRunning(r => !r)}
                  style={{ flex:1, padding:"6px 0", fontSize:11, fontWeight:700,
                           background:"linear-gradient(180deg,#c89100,#c89100)",
                           border:"2px solid #c89100", borderBottom:"3px solid #c89100",
                           borderRadius:6, cursor:"pointer", color:"#FFFDD0" }}>
                  {pomRunning ? "⏸ 정지" : "▶ 시작"}
                </button>
                <button onClick={() => { setPomRunning(false); setPomTime(pomMode==="공부"?25*60:5*60) }}
                  style={{ padding:"6px 10px", fontSize:11, background:"#fff4a0",
                           border:"2px solid #c89100", borderBottom:"3px solid #c89100",
                           borderRadius:6, cursor:"pointer", color:"#6b3d1f", fontWeight:700 }}>↺</button>
              </div>
              </div>{/* body */}
            </div>{/* PANEL */}

            {/* 채팅방 */}
            <div style={{ ...PANEL.wrap, flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div style={PANEL.header}>
                <span style={PANEL.headerText}>💬 채팅방</span>
              </div>
              <div style={{ ...PANEL.body, flex:1, display:"flex", flexDirection:"column", overflow:"hidden", padding:"10px" }}>
              <div ref={chatRef}
                style={{ flex:1, overflowY:"auto", display:"flex",
                          flexDirection:"column", gap:6, marginBottom:8 }}>
                {messages.map(msg => (
                  <div key={msg.id}
                    style={{ display:"flex", flexDirection:"column",
                              alignItems: msg.name==="나" ? "flex-end" : "flex-start" }}>
                    {msg.name !== "나" && (
                      <div style={{ fontSize:10, color:"#c89100", marginBottom:2 }}>{msg.name}</div>
                    )}
                    <div style={{ maxWidth:"85%", padding:"6px 10px", borderRadius:10, fontSize:12,
                                   background: msg.name==="나" ? "#c89100" : "#fff4a0",
                                   color: msg.name==="나" ? "#FFFDD0" : "#2a1a0a" }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize:10, color:"#a86838", marginTop:2 }}>{msg.time}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && sendChat()}
                  placeholder="메시지..."
                  style={{ flex:1, background:"#FFFDD0", border:"2px solid #c89100",
                           borderRadius:6, padding:"6px 8px", color:"#2a1a0a",
                           fontSize:12, outline:"none" }} />
                <button onClick={sendChat}
                  style={{ background:"linear-gradient(180deg,#c89100,#c89100)",
                           border:"2px solid #c89100", borderBottom:"3px solid #c89100",
                           borderRadius:6, padding:"6px 10px", fontSize:11,
                           fontWeight:700, cursor:"pointer", color:"#FFFDD0" }}>
                  전송
                </button>
              </div>
              </div>{/* body */}
            </div>{/* PANEL */}
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
    ? (pomMode === "휴식" ? "#FFC107" : "#FFC107")
    : (m.status === "focus" ? "#FFC107" : "#FFC107")

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
      <div style={{ background: m.isMe ? "#FFC107" : "rgba(0,0,0,0.78)",
                    color: m.isMe ? "#2a1a0a" : "#FFFDD0",
                    fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:8,
                    border:`1px solid ${m.isMe ? "#c89100" : "#6b3d1f"}`,
                    marginBottom:4, whiteSpace:"nowrap" }}>
        {m.name}
      </div>

      {/* 캐릭터 몸통 */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                    border: m.isMe ? "2px solid #FFC107" : "none",
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
      <div style={{ marginTop:5, background:"rgba(240,200,122,0.92)", border:"2px solid #c89100",
                    borderRadius:7, padding:"3px 8px", fontSize:9,
                    textAlign:"center", minWidth:84,
                    boxShadow:"0 2px 6px rgba(0,0,0,0.3)" }}>
        <div style={{ color:"#c89100", fontWeight:700 }}>📚 {m.studyTime}</div>
        <div style={{ color:"#895129", fontWeight:700 }}>🎯 {m.focusTime}</div>
      </div>
    </div>
  )
}