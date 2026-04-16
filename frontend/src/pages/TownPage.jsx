
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import SharedHeader from "../components/SharedHeader"

// ── 더미 데이터 ──

// 🔌 TODO(백엔드): GET /api/quests/today
//   → [{ id, title, desc, npc:{name,emoji}, progress:{current,total,unit}, rewards, status, location }]
const QUEST_DETAILS = [
  {
    id: 1,
    title: "집중 30분 달성",
    desc: "뽀모도로 타이머를 이용해 30분 이상 집중 상태를 유지하세요. 강의실에서 집중도 80점 이상을 유지하면 완료됩니다.",
    npc: { name: "한원석 교수님", emoji: "🧙" },
    progress: { current: 18, total: 30, unit: "분" },
    rewards: [
      { type: "EXP", amount: 100, emoji: "⚡" },
      { type: "GOLD", amount: 50, emoji: "💰" },
    ],
    status: "진행중",
    location: "/lecture",
  },
  {
    id: 2,
    title: "퀴즈 3문제 풀기",
    desc: "포석호와 함께 오늘 배운 내용 중 3가지 퀴즈를 풀어보세요. 정답을 맞히면 보상이 지급됩니다.",
    npc: { name: "포석호", emoji: "🐾" },
    progress: { current: 1, total: 3, unit: "문제" },
    rewards: [
      { type: "EXP", amount: 150, emoji: "⚡" },
      { type: "배지", amount: 1, emoji: "🎖️" },
    ],
    status: "진행중",
    location: null,
  },
  {
    id: 3,
    title: "강의 수강 완료",
    desc: "오늘 배정된 수학 강의를 끝까지 시청하세요. 강의 종료 후 집중도 리포트를 확인하실 수 있습니다.",
    npc: { name: "선생님 NPC", emoji: "👨‍🏫" },
    progress: { current: 30, total: 30, unit: "분" },
    rewards: [
      { type: "EXP", amount: 200, emoji: "⚡" },
      { type: "GOLD", amount: 100, emoji: "💰" },
    ],
    status: "완료",
    location: "/lecture",
  },
]

// 🔌 TODO(백엔드): GET /api/schedule/today
//   → [{ time, subject, lectureId, lectureUrl }] 형태로 교체
const SCHEDULE = [
  { time: "09:00", subject: "수학",  lectureId: "math-101"    },
  { time: "11:00", subject: "영어",  lectureId: "eng-201"     },
  { time: "14:00", subject: "물리",  lectureId: "physics-301" },
  { time: "16:00", subject: "화학",  lectureId: "chem-401"    },
]

const QUIZZES = [
  { id: 1, subject: "수학", question: "미분의 기본 정의는?", difficulty: "중" },
  { id: 2, subject: "영어", question: "현재완료 용법 3가지?", difficulty: "하" },
  { id: 3, subject: "물리", question: "뉴턴 제2법칙 F=?", difficulty: "하" },
  { id: 4, subject: "화학", question: "몰(mol)의 정의는?", difficulty: "상" },
]

// 🔌 TODO(백엔드): GET /api/user/badges → [{ id, emoji, name, earned }]
const BADGES = [
  { id: 1, emoji: "🔥", name: "7일 연속 출석", earned: true },
  { id: 2, emoji: "⚡", name: "퀘스트 완료 10회", earned: true },
  { id: 3, emoji: "🌟", name: "만점 퀴즈", earned: false },
  { id: 4, emoji: "🏆", name: "레벨 20 달성", earned: false },
  { id: 5, emoji: "📚", name: "강의 50개 수강", earned: true },
  { id: 6, emoji: "💎", name: "30일 연속 출석", earned: false },
]

const STAR_POS = [
  {t:7,l:6},{t:13,l:18},{t:4,l:30},{t:18,l:44},
  {t:3,l:58},{t:14,l:72},{t:9,l:84},{t:21,l:10},
  {t:5,l:40},{t:20,l:93},{t:8,l:53},{t:16,l:25},
  {t:11,l:66},{t:2,l:80},{t:22,l:36},
]

// ── 메인 컴포넌트 ──

export default function TownPage() {
  const [popup, setPopup]                 = useState(null)
  const [selectedQuest, setSelectedQuest] = useState(null)
  const [notifs, setNotifs]               = useState({
    quest: true, schedule: false, quiz: true, teacher: false,
  })
  // 🔌 TODO(백엔드): GET /api/user/today-stats (polling 또는 WebSocket)
  //   → { studyTime: "HH:MM", focusTime: "HH:MM" }
  //   현재는 더미값 "00:00" 사용. 실시간 갱신 시 useEffect + setInterval 로 교체
  const [studyStats] = useState({ studyTime: "00:00", focusTime: "00:00" })
  const navigate = useNavigate()

  function openNpc(key, popupName) {
    setNotifs(p => ({ ...p, [key]: false }))
    setPopup(popupName)
  }

  function openQuestDetail(q) {
    setSelectedQuest(q)
    setPopup("questDetail")
  }

  return (
    <div style={{ width: "100%", height: "100%", background: "#0b1220",
                  color: "#fff", fontFamily: "'Noto Sans KR', sans-serif",
                  overflow: "auto", position: "relative" }}>

      <SharedHeader />

      {/* ── 마을 맵 ── */}
      <div style={{
        padding: "28px 40px 0",
        background: "linear-gradient(180deg,#05091a 0%,#0c1f44 50%,#162e16 80%,#1e4a1e 100%)",
        position: "relative", minHeight: 340, overflow: "hidden",
        display: "flex", alignItems: "flex-end",
      }}>

        {/* 별 */}
        {STAR_POS.map((s, i) => (
          <div key={i} style={{
            position: "absolute", top: `${s.t}%`, left: `${s.l}%`,
            width: i % 4 === 0 ? 3 : 2, height: i % 4 === 0 ? 3 : 2,
            background: "#fff", borderRadius: "50%",
            opacity: i % 3 === 0 ? 0.8 : 0.4, pointerEvents: "none",
          }} />
        ))}

        {/* 왼쪽: NPC 3종 */}
        <div style={{ display: "flex", gap: 36, alignItems: "flex-end", flexShrink: 0 }}>
          <MapleChar
            name="한원석 교수님" headEmoji="🧙"
            bodyColor="#8a4af5" legColor="#5a2af5"
            hasNotif={notifs.quest}
            onClick={() => openNpc("quest", "quest")}
          />
          <MapleChar
            name="실습 조교님" headEmoji="🧑‍💼"
            bodyColor="#2ab8a8" legColor="#1a8878"
            hasNotif={notifs.schedule}
            onClick={() => openNpc("schedule", "schedule")}
          />
          {/* 교실 건물 */}
          <div
            onClick={() => { setNotifs(p => ({ ...p, teacher: false })); navigate("/lecture") }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "none"}
            style={{ display: "flex", flexDirection: "column", alignItems: "center",
                     cursor: "pointer", marginBottom: 20, transition: "transform 0.2s",
                     flexShrink: 0 }}>
            {notifs.teacher && (
              <div style={{ position: "relative", marginBottom: 3 }}>
                <div style={{ background: "#fff", border: "2px solid #1a1a1a", borderRadius: 8,
                              padding: "1px 9px", fontSize: 14, fontWeight: 900,
                              color: "#e00", lineHeight: 1.4 }}>!</div>
                <div style={{ position: "absolute", bottom: -6, left: "50%",
                              transform: "translateX(-50%)", width: 0, height: 0,
                              borderLeft: "5px solid transparent",
                              borderRight: "5px solid transparent",
                              borderTop: "6px solid #1a1a1a" }} />
              </div>
            )}
            <div style={{ fontSize: 10, color: "#7ec8f5", fontWeight: 700, marginBottom: 4,
                          background: "rgba(0,0,0,0.65)", padding: "2px 10px", borderRadius: 8,
                          border: "1px solid #2a4a6a" }}>교실</div>
            <div style={{ fontSize: 46 }}>🏫</div>
            <div style={{ width: 60, height: 10, background: "#2a5a9a",
                          borderRadius: "3px 3px 0 0", borderTop: "2px solid #4a8aca" }} />
          </div>
        </div>

        {/* 스페이서 */}
        <div style={{ flex: 1, minWidth: 32 }} />

        {/* 중앙: 내 캐릭터 + 펫 (붙어있게) */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
          <MapleChar
            name="닉네임" headEmoji="🧑"
            bodyColor="#4a6af5" legColor="#2a4ae0"
            isMe
            burningBubble={studyStats}
          />
          <MapleChar
            name="포석호" headEmoji="🐻‍❄️"
            bodyColor="#e8843a" legColor="#c05a20"
            hasNotif={notifs.quiz}
            onClick={() => openNpc("quiz", "pet")}
            small
          />
        </div>

        {/* 스페이서 */}
        <div style={{ flex: 1, minWidth: 32 }} />

        {/* 오른쪽: 토마토 농장 */}
        <div
          onClick={() => navigate("/party")}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-6px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "none"}
          style={{ display: "flex", flexDirection: "column", alignItems: "center",
                   cursor: "pointer", marginBottom: 20, transition: "transform 0.2s",
                   flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: "#f5c518", fontWeight: 700, marginBottom: 4,
                        background: "rgba(0,0,0,0.65)", padding: "2px 10px", borderRadius: 8,
                        border: "1px solid #3a4a2a" }}>
            토마토 농장
          </div>
          <div style={{ fontSize: 52 }}>🍅</div>
          <div style={{ width: 72, height: 10, background: "#3a7a3a",
                        borderRadius: "3px 3px 0 0", borderTop: "2px solid #5aaa5a" }} />
        </div>

        {/* 퀘스트 진행 현황 박스 */}
        <div style={{ position: "absolute", top: 16, right: 16,
                      background: "rgba(5,10,25,0.82)", backdropFilter: "blur(6px)",
                      border: "1px solid #2a3a5a", borderRadius: 10, padding: 14, minWidth: 210 }}>
          <div style={{ fontSize: 11, color: "#7ec8f5", fontWeight: 700, marginBottom: 10 }}>
            📋 퀘스트 진행 현황
          </div>
          {QUEST_DETAILS.map(q => (
            <div key={q.id}
              onClick={() => openQuestDetail(q)}
              onMouseEnter={e => { e.currentTarget.style.borderColor="#f5c518"; e.currentTarget.style.background="rgba(245,197,24,0.06)" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.background="rgba(255,255,255,0.03)" }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                       fontSize: 11, padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                       marginBottom: 4, background: "rgba(255,255,255,0.03)",
                       border: "1px solid transparent", transition: "all 0.15s" }}>
              <span style={{ color: "#ddd" }}>{q.title}</span>
              <span style={{ color: q.status === "완료" ? "#22c98a" : "#f5c518",
                             fontWeight: 700, fontSize: 10 }}>{q.status}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#555", marginTop: 6, textAlign: "right" }}>
            진행률 [{QUEST_DETAILS.filter(q => q.status === "완료").length}/{QUEST_DETAILS.length}]
          </div>
        </div>

        {/* 잔디 */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 20,
                      background: "linear-gradient(#3a7a3a,#2a5a2a)",
                      borderTop: "2px solid #4a9a4a", pointerEvents: "none" }} />
      </div>

      {/* 우측 하단 고정 버튼 (대시보드 + 도감) */}
      <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", gap: 10, zIndex: 100 }}>
        <FixedBtn emoji="📊" color="#7ec8f5" onClick={() => navigate("/dashboard")} />
        <FixedBtn emoji="📖" color="#f5c518" onClick={() => setPopup("inventory")} />
      </div>

      {/* 팝업들 */}
      {popup === "quest" && (
        <QuestListPopup onClose={() => setPopup(null)} onSelectQuest={openQuestDetail} />
      )}
      {popup === "schedule"   && <SchedulePopup   onClose={() => setPopup(null)} navigate={navigate} />}
      {popup === "pet"        && <PetPopup         onClose={() => setPopup(null)} />}
      {popup === "inventory"  && <InventoryPopup   onClose={() => setPopup(null)} />}
      {popup === "questDetail" && selectedQuest && (
        <QuestDetailPopup quest={selectedQuest} onClose={() => setPopup(null)} navigate={navigate} />
      )}
    </div>
  )
}

// ── 고정 버튼 ──

function FixedBtn({ emoji, color, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ width: 54, height: 54, background: "#1a2a3a",
               border: `2px solid ${hov ? color : "#2a3a5a"}`,
               borderRadius: "50%", display: "flex", alignItems: "center",
               justifyContent: "center", fontSize: 22, cursor: "pointer",
               boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
               transform: hov ? "scale(1.1)" : "scale(1)",
               transition: "border-color 0.2s, transform 0.15s" }}>
      {emoji}
    </div>
  )
}

// ── MapleStory 스타일 캐릭터 ──

function MapleChar({ name, headEmoji, bodyColor, legColor, hasNotif, onClick, isMe, burningBubble, small }) {
  const [hov, setHov] = useState(false)
  const headSize = small ? 22 : 32
  const bodyW    = small ? 17 : 24
  const bodyH    = small ? 13 : 18
  const legW     = small ? 7  : 10
  const legH     = small ? 11 : 14
  const tagSize  = small ? 9  : 10
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center",
               cursor: onClick ? "pointer" : "default",
               marginBottom: 20, userSelect: "none" }}>

      {/* 🔥 Burning Time 말풍선 (내 캐릭터 전용) */}
      {burningBubble && (
        <div style={{ position: "relative", marginBottom: 6 }}>
          <div style={{
            background: "#0d1a2e", border: "2px solid #f5c518",
            borderRadius: 10, padding: "7px 12px",
            minWidth: 130, boxShadow: "0 0 12px rgba(245,197,24,0.25)",
          }}>
            <div style={{ fontSize: 10, color: "#f5c518", fontWeight: 800,
                          marginBottom: 5, letterSpacing: 0.5 }}>
              🔥 Burning Time
            </div>
            <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "center", marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: "#aaa" }}>공부시간</span>
              {/* 🔌 TODO: studyTime ← GET /api/user/today-stats */}
              <span style={{ fontSize: 12, color: "#f5c518", fontWeight: 700,
                             fontFamily: "monospace" }}>
                {burningBubble.studyTime}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "#aaa" }}>집중시간</span>
              {/* 🔌 TODO: focusTime ← GET /api/user/today-stats */}
              <span style={{ fontSize: 12, color: "#22c98a", fontWeight: 700,
                             fontFamily: "monospace" }}>
                {burningBubble.focusTime}
              </span>
            </div>
          </div>
          {/* 말풍선 꼬리 */}
          <div style={{ position: "absolute", bottom: -7, left: "50%",
                        transform: "translateX(-50%)", width: 0, height: 0,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderTop: "8px solid #f5c518" }} />
        </div>
      )}

      {/* 알림 말풍선 (NPC 전용) */}
      {hasNotif && (
        <div style={{ marginBottom: 3, position: "relative" }}>
          <div style={{ background: "#fff", border: "2px solid #1a1a1a", borderRadius: 8,
                        padding: "1px 9px", fontSize: 14, fontWeight: 900,
                        color: "#e00", lineHeight: 1.4 }}>!</div>
          <div style={{ position: "absolute", bottom: -6, left: "50%",
                        transform: "translateX(-50%)", width: 0, height: 0,
                        borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
                        borderTop: "6px solid #1a1a1a" }} />
        </div>
      )}

      {/* 이름 태그 */}
      <div style={{
        background: isMe ? "#f5c518" : "rgba(0,0,0,0.78)",
        color: isMe ? "#000" : "#fff",
        fontSize: tagSize, fontWeight: 700, padding: "2px 9px", borderRadius: 10, marginBottom: 5,
        border: `1px solid ${isMe ? "#c0900a" : "#3a4a6a"}`, whiteSpace: "nowrap",
        boxShadow: isMe ? "0 0 10px rgba(245,197,24,0.35)" : "none",
      }}>{name}</div>

      {/* 캐릭터 */}
      <div style={{ transform: hov && onClick ? "translateY(-8px)" : "none",
                    transition: "transform 0.18s ease",
                    display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: headSize, lineHeight: 1 }}>{headEmoji}</div>
        <div style={{ width: bodyW, height: bodyH, background: bodyColor, marginTop: 1,
                      borderRadius: "3px 3px 0 0", boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.22)" }} />
        <div style={{ display: "flex", gap: 3 }}>
          {[0,1].map(i => (
            <div key={i} style={{ width: legW, height: legH, background: legColor,
                                   borderRadius: "0 0 3px 3px",
                                   boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.28)" }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 팝업: 퀘스트 목록 ──

function QuestListPopup({ onClose, onSelectQuest }) {
  return (
    <PopupOverlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🧙 오늘의 퀘스트</div>
      {QUEST_DETAILS.map(q => (
        <div key={q.id} onClick={() => onSelectQuest(q)}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#f5c518"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "#2a3a5a"}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                   padding: "11px 12px", marginBottom: 7, background: "#1a2a3a",
                   borderRadius: 8, cursor: "pointer", border: "1px solid #2a3a5a",
                   transition: "border-color 0.15s" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{q.title}</div>
            <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{q.npc.emoji} {q.npc.name}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8,
                           background: q.status === "완료" ? "#1a4a2a" : "#4a3a1a",
                           color: q.status === "완료" ? "#22c98a" : "#f5c518" }}>{q.status}</span>
            <span style={{ fontSize: 10, color: "#555" }}>
              {q.progress.current}/{q.progress.total} {q.progress.unit}
            </span>
          </div>
        </div>
      ))}
    </PopupOverlay>
  )
}

// ── 팝업: 퀘스트 상세 ──

function QuestDetailPopup({ quest, onClose, navigate }) {
  const pct = Math.min(100, Math.round((quest.progress.current / quest.progress.total) * 100))
  return (
    <PopupOverlay onClose={onClose} wide>
      <div style={{ display: "flex", alignItems: "center", gap: 14,
                    marginBottom: 18, paddingBottom: 16, borderBottom: "1px solid #2a3a5a" }}>
        <div style={{ width: 68, height: 68, background: "#1a2a3a", borderRadius: 14,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 38, border: "2px solid #3a4a6a", flexShrink: 0 }}>
          {quest.npc.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 3 }}>퀘스트 의뢰인</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f5c518" }}>{quest.npc.name}</div>
        </div>
        <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 10, fontWeight: 700,
                       background: quest.status === "완료" ? "#1a4a2a" : "#3a2a0a",
                       color: quest.status === "완료" ? "#22c98a" : "#f5c518" }}>{quest.status}</span>
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{quest.title}</div>
        <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.75, marginBottom: 16 }}>{quest.desc}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa", marginBottom: 6 }}>
          <span>진행률</span>
          <span>{quest.progress.current} / {quest.progress.total} {quest.progress.unit}</span>
        </div>
        <div style={{ height: 10, background: "#1a2a3a", borderRadius: 5,
                      overflow: "hidden", border: "1px solid #2a3a4a" }}>
          <div style={{ width: pct + "%", height: "100%", borderRadius: 5,
                        background: quest.status === "완료"
                          ? "linear-gradient(90deg,#22c98a,#1aa870)"
                          : "linear-gradient(90deg,#f5c518,#e0a800)",
                        transition: "width 0.6s ease" }} />
        </div>
        <div style={{ fontSize: 10, color: "#aaa", marginTop: 4, textAlign: "right" }}>{pct}% 달성</div>
      </div>
      <div style={{ background: "#0d1825", borderRadius: 10, padding: 14,
                    marginBottom: 20, border: "1px solid #2a3a4a" }}>
        <div style={{ fontSize: 11, color: "#aaa", fontWeight: 700, marginBottom: 10 }}>🎁 보상</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {quest.rewards.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
                                   background: "#1a2a3a", padding: "8px 14px",
                                   borderRadius: 8, border: "1px solid #2a3a5a" }}>
              <span style={{ fontSize: 22 }}>{r.emoji}</span>
              <div>
                <div style={{ fontSize: 10, color: "#aaa" }}>{r.type}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f5c518" }}>+{r.amount}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose}
          style={{ flex: 1, padding: "11px 0", background: "#1a2a3a", border: "1px solid #2a3a5a",
                   borderRadius: 8, color: "#aaa", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>닫기</button>
        {quest.location && (
          <button onClick={() => navigate(quest.location)}
            style={{ flex: 1, padding: "11px 0", background: "rgba(30,70,140,0.6)",
                     border: "1px solid #4a8ade", borderRadius: 8, color: "#7ec8f5",
                     fontWeight: 700, cursor: "pointer", fontSize: 13 }}>바로이동</button>
        )}
        <button onClick={onClose}
          style={{ flex: quest.location ? 1 : 2, padding: "11px 0", background: "#f5c518",
                   border: "none", borderRadius: 8, color: "#000",
                   fontWeight: 700, cursor: "pointer", fontSize: 13 }}>수락하기</button>
      </div>
    </PopupOverlay>
  )
}

// ── 팝업: 일정표 ──

function SchedulePopup({ onClose, navigate }) {
  return (
    <PopupOverlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📅 추천 일정표</div>
      {SCHEDULE.map((s, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between",
                               alignItems: "center", fontSize: 13,
                               padding: "10px 0", borderBottom: "1px solid #1a2a3a" }}>
          <span style={{ color: "#aaa", minWidth: 52 }}>{s.time}</span>
          <span style={{ flex: 1, marginLeft: 12 }}>{s.subject}</span>
          {/* 🔌 TODO(백엔드): lectureId로 특정 강의 URL 라우팅 (현재는 /lecture 고정) */}
          <button
            onClick={() => { onClose(); navigate("/lecture") }}
            style={{ color: "#7ec8f5", cursor: "pointer", fontSize: 12,
                     background: "none", border: "none", padding: "2px 4px",
                     fontWeight: 700 }}>
            이동
          </button>
        </div>
      ))}
    </PopupOverlay>
  )
}

// ── 팝업: 펫 (질문하기 / 퀴즈 풀기 2모드) ──

function PetPopup({ onClose }) {
  const [mode, setMode]             = useState("question")  // "question" | "quiz"
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState("")
  const [loading, setLoading]       = useState(true)
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const chatRef                     = useRef(null)

  // 🔌 TODO(백엔드): 실제 LLM 엔드포인트로 교체
  const LLM_URL = "https://stonewall-rival-sternum.ngrok-free.dev/api/chat"

  // 마운트 시 펫 자동 연결
  useEffect(() => {
    async function connectPet() {
      try {
        const res = await fetch(LLM_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
          body: JSON.stringify({ message: "안녕! 나는 공부 도우미 포석호야." }),
        })
        const data = await res.json()
        setMessages([{ type: "npc", text: data.reply }])
      } catch {
        setMessages([{ type: "npc", text: "안녕하세요! 🐻‍❄️ 궁금한 것을 물어보거나 퀴즈를 풀어볼 수 있어요!" }])
      } finally {
        setLoading(false)
      }
    }
    connectPet()
  }, [])

  function scrollBottom() {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }

  async function sendMessage(text) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    if (!text) setInput("")
    setMessages(prev => { setTimeout(scrollBottom, 50); return [...prev, { type: "user", text: msg }] })
    setLoading(true)
    try {
      const res = await fetch(LLM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { type: "npc", text: data.reply }])
    } catch {
      setMessages(prev => [...prev, { type: "npc", text: "(더미) 좋은 질문이에요! 같이 생각해봐요 😊" }])
    } finally {
      setLoading(false)
      setTimeout(scrollBottom, 50)
    }
  }

  function selectQuiz(quiz) {
    if (selectedQuiz?.id === quiz.id || loading) return
    setSelectedQuiz(quiz)
    sendMessage(`[${quiz.subject}] "${quiz.question}" 퀴즈를 풀고 싶어요!`)
  }

  const tabStyle = (active) => ({
    flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 700, cursor: "pointer",
    background: active ? "#f5c518" : "transparent",
    color: active ? "#000" : "#aaa",
    border: "1px solid", borderColor: active ? "#f5c518" : "#2a3a5a",
    borderRadius: 6,
  })

  return (
    <PopupOverlay onClose={onClose} wide>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 28 }}>🐻‍❄️</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>포석호</div>
        <div style={{ fontSize: 10, color: "#555", marginLeft: "auto",
                      display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%",
                        background: loading ? "#f5c518" : "#22c98a",
                        boxShadow: loading ? "0 0 6px #f5c518" : "0 0 6px #22c98a" }} />
          {loading ? "연결 중..." : "연결됨"}
        </div>
      </div>

      {/* 모드 탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button style={tabStyle(mode === "question")} onClick={() => setMode("question")}>
          ❓ 질문하기
        </button>
        <button style={tabStyle(mode === "quiz")} onClick={() => setMode("quiz")}>
          📝 퀴즈 풀기
        </button>
      </div>

      {/* 퀴즈 목록 (퀴즈 모드에서만) */}
      {mode === "quiz" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
          {QUIZZES.map(q => (
            <div key={q.id} onClick={() => selectQuiz(q)}
              style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                       display: "flex", justifyContent: "space-between", alignItems: "center",
                       background: selectedQuiz?.id === q.id ? "#1e3050" : "#1a2a3a",
                       border: `1px solid ${selectedQuiz?.id === q.id ? "#f5c518" : "#2a3a5a"}`,
                       transition: "all 0.15s" }}>
              <span style={{ fontSize: 12 }}>
                <span style={{ color: "#7ec8f5", marginRight: 6, fontSize: 11 }}>[{q.subject}]</span>
                {q.question}
              </span>
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, marginLeft: 8, flexShrink: 0,
                             background: q.difficulty === "하" ? "#1a4a2a" : q.difficulty === "중" ? "#4a3a1a" : "#4a1a1a",
                             color: q.difficulty === "하" ? "#22c98a" : q.difficulty === "중" ? "#f5c518" : "#ff6b6b" }}>
                {q.difficulty}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 채팅 영역 */}
      <div style={{ borderTop: "1px solid #2a3a5a", paddingTop: 12 }}>
        <div ref={chatRef}
          style={{ height: mode === "quiz" ? 130 : 220, overflowY: "auto", display: "flex",
                   flexDirection: "column", gap: 6, marginBottom: 10 }}>
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
          {loading && messages.length > 0 && (
            <div style={{ fontSize: 11, color: "#555", paddingLeft: 22 }}>입력 중...</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder={mode === "quiz"
              ? (selectedQuiz ? "답변을 입력하세요..." : "퀴즈를 선택하고 시작하세요...")
              : "궁금한 것을 물어보세요..."}
            disabled={loading}
            style={{ flex: 1, background: "#1a2a4a", border: "1px solid #2a3a5a",
                     borderRadius: 8, padding: "8px 12px", color: "#fff",
                     fontSize: 12, outline: "none", opacity: loading ? 0.6 : 1 }} />
          <button onClick={() => sendMessage()} disabled={loading}
            style={{ background: "#f5c518", border: "none", borderRadius: 8,
                     padding: "8px 16px", fontWeight: 700,
                     cursor: loading ? "not-allowed" : "pointer",
                     fontSize: 12, opacity: loading ? 0.6 : 1 }}>전송</button>
        </div>
      </div>
    </PopupOverlay>
  )
}

// ── 팝업: 도감 ──

function InventoryPopup({ onClose }) {
  return (
    <PopupOverlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📖 도감 (뱃지 모음집)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {BADGES.map(b => (
          <div key={b.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: 12, borderRadius: 8, textAlign: "center",
            background: b.earned ? "#1a2a3a" : "#0d1520",
            border: b.earned ? "1px solid #f5c518" : "1px solid #2a3a3a",
            opacity: b.earned ? 1 : 0.4,
          }}>
            <div style={{ fontSize: 28, marginBottom: 4,
                          filter: b.earned ? "none" : "grayscale(100%)" }}>{b.emoji}</div>
            <div style={{ fontSize: 10, color: b.earned ? "#ddd" : "#666" }}>{b.name}</div>
            {b.earned && <div style={{ fontSize: 9, color: "#f5c518", marginTop: 2 }}>획득!</div>}
          </div>
        ))}
      </div>
    </PopupOverlay>
  )
}

// ── 공통 팝업 오버레이 ──

function PopupOverlay({ children, onClose, wide }) {
  return (
    <>
      <div onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        background: "#0d1520", border: "1px solid #2a3a5a",
        borderRadius: 14, padding: 24, zIndex: 201,
        width: wide ? "min(540px,92vw)" : "min(420px,92vw)",
        maxHeight: "88vh", overflowY: "auto",
      }}>
        <button onClick={onClose}
          style={{ position: "absolute", top: 12, right: 14, background: "none",
                   border: "none", color: "#555", fontSize: 18, cursor: "pointer" }}>✕</button>
        {children}
      </div>
    </>
  )
}
