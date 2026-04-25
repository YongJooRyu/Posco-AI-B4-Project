import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import SharedHeader, {
  PIX, BODY_HI, BODY_MAIN, BODY_DARK,
  LIME_HI, LIME_MAIN, LIME_DARK,
  AMBER_MAIN,
  COLOR_TEXT, COLOR_TEXT_SUB, COLOR_NEUTRAL, COLOR_FOCUS, COLOR_UNFOCUS,
  pixClip, pixClipSm, bodyGrad, limeGrad, sideShadow,
} from "../components/SharedHeader"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"
const HDR  = { "X-User-Id": "1" }

// SharedHeader에서 가져온 토큰 alias (기존 변수명 유지)
const PIX_CLIP    = pixClip
const PIX_CLIP_SM = pixClipSm

// ── 헬퍼 ──────────────────────────────────────────────────────

function formatFocusSec(sec) {
  if (!sec) return "0분"
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}분`
}

function secToLabel(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0")
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0")
  return `${h}:${m}`
}

function gradeColor(score) {
  if (score >= 90) return "#1aa870"   // S - 진한 초록
  if (score >= 70) return "#22c98a"   // A/B - 초록
  if (score >= 50) return AMBER_MAIN  // C - 앰버
  return COLOR_UNFOCUS                // D - 빨강
}

function grade(score) {
  if (score >= 90) return "S"
  if (score >= 80) return "A"
  if (score >= 70) return "B"
  if (score >= 60) return "C"
  return "D"
}

// 인접한(또는 짧은 간격으로 떨어진) 미집중 구간을 하나로 병합
// gapTolerance(초): 이 간격 이내면 같은 구간으로 본다 (기본 30초 = 짧은 한눈팔이 흡수)
function mergeAdjacentSegments(segs, gapTolerance = 30) {
  if (!segs || segs.length === 0) return []
  const sorted = [...segs].sort((a, b) => a.start_sec - b.start_sec)
  const merged = []
  let cur = { ...sorted[0] }
  let scoreSum = (cur.avg_score ?? 0) * (cur.end_sec - cur.start_sec)
  let durSum   = cur.end_sec - cur.start_sec

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]
    // 같은 세션 내에서 간격이 gapTolerance 이내면 병합
    if (next.session_id === cur.session_id && next.start_sec <= cur.end_sec + gapTolerance) {
      cur.end_sec = Math.max(cur.end_sec, next.end_sec)
      const nDur = next.end_sec - next.start_sec
      scoreSum += (next.avg_score ?? 0) * nDur
      durSum   += nDur
    } else {
      cur.avg_score = durSum > 0 ? scoreSum / durSum : cur.avg_score
      merged.push(cur)
      cur = { ...next }
      scoreSum = (cur.avg_score ?? 0) * (cur.end_sec - cur.start_sec)
      durSum   = cur.end_sec - cur.start_sec
    }
  }
  cur.avg_score = durSum > 0 ? scoreSum / durSum : cur.avg_score
  merged.push(cur)
  return merged
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: bodyGrad, boxShadow: sideShadow,
      clipPath: pixClip, padding: 16,
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardTitle({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: COLOR_TEXT_SUB,
                  fontFamily: "monospace" }}>
      {children}
    </div>
  )
}

function Skeleton({ w = "100%", h = 18, style = {} }) {
  return (
    <div style={{
      width: w, height: h, clipPath: pixClipSm,
      background: BODY_DARK,
      animation: "shimmer 1.5s infinite",
      ...style,
    }} />
  )
}

// ── 시간대별 집중도 바 차트 ────────────────────────────────────
// focusLogs: [{video_time_sec, focus_score, session_created_at}]
// 실제 시각(0~23시) 슬롯으로 집계
function HourlyChart({ focusLogs, loading }) {
  const hourly = Array(24).fill(null)

  if (focusLogs.length > 0) {
    const buckets = Array(24).fill(null).map(() => [])
    focusLogs.forEach(l => {
      // 세션 시작 시각 + 영상 내 경과 초 = 실제 시각
      let actualHour = null
      if (l.session_created_at) {
        const sessStart = new Date(l.session_created_at)
        const actualTime = new Date(sessStart.getTime() + (l.video_time_sec || 0) * 1000)
        actualHour = actualTime.getHours()
      } else if (l.created_at) {
        // log에 직접 시각이 있는 경우 (백엔드가 제공하면)
        actualHour = new Date(l.created_at).getHours()
      }
      if (actualHour !== null && actualHour >= 0 && actualHour < 24) {
        buckets[actualHour].push(l.focus_score)
      }
    })
    buckets.forEach((b, i) => {
      if (b.length > 0) {
        hourly[i] = Math.round((b.reduce((a, v) => a + v, 0) / b.length) * 100)
      }
    })
  }

  return (
    <Card>
      <CardTitle>오늘 집중도 타임라인</CardTitle>
      {loading ? (
        <Skeleton h={80} />
      ) : focusLogs.length === 0 ? (
        <div style={{ fontSize: 12, color: COLOR_NEUTRAL, textAlign: "center", padding: "20px 0" }}>
          아직 수강 데이터가 없어요
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-end", height: 80, gap: 2 }}>
            {hourly.map((v, i) => {
              const pct = v ?? 0
              const color = pct >= 70 ? "#22c98a" : pct >= 40 ? AMBER_MAIN : pct > 0 ? COLOR_UNFOCUS : BODY_DARK
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column",
                                       alignItems: "center", gap: 2 }}>
                  <div style={{
                    width: "100%", height: pct === 0 ? 2 : `${Math.max(4, pct)}%`,
                    background: color,
                    opacity: pct === 0 ? 0.15 : 0.9, transition: "height 0.4s",
                  }}
                       title={pct > 0 ? `${i}시: ${pct}점` : `${i}시: 데이터 없음`} />
                  {i % 4 === 0 && (
                    <div style={{ fontSize: 9, color: COLOR_NEUTRAL }}>{i}시</div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {[["#22c98a", "집중 (70↑)"], [AMBER_MAIN, "보통 (40~70)"], [COLOR_UNFOCUS, "미집중 (↓40)"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                <div style={{ width: 8, height: 8, background: c }} />
                <span style={{ color: COLOR_NEUTRAL }}>{l}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

// ── 과목별 집중도 ──────────────────────────────────────────────
// sessions: [{subject, avg_focus}]
function SubjectChart({ sessions, loading }) {
  // subject별 avg_focus 평균
  const subjectMap = {}
  const COLORS = { "수학": COLOR_TEXT_SUB, "영어": "#22c98a", "물리": "#7c6ff7",
                   "화학": "#FFC107", "과학": "#d94040", "국어": "#38a4f8" }

  sessions.forEach(s => {
    if (s.avg_focus == null) return
    if (!subjectMap[s.subject]) subjectMap[s.subject] = []
    subjectMap[s.subject].push(s.avg_focus)
  })

  const subjects = Object.entries(subjectMap).map(([name, scores]) => ({
    name,
    score: Math.round((scores.reduce((a, v) => a + v, 0) / scores.length) * 100),
    color: COLORS[name] ?? COLOR_NEUTRAL,
  })).sort((a, b) => b.score - a.score)

  return (
    <Card>
      <CardTitle>과목별 집중도 점수</CardTitle>
      {loading ? (
        <>
          {[1, 2, 3].map(i => <Skeleton key={i} h={30} style={{ marginBottom: 10 }} />)}
        </>
      ) : subjects.length === 0 ? (
        <div style={{ fontSize: 12, color: COLOR_NEUTRAL, textAlign: "center", padding: "20px 0" }}>
          수강한 과목 데이터가 없어요
        </div>
      ) : subjects.map((s, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between",
                         fontSize: 12, marginBottom: 4 }}>
            <span style={{ color:"#4a3d28", fontWeight:600 }}>{s.name}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: s.color, fontWeight: 700 }}>{s.score}점</span>
              <span style={{ background: s.color + "33", color: s.color,
                             fontSize: 10, fontWeight: 700, padding: "1px 6px", clipPath: PIX_CLIP_SM }}>
                {grade(s.score)}
              </span>
            </div>
          </div>
          <div style={{ height: 6, background: BODY_DARK }}>
            <div style={{ width: `${s.score}%`, height: "100%", background: s.color,
                          transition: "width 0.6s ease" }} />
          </div>
        </div>
      ))}
    </Card>
  )
}


// ── LLM 이해도 히스토리 ──────────────────────────────────────
function QuizScoreHistory({ scores, loading }) {
  if (loading) return (
    <Card>
      <CardTitle>🧠 LLM 퀴즈 이해도 기록</CardTitle>
      {[1,2,3].map(i => <Skeleton key={i} h={56} style={{ marginBottom:8 }} />)}
    </Card>
  )

  // 강의별 평균 집계
  const byLecture = {}
  scores.forEach(s => {
    if (!byLecture[s.lecture_title]) byLecture[s.lecture_title] = []
    byLecture[s.lecture_title].push(s.total)
  })

  const scoreColor = (v) => v >= 70 ? "#22c98a" : v >= 40 ? AMBER_MAIN : COLOR_UNFOCUS

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <CardTitle style={{ margin:0 }}>🧠 LLM 퀴즈 이해도 기록</CardTitle>
        <div style={{ fontSize:10, color:COLOR_NEUTRAL }}>최근 {scores.length}건</div>
      </div>

      {scores.length === 0 ? (
        <div style={{ fontSize:12, color:COLOR_NEUTRAL, textAlign:"center", padding:"20px 0" }}>
          퀴즈 기록이 없어요. 강의 수강 후 포석호와 퀴즈를 풀어보세요! 🐻‍❄️
        </div>
      ) : (
        <>
          {/* 강의별 평균 */}
          <div style={{ marginBottom:14 }}>
            {Object.entries(byLecture).map(([title, vals]) => {
              const avg = Math.round(vals.reduce((a,v)=>a+v,0) / vals.length)
              const color = scoreColor(avg)
              return (
                <div key={title} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between",
                                fontSize:12, marginBottom:3 }}>
                    <span style={{ color:"#4a3d28", fontWeight:600 }}>{title}</span>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ color, fontWeight:700 }}>{avg}점</span>
                      <span style={{ fontSize:10, background:color+"33", color,
                                     padding:"1px 6px", clipPath:PIX_CLIP_SM, fontWeight:700 }}>
                        {avg>=70?"B이상":avg>=40?"C":"D"}
                      </span>
                    </div>
                  </div>
                  <div style={{ height:6, background:BODY_DARK }}>
                    <div style={{ width:`${avg}%`, height:"100%", background:color,
                                  transition:"width 0.6s ease" }} />
                  </div>
                  <div style={{ fontSize:10, color:COLOR_NEUTRAL, marginTop:2 }}>
                    {vals.length}회 응답 · 최고 {Math.max(...vals)}점
                  </div>
                </div>
              )
            })}
          </div>

          {/* 최근 5개 상세 */}
          <div style={{ borderTop:"1px solid #f0e8d8", paddingTop:10 }}>
            <div style={{ fontSize:11, color:COLOR_NEUTRAL, marginBottom:8, fontWeight:600 }}>최근 답변 기록</div>
            {scores.slice(0,5).map((s,i) => {
              const color = scoreColor(s.total)
              return (
                <div key={i} style={{ padding:"7px 0", borderBottom:"1px solid #f0e8d8", fontSize:11 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ color:"#4a3d28", fontWeight:600 }}>{s.lecture_title}</span>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ color, fontWeight:700 }}>{s.total}점</span>
                      <span style={{ fontSize:9, background: s.match_result==="일치" ? "#e0f5ec"
                                                             : s.match_result==="부분일치" ? "#fff4cc" : "#fdecea",
                                     color: s.match_result==="일치" ? "#187050"
                                          : s.match_result==="부분일치" ? COLOR_TEXT_SUB : "#c42f1c",
                                     padding:"1px 6px", borderRadius:4 }}>
                        {s.match_result || "채점됨"}
                      </span>
                    </div>
                  </div>
                  {/* 항목별 미니 바 */}
                  <div style={{ display:"flex", gap:6 }}>
                    {[
                      { label:"개념", val:s.concept,  max:40 },
                      { label:"정확", val:s.accuracy, max:40 },
                      { label:"구체", val:s.detail,   max:20 },
                    ].map(item => (
                      <div key={item.label} style={{ flex:1 }}>
                        <div style={{ fontSize:9, color:COLOR_NEUTRAL, marginBottom:1 }}>
                          {item.label} {item.val}
                        </div>
                        <div style={{ height:3, background:BODY_DARK, borderRadius:2 }}>
                          <div style={{ width:`${(item.val/item.max)*100}%`, height:"100%",
                                        background: scoreColor(item.val/item.max*100),
                                        borderRadius:2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 키워드 */}
                  {(s.matched_keywords?.length > 0 || s.missing_keywords?.length > 0) && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:5 }}>
                      {s.matched_keywords?.slice(0,4).map(k => (
                        <span key={k} style={{ background:"#e0f5ec", color:"#187050",
                                               border:"1px solid #22c98a66",
                                               borderRadius:10, padding:"1px 5px", fontSize:9 }}>✓ {k}</span>
                      ))}
                      {s.missing_keywords?.slice(0,3).map(k => (
                        <span key={k} style={{ background:"#fff0f0", color:"#c42f1c",
                                               border:"1px solid #c42f1c66",
                                               borderRadius:10, padding:"1px 5px", fontSize:9 }}>✗ {k}</span>
                      ))}
                    </div>
                  )}
                  {s.comment && (
                    <div style={{ fontSize:10, color:COLOR_NEUTRAL, marginTop:4 }}>💬 {s.comment}</div>
                  )}
                  <div style={{ fontSize:9, color:COLOR_NEUTRAL, marginTop:3 }}>
                    {new Date(s.created_at).toLocaleString("ko-KR")}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

// ── 미집중 구간 ────────────────────────────────────────────────
function UnfocusedSegments({ segments, sessions, loading, navigate }) {
  // segments: [{start_sec, end_sec, avg_score, session_id, lecture_title}]
  if (loading) return (
    <Card>
      <CardTitle>미집중 구간 모음</CardTitle>
      {[1, 2, 3].map(i => <Skeleton key={i} h={40} style={{ marginBottom: 8 }} />)}
    </Card>
  )

  return (
    <Card>
      <CardTitle>미집중 구간 모음</CardTitle>
      {segments.length === 0 ? (
        <div style={{ fontSize: 12, color: COLOR_NEUTRAL, textAlign: "center", padding: "20px 0" }}>
          오늘 미집중 구간이 없어요 🎉
        </div>
      ) : segments.slice(0, 5).map((seg, i) => {
        const durSec = Math.round(seg.end_sec - seg.start_sec)
        const durMin = Math.round(durSec / 60)
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between",
                                 alignItems: "center", padding: "8px 0",
                                 borderBottom: "1px solid #f0e8d8", fontSize: 12 }}>
            <div>
              <div style={{ color: "#4a3d28", fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                {secToLabel(seg.start_sec)}
                {durMin >= 2 && (
                  <span style={{ fontSize: 9, color: COLOR_UNFOCUS, background: "#fff0f0",
                                 border: `1px solid ${COLOR_UNFOCUS}`, borderRadius: 3,
                                 padding: "1px 5px", fontWeight: 700 }}>
                    {durMin}분 연속
                  </span>
                )}
              </div>
              <div style={{ color: COLOR_NEUTRAL, fontSize: 11 }}>
                {seg.lecture_title ?? "강의"} · {durSec >= 60 ? `${durMin}분` : `${durSec}초`}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: COLOR_UNFOCUS, fontSize: 11 }}>
                {Math.round(seg.avg_score * 100)}점
              </span>
              <button
                onClick={() => navigate("/lecture", { state: { seekTo: seg.start_sec } })}
                style={{ fontSize: 10, background: LIME_MAIN, border: `2px solid ${PIX}`,
                         borderBottom: `4px solid ${PIX}`,
                         boxShadow: `inset 0 2px 0 ${LIME_HI}`,
                         clipPath: pixClip, padding: "3px 8px",
                         cursor: "pointer", fontWeight: 700, color: "#2a1a0a", fontFamily: "monospace" }}>
                다시보기
              </button>
            </div>
          </div>
        )
      })}
    </Card>
  )
}

// ── 주간 트렌드 ────────────────────────────────────────────────
function WeeklyTrend({ weeklyData, loading }) {
  const days = ["월", "화", "수", "목", "금", "토", "일"]

  return (
    <Card>
      <CardTitle>주간 집중 트렌드</CardTitle>
      {loading ? (
        <Skeleton h={60} />
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 70 }}>
          {days.map((day, i) => {
            const score = weeklyData[i] ?? 0
            const color = score >= 70 ? "#22c98a" : score >= 40 ? AMBER_MAIN : score > 0 ? COLOR_UNFOCUS : BODY_DARK
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column",
                                     alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", minHeight: 4,
                               height: score > 0 ? `${Math.max(6, score * 0.65)}%` : 4,
                               background: color, borderRadius: "3px 3px 0 0",
                               opacity: score === 0 ? 0.2 : 0.9,
                               transition: "height 0.5s ease" }} />
                <div style={{ fontSize: 10, color: COLOR_NEUTRAL }}>{day}</div>
                {score > 0 && <div style={{ fontSize: 9, color: "#4a3d28", fontWeight:700 }}>{score}</div>}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState("오늘")

  // ── 서버 상태 ──
  const [user,        setUser]        = useState(null)
  const [sessions,    setSessions]    = useState([])   // 오늘 강의 세션들
  const [focusLogs,   setFocusLogs]   = useState([])   // 오늘 전체 focus_log
  const [lowSegs,     setLowSegs]     = useState([])   // 미집중 구간
  const [weeklyData,  setWeeklyData]  = useState(Array(7).fill(0))
  const [quizScores,  setQuizScores]  = useState([])   // LLM 이해도 점수 기록
  const [loadingScores, setLoadingScores] = useState(true)

  // ── 로딩 상태 ──
  const [loadingUser,    setLoadingUser]    = useState(true)
  const [loadingSessions,setLoadingSessions]= useState(true)

  // ── GET /users/me ──
  useEffect(() => {
    fetch(`${BASE}/users/me`, { headers: HDR })
      .then(r => r.json())
      .then(data => { setUser(data); setLoadingUser(false) })
      .catch(() => setLoadingUser(false))
  }, [])

  // ── GET /quiz/scores (LLM 이해도) ──
  useEffect(() => {
    fetch(`${BASE}/quiz/scores`, { headers: HDR })
      .then(r => r.json())
      .then(data => { setQuizScores(Array.isArray(data) ? data : []); setLoadingScores(false) })
      .catch(() => setLoadingScores(false))
  }, [])

  // ── GET /focus/sessions/today → 타임라인 + 과목별 + 미집중 + 주간 ──
  useEffect(() => {
    // 오늘 세션 목록 & 각 세션의 timeline 가져오기
    async function loadSessions() {
      try {
        // 1) 오늘 강의 세션 목록
        const sessRes = await fetch(`${BASE}/focus/sessions/today`, { headers: HDR })
        if (!sessRes.ok) {
          console.warn("[Dashboard] /focus/sessions/today 실패:", sessRes.status)
          throw new Error(`HTTP ${sessRes.status}`)
        }
        const sessData = await sessRes.json()
        console.log(`[Dashboard] 오늘 세션 ${sessData.length}개 로드됨`, sessData)
        setSessions(sessData)

        // 2) 각 세션 timeline 병렬 fetch (각 log에 세션의 created_at 주입)
        const timelines = await Promise.all(
          sessData.map(s =>
            fetch(`${BASE}/focus/session/${s.session_id}`, { headers: HDR })
              .then(r => r.ok ? r.json() : { logs: [] })
              .then(d => (d.logs ?? []).map(log => ({
                ...log,
                session_created_at: s.created_at,  // 세션 시작 시각 추가
              })))
              .catch(err => {
                console.warn(`[Dashboard] 세션 ${s.session_id} timeline 실패`, err)
                return []
              })
          )
        )
        const allLogs = timelines.flat()
        console.log(`[Dashboard] 전체 focus logs: ${allLogs.length}개`)
        setFocusLogs(allLogs)

        // 3) 미집중 구간 추출 (연속 focus < 0.7, 10초 이상)
        const segs = []
        sessData.forEach((sess, si) => {
          const logs = (timelines[si] ?? []).sort((a, b) => a.video_time_sec - b.video_time_sec)
          let segStart = null, segScores = []
          logs.forEach(log => {
            if (log.focus_score < 0.7) {
              if (segStart === null) segStart = log.video_time_sec
              segScores.push(log.focus_score)
            } else {
              if (segStart !== null) {
                const duration = log.video_time_sec - segStart
                if (duration >= 10) {
                  segs.push({
                    start_sec: segStart,
                    end_sec: log.video_time_sec,
                    avg_score: segScores.reduce((a, v) => a + v, 0) / segScores.length,
                    session_id: sess.session_id,
                    lecture_title: sess.lecture_title,
                  })
                }
                segStart = null; segScores = []
              }
            }
          })
        })
        console.log(`[Dashboard] 미집중 구간 ${segs.length}개 추출됨`)
        // 인접한 구간 병합 → 연속된 미집중 시간을 하나의 구간으로 표시
        const mergedSegs = mergeAdjacentSegments(segs, 30)
        console.log(`[Dashboard] 병합 후 ${mergedSegs.length}개`)
        setLowSegs(mergedSegs)

      } catch (err) {
        console.error("[Dashboard] loadSessions 실패:", err)
        setSessions([])
        setFocusLogs([])
        setLowSegs([])
      } finally {
        setLoadingSessions(false)
      }
    }

    // ── 주간 데이터: /focus/weekly (없으면 sessions avg_focus로 근사) ──
    async function loadWeekly() {
      try {
        const r = await fetch(`${BASE}/focus/weekly`, { headers: HDR })
        if (!r.ok) throw new Error()
        const data = await r.json()  // {mon:float, tue:float, ...} or [0~6]
        if (Array.isArray(data)) {
          setWeeklyData(data.map(v => Math.round(v * 100)))
        } else {
          const keys = ["mon","tue","wed","thu","fri","sat","sun"]
          setWeeklyData(keys.map(k => Math.round((data[k] ?? 0) * 100)))
        }
      } catch {
        // fallback: 오늘치만 넣기 (sessions avg_focus)
        const today = new Date().getDay()  // 0=일,1=월...
        const dayIdx = today === 0 ? 6 : today - 1
        setWeeklyData(prev => {
          const next = [...prev]
          // placeholder: 데이터 없으면 0 유지
          return next
        })
      }
    }

    loadSessions()
    loadWeekly()
  }, [])

  // ── 파생값 ──
  const focusSec = user?.today_focus_sec ?? 0

  // 과목별 sessions 변환 (SubjectChart용)
  const sessionsWithSubject = sessions.map(s => ({
    subject: s.subject,
    avg_focus: s.avg_focus,
  }))

  return (
    <div style={{
      width: "100%", height: "100%", background: BODY_MAIN,
      color: "#2a1a0a", fontFamily: "monospace",
      overflow: "auto", display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <SharedHeader showHome />

      {/* 서브 헤더 */}
      <div style={{ background: limeGrad, boxShadow: sideShadow,
                    padding: "9px 20px", flexShrink: 0,
                    display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#2a1a0a", fontFamily: "monospace" }}>
          📊 학습 리포트
        </span>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {["오늘", "이번 주", "이번 달"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "3px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                       fontFamily: "monospace",
                       background: tab === t ? LIME_DARK : "transparent",
                       color: tab === t ? "#FFFDD0" : "#2a1a0a",
                       border: `2px solid ${PIX}`,
                       borderBottom: tab === t ? `4px solid ${PIX}` : `2px solid ${PIX}`,
                       boxShadow: tab === t ? "none" : `inset 0 2px 0 ${LIME_HI}`,
                       clipPath: pixClip }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── 요약 카드 3개 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { label: "연속 출석",      value: user ? `${user.streak_days}일`  : "--", color: "#e67e22", loading: loadingUser },
            { label: "오늘 집중 시간", value: user ? formatFocusSec(focusSec) : "--", color: "#22c98a", loading: loadingUser },
            { label: "레벨",           value: user ? `Lv.${user.level}`       : "--", color: "#7c6ff7", loading: loadingUser },
          ].map((c, i) => (
            <div key={i} style={{ clipPath: pixClip, overflow: "hidden",
                                   boxShadow: "0 4px 16px rgba(0,0,0,0.18)", fontFamily: "monospace" }}>
              <div style={{ background: limeGrad, boxShadow: sideShadow,
                             padding: "6px 14px", fontSize: 10, fontWeight: 700, color: "#2a1a0a" }}>
                {c.label}
              </div>
              <div style={{ background: bodyGrad, boxShadow: sideShadow,
                             padding: "14px 16px", textAlign: "center" }}>
                {c.loading ? (
                  <Skeleton h={32} style={{ margin: "0 auto", width: "60%" }} />
                ) : (
                  <div style={{ fontSize: 26, fontWeight: 700, color: c.color, lineHeight: 1 }}>{c.value}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── 상단 2컬럼: 시간대별 집중도 + 주간 트렌드 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <HourlyChart focusLogs={focusLogs} loading={loadingSessions} />
          <WeeklyTrend weeklyData={weeklyData} loading={loadingSessions} />
        </div>

        {/* ── 중단 2컬럼: 과목별 집중도 + 미집중 구간 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <SubjectChart sessions={sessionsWithSubject} loading={loadingSessions} />
          <UnfocusedSegments
            segments={lowSegs}
            loading={loadingSessions}
            navigate={navigate}
          />
        </div>

        {/* ── 하단 2컬럼: LLM 이해도 기록 + 오늘 수강 세션 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
          <QuizScoreHistory scores={quizScores} loading={loadingScores} />

          {/* 오늘 수강 세션 목록 */}
          <Card>
            <CardTitle>📚 오늘 수강 기록</CardTitle>
            {loadingSessions ? (
              [1, 2, 3].map(i => <Skeleton key={i} h={44} style={{ marginBottom: 8 }} />)
            ) : sessions.length === 0 ? (
              <div style={{ fontSize: 12, color: COLOR_NEUTRAL, textAlign: "center", padding: "20px 0" }}>
                오늘 수강한 강의가 없어요
              </div>
            ) : sessions.map((s, i) => {
              const pct = s.avg_focus ? Math.round(s.avg_focus * 100) : null
              const color = pct ? gradeColor(pct) : COLOR_NEUTRAL
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between",
                                       alignItems: "center", padding: "8px 0",
                                       borderBottom: "1px solid #f0e8d8", fontSize: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#4a3d28", marginBottom: 2,
                                   overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.lecture_title}
                    </div>
                    <div style={{ fontSize: 10, color: COLOR_NEUTRAL }}>{s.subject}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                    {pct !== null ? (
                      <span style={{ color, fontWeight: 700 }}>{pct}점</span>
                    ) : (
                      <span style={{ color: COLOR_NEUTRAL, fontSize: 10 }}>수강 중</span>
                    )}
                    <button
                      onClick={() => navigate("/lecture")}
                      style={{ fontSize: 10, background: LIME_MAIN, border: `2px solid ${PIX}`,
                               borderBottom: `4px solid ${PIX}`,
                               boxShadow: `inset 0 2px 0 ${LIME_HI}`,
                               clipPath: pixClip, padding: "3px 8px",
                               cursor: "pointer", fontWeight: 700, color: "#2a1a0a", fontFamily: "monospace" }}>
                      이어보기
                    </button>
                  </div>
                </div>
              )
            })}
          </Card>
        </div>

      </div>
    </div>
  )
}