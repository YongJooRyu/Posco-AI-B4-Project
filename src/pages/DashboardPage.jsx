import { useState } from "react"

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
  const [tab, setTab] = useState("오늘")

  return (
    <div style={{ width:"100%", height:"100%", background:"#0b1220",
                  color:"#fff", fontFamily:"'Noto Sans KR',sans-serif",
                  overflow:"auto" }}>

      {/* 상단 */}
      <div style={{ padding:"16px 20px", borderBottom:"1px solid #1a2a4a",
                    display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontWeight:700, fontSize:16 }}>📊 학습 리포트</div>
        <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
          {["오늘","이번 주","이번 달"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding:"4px 12px", fontSize:11, fontWeight:700,
                       background: tab===t ? "#f5c518" : "transparent",
                       color: tab===t ? "#000" : "#aaa",
                       border:"1px solid",
                       borderColor: tab===t ? "#f5c518" : "#2a3a5a",
                       borderRadius:20, cursor:"pointer" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:16, display:"flex", flexDirection:"column",
                    gap:12 }}>

        {/* 요약 카드 4개 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
                      gap:10 }}>
          {[
            { label:"오늘 집중도 점수", value:"82점", color:"#7c6ff7" },
            { label:"오늘 집중 시간",   value:"3h 20m", color:"#22c98a" },
            { label:"오늘 미집중 시간", value:"40m",   color:"#f5c518" },
            { label:"졸음 감지",        value:"2회",   color:"#f06060" },
          ].map((c,i) => (
            <div key={i} style={{ background:"#1a2a3a",
                                   border:`1px solid ${c.color}44`,
                                   borderRadius:10, padding:14,
                                   textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#aaa", marginBottom:6 }}>
                {c.label}
              </div>
              <div style={{ fontSize:26, fontWeight:700, color:c.color }}>
                {c.value}
              </div>
            </div>
          ))}
        </div>

        {/* 시간대별 집중도 바 차트 */}
        <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                      borderRadius:10, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12,
                        color:"#7ec8f5" }}>
            오늘 전체 타임라인 (시간대별 집중도)
          </div>
          <div style={{ display:"flex", alignItems:"flex-end",
                        height:80, gap:2 }}>
            {HOURLY.map((v,i) => (
              <div key={i} style={{ flex:1, display:"flex",
                                    flexDirection:"column",
                                    alignItems:"center", gap:2 }}>
                <div style={{
                  width:"100%",
                  height: v === 0 ? 2 : `${v}%`,
                  background: v >= 70 ? "#22c98a" : v >= 40 ? "#f5c518" : "#f06060",
                  borderRadius:"3px 3px 0 0",
                  transition:"height 0.3s",
                  opacity: v === 0 ? 0.2 : 0.85,
                }} />
                {i % 4 === 0 && (
                  <div style={{ fontSize:9, color:"#555" }}>{i}시</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 과목별 집중도 */}
        <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                      borderRadius:10, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12,
                        color:"#7ec8f5" }}>
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
                    <span style={{ color:s.color, fontWeight:700 }}>
                      {s.score}점
                    </span>
                    <span style={{ background:s.color+"33", color:s.color,
                                   fontSize:10, fontWeight:700,
                                   padding:"1px 6px", borderRadius:4 }}>
                      {grade}
                    </span>
                  </div>
                </div>
                <div style={{ height:6, background:"#0d1520", borderRadius:3 }}>
                  <div style={{ width:`${s.score}%`, height:"100%",
                                background:s.color, borderRadius:3,
                                transition:"width 0.5s" }} />
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
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12,
                          color:"#7ec8f5" }}>
              미집중 구간 모음
            </div>
            {UNFOCUSED.map((u,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                                     alignItems:"center", padding:"8px 0",
                                     borderBottom:"1px solid #1a2a4a",
                                     fontSize:12 }}>
                <div>
                  <div style={{ color:"#f5c518" }}>{u.time}</div>
                  <div style={{ color:"#aaa", fontSize:11 }}>{u.lecture}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ color:"#f06060" }}>{u.duration}</span>
                  <button style={{ fontSize:10, background:"#f5c518",
                                   border:"none", borderRadius:5,
                                   padding:"3px 8px", cursor:"pointer",
                                   fontWeight:700 }}>
                    다시보기
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 퀴즈 대시보드 */}
          <div style={{ background:"#1a2a3a", border:"1px solid #2a3a5a",
                        borderRadius:10, padding:16 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12,
                          color:"#7ec8f5" }}>
              퀴즈 대시보드
            </div>
            {[
              { label:"오늘 푼 퀴즈",  value:"5개",  color:"#22c98a" },
              { label:"정답률",        value:"80%",  color:"#f5c518" },
              { label:"획득 경험치",   value:"450", color:"#7c6ff7" },
            ].map((s,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                                     padding:"8px 0",
                                     borderBottom:"1px solid #1a2a4a",
                                     fontSize:12 }}>
                <span style={{ color:"#aaa" }}>{s.label}</span>
                <span style={{ color:s.color, fontWeight:700 }}>{s.value}</span>
              </div>
            ))}
            <button style={{ width:"100%", marginTop:12, padding:"8px 0",
                             background:"#7c6ff7", border:"none",
                             borderRadius:8, color:"#fff", fontSize:12,
                             fontWeight:700, cursor:"pointer" }}>
              퀴즈 풀러가기 →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}