import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import SharedHeader from "../components/SharedHeader"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

function formatFocusSec(sec) {
  if (!sec) return "0분"
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}분`
}

// 🔌 TODO: 백엔드 API 연결 시 더미 데이터 교체
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



export default function DashboardPage() {
  const [tab, setTab]         = useState("오늘")
  const navigate              = useNavigate()
  const [user, setUser]       = useState(null)
  const [reviewQueue, setReviewQueue] = useState([])
  const [loadingUser, setLoadingUser] = useState(true)

  // GET /users/me
  useEffect(() => {
    fetch(`${BASE}/users/me`, { headers: { "X-User-Id": "1" } })
      .then(r => r.json())
      .then(data => { setUser(data); setLoadingUser(false) })
      .catch(() => setLoadingUser(false))
  }, [])

  // GET /quiz/review-queue
  useEffect(() => {
    fetch(`${BASE}/quiz/review-queue`, { headers: { "X-User-Id": "1" } })
      .then(r => r.json())
      .then(data => setReviewQueue(data ?? []))
      .catch(() => {})
  }, [])

  // users/me 기반 요약 카드 값
  const focusSec    = user?.today_focus_sec ?? 0
  const totalSec    = focusSec  // 오늘 집중 시간
  const unfocusSec  = Math.max(0, (user?.streak_days ?? 0) > 0 ? 0 : 0)  // API 없음 — 더미 유지
  const avgFocusPct = user ? Math.round((focusSec / Math.max(1, focusSec + 2400)) * 100) : null

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
            { label:"연속 출석",        value: user ? `${user.streak_days}일` : "--",          color:"#7c6ff7" },
            { label:"오늘 집중 시간",   value: user ? formatFocusSec(focusSec) : "--",         color:"#22c98a" },
            { label:"복습 대기",        value: `${reviewQueue.length}개`,                      color:"#f5c518" },
            { label:"레벨",             value: user ? `Lv.${user.level}` : "--",               color:"#38a4f8" },
          ].map((c,i) => (
            <div key={i} style={{ background:"#1a2a3a", border:`1px solid ${c.color}44`,
                                   borderRadius:10, padding:14, textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#aaa", marginBottom:6 }}>{c.label}</div>
              <div style={{ fontSize:26, fontWeight:700, color:c.color }}>
                {loadingUser && i !== 2 ? "..." : c.value}
              </div>
            </div>
          ))}
        </div>

        {/* 시간대별 집중도 */}
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
          {/* 범례 */}
          <div style={{ display:"flex", gap:16, marginTop:8 }}>
            {[["#22c98a","집중 (70점↑)"],["#f5c518","보통 (40~70)"],["#f06060","미집중 (40↓)"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10 }}>
                <div style={{ width:8, height:8, borderRadius:2, background:c }} />
                <span style={{ color:"#aaa" }}>{l}</span>
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

        {/* 미집중 구간 + 복습 큐 */}
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
                  <span style={{ color:"#f5c518" }}>{u.duration}</span>
                  <button
                    onClick={() => navigate("/lecture", { state:{ seekTo: u.time } })}
                    style={{ fontSize:10, background:"#f5c518", border:"none",
                             borderRadius:5, padding:"3px 8px",
                             cursor:"pointer", fontWeight:700, color:"#000" }}>
                    다시보기
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 복습 대기 큐 (망각곡선 기반) */}
          <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                        borderRadius:10, padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between",
                          alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#7ec8f5" }}>
                📅 복습 대기 목록
              </div>
              <div style={{ fontSize:10, color:"#aaa" }}>
                망각곡선 기반
              </div>
            </div>

            {reviewQueue.length === 0 ? (
              <div style={{ fontSize:12, color:"#555", padding:"20px 0", textAlign:"center" }}>
                오늘 복습할 퀴즈가 없어요 🎉
              </div>
            ) : (
              reviewQueue.slice(0, 5).map((q, i) => (
                <div key={i} style={{ padding:"8px 0", borderBottom:"1px solid #1a2a4a",
                                      display:"flex", justifyContent:"space-between",
                                      alignItems:"center", fontSize:12 }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                      <span style={{ color: q.is_correct ? "#22c98a" : "#f06060", fontSize:10 }}>
                        {q.is_correct ? "✅ 이전 정답" : "❌ 이전 오답"}
                      </span>
                    </div>
                    <div style={{ color:"#ccc" }}>{q.question}</div>
                    <div style={{ fontSize:10, color:"#555", marginTop:2 }}>
                      복습 예정: {q.next_review_at
                        ? new Date(q.next_review_at).toLocaleDateString("ko-KR")
                        : "오늘"}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* 강의 페이지로 이동 안내 */}
            <div style={{ marginTop:14, padding:"10px 12px",
                          background:"rgba(124,111,247,0.1)",
                          border:"1px solid #7c6ff744",
                          borderRadius:8, fontSize:11, color:"#aaa",
                          textAlign:"center", lineHeight:1.6 }}>
              💡 퀴즈는 강의 수강 후<br/>
              <strong style={{ color:"#7c6ff7" }}>자동으로 시작</strong>돼요
            </div>
          </div>
        </div>

        {/* 주간 집중 트렌드 */}
        <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                      borderRadius:10, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:"#7ec8f5" }}>
            주간 집중 트렌드
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:60 }}>
            {[
              { day:"월", score:72 }, { day:"화", score:85 },
              { day:"수", score:60 }, { day:"목", score:90 },
              { day:"금", score:78 }, { day:"토", score:45 },
              { day:"일", score:82 },
            ].map((d, i) => (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
                                    alignItems:"center", gap:4 }}>
                <div style={{ width:"100%", height:`${d.score * 0.6}%`,
                               background: d.score>=70?"#7c6ff7":d.score>=40?"#f5c518":"#f06060",
                               borderRadius:"3px 3px 0 0", opacity:0.85,
                               minHeight:4 }} />
                <div style={{ fontSize:10, color:"#aaa" }}>{d.day}</div>
                <div style={{ fontSize:9, color:"#555" }}>{d.score}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}