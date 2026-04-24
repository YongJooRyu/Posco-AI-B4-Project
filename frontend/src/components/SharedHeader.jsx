import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

const UI   = "/assets/Cute_Fantasy_UI/UI"
const AF   = "/assets/Cute_Fantasy_Free"

// UI_Bars.png (304x128)
const UI_BARS   = `${UI}/UI_Bars.png`
// UI_Icons.png (624x256) — 16x16 아이콘 시트
const UI_ICONS  = `${UI}/UI_Icons.png`
// Player.png (192x320) — idle_down row0, 32x32/frame
const PLAYER_SHEET = `${AF}/Player/Player.png`

// ── 픽셀아트 스프라이트 헬퍼 ──────────────────────────────

// UI_Icons에서 단일 아이콘 (16x16)
function PixelIcon({ sx, sy, scale=2, style={} }) {
  return (
    <div style={{
      width: 16*scale, height: 16*scale,
      backgroundImage: `url("${UI_ICONS}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${624*scale}px ${256*scale}px`,
      backgroundPosition: `-${sx*scale}px -${sy*scale}px`,
      imageRendering: "pixelated",
      flexShrink: 0,
      ...style,
    }} />
  )
}

// UI_Bars에서 단일 바
// 분석 결과:
//   채워진 바: y=7~9 (3px 높이), x=0(빨강), x=32(파랑), x=64(초록)
//   빈 바 배경: y=15~19 (5px 높이), x=0~31
// 각 바 너비: 32px (실제 내용은 28px + 테두리)
function PixelBar({ pct, colorSx = 64, scale = 3, style = {} }) {
  // colorSx: 0=빨강, 32=파랑, 64=초록
  const barNativeW = 32
  const barNativeH = 3   // y=7~9
  const bgNativeH  = 5   // y=15~19
  const displayW   = barNativeW * scale
  const displayH   = bgNativeH  * scale

  return (
    <div style={{
      position: "relative",
      width: displayW, height: displayH,
      imageRendering: "pixelated",
      flexShrink: 0,
      ...style,
    }}>
      {/* 빈 바 배경 (y=15, x=0) */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url("${UI_BARS}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${304 * scale}px ${128 * scale}px`,
        backgroundPosition: `0px -${15 * scale}px`,
        imageRendering: "pixelated",
      }} />
      {/* 채워진 바 (clip으로 비율만큼 자르기) */}
      <div style={{
        position: "absolute",
        left: 0,
        top: Math.round((displayH - barNativeH * scale) / 2),
        width: `${Math.max(0, Math.min(100, pct))}%`,
        height: barNativeH * scale,
        overflow: "hidden",
      }}>
        <div style={{
          width: displayW,
          height: barNativeH * scale,
          backgroundImage: `url("${UI_BARS}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${304 * scale}px ${128 * scale}px`,
          backgroundPosition: `-${colorSx * scale}px -${7 * scale}px`,
          imageRendering: "pixelated",
        }} />
      </div>
    </div>
  )
}

// 플레이어 스프라이트 아바타 (idle_down, row0, col0)
function PlayerAvatar({ scale=3 }) {
  return (
    <div style={{
      width: 32*scale, height: 32*scale,
      backgroundImage: `url("${PLAYER_SHEET}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${192*scale}px ${320*scale}px`,
      backgroundPosition: "0px 0px",
      imageRendering: "pixelated",
      animation: "headerBob 2s ease-in-out infinite",
    }} />
  )
}

// ─────────────────────────────────────────────────────────

function formatFocusSec(sec) {
  if (!sec) return "0분"
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분`
}

export default function SharedHeader({ showHome = false }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch(`${BASE}/users/me`, { headers: { "X-User-Id": "1" } })
      .then(r => r.json())
      .then(data => setUser(data))
      .catch(() => {})
  }, [])

  const today   = new Date()
  const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getDate()).padStart(2,"0")}`

  const name     = user?.name            ?? "우사기"
  const streak   = user?.streak_days     ?? 0
  const focusSec = user?.today_focus_sec ?? 0
  const level    = user?.level           ?? 1
  const exp      = user?.exp             ?? 0
  const expNext  = user?.exp_next        ?? 100
  const gold     = user?.gold            ?? 0

  const expPct = expNext > 0 ? Math.min(100, Math.round(exp / expNext * 100)) : 0

  return (
    <div style={{
      display: "flex", alignItems: "center",
      padding: "0 16px",
      height: 60,
      background: "linear-gradient(180deg, #F9E076 0%, #e8c550 100%)",
      borderBottom: "3px solid #c89100",
      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      gap: 12, flexShrink: 0,
      imageRendering: "pixelated",
    }}>
      <style>{`
        @keyframes headerBob {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-3px); }
        }
      `}</style>

      {/* ── 아바타 프레임 ── */}
      <div style={{
        position: "relative",
        width: 50, height: 50,
        background: "linear-gradient(135deg, #F9E076 0%, #e8c550 100%)",
        border: "2px solid #c89100",
        borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 0 0 1px #2a1a0a, inset 0 1px 0 rgba(200, 205, 255, 0.3)",
        imageRendering: "pixelated",
      }}>
        <PlayerAvatar scale={1.4} />
        {/* 레벨 뱃지 — 아바타 우하단 */}
        <div style={{
          position: "absolute", bottom: -6, right: -6,
          background: "#2a1a0a", border: "2px solid #895129",
          borderRadius: 4, padding: "0px 5px",
          fontSize: 9, fontWeight: 700, color: "#FFFDD0",
          fontFamily: "monospace", lineHeight: "16px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
        }}>
          {level}
        </div>
      </div>

      {/* ── 이름 + EXP바 + 집중시간 ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
        {/* 이름 + Lv */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: "#000000",
            fontFamily: "monospace", letterSpacing: 0.5,
          }}>{name}</span>
          <span style={{
            fontSize: 9, color: "#000000", fontFamily: "monospace",
            background: "rgba(60,30,0,0.3)", border: "1px solid #2a1a0a",
            borderRadius: 3, padding: "1px 5px",
          }}>Lv.{level}</span>
        </div>

        {/* EXP 바 */}
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <PixelIcon sx={48} sy={0} scale={1.4} />
          <div style={{ position:"relative" }}>
            <PixelBar pct={expPct} colorSx={64} scale={2} />
          </div>
          <span style={{ fontSize:9, color:"#2a1a0a", fontFamily:"monospace" }}>
            {exp}/{expNext}
          </span>
        </div>
      </div>

      {/* 구분선 */}
      <div style={{ width:1, height:36, background:"#c89100", flexShrink:0, margin:"0 4px" }} />

      {/* ── 집중시간 ── */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                    gap:2, flexShrink:0 }}>
        <span style={{ fontSize:9, color:"#2a1a0a", fontFamily:"monospace" }}>오늘 집중</span>
        <span style={{ fontSize:13, fontWeight:700, color:"#2a1a0a",
                       fontFamily:"monospace" }}>
          {formatFocusSec(focusSec)}
        </span>
      </div>

      <div style={{ flex:1 }} />

      {/* ── 연속 도전 ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:5,
        background:"rgba(60,30,0,0.25)",
        border:"1px solid #c89100",
        borderRadius:6, padding:"5px 10px", flexShrink:0,
      }}>
        <PixelIcon sx={144} sy={0} scale={1.5} />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
          <span style={{ fontSize:9, color:"#2a1a0a", fontFamily:"monospace" }}>연속</span>
          <span style={{ fontSize:12, fontWeight:700, color:"#2a1a0a",
                         fontFamily:"monospace", lineHeight:1 }}>{streak}일</span>
        </div>
      </div>

      {/* ── 골드 ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:5,
        background:"rgba(60,30,0,0.25)",
        border:"1px solid #c89100",
        borderRadius:6, padding:"5px 10px", flexShrink:0,
      }}>
        <PixelIcon sx={96} sy={0} scale={2} />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
          <span style={{ fontSize:9, color:"#2a1a0a", fontFamily:"monospace" }}>골드</span>
          <span style={{ fontSize:12, fontWeight:700, color:"#2a1a0a",
                         fontFamily:"monospace", lineHeight:1 }}>
            {gold.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── 날짜 ── */}
      <div style={{
        fontSize:10, color:"#2a1a0a", fontFamily:"monospace", flexShrink:0,
      }}>{dateStr}</div>

      {/* ── 홈 버튼 ── */}
      {showHome && (
        <button
          onClick={() => navigate("/town")}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "#895129"
            e.currentTarget.style.background  = "rgba(60,30,0,0.4)"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "#c89100"
            e.currentTarget.style.background  = "rgba(60,30,0,0.25)"
          }}
          style={{
            background:"rgba(60,30,0,0.25)", border:"2px solid #c89100",
            borderBottom:"3px solid #895129",
            borderRadius:6, padding:"5px 12px",
            color:"#FFFDD0", fontSize:11,
            cursor:"pointer", fontFamily:"monospace",
            display:"flex", alignItems:"center", gap:4,
            flexShrink:0, fontWeight:700,
            transition:"border-color 0.15s, background 0.15s",
            textShadow:"1px 1px 0 #895129",
          }}>
          🏠 홈
        </button>
      )}
    </div>
  )
}