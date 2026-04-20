import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import SharedHeader from "../components/SharedHeader"
import { getReviewQueue } from "../api/index.js"

// ── Cute Fantasy 에셋 경로 ──
const AF  = "/assets/Cute_Fantasy_Free"    // 무료 (타일용)
const A   = "/assets/Cute_Fantasy"         // 유료
const OD  = `${A}/Outdoor decoration`      // 공백 있는 폴더

const PLAYER_SHEET  = `${AF}/Player/Player.png`
const INN_IMG       = `${A}/Buildings/Buildings/Unique_Buildings/Inn/Inn_Blue.png`
const BARN_IMG      = `${A}/Buildings/Buildings/Unique_Buildings/Barn/Barn_Base_Red.png`
const FARMER_NPC    = `${A}/NPCs (Premade)/Farmer_Bob.png`
const CHEF_NPC      = `${A}/NPCs (Premade)/Chef_Chloe.png`
const LUMBERJACK_NPC= `${A}/NPCs (Premade)/Lumberjack_Jack.png`
const OAK_BIG       = `${A}/Trees/Big_Oak_Tree.png`
const OAK_MED       = `${A}/Trees/Medium_Oak_Tree.png`
const BIRCH_BIG     = `${A}/Trees/Big_Birch_Tree.png`
const FOUNTAIN_IMG  = `${OD}/Fountain.png`
const WELL_IMG      = `${OD}/Well.png`
const FENCE_IMG     = `${OD}/Fences.png`
const BENCH_IMG     = `${OD}/Benches.png`
const GRASS_TILE    = `${A}/Tiles/Grass/Grass_1_Middle.png`
const PATH_TILE     = `${AF}/Tiles/Path_Middle.png`
const PATH_BORDER   = `${AF}/Tiles/Path_Tile.png`
const WATER_TILE    = `${AF}/Tiles/Water_Middle.png`
const WATER_BORDER  = `${AF}/Tiles/Water_Tile.png`
const FARM_TILE     = `${AF}/Tiles/FarmLand_Tile.png`
const CHICKEN_IMG   = `${A}/Animals/Chicken/Chicken_01.png`
const DUCK_IMG      = `${A}/Animals/Duck/Duck_01.png`
const FROG_IMG      = `${A}/Animals/Frog/Frog_01.png`

// ── Player 스프라이트 행 (32px 단위) ──
// row: idle_down=0, idle_left=1, idle_right=2, idle_up=3
//      walk_down=4, walk_left=5, walk_right=6, walk_up=7
const DIR_ROW = {
  down:  { idle: 0, walk: 4 },
  left:  { idle: 1, walk: 5 },
  right: { idle: 2, walk: 6 },
  up:    { idle: 3, walk: 7 },
}

// ── 애니메이션 CSS ──
// walk_right는 4프레임, 나머지는 6프레임
const WALK_ANIM_CSS = `
@keyframes walkFrames {
  0%         { background-position-x: 0px; }
  16.666%    { background-position-x: -96px; }
  33.333%    { background-position-x: -192px; }
  50%        { background-position-x: -288px; }
  66.666%    { background-position-x: -384px; }
  83.333%    { background-position-x: -480px; }
  100%       { background-position-x: 0px; }
}
@keyframes idleBob {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-2px); }
}
`

// ── 헬퍼 컴포넌트 ──

function Sprite({ src, w, h, scale=2, style={}, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: w*scale, height: h*scale,
        backgroundImage: `url(${src})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${w*scale}px ${h*scale}px`,
        imageRendering: "pixelated",
        cursor: onClick ? "pointer" : "default",
        transform: hov && onClick ? "translateY(-6px)" : "none",
        transition: "transform 0.18s ease",
        ...style,
      }} />
  )
}

function SheetSprite({ src, sx, sy, sw, sh, sheetW, sheetH, scale=2, style={} }) {
  return (
    <div style={{
      width: sw*scale, height: sh*scale,
      backgroundImage: `url(${src})`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${sheetW*scale}px ${sheetH*scale}px`,
      backgroundPosition: `-${sx*scale}px -${sy*scale}px`,
      imageRendering: "pixelated",
      ...style,
    }} />
  )
}

// NPC 스프라이트 (64x64 per frame, 6열)
// scale=1.5 → 화면 96x96px (플레이어와 동일)
function NpcSprite({ src, sheetW, sheetH, name, hasNotif, onClick, style={} }) {
  const SC = 3.0   // 64 * 1.5 = 96px (플레이어와 동일)
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"inline-flex", flexDirection:"column",
        alignItems:"center", cursor: onClick?"pointer":"default",
        transform: hov&&onClick?"translateY(-6px)":"none",
        transition:"transform 0.18s ease", userSelect:"none",
        ...style,
      }}>
      {hasNotif && <NotifBadge />}
      {name && <NameTag name={name} />}
      <div style={{
        width: 64*SC, height: 64*SC,
        backgroundImage: `url("${src}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${sheetW*SC}px ${sheetH*SC}px`,
        backgroundPosition: "0px 0px",
        imageRendering: "pixelated",
        animation: "idleBob 1.5s ease-in-out infinite",
      }} />
    </div>
  )
}

function NotifBadge() {
  return (
    <div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", zIndex:10 }}>
      <div style={{ background:"#fff", border:"2px solid #e00", borderRadius:6,
                    padding:"0 7px", fontSize:13, fontWeight:900, color:"#e00", lineHeight:1.4,
                    boxShadow:"0 2px 6px rgba(0,0,0,0.5)" }}>!</div>
    </div>
  )
}

function NameTag({ name, isMe=false }) {
  return (
    <div style={{
      position:"absolute", top:-22, left:"50%", transform:"translateX(-50%)",
      background: isMe ? "#f5c518" : "rgba(0,0,0,0.85)",
      color: isMe ? "#000" : "#fff",
      fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:8,
      border: isMe ? "1px solid #c0900a" : "1px solid #3a4a6a",
      whiteSpace:"nowrap", zIndex:10,
      boxShadow: isMe ? "0 0 10px rgba(245,197,24,0.5)" : "none",
    }}>{name}</div>
  )
}

// 내 캐릭터 — 방향키 이동 + 4방향 walk 애니메이션 (96x96px 고정)
function MyChar({ name, burningBubble, dir="down", isWalking=false }) {
  const row = DIR_ROW[dir][isWalking ? "walk" : "idle"]
  const bgY = -(row * 96)   // 32px * 3scale = 96px per row

  return (
    <div style={{ position:"relative", display:"inline-flex",
                  flexDirection:"column", alignItems:"center", userSelect:"none" }}>
      <style>{WALK_ANIM_CSS}</style>

      {/* Burning Time 버블 */}
      {burningBubble && (
        <div style={{ position:"absolute", bottom:"100%", left:"50%",
                      transform:"translateX(-50%)", marginBottom:10, zIndex:20,
                      whiteSpace:"nowrap" }}>
          <div style={{ background:"rgba(13,26,46,0.96)", border:"2px solid #f5c518",
                        borderRadius:10, padding:"8px 14px",
                        boxShadow:"0 4px 20px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize:10, color:"#f5c518", fontWeight:800, marginBottom:6 }}>
              🔥 Burning Time
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", gap:24, marginBottom:3 }}>
              <span style={{ fontSize:9, color:"#888" }}>공부시간</span>
              <span style={{ fontSize:12, color:"#f5c518", fontWeight:700,
                             fontFamily:"monospace" }}>{burningBubble.studyTime}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", gap:24 }}>
              <span style={{ fontSize:9, color:"#888" }}>집중시간</span>
              <span style={{ fontSize:12, color:"#22c98a", fontWeight:700,
                             fontFamily:"monospace" }}>{burningBubble.focusTime}</span>
            </div>
          </div>
          <div style={{ position:"absolute", bottom:-7, left:"50%", transform:"translateX(-50%)",
                        width:0, height:0, borderLeft:"6px solid transparent",
                        borderRight:"6px solid transparent", borderTop:"8px solid #f5c518" }} />
        </div>
      )}

      <NameTag name={name} isMe />

      <div style={{
        width: 96, height: 96,
        backgroundImage: `url("${PLAYER_SHEET}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${192*3}px ${320*3}px`,
        backgroundPositionY: `${bgY}px`,
        imageRendering: "pixelated",
        animation: isWalking
          ? "walkFrames 0.6s steps(1) infinite"
          : "idleBob 1.5s ease-in-out infinite",
        outline: "2px solid #f5c518", outlineOffset:3, borderRadius:4,
      }} />
    </div>
  )
}


const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

// 초 → "HH:MM" 형식
function secToHHMM(sec) {
  if (!sec) return "00:00"
  const h = String(Math.floor(sec / 3600)).padStart(2, "0")
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0")
  return `${h}:${m}`
}

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
  const [studyStats, setStudyStats] = useState({ studyTime: "00:00", focusTime: "00:00" })
  const [reviewQueue, setReviewQueue] = useState([])
  const navigate = useNavigate()

  // ── 캐릭터 이동 state ──
  const [charPos,    setCharPos]    = useState({ x: 50, y: 44 })  // % 단위 — 메인 길 위
  const [charDir,    setCharDir]    = useState("down")
  const [isWalking,  setIsWalking]  = useState(false)
  const keysRef = useRef({})
  const animRef = useRef(null)

  // GET /users/me → 오늘 공부시간 / 집중시간
  useEffect(() => {
    fetch(`${BASE}/users/me`, { headers: { "X-User-Id": "1" } })
      .then(r => r.json())
      .then(data => {
        setStudyStats({
          studyTime:  secToHHMM(data.today_focus_sec),   // 오늘 집중 시간
          focusTime:  secToHHMM(data.today_focus_sec),   // 동일 (API 분리 전까지)
        })
      })
      .catch(() => {})
  }, [])

  // 복습 큐 확인 → 포석호 "!" 뱃지 표시
  useEffect(() => {
    getReviewQueue()
      .then(res => {
        if (res.data?.length > 0) {
          setReviewQueue(res.data)
          setNotifs(p => ({ ...p, quiz: true }))
        }
      })
      .catch(() => {})
  }, [])

  // ── 방향키 이동 ──
  useEffect(() => {
    const SPEED = 0.25  // % per frame
    const DIR_MAP = {
      ArrowUp:    { dir:"up",    dx:0,      dy:-SPEED },
      ArrowDown:  { dir:"down",  dx:0,      dy: SPEED },
      ArrowLeft:  { dir:"left",  dx:-SPEED, dy:0      },
      ArrowRight: { dir:"right", dx: SPEED, dy:0      },
      w:          { dir:"up",    dx:0,      dy:-SPEED },
      s:          { dir:"down",  dx:0,      dy: SPEED },
      a:          { dir:"left",  dx:-SPEED, dy:0      },
      d:          { dir:"right", dx: SPEED, dy:0      },
    }

    function onKeyDown(e) {
      if (DIR_MAP[e.key]) {
        e.preventDefault()
        keysRef.current[e.key] = true
      }
    }
    function onKeyUp(e) {
      keysRef.current[e.key] = false
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup",   onKeyUp)

    function tick() {
      const pressed = Object.entries(DIR_MAP)
        .filter(([k]) => keysRef.current[k])
      
      if (pressed.length > 0) {
        // 마지막으로 누른 방향 기준
        const [, { dir, dx, dy }] = pressed[pressed.length - 1]
        setCharDir(dir)
        setIsWalking(true)
        setCharPos(prev => ({
          x: Math.max(2, Math.min(92, prev.x + dx)),
          y: Math.max(5, Math.min(85, prev.y + dy)),
        }))
      } else {
        setIsWalking(false)
      }
      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup",   onKeyUp)
      cancelAnimationFrame(animRef.current)
    }
  }, [])

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
        position:"relative", width:"100%", height:"calc(100vh - 60px)",
        overflow:"hidden",
        backgroundImage:`url(${GRASS_TILE})`,
        backgroundRepeat:"repeat", backgroundSize:"48px 48px",
        imageRendering:"pixelated",
      }}>

        {/* ══ 연못 (왼쪽 상단) ══ */}
        <div style={{ position:"absolute", left:"2%", top:"4%", width:200, height:130,
          backgroundImage:`url(${WATER_TILE})`, backgroundRepeat:"repeat",
          backgroundSize:"48px 48px", imageRendering:"pixelated", zIndex:1 }} />
        <div style={{ position:"absolute", left:"2%", top:"4%", width:200, height:16,
          backgroundImage:`url(${WATER_BORDER})`, backgroundRepeat:"repeat-x",
          backgroundSize:"48px 96px", backgroundPosition:"0px 0px",
          imageRendering:"pixelated", zIndex:2 }} />
        <div style={{ position:"absolute", left:"2%", top:"calc(4% + 114px)", width:200, height:16,
          backgroundImage:`url(${WATER_BORDER})`, backgroundRepeat:"repeat-x",
          backgroundSize:"48px 96px", backgroundPosition:"0px 0px",
          imageRendering:"pixelated", zIndex:2, transform:"scaleY(-1)" }} />

        {/* 분수대 */}
        <Sprite src={FOUNTAIN_IMG} w={32} h={80} scale={2.5}
          style={{ position:"absolute", left:"calc(2% + 84px)", top:"calc(4% + 24px)", zIndex:3 }} />

        {/* 오리 */}
        <Sprite src={DUCK_IMG} w={16} h={16} scale={2}
          style={{ position:"absolute", left:"calc(2% + 30px)", top:"calc(4% + 70px)", zIndex:3 }} />
        <Sprite src={FROG_IMG} w={16} h={16} scale={2}
          style={{ position:"absolute", left:"calc(2% + 150px)", top:"calc(4% + 80px)", zIndex:3 }} />

        {/* ══ 농장 구역 (오른쪽 상단) ══ */}
        <div style={{ position:"absolute", right:"3%", top:"5%", width:200, height:160,
          backgroundImage:`url(${FARM_TILE})`, backgroundRepeat:"repeat",
          backgroundSize:"48px 48px", imageRendering:"pixelated", zIndex:1, borderRadius:4 }} />
        {/* 닭 */}
        <Sprite src={CHICKEN_IMG} w={16} h={16} scale={2}
          style={{ position:"absolute", right:"calc(3% + 40px)", top:"calc(5% + 100px)", zIndex:3 }} />
        <Sprite src={CHICKEN_IMG} w={16} h={16} scale={2}
          style={{ position:"absolute", right:"calc(3% + 100px)", top:"calc(5% + 120px)", zIndex:3 }} />

        {/* ══ 나무들 ══ */}
        {/* 실제 확인된 프레임 구조:
            Big_Oak_Tree  192x80: fw=64, 3cols → col0=그루터기, col1=큰참나무, col2=작은참나무
            Medium_Oak_Tree 96x48: fw=32, 3cols → col0=그루터기, col1=나무A, col2=나무B
            Big_Birch_Tree  96x80: fw=32, 3cols → col0=그루터기, col1=자작나무A, col2=자작나무B  */}

        {/* 상단 숲 */}
        {[
          { src:OAK_BIG,   sx:64,  sw:192, sh:80, fw:64, fh:80, scale:2.2, left:"17%", top:"2%"  },
          { src:OAK_MED,   sx:32,  sw:96,  sh:48, fw:32, fh:48, scale:2.5, left:"24%", top:"5%"  },
          { src:OAK_BIG,   sx:64,  sw:192, sh:80, fw:64, fh:80, scale:2.4, left:"31%", top:"1%"  },
          { src:BIRCH_BIG, sx:32,  sw:96,  sh:80, fw:32, fh:80, scale:2.0, left:"38%", top:"3%"  },
          { src:OAK_MED,   sx:64,  sw:96,  sh:48, fw:32, fh:48, scale:2.5, left:"44%", top:"6%"  },
          { src:OAK_BIG,   sx:64,  sw:192, sh:80, fw:64, fh:80, scale:2.2, left:"56%", top:"2%"  },
          { src:BIRCH_BIG, sx:64,  sw:96,  sh:80, fw:32, fh:80, scale:1.9, left:"63%", top:"5%"  },
          { src:OAK_MED,   sx:32,  sw:96,  sh:48, fw:32, fh:48, scale:2.5, left:"70%", top:"1%"  },
          { src:OAK_BIG,   sx:64,  sw:192, sh:80, fw:64, fh:80, scale:1.8, left:"77%", top:"4%"  },
        ].map((t, i) => (
          <div key={i} style={{
            position:"absolute", left:t.left, top:t.top, zIndex:1,
            width:  t.fw * t.scale,
            height: t.fh * t.scale,
            backgroundImage: `url(${t.src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${t.sw * t.scale}px ${t.sh * t.scale}px`,
            backgroundPosition: `-${t.sx * t.scale}px 0px`,
            imageRendering: "pixelated",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))",
          }} />
        ))}

        {/* 하단 나무들 */}
        {[
          { src:OAK_BIG,   sx:64,  sw:192, sh:80, fw:64, fh:80, scale:2.0, left:"1%",  top:"63%" },
          { src:OAK_MED,   sx:32,  sw:96,  sh:48, fw:32, fh:48, scale:2.5, left:"8%",  top:"67%" },
          { src:OAK_BIG,   sx:64,  sw:192, sh:80, fw:64, fh:80, scale:2.2, left:"16%", top:"62%" },
          { src:BIRCH_BIG, sx:32,  sw:96,  sh:80, fw:32, fh:80, scale:2.0, left:"26%", top:"66%" },
          { src:OAK_MED,   sx:64,  sw:96,  sh:48, fw:32, fh:48, scale:2.5, left:"36%", top:"63%" },
          { src:OAK_BIG,   sx:64,  sw:192, sh:80, fw:64, fh:80, scale:2.1, left:"46%", top:"67%" },
          { src:BIRCH_BIG, sx:64,  sw:96,  sh:80, fw:32, fh:80, scale:1.9, left:"57%", top:"62%" },
          { src:OAK_MED,   sx:32,  sw:96,  sh:48, fw:32, fh:48, scale:2.5, left:"67%", top:"66%" },
          { src:OAK_BIG,   sx:64,  sw:192, sh:80, fw:64, fh:80, scale:2.2, left:"76%", top:"63%" },
          { src:BIRCH_BIG, sx:32,  sw:96,  sh:80, fw:32, fh:80, scale:1.8, left:"85%", top:"67%" },
        ].map((t, i) => (
          <div key={i+20} style={{
            position:"absolute", left:t.left, top:t.top, zIndex:8,
            width:  t.fw * t.scale,
            height: t.fh * t.scale,
            backgroundImage: `url(${t.src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${t.sw * t.scale}px ${t.sh * t.scale}px`,
            backgroundPosition: `-${t.sx * t.scale}px 0px`,
            imageRendering: "pixelated",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))",
          }} />
        ))}

        {/* ══ 우물 (길 양 끝 옆) ══ */}
        <Sprite src={WELL_IMG} w={32} h={48} scale={2.5}
          style={{ position:"absolute", left:"8%", top:"calc(50% - 145px)", zIndex:4 }} />
        <Sprite src={WELL_IMG} w={32} h={48} scale={2.5}
          style={{ position:"absolute", left:"78%", top:"calc(50% - 145px)", zIndex:4 }} />

        {/* ══ 가로 메인 길 ══ */}
        {/* 길 본체 */}
        <div style={{ position:"absolute", left:0, right:0, top:"calc(50% - 2px)", height:62,
          backgroundImage:`url(${PATH_TILE})`, backgroundRepeat:"repeat-x",
          backgroundSize:"48px 48px", imageRendering:"pixelated", zIndex:3 }} />

        {/* 길 위 잔디 경계 — 픽셀아트 볼록 경계 (inline PNG) */}
        <div style={{
          position:"absolute", left:0, right:0,
          top:"calc(50% - 14px)", height:16,
          backgroundImage:`url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAMCAYAAADS87vJAAAAfUlEQVR4nGO06/T4zzCCAdNAO2CgwWgADLQDBhqMBsBAO2CgASMDAwODRqbRfwYGBgYxBTGqGfzqwSsGBgYGhhvTzzEOZvMZkTnUcCiyw9DlBqP5GIaQaxA+hw1m8/EaRoxBpDhsMJpPlKHYDKLEYYPJfJIMhxlELYcNBvMByVNhGr08OuEAAAAASUVORK5CYII=")`,
          backgroundRepeat:"repeat-x",
          backgroundSize:"64px 12px",
          imageRendering:"pixelated",
          zIndex:5,
        }} />

        {/* 길 아래 잔디 경계 — 위로 볼록 (inline PNG) */}
        <div style={{
          position:"absolute", left:0, right:0,
          top:"calc(50% + 60px)", height:16,
          backgroundImage:`url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAMCAYAAADS87vJAAAAfElEQVR4nGNkIAFoZBr9h7FvTD/HSIrewWo+UZbANIopiMHFXj14hWIQNRw2EObjNRybRnRAiUMHg/lYDSVGIzogxaGDyXwUw8hxGDrA59DBaD4jtRyGDpAdOpjNZ7Tr9PhPWNnwBUwD7YCBBqMBMNAOGGgwGgAD7YCBBgBKr2EaVvsbvAAAAABJRU5ErkJggg==")`,
          backgroundRepeat:"repeat-x",
          backgroundSize:"64px 12px",
          imageRendering:"pixelated",
          zIndex:5,
        }} />

        {/* ══ 꽃 (길 위아래 + 맵 전체) ══ */}
        {[
          {l:"5%",t:"18%"},{l:"10%",t:"25%"},{l:"14%",t:"14%"},{l:"19%",t:"30%"},
          {l:"23%",t:"20%"},{l:"30%",t:"26%"},{l:"36%",t:"16%"},{l:"42%",t:"23%"},
          {l:"50%",t:"19%"},{l:"57%",t:"26%"},{l:"64%",t:"14%"},{l:"70%",t:"28%"},
          {l:"76%",t:"19%"},{l:"83%",t:"24%"},{l:"90%",t:"17%"},
          {l:"4%", t:"calc(50%-28px)"},{l:"12%",t:"calc(50%-22px)"},{l:"20%",t:"calc(50%-28px)"},
          {l:"30%",t:"calc(50%-22px)"},{l:"44%",t:"calc(50%-28px)"},{l:"52%",t:"calc(50%-22px)"},
          {l:"60%",t:"calc(50%-28px)"},{l:"72%",t:"calc(50%-22px)"},{l:"84%",t:"calc(50%-28px)"},
          {l:"6%", t:"calc(50%+62px)"},{l:"14%",t:"calc(50%+68px)"},{l:"22%",t:"calc(50%+62px)"},
          {l:"31%",t:"calc(50%+68px)"},{l:"40%",t:"calc(50%+62px)"},{l:"53%",t:"calc(50%+68px)"},
          {l:"62%",t:"calc(50%+62px)"},{l:"74%",t:"calc(50%+68px)"},{l:"82%",t:"calc(50%+62px)"},
          {l:"7%",t:"77%"},{l:"16%",t:"81%"},{l:"28%",t:"76%"},{l:"37%",t:"82%"},
          {l:"46%",t:"78%"},{l:"55%",t:"83%"},{l:"64%",t:"77%"},{l:"73%",t:"81%"},
          {l:"82%",t:"77%"},{l:"91%",t:"82%"},
        ].map((f,i) => (
          <div key={i} style={{
            position:"absolute", left:f.l, top:f.t, zIndex:2,
            width:24, height:24,
            backgroundImage:`url(${AF}/Outdoor_decoration/Outdoor_Decor_Free.png)`,
            backgroundRepeat:"no-repeat",
            backgroundSize:`${112*1.5}px ${192*1.5}px`,
            backgroundPosition:`-${(i%3)*16*1.5}px -${128*1.5}px`,
            imageRendering:"pixelated",
          }} />
        ))}

        {/* ══ Inn 교실 건물 ══ */}
        <div onClick={() => { setNotifs(p=>({...p,teacher:false})); navigate("/lecture") }}
          onMouseEnter={e=>e.currentTarget.style.transform="translateY(-4px)"}
          onMouseLeave={e=>e.currentTarget.style.transform="none"}
          style={{ position:"absolute", left:"7%", top:"15%", zIndex:4,
                   cursor:"pointer", transition:"transform 0.2s" }}>
          <div style={{ position:"relative" }}>
            {notifs.teacher && <NotifBadge />}
            <div style={{ position:"absolute", top:-22, left:"50%", transform:"translateX(-50%)",
                          background:"rgba(0,0,0,0.85)", color:"#7ec8f5", fontSize:9, fontWeight:700,
                          padding:"2px 8px", borderRadius:6, border:"1px solid #2a4a6a",
                          whiteSpace:"nowrap", zIndex:10 }}>교실 (Inn)</div>
            <Sprite src={INN_IMG} w={240} h={192} scale={1.5}
              style={{ filter:"drop-shadow(0 6px 14px rgba(0,0,0,0.6))" }} />
          </div>
        </div>

        {/* ══ NPC — 한원석 교수님 (Farmer Bob) — 길 위, 왼쪽 ══ */}
        <NpcSprite src={FARMER_NPC} sheetW={384} sheetH={832}
          name="한원석 교수님" hasNotif={notifs.quest}
          onClick={() => openNpc("quest","quest")}
          style={{ position:"absolute", left:"18%", top:"calc(50% - 160px)", zIndex:6 }} />

        {/* ══ NPC — 실습 조교님 (Chef Chloe) — 길 위, 중앙 ══ */}
        <NpcSprite src={CHEF_NPC} sheetW={384} sheetH={448}
          name="실습 조교님" hasNotif={notifs.schedule}
          onClick={() => openNpc("schedule","schedule")}
          style={{ position:"absolute", left:"38%", top:"calc(50% - 160px)", zIndex:6 }} />

        {/* ══ 내 캐릭터 ══ */}
        <div style={{ position:"absolute", left:`${charPos.x}%`, top:`${charPos.y}%`,
                      transform:"translateX(-50%)", zIndex:9,
                      transition:"left 0.05s linear, top 0.05s linear" }}>
          <MyChar name="우사기" burningBubble={studyStats}
            dir={charDir} isWalking={isWalking} />
        </div>

        {/* ══ 포석호 (Lumberjack) — 길 위, 오른쪽 ══ */}
        <NpcSprite src={LUMBERJACK_NPC} sheetW={384} sheetH={640}
          name="포석호" hasNotif={notifs.quiz}
          onClick={() => openNpc("quiz","pet")}
          style={{ position:"absolute", left:"62%", top:"calc(50% - 160px)", zIndex:6 }} />

        {/* ══ Barn 토마토 농장 ══ */}
        <div onClick={() => navigate("/party")}
          onMouseEnter={e=>e.currentTarget.style.transform="translateY(-4px)"}
          onMouseLeave={e=>e.currentTarget.style.transform="none"}
          style={{ position:"absolute", right:"6%", top:"6%", zIndex:4,
                   cursor:"pointer", transition:"transform 0.2s" }}>
          <div style={{ position:"relative" }}>
            <div style={{ position:"absolute", top:-22, left:"50%", transform:"translateX(-50%)",
                          background:"rgba(0,0,0,0.85)", color:"#f5c518", fontSize:9, fontWeight:700,
                          padding:"2px 8px", borderRadius:6, border:"1px solid #3a4a2a",
                          whiteSpace:"nowrap", zIndex:10 }}>토마토 농장</div>
            <Sprite src={BARN_IMG} w={160} h={128} scale={1.8}
              style={{ filter:"drop-shadow(0 6px 14px rgba(0,0,0,0.5))" }} />
          </div>
        </div>

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
      {popup === "pet"        && <PetPopup         onClose={() => setPopup(null)} reviewQueue={reviewQueue} />}
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
      style={{ width: 54, height: 54,
               background: hov ? "#e07b00" : "#c8900a",
               border: "3px solid #8B6914",
               borderBottom: hov ? "3px solid #6b4f0a" : "5px solid #6b4f0a",
               borderRadius: 10,
               display: "flex", alignItems: "center",
               justifyContent: "center", fontSize: 22, cursor: "pointer",
               boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
               transform: hov ? "translateY(2px)" : "none",
               transition: "transform 0.1s, border-bottom 0.1s" }}>
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
    <PopupOverlay onClose={onClose} title="오늘의 퀘스트" icon="🧙">
      {QUEST_DETAILS.map(q => (
        <div key={q.id} onClick={() => onSelectQuest(q)}
          onMouseEnter={e => { e.currentTarget.style.background="#ffe8a0"; e.currentTarget.style.borderColor="#c8900a" }}
          onMouseLeave={e => { e.currentTarget.style.background="#fff8e8"; e.currentTarget.style.borderColor="#d4b896" }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                   padding: "11px 12px", marginBottom: 7, background: "#fff8e8",
                   borderRadius: 8, cursor: "pointer", border: "2px solid #d4b896",
                   transition: "all 0.15s" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#3d2b00" }}>{q.title}</div>
            <div style={{ fontSize: 10, color: "#8B6914", marginTop: 2 }}>{q.npc.emoji} {q.npc.name}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, fontWeight: 700,
                           background: q.status === "완료" ? "#d4f0d4" : "#fff0c0",
                           color: q.status === "완료" ? "#1a6a2a" : "#8B6000",
                           border: q.status === "완료" ? "1px solid #88cc88" : "1px solid #c8a000" }}>
              {q.status}
            </span>
            <span style={{ fontSize: 10, color: "#a08060" }}>
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
    <PopupOverlay onClose={onClose} wide title={quest.title} icon={quest.npc.emoji}>
      <div style={{ display: "flex", alignItems: "center", gap: 12,
                    marginBottom: 16, paddingBottom: 14, borderBottom: "2px solid #d4b896" }}>
        <div style={{ width: 60, height: 60, background: "#ffe8c0", borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 34, border: "3px solid #c8900a", flexShrink: 0 }}>
          {quest.npc.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "#8B6914", marginBottom: 2 }}>퀘스트 의뢰인</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#3d2b00" }}>{quest.npc.name}</div>
        </div>
        <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, fontWeight: 700,
                       background: quest.status === "완료" ? "#d4f0d4" : "#fff0c0",
                       color: quest.status === "완료" ? "#1a6a2a" : "#8B6000",
                       border: quest.status === "완료" ? "2px solid #88cc88" : "2px solid #c8a000" }}>
          {quest.status}
        </span>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#5a3e00", lineHeight: 1.75, marginBottom: 14,
                      background: "#fff8e8", borderRadius: 8, padding: 12,
                      border: "1px solid #d4b896" }}>{quest.desc}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11,
                      color: "#8B6914", marginBottom: 6 }}>
          <span>진행률</span>
          <span>{quest.progress.current} / {quest.progress.total} {quest.progress.unit}</span>
        </div>
        <div style={{ height: 14, background: "#e8d0a0", borderRadius: 7,
                      overflow: "hidden", border: "2px solid #c8900a" }}>
          <div style={{ width: pct + "%", height: "100%", borderRadius: 5,
                        background: quest.status === "완료"
                          ? "linear-gradient(90deg,#44dd88,#22aa66)"
                          : "linear-gradient(90deg,#f5c518,#e09000)",
                        transition: "width 0.6s ease" }} />
        </div>
        <div style={{ fontSize: 10, color: "#8B6914", marginTop: 4, textAlign: "right" }}>{pct}% 달성</div>
      </div>
      <div style={{ background: "#fff0c8", borderRadius: 10, padding: 12,
                    marginBottom: 16, border: "2px solid #c8900a" }}>
        <div style={{ fontSize: 11, color: "#8B6000", fontWeight: 700, marginBottom: 8 }}>🎁 보상</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {quest.rewards.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6,
                                   background: "#fff8e8", padding: "8px 12px",
                                   borderRadius: 8, border: "2px solid #d4b896" }}>
              <span style={{ fontSize: 20 }}>{r.emoji}</span>
              <div>
                <div style={{ fontSize: 10, color: "#8B6914" }}>{r.type}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#c8900a" }}>+{r.amount}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <PixelBtn onClick={onClose} variant="secondary" style={{ flex: 1, padding: "10px 0" }}>닫기</PixelBtn>
        {quest.location && (
          <PixelBtn onClick={() => navigate(quest.location)} variant="secondary" style={{ flex: 1, padding: "10px 0" }}>
            바로이동
          </PixelBtn>
        )}
        <PixelBtn onClick={onClose} variant="primary" style={{ flex: quest.location ? 1 : 2, padding: "10px 0" }}>
          수락하기
        </PixelBtn>
      </div>
    </PopupOverlay>
  )
}

// ── 팝업: 일정표 ──

function SchedulePopup({ onClose, navigate }) {
  return (
    <PopupOverlay onClose={onClose} title="추천 일정표" icon="📅">
      {SCHEDULE.map((s, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between",
                               alignItems: "center", fontSize: 13,
                               padding: "10px 12px", marginBottom: 6,
                               background: "#fff8e8", borderRadius: 8,
                               border: "2px solid #d4b896" }}>
          <span style={{ color: "#8B6914", fontWeight: 700, minWidth: 52 }}>{s.time}</span>
          <span style={{ flex: 1, marginLeft: 12, color: "#3d2b00", fontWeight: 600 }}>{s.subject}</span>
          <button
            onClick={() => { onClose(); navigate("/lecture") }}
            style={{ color: "#c8900a", cursor: "pointer", fontSize: 12,
                     background: "none", border: "none", padding: "2px 4px",
                     fontWeight: 700 }}>
            이동 →
          </button>
        </div>
      ))}
    </PopupOverlay>
  )
}

// ── 팝업: 펫 (질문하기 + 복습 큐 연동) ──

function PetPopup({ onClose, reviewQueue = [] }) {
  // 복습 큐 있으면 바로 복습 모드, 없으면 질문 모드
  const [mode, setMode]         = useState(reviewQueue.length > 0 ? "review" : "question")
  const [messages, setMessages] = useState(() =>
    reviewQueue.length > 0
      ? [{ type:"npc", text:`미뤄둔 퀴즈가 ${reviewQueue.length}개 있어요! 지금 풀어볼까요? 😊` }]
      : [{ type:"npc", text:"안녕하세요! 🐻‍❄️ 궁금한 것을 물어보세요!" }]
  )
  const [input, setInput]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [current, setCurrent]   = useState(0)
  const [reviewDone, setReviewDone] = useState(false)
  const chatRef                 = useRef(null)
  const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

  function scrollBottom() {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }

  // 질문하기 모드
  async function sendQuestion() {
    if (!input.trim() || loading) return
    const txt = input.trim(); setInput("")
    setMessages(prev => [...prev, { type:"user", text:txt }]); setLoading(true)
    try {
      const res = await fetch(`${BASE}/quiz/generate`, {
        method:"POST", headers:{ "Content-Type":"application/json", "X-User-Id":"1" },
        body: JSON.stringify({ question: txt }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { type:"npc", text: data.question ?? "(더미) 좋은 질문이에요! 같이 생각해봐요 😊" }])
    } catch {
      setMessages(prev => [...prev, { type:"npc", text:"(더미) 좋은 질문이에요! 같이 생각해봐요 😊" }])
    } finally { setLoading(false); setTimeout(scrollBottom, 50) }
  }

  // 복습 퀴즈 답변
  async function sendReviewAnswer() {
    if (!input.trim() || loading) return
    const txt = input.trim(); setInput("")
    setMessages(prev => [...prev, { type:"user", text:txt }]); setLoading(true)
    try {
      const res = await fetch(`${BASE}/quiz/answer`, {
        method:"POST", headers:{ "Content-Type":"application/json", "X-User-Id":"1" },
        body: JSON.stringify({ quiz_id: reviewQueue[current]?.id, user_answer: txt }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { type:"npc", text: data.llm_feedback ?? "(더미) 잘 했어요!" }])
      const next = current + 1
      if (next >= reviewQueue.length) {
        setTimeout(() => setReviewDone(true), 600)
      } else {
        setCurrent(next)
        setTimeout(() => {
          setMessages(prev => [...prev, { type:"npc",
            text: `다음 문제예요!\n[${reviewQueue[next].subject}] ${reviewQueue[next].question}` }])
          setLoading(false); setTimeout(scrollBottom, 50)
        }, 600)
        return
      }
    } catch {
      setMessages(prev => [...prev, { type:"npc", text:"(더미) 좋은 답변이에요!" }])
    } finally { setLoading(false); setTimeout(scrollBottom, 50) }
  }

  return (
    <PopupOverlay onClose={onClose} wide title="포석호" icon="🐻‍❄️">
      {reviewQueue.length > 0 && !reviewDone && (
        <div style={{ marginBottom: 10, background: "#fff0c0", border: "2px solid #c8a000",
                      borderRadius: 6, padding: "4px 12px", fontSize: 10,
                      color: "#8B6000", fontWeight: 700, display: "inline-block" }}>
          📝 복습 대기 {reviewQueue.length}개
        </div>
      )}

      {/* 모드 탭 */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        <button style={{
          flex:1, padding:"7px 0", fontSize:12, fontWeight:700, cursor:"pointer",
          background: mode==="question" ? "#c8900a" : "#e8d5a0",
          color: mode==="question" ? "#fff5e0" : "#8B6914",
          border: mode==="question" ? "2px solid #8B6914" : "2px solid #d4b896",
          borderBottom: mode==="question" ? "3px solid #6b4f0a" : "2px solid #d4b896",
          borderRadius:6,
        }} onClick={() => setMode("question")}>
          ❓ 질문하기
        </button>
        {reviewQueue.length > 0 && (
          <button style={{
            flex:1, padding:"7px 0", fontSize:12, fontWeight:700, cursor:"pointer",
            background: mode==="review" ? "#c8900a" : "#e8d5a0",
            color: mode==="review" ? "#fff5e0" : "#8B6914",
            border: mode==="review" ? "2px solid #8B6914" : "2px solid #d4b896",
            borderBottom: mode==="review" ? "3px solid #6b4f0a" : "2px solid #d4b896",
            borderRadius:6,
          }} onClick={() => setMode("review")}>
            📝 복습 퀴즈 ({reviewQueue.length})
          </button>
        )}
      </div>

      {/* 복습 모드 — 현재 문제 카드 */}
      {mode === "review" && !reviewDone && reviewQueue[current] && (
        <div style={{ background:"#fff0c0", borderRadius:8, padding:"10px 14px",
                      marginBottom:12, border:"2px solid #c8a000" }}>
          <div style={{ fontSize:10, color:"#8B6000", marginBottom:4, fontWeight:700 }}>
            [{reviewQueue[current].subject}] — {current+1}/{reviewQueue.length}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:"#3d2b00" }}>{reviewQueue[current].question}</div>
        </div>
      )}

      {/* 복습 완료 */}
      {mode === "review" && reviewDone && (
        <div style={{ textAlign:"center", padding:"16px 0", marginBottom:12 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
          <div style={{ fontSize:14, fontWeight:700, color:"#3d2b00", marginBottom:4 }}>복습 완료!</div>
          <div style={{ fontSize:11, color:"#8B6914" }}>미뤄둔 퀴즈를 모두 풀었어요.</div>
        </div>
      )}

      {/* 채팅 영역 */}
      <div style={{ borderTop:"2px solid #d4b896", paddingTop:12 }}>
        <div ref={chatRef}
          style={{ height: mode === "review" ? 160 : 220, overflowY:"auto", display:"flex",
                   flexDirection:"column", gap:6, marginBottom:10 }}>
          {messages.map((m,i) => (
            <div key={i} style={{ display:"flex",
                                   justifyContent: m.type==="user" ? "flex-end" : "flex-start",
                                   alignItems:"flex-end", gap:4 }}>
              {m.type==="npc" && <span style={{ fontSize:14, flexShrink:0 }}>🐻‍❄️</span>}
              <div style={{ maxWidth:"78%", padding:"7px 11px", borderRadius:10,
                             fontSize:12, lineHeight:1.5,
                             background: m.type==="user" ? "#c8900a" : "#fff8e8",
                             color: m.type==="user" ? "#fff5e0" : "#3d2b00",
                             border: m.type==="user" ? "none" : "1px solid #d4b896" }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && <div style={{ fontSize:11, color:"#a08060", paddingLeft:22 }}>입력 중...</div>}
        </div>

        {!reviewDone && (
          <div style={{ display:"flex", gap:6 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && (mode==="review" ? sendReviewAnswer() : sendQuestion())}
              placeholder={mode==="review" ? "답변을 입력하세요..." : "궁금한 것을 물어보세요..."}
              disabled={loading}
              style={{ flex:1, background:"#fff8e8", border:"2px solid #d4b896",
                       borderRadius:8, padding:"8px 12px", color:"#3d2b00",
                       fontSize:12, outline:"none", opacity:loading?0.6:1 }} />
            <PixelBtn
              onClick={mode==="review" ? sendReviewAnswer : sendQuestion}
              disabled={loading}>전송</PixelBtn>
          </div>
        )}
      </div>
    </PopupOverlay>
  )
}

// ── 팝업: 도감 ──

function InventoryPopup({ onClose }) {
  return (
    <PopupOverlay onClose={onClose} title="도감 (뱃지 모음집)" icon="📖">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {BADGES.map(b => (
          <div key={b.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: 12, borderRadius: 8, textAlign: "center",
            background: b.earned ? "#fff8e8" : "#f0e8d8",
            border: b.earned ? "3px solid #c8900a" : "2px solid #d4b896",
            opacity: b.earned ? 1 : 0.5,
          }}>
            <div style={{ fontSize: 28, marginBottom: 4,
                          filter: b.earned ? "none" : "grayscale(100%)" }}>{b.emoji}</div>
            <div style={{ fontSize: 10, color: b.earned ? "#3d2b00" : "#8B7050",
                          fontWeight: b.earned ? 700 : 400 }}>{b.name}</div>
            {b.earned && (
              <div style={{ fontSize: 9, color: "#c8900a", marginTop: 4, fontWeight: 700,
                            background: "#fff0c0", border: "1px solid #c8a000",
                            borderRadius: 4, padding: "1px 6px" }}>획득!</div>
            )}
          </div>
        ))}
      </div>
    </PopupOverlay>
  )
}

// ── 픽셀아트 버튼 ──
function PixelBtn({ children, onClick, variant = "primary", style = {}, disabled = false }) {
  const [hov, setHov] = useState(false)
  const colors = {
    primary:   { bg: hov ? "#e07b00" : "#c8900a", border: "#8B6914", shadow: "#6b4f0a", text: "#fff5e0" },
    secondary: { bg: hov ? "#e8d5a0" : "#d4b896", border: "#8B6914", shadow: "#6b4f0a", text: "#3d2b00" },
    danger:    { bg: hov ? "#d94040" : "#c03030", border: "#8B1414", shadow: "#6b0a0a", text: "#fff0f0" },
  }
  const c = colors[variant] || colors.primary
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: c.bg, border: `3px solid ${c.border}`,
        borderBottom: `5px solid ${c.shadow}`,
        borderRadius: 6, padding: "8px 16px",
        color: c.text, fontWeight: 700, fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transform: hov && !disabled ? "translateY(1px)" : "none",
        transition: "transform 0.1s",
        ...style,
      }}>
      {children}
    </button>
  )
}

// ── 공통 팝업 오버레이 (밝은 픽셀아트 테마) ──

function PopupOverlay({ children, onClose, wide, title, icon }) {
  return (
    <>
      <div onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(20,10,0,0.55)", zIndex: 200 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 201,
        width: wide ? "min(560px,94vw)" : "min(430px,94vw)",
        maxHeight: "90vh",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          background: "#f0c87a",
          border: "4px solid #8B6914",
          borderBottom: "6px solid #6b4f0a",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {/* 헤더 */}
          <div style={{
            background: "linear-gradient(180deg, #c8900a 0%, #a06800 100%)",
            borderBottom: "3px solid #8B6914",
            padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
            <span style={{
              fontSize: 14, fontWeight: 700, color: "#fff5e0",
              flex: 1, textShadow: "1px 1px 0 #6b4f0a",
            }}>{title}</span>
            <button onClick={onClose} style={{
              background: "#8B3a00", border: "2px solid #6b2a00",
              borderBottom: "3px solid #4a1a00", borderRadius: 4,
              width: 24, height: 24, color: "#ffddaa",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
          {/* 본문 */}
          <div style={{
            background: "#fdf0cc",
            padding: "16px",
            overflowY: "auto",
            maxHeight: "75vh",
          }}>
            {children}
          </div>
        </div>
      </div>
    </>
  )
}