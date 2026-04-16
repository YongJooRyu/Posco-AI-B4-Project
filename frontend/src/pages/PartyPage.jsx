import { useState, useEffect, useRef } from "react"
import SharedHeader from "../components/SharedHeader"

// 🔌 TODO(백엔드): GET /api/party/members → [{ id, name, score, status, emoji, bodyColor, legColor, isMe, studyTime, focusTime }]
const INIT_MEMBERS = [
  { id:1, name:"영환", score:88, status:"focus",   emoji:"🦊", bodyColor:"#8a4af5", legColor:"#5a2af5", isMe:false, studyTime:"01:23", focusTime:"01:05" },
  { id:2, name:"아름", score:72, status:"unfocus",  emoji:"🐱", bodyColor:"#2ab8a8", legColor:"#1a8878", isMe:false, studyTime:"00:58", focusTime:"00:42" },
  { id:3, name:"준서", score:91, status:"focus",   emoji:"🐻", bodyColor:"#3a7af5", legColor:"#1a5ad5", isMe:false, studyTime:"01:45", focusTime:"01:38" },
  { id:4, name:"용주", score:45, status:"drowsy",  emoji:"🐶", bodyColor:"#d4903a", legColor:"#a06020", isMe:false, studyTime:"00:32", focusTime:"00:10" },
  { id:5, name:"효은", score:82, status:"focus",   emoji:"🐰", bodyColor:"#4a6af5", legColor:"#2a4ae0", isMe:true,  studyTime:"01:12", focusTime:"00:58" },
]

const INIT_CHAT = [
  { id:1, name:"영환", text:"다들 화이팅!", time:"14:23" },
  { id:2, name:"용주", text:"저 졸음 감지됐어요 ㅠㅠ", time:"14:24" },
  { id:3, name:"효은", text:"저도요 ㅋㅋ 힘내요!", time:"14:25" },
  { id:4, name:"준서", text:"뽀모도로 25분 남았어요!", time:"14:26" },
]

// 🔌 TODO(백엔드): GET /api/party/team-missions → [{ id, title, desc, progress, rewards, status }]
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

// 🔌 TODO(백엔드): GET /api/party/individual-missions → [{ id, title, rewards }]
const INDIVIDUAL_MISSIONS = [
  { id: 1, title: "집중 25분 연속 성공",   rewards: [{ type: "EXP",  amount: 10, emoji: "⚡" }] },
  { id: 2, title: "퀴즈 1문제 풀기",       rewards: [{ type: "GOLD", amount: 5,  emoji: "💰" }] },
  { id: 3, title: "세션 중 졸음 0회 유지", rewards: [{ type: "EXP",  amount: 15, emoji: "⚡" }] },
]

const QUIZZES = [
  { id: 1, subject: "수학", question: "미분의 기본 정의는?",   difficulty: "중" },
  { id: 2, subject: "영어", question: "현재완료 용법 3가지?",  difficulty: "하" },
  { id: 3, subject: "물리", question: "뉴턴 제2법칙 F=?",     difficulty: "하" },
  { id: 4, subject: "화학", question: "몰(mol)의 정의는?",    difficulty: "상" },
]

const STATUS_COLOR = { focus: "#22c98a", unfocus: "#f5c518", drowsy: "#f06060" }

const CIRCUMFERENCE = 2 * Math.PI * 44   // r=44

function getStatusMsg(member, pomMode) {
  if (member.status === "drowsy") return "잠깐 잘게 Zzz 💤"
  if (pomMode === "파워냅")        return "파워냅 중 💤"
  if (pomMode === "휴식")          return "휴식중 ☕"
  if (member.status === "focus")   return "집중중 💪"
  return "딴짓중 😅"
}

export default function PartyPage() {
  const [members, setMembers]       = useState(INIT_MEMBERS)
  const [messages, setMessages]     = useState(INIT_CHAT)
  const [input, setInput]           = useState("")
  const [pomMode, setPomMode]       = useState("공부")
  const [pomTime, setPomTime]       = useState(25 * 60)
  const [pomRunning, setPomRunning] = useState(false)
  // 🔌 TODO(백엔드): GET /api/party/pomodoro-progress → { count, goal }
  const [pomCount, setPomCount]     = useState(2)
  const pomGoal                     = 4
  const [petOpen, setPetOpen]       = useState(false)
  const chatRef                     = useRef(null)

  // 뽀모도로 타이머
  useEffect(() => {
    if (!pomRunning) return
    const t = setInterval(() => {
      setPomTime(p => {
        if (p <= 1) {
          clearInterval(t)
          setPomRunning(false)
          // 🔌 TODO(백엔드): POST /api/party/pomodoro-complete (완료 기록)
          setPomCount(c => Math.min(c + 1, pomGoal))
          return 0
        }
        return p - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [pomRunning])

  // 🔌 TODO(백엔드): WebSocket or polling → member status/score updates
  useEffect(() => {
    const t = setInterval(() => {
      setMembers(prev => prev.map(m =>
        m.isMe ? m : {
          ...m,
          score: Math.max(20, Math.min(100, m.score + Math.floor((Math.random() - 0.4) * 10))),
        }
      ))
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

  const total       = pomMode === "공부" ? 25*60 : pomMode === "휴식" ? 5*60 : 15*60
  const pomProgress = (total - pomTime) / total
  const pomOffset   = CIRCUMFERENCE * (1 - pomProgress)
  const modeColor   = pomMode === "공부" ? "#f5c518" : pomMode === "휴식" ? "#22c98a" : "#7ec8f5"
  const mins        = String(Math.floor(pomTime / 60)).padStart(2, "0")
  const secs        = String(pomTime % 60).padStart(2, "0")
  const sorted      = [...members].sort((a, b) => b.score - a.score)

  return (
    <div style={{ width: "100%", height: "100%", background: "#0b1220", color: "#fff",
                  fontFamily: "'Noto Sans KR',sans-serif", display: "flex",
                  flexDirection: "column", overflow: "hidden", position: "relative" }}>

      <SharedHeader showHome />

      {/* 서브 헤더 */}
      <div style={{ display: "flex", alignItems: "center", padding: "7px 16px",
                    background: "#0d1825", borderBottom: "1px solid #1a2a4a",
                    gap: 12, flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>🍅 토마토 농장 파티</div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#22c98a", fontWeight: 700 }}>
          {members.length}명 접속중
        </div>
      </div>

      {/* 메인 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* 캐릭터 맵 */}
        <div style={{
          padding: "20px 24px 0",
          background: "linear-gradient(180deg,#0d2244 0%,#1a3a1a 100%)",
          display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap",
          justifyContent: "center", flexShrink: 0, position: "relative", minHeight: 240,
        }}>
          {members.map(m => (
            <PartyChar key={m.id} member={m} pomMode={pomMode} />
          ))}
          {/* 잔디 */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 18,
                        background: "linear-gradient(#3a7a3a,#2a5a2a)",
                        borderTop: "2px solid #4a9a4a", pointerEvents: "none" }} />
        </div>

        {/* 3열 레이아웃 */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── 왼쪽: 랭킹 + 개인미션 ── */}
          <div style={{ width: 248, display: "flex", flexDirection: "column",
                        gap: 10, padding: 12, overflow: "auto", flexShrink: 0 }}>

            {/* 집중도 랭킹 */}
            <div style={{ background: "#1a2a3a", border: "1px solid #2a3a5a",
                          borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7ec8f5", marginBottom: 10 }}>
                🏆 집중도 점수 랭킹
              </div>
              {sorted.map((m, i) => (
                <div key={m.id}
                  style={{ display: "flex", alignItems: "center", gap: 8,
                            padding: "6px 0", borderBottom: "1px solid #1a2a4a",
                            background: m.isMe ? "rgba(245,197,24,0.05)" : "none" }}>
                  <div style={{ width: 18, fontSize: 11, fontWeight: 700, textAlign: "center",
                                 color: i===0?"#f5c518":i===1?"#aaa":i===2?"#cd7f32":"#555" }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 18 }}>{m.emoji}</div>
                  <div style={{ flex: 1, fontSize: 11,
                                 color: m.isMe ? "#f5c518" : "#fff",
                                 fontWeight: m.isMe ? 700 : 400 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: STATUS_COLOR[m.status] }}>{m.score}점</div>
                </div>
              ))}
            </div>

            {/* 개인 미션 */}
            <div style={{ background: "#1a2a3a", border: "1px solid #2a3a5a",
                          borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7ec8f5", marginBottom: 10 }}>
                ⚔️ 개인 미션
              </div>
              {/* 🔌 TODO(백엔드): 내 미션 달성 여부 */}
              {INDIVIDUAL_MISSIONS.map((m, idx) => {
                const achieved = idx === 1
                return (
                  <div key={m.id}
                    style={{ padding: "8px 0", borderBottom: "1px solid #1a2a4a",
                              display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 11,
                                     color: achieved ? "#aaa" : "#fff",
                                     textDecoration: achieved ? "line-through" : "none" }}>
                        {m.title}
                      </div>
                      <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>
                        {m.rewards.map(r => `${r.emoji} +${r.amount} ${r.type}`).join(" · ")}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, marginLeft: 6,
                                   color: achieved ? "#22c98a" : "#f5c518" }}>
                      {achieved ? "완료" : "진행중"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 중앙: 팀 미션 ── */}
          <div style={{ flex: 1, padding: 12, overflow: "auto", minWidth: 0,
                        display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "#1a2a3a", border: "1px solid #2a3a5a",
                          borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7ec8f5", marginBottom: 12 }}>
                🛡️ 팀 미션
              </div>
              {TEAM_MISSIONS.map(tm => {
                const pct = Math.min(100, Math.round(tm.progress.current / tm.progress.total * 100))
                return (
                  <div key={tm.id}
                    style={{ marginBottom: 14, padding: 14, borderRadius: 10,
                              background: "#0d1825", border: "1px solid #2a3a4a" }}>
                    <div style={{ display: "flex", justifyContent: "space-between",
                                   alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{tm.title}</div>
                      <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 8, fontWeight: 700,
                                      flexShrink: 0, marginLeft: 8,
                                      background: tm.status === "완료" ? "#1a4a2a" : "#3a2a0a",
                                      color: tm.status === "완료" ? "#22c98a" : "#f5c518" }}>
                        {tm.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#aaa", marginBottom: 10 }}>{tm.desc}</div>
                    <div style={{ display: "flex", justifyContent: "space-between",
                                   fontSize: 10, color: "#aaa", marginBottom: 5 }}>
                      <span>진행률</span>
                      <span style={{ color: "#fff" }}>
                        {tm.progress.current} / {tm.progress.total} {tm.progress.unit}
                      </span>
                    </div>
                    <div style={{ height: 8, background: "#1a2a3a", borderRadius: 4,
                                   overflow: "hidden", marginBottom: 12,
                                   border: "1px solid #2a3a4a" }}>
                      <div style={{ width: pct + "%", height: "100%",
                                     background: tm.status === "완료"
                                       ? "linear-gradient(90deg,#22c98a,#1aa870)"
                                       : "linear-gradient(90deg,#f5c518,#e0a800)",
                                     borderRadius: 4, transition: "width 0.6s ease" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#aaa", marginBottom: 8 }}>🎁 성공 보상</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {tm.rewards.map((r, i) => (
                        <div key={i}
                          style={{ display: "flex", alignItems: "center", gap: 6,
                                    background: "#1a2a3a", padding: "6px 10px",
                                    borderRadius: 7, border: "1px solid #2a3a5a" }}>
                          <span style={{ fontSize: 18 }}>{r.emoji}</span>
                          <div>
                            <div style={{ fontSize: 9, color: "#aaa" }}>{r.type}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f5c518" }}>
                              +{r.amount}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 오른쪽: 웹캠 + 원형 뽀모도로 + 채팅방 ── */}
          <div style={{ width: 278, display: "flex", flexDirection: "column",
                        gap: 10, padding: 12, overflow: "hidden", flexShrink: 0 }}>

            {/* 웹캠 */}
            <div style={{ background: "#1a2a3a", border: "1px solid #2a3a5a",
                          borderRadius: 10, padding: 12, flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: "#7ec8f5", fontWeight: 700, marginBottom: 6 }}>
                웹캠
              </div>
              <div style={{ background: "#0d1520", borderRadius: 8, height: 74,
                            display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: 24, color: "#2a3a5a" }}>📷</div>
              {/* 🔌 TODO(백엔드): GET /api/cv/focus-score → { score } */}
              <div style={{ marginTop: 6, fontSize: 11, textAlign: "center",
                            color: "#22c98a", fontWeight: 700 }}>실시간 집중도: 82점</div>
            </div>

            {/* 원형 뽀모도로 타이머 */}
            <div style={{ background: "#1a2a3a", border: "1px solid #2a3a5a",
                          borderRadius: 10, padding: 12, flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: "#7ec8f5", fontWeight: 700, marginBottom: 8 }}>
                동적 뽀모도로 🍅
              </div>

              {/* 모드 탭 */}
              <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                {["공부","휴식","파워냅"].map(m => (
                  <button key={m} onClick={() => {
                    setPomMode(m); setPomRunning(false)
                    setPomTime(m === "공부" ? 25*60 : m === "휴식" ? 5*60 : 15*60)
                  }} style={{ flex: 1, padding: "3px 0", fontSize: 9, fontWeight: 700,
                               background: pomMode === m ? modeColor : "transparent",
                               color: pomMode === m ? "#000" : "#aaa",
                               border: "1px solid",
                               borderColor: pomMode === m ? modeColor : "#2a3a5a",
                               borderRadius: 5, cursor: "pointer" }}>
                    {m}
                  </button>
                ))}
              </div>

              {/* SVG 원형 타이머 */}
              <div style={{ display: "flex", justifyContent: "center",
                            position: "relative", marginBottom: 6 }}>
                <svg width={110} height={110} style={{ display: "block" }}>
                  {/* 배경 원 */}
                  <circle cx={55} cy={55} r={44} fill="none" stroke="#1a2a4a" strokeWidth={9} />
                  {/* 진행 원 */}
                  <circle cx={55} cy={55} r={44} fill="none" stroke={modeColor} strokeWidth={9}
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={pomOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 55 55)"
                    style={{ transition: pomRunning ? "stroke-dashoffset 1s linear" : "none" }} />
                </svg>
                {/* 중앙 시간 표시 */}
                <div style={{ position: "absolute", top: "50%", left: "50%",
                              transform: "translate(-50%,-50%)", textAlign: "center" }}>
                  <div style={{ fontSize: 19, fontWeight: 700, color: modeColor,
                                fontFamily: "monospace", lineHeight: 1 }}>
                    {mins}:{secs}
                  </div>
                  <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{pomMode}</div>
                </div>
              </div>

              {/* 🔌 TODO(백엔드): POST /api/party/pomodoro → 횟수 기록, 퀘스트 연동 */}
              <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700,
                            color: "#aaa", marginBottom: 8 }}>
                🍅 <span style={{ color: "#f5c518" }}>[{pomCount}/{pomGoal}회]</span>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPomRunning(r => !r)}
                  style={{ flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 700,
                           background: modeColor, border: "none", borderRadius: 6,
                           cursor: "pointer", color: "#000" }}>
                  {pomRunning ? "⏸ 정지" : "▶ 시작"}
                </button>
                <button onClick={() => {
                  setPomRunning(false)
                  setPomTime(pomMode === "공부" ? 25*60 : pomMode === "휴식" ? 5*60 : 15*60)
                }} style={{ padding: "6px 10px", fontSize: 11, background: "#1a2a4a",
                            border: "1px solid #2a3a5a", borderRadius: 6,
                            cursor: "pointer", color: "#aaa" }}>↺</button>
              </div>
            </div>

            {/* 채팅방 */}
            <div style={{ background: "#1a2a3a", border: "1px solid #2a3a5a",
                          borderRadius: 10, padding: 12, flex: 1,
                          display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ fontSize: 11, color: "#7ec8f5", fontWeight: 700, marginBottom: 8 }}>
                채팅방
              </div>
              <div ref={chatRef}
                style={{ flex: 1, overflowY: "auto", display: "flex",
                          flexDirection: "column", gap: 6, marginBottom: 8 }}>
                {messages.map(msg => (
                  <div key={msg.id}
                    style={{ display: "flex", flexDirection: "column",
                              alignItems: msg.name === "나" ? "flex-end" : "flex-start" }}>
                    {msg.name !== "나" && (
                      <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>{msg.name}</div>
                    )}
                    <div style={{ maxWidth: "85%", padding: "6px 10px", borderRadius: 10,
                                   fontSize: 12,
                                   background: msg.name === "나" ? "#f5c518" : "#0d1520",
                                   color: msg.name === "나" ? "#000" : "#fff" }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{msg.time}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  placeholder="메시지..."
                  style={{ flex: 1, background: "#0d1520", border: "1px solid #2a3a5a",
                           borderRadius: 6, padding: "6px 8px", color: "#fff",
                           fontSize: 12, outline: "none" }} />
                <button onClick={sendChat}
                  style={{ background: "#f5c518", border: "none", borderRadius: 6,
                           padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  전송
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 고정 펫 캐릭터 (우측 하단) */}
      <PetCharFixed onOpen={() => setPetOpen(true)} />
      {petOpen && <PetPopup onClose={() => setPetOpen(false)} />}
    </div>
  )
}

// ── 파티 캐릭터 (마을 스타일 + 상태 말풍선 + 공부시간) ──

function PartyChar({ member: m, pomMode }) {
  const msg      = getStatusMsg(m, pomMode)
  const msgColor = m.status === "drowsy" ? "#f06060"
                 : pomMode !== "공부"     ? "#22c98a"
                 : m.status === "focus"   ? "#22c98a" : "#f5c518"

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                  marginBottom: 20, userSelect: "none" }}>

      {/* 상태 말풍선 */}
      <div style={{ position: "relative", marginBottom: 3 }}>
        <div style={{ background: "rgba(13,21,32,0.92)", border: `1px solid ${msgColor}`,
                      borderRadius: 7, padding: "2px 8px", fontSize: 9, fontWeight: 700,
                      color: msgColor, whiteSpace: "nowrap" }}>
          {msg}
        </div>
        <div style={{ position: "absolute", bottom: -5, left: "50%",
                      transform: "translateX(-50%)", width: 0, height: 0,
                      borderLeft: "4px solid transparent",
                      borderRight: "4px solid transparent",
                      borderTop: `5px solid ${msgColor}` }} />
      </div>

      {/* 이름 태그 */}
      <div style={{ background: m.isMe ? "#f5c518" : "rgba(0,0,0,0.78)",
                    color: m.isMe ? "#000" : "#fff",
                    fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 8,
                    border: `1px solid ${m.isMe ? "#c0900a" : "#3a4a6a"}`,
                    marginBottom: 4, whiteSpace: "nowrap" }}>
        {m.name}
      </div>

      {/* 캐릭터 몸통 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                    filter: m.status === "drowsy" ? "saturate(0.35)" : "none",
                    border: m.isMe ? "2px solid #f5c518" : "none",
                    borderRadius: m.isMe ? 8 : 0,
                    padding: m.isMe ? 3 : 0 }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>{m.emoji}</div>
        <div style={{ width: 22, height: 16, background: m.bodyColor, marginTop: 1,
                      borderRadius: "3px 3px 0 0",
                      boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.22)" }} />
        <div style={{ display: "flex", gap: 2 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ width: 9, height: 13, background: m.legColor,
                                   borderRadius: "0 0 3px 3px",
                                   boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.28)" }} />
          ))}
        </div>
      </div>

      {/* 공부시간 미니 버블 */}
      <div style={{ marginTop: 5, background: "#0d1a2e", border: "1px solid #2a3a5a",
                    borderRadius: 7, padding: "3px 8px", fontSize: 9,
                    textAlign: "center", minWidth: 84 }}>
        {/* 🔌 TODO(백엔드): studyTime / focusTime ← member stats */}
        <div style={{ color: "#f5c518" }}>📚 {m.studyTime}</div>
        <div style={{ color: "#22c98a" }}>🎯 {m.focusTime}</div>
      </div>
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
      style={{ position: "fixed", bottom: 24, right: 24, zIndex: 100,
               cursor: "pointer", display: "flex", flexDirection: "column",
               alignItems: "center", userSelect: "none" }}>
      {hov && (
        <div style={{ position: "relative", marginBottom: 5 }}>
          <div style={{ background: "#fff", color: "#222", fontSize: 9, fontWeight: 600,
                        padding: "3px 8px", borderRadius: 7, border: "1px solid #ccc",
                        whiteSpace: "nowrap" }}>
            포석호와 대화하기 😊
          </div>
          <div style={{ position: "absolute", bottom: -5, left: "50%",
                        transform: "translateX(-50%)", width: 0, height: 0,
                        borderLeft: "4px solid transparent", borderRight: "4px solid transparent",
                        borderTop: "5px solid #ccc" }} />
        </div>
      )}
      <div style={{ transform: hov ? "translateY(-6px)" : "none",
                    transition: "transform 0.18s ease",
                    display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: 8, color: "#7ec8f5", fontWeight: 700, marginBottom: 3,
                      background: "rgba(13,21,32,0.9)", padding: "1px 6px",
                      borderRadius: 6, border: "1px solid #2a3a5a" }}>포석호</div>
        <div style={{ fontSize: 24, lineHeight: 1 }}>🐻‍❄️</div>
        <div style={{ width: 18, height: 13, background: "#e8843a", marginTop: 1,
                      borderRadius: "3px 3px 0 0",
                      boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.22)" }} />
        <div style={{ display: "flex", gap: 2 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ width: 7, height: 10, background: "#c05a20",
                                   borderRadius: "0 0 2px 2px" }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 펫 팝업 (질문하기 / 퀴즈 풀기 2모드) ──

function PetPopup({ onClose }) {
  const [mode, setMode]               = useState("question")
  const [messages, setMessages]       = useState([
    { type: "npc", text: "안녕하세요! 🐻‍❄️ 궁금한 것을 물어보거나 퀴즈를 풀어볼 수 있어요!" },
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
    setMessages(prev => [...prev, { type: "user", text: txt }])
    setLoading(true)
    try {
      // 🔌 TODO(백엔드): 실제 LLM 엔드포인트로 교체
      const res = await fetch("https://stonewall-rival-sternum.ngrok-free.dev", {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ message: txt }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { type: "npc", text: data.reply }])
    } catch {
      setMessages(prev => [...prev, { type: "npc", text: "(더미) 잘 하고 있어요! 계속해봐요 😊" }])
    } finally {
      setLoading(false)
      setTimeout(scrollBottom, 50)
    }
  }

  const tabStyle = (active) => ({
    flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 700, cursor: "pointer",
    background: active ? "#f5c518" : "transparent",
    color: active ? "#000" : "#aaa",
    border: "1px solid", borderColor: active ? "#f5c518" : "#2a3a5a",
    borderRadius: 6,
  })

  return (
    <>
      <div onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                    background: "#0d1520", border: "1px solid #2a3a5a",
                    borderRadius: 14, padding: 24, zIndex: 201,
                    width: "min(520px,92vw)", maxHeight: "88vh", overflowY: "auto" }}>
        <button onClick={onClose}
          style={{ position: "absolute", top: 12, right: 14, background: "none",
                   border: "none", color: "#555", fontSize: 18, cursor: "pointer" }}>✕</button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 26 }}>🐻‍❄️</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>포석호</div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button style={tabStyle(mode === "question")} onClick={() => setMode("question")}>
            ❓ 질문하기
          </button>
          <button style={tabStyle(mode === "quiz")} onClick={() => setMode("quiz")}>
            📝 퀴즈 풀기
          </button>
        </div>

        {mode === "quiz" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
            {QUIZZES.map(q => (
              <div key={q.id}
                onClick={() => { setSelectedQuiz(q); sendMsg(`[${q.subject}] "${q.question}" 퀴즈를 풀고 싶어요!`) }}
                style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                         display: "flex", justifyContent: "space-between", alignItems: "center",
                         background: selectedQuiz?.id === q.id ? "#1e3050" : "#1a2a3a",
                         border: `1px solid ${selectedQuiz?.id === q.id ? "#f5c518" : "#2a3a5a"}`,
                         transition: "all 0.15s" }}>
                <span style={{ fontSize: 12 }}>
                  <span style={{ color: "#7ec8f5", marginRight: 6, fontSize: 11 }}>[{q.subject}]</span>
                  {q.question}
                </span>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, marginLeft: 8,
                               flexShrink: 0,
                               background: q.difficulty==="하"?"#1a4a2a":q.difficulty==="중"?"#4a3a1a":"#4a1a1a",
                               color: q.difficulty==="하"?"#22c98a":q.difficulty==="중"?"#f5c518":"#ff6b6b" }}>
                  {q.difficulty}
                </span>
              </div>
            ))}
          </div>
        )}

        <div ref={chatRef}
          style={{ height: mode === "quiz" ? 160 : 240, overflowY: "auto", display: "flex",
                   flexDirection: "column", gap: 6, marginBottom: 10,
                   borderTop: "1px solid #2a3a5a", paddingTop: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex",
                                   justifyContent: m.type === "user" ? "flex-end" : "flex-start",
                                   alignItems: "flex-end", gap: 4 }}>
              {m.type === "npc" && <span style={{ fontSize: 14, flexShrink: 0 }}>🐻‍❄️</span>}
              <div style={{ maxWidth: "78%", padding: "7px 11px", borderRadius: 10,
                             fontSize: 12, lineHeight: 1.5,
                             background: m.type === "user" ? "#f5c518" : "#1a2a4a",
                             color: m.type === "user" ? "#000" : "#fff" }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && <div style={{ fontSize: 11, color: "#555", paddingLeft: 22 }}>입력 중...</div>}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMsg(input)}
            placeholder={mode === "question" ? "궁금한 것을 물어보세요..." : "답변을 입력하세요..."}
            disabled={loading}
            style={{ flex: 1, background: "#1a2a4a", border: "1px solid #2a3a5a",
                     borderRadius: 8, padding: "8px 12px", color: "#fff",
                     fontSize: 12, outline: "none", opacity: loading ? 0.6 : 1 }} />
          <button onClick={() => sendMsg(input)} disabled={loading}
            style={{ background: "#f5c518", border: "none", borderRadius: 8,
                     padding: "8px 16px", fontWeight: 700,
                     cursor: loading ? "not-allowed" : "pointer",
                     fontSize: 12, opacity: loading ? 0.6 : 1 }}>전송</button>
        </div>
      </div>
    </>
  )
}
