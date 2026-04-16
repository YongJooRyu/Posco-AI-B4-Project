import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

// 더미 파티원 데이터
const DUMMY_MEMBERS = [ 
  { id:1, name:"영환", score:88, status:"focus",   emoji:"🦊", isMe:false },
  { id:2, name:"아름", score:72, status:"unfocus",  emoji:"🐱", isMe:false },
  { id:3, name:"준서", score:91, status:"focus",   emoji:"🐻", isMe:false },
  { id:4, name:"용주", score:45, status:"drowsy",  emoji:"🐶", isMe:false },
  { id:5, name:"효은",     score:82, status:"focus",   emoji:"🐰",   isMe:true  },
]

const DUMMY_CHAT = [
  { id:1, name:"영환", text:"다들 화이팅!", time:"14:23" },
  { id:2, name:"용주", text:"저 졸음 감지됐어요 ㅠㅠ", time:"14:24" },
  { id:3, name:"효은",     text:"저도요 ㅋㅋ 힘내요!", time:"14:25" },
  { id:4, name:"준서", text:"뽀모도로 25분 남았어요!", time:"14:26" },
]

const STATUS_COLOR = {
  focus:   "#22c98a",
  unfocus: "#f5c518",
  drowsy:  "#f06060",
}
const STATUS_LABEL = {
  focus: "집중중", unfocus: "미집중", drowsy: "졸음감지"
}

function HomeButton() {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate("/town")}
      style={{ background:"#1a2a3a", border:"1px solid #2a3a5a", borderRadius:8,
               padding:"6px 12px", color:"#aaa", fontSize:12, cursor:"pointer",
               display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
      🏠 홈
    </button>
  )
}

export default function PartyPage() {
  const [members, setMembers]   = useState(DUMMY_MEMBERS)
  const [messages, setMessages] = useState(DUMMY_CHAT)
  const [input, setInput]       = useState("")
  const [pomMode, setPomMode]   = useState("공부")
  const [pomTime, setPomTime]   = useState(25 * 60)
  const [pomRunning, setPomRunning] = useState(false)

  // 뽀모도로
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

  // 더미 실시간 점수 변화 (5초마다)
  useEffect(() => {
    const t = setInterval(() => {
      setMembers(prev => prev.map(m =>
        m.isMe ? m : {
          ...m,
          score: Math.max(20, Math.min(100,
            m.score + Math.floor((Math.random()-0.4) * 10)
          ))
        }
      ))
    }, 5000)
    return () => clearInterval(t)
  }, [])

  function sendChat() {
    if (!input.trim()) return
    const now = new Date()
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}`
    setMessages(prev => [...prev, { id:Date.now(), name:"나", text:input, time }])
    setInput("")
  }

  const mins = String(Math.floor(pomTime/60)).padStart(2,"0")
  const secs = String(pomTime%60).padStart(2,"0")
  const total = pomMode==="공부"?25*60:pomMode==="휴식"?5*60:15*60
  const progress = ((total-pomTime)/total)*100

  const sorted = [...members].sort((a,b) => b.score-a.score)

  return (
    <div style={{ width:"100%", height:"100%", background:"#0b1220",
                  color:"#fff", fontFamily:"'Noto Sans KR',sans-serif",
                  display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* 상단 바 */}
      <div style={{ display:"flex", alignItems:"center", padding:"10px 16px",
                    background:"#0d1520", borderBottom:"1px solid #1a2a4a",
                    gap:12, flexShrink:0 }}>
        <HomeButton />
        <div style={{ fontWeight:700 }}>🍅 토마토 농장</div>
        <div style={{ marginLeft:"auto", fontSize:12, color:"#22c98a",
                      fontWeight:700 }}>
          {members.length}명 접속중
        </div>
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* 왼쪽 — 캐릭터 + 랭킹 */}
        <div style={{ flex:1, display:"flex", flexDirection:"column",
                      overflow:"auto" }}>

          {/* 캐릭터 맵 */}
          <div style={{ padding:16, background:"linear-gradient(180deg,#0d2244 0%,#1a3a1a 100%)",
                        minHeight:220, display:"flex", alignItems:"flex-end",
                        gap:20, flexWrap:"wrap", justifyContent:"center" }}>
            {members.map(m => (
              <div key={m.id} style={{ display:"flex", flexDirection:"column",
                                        alignItems:"center", gap:4,
                                        animation: m.status==="drowsy"
                                          ? "none" : undefined }}>
                <div style={{ fontSize:10, color: STATUS_COLOR[m.status],
                               fontWeight:700, background:"rgba(0,0,0,0.5)",
                               padding:"2px 6px", borderRadius:10 }}>
                  {m.score}점 · {STATUS_LABEL[m.status]}
                </div>
                <div style={{ fontSize:36,
                               filter: m.status==="drowsy"
                                 ? "grayscale(0.7)" : "none",
                               border: m.isMe
                                 ? "2px solid #f5c518" : "none",
                               borderRadius:8, padding:4 }}>
                  {m.emoji}
                </div>
                <div style={{ fontSize:11, fontWeight: m.isMe ? 700 : 400,
                               color: m.isMe ? "#f5c518" : "#fff" }}>
                  {m.name}
                </div>
              </div>
            ))}
          </div>

          {/* 집중도 랭킹 */}
          <div style={{ padding:16 }}>
            <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                          borderRadius:10, padding:14 }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:10,
                            color:"#7ec8f5" }}>집중도 점수 랭킹</div>
              {sorted.map((m,i) => (
                <div key={m.id}
                  style={{ display:"flex", alignItems:"center", gap:10,
                            padding:"7px 0", borderBottom:"1px solid #1a2a4a",
                            background: m.isMe ? "rgba(245,197,24,0.05)" : "none" }}>
                  <div style={{ width:20, fontSize:12, fontWeight:700,
                                 color: i===0?"#f5c518":i===1?"#aaa":i===2?"#cd7f32":"#555",
                                 textAlign:"center" }}>
                    {i+1}
                  </div>
                  <div style={{ fontSize:20 }}>{m.emoji}</div>
                  <div style={{ flex:1, fontSize:12,
                                 color: m.isMe ? "#f5c518" : "#fff",
                                 fontWeight: m.isMe ? 700 : 400 }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize:12, color: STATUS_COLOR[m.status] }}>
                    {m.score}점
                  </div>
                  <div style={{ fontSize:10, color:"#555" }}>
                    {STATUS_LABEL[m.status]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 오른쪽 사이드바 */}
        <div style={{ width:280, display:"flex", flexDirection:"column",
                      gap:10, padding:"12px 12px 12px 0", overflow:"hidden" }}>

          {/* 웹캠 */}
          <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                        borderRadius:10, padding:12, flexShrink:0 }}>
            <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700,
                          marginBottom:6 }}>웹캠</div>
            <div style={{ background:"#0d1520", borderRadius:8, height:90,
                          display:"flex", alignItems:"center",
                          justifyContent:"center", fontSize:28, color:"#2a3a5a" }}>
              📷
            </div>
            <div style={{ marginTop:8, fontSize:12, textAlign:"center",
                          color:"#22c98a", fontWeight:700 }}>
              실시간 집중도: 82점
            </div>
          </div>

          {/* 뽀모도로 */}
          <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                        borderRadius:10, padding:12, flexShrink:0 }}>
            <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700,
                          marginBottom:8 }}>동적 뽀모도로</div>
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
            <div style={{ display:"flex", gap:6, marginTop:8 }}>
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

          {/* 채팅방 */}
          <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                        borderRadius:10, padding:12, flex:1,
                        display:"flex", flexDirection:"column",
                        overflow:"hidden" }}>
            <div style={{ fontSize:11, color:"#7ec8f5", fontWeight:700,
                          marginBottom:8 }}>채팅방</div>

            {/* 메시지 목록 */}
            <div style={{ flex:1, overflowY:"auto", display:"flex",
                          flexDirection:"column", gap:6, marginBottom:8 }}>
              {messages.map(msg => (
                <div key={msg.id}
                  style={{ display:"flex", flexDirection:"column",
                            alignItems: msg.name==="나" ? "flex-end" : "flex-start" }}>
                  {msg.name !== "나" && (
                    <div style={{ fontSize:10, color:"#555", marginBottom:2 }}>
                      {msg.name}
                    </div>
                  )}
                  <div style={{ maxWidth:"85%", padding:"6px 10px",
                                 borderRadius:10, fontSize:12,
                                 background: msg.name==="나" ? "#f5c518" : "#0d1520",
                                 color: msg.name==="나" ? "#000" : "#fff" }}>
                    {msg.text}
                  </div>
                  <div style={{ fontSize:10, color:"#444", marginTop:2 }}>
                    {msg.time}
                  </div>
                </div>
              ))}
            </div>

            {/* 입력창 */}
            <div style={{ display:"flex", gap:6 }}>
              <input value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && sendChat()}
                placeholder="메시지..."
                style={{ flex:1, background:"#0d1520",
                          border:"1px solid #2a3a5a", borderRadius:6,
                          padding:"6px 8px", color:"#fff", fontSize:12,
                          outline:"none" }} />
              <button onClick={sendChat}
                style={{ background:"#f5c518", border:"none",
                          borderRadius:6, padding:"6px 10px",
                          fontSize:11, fontWeight:700, cursor:"pointer" }}>
                전송
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}