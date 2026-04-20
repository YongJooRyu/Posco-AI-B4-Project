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

// UI_Bars에서 단일 바 (가로 바 스트립)
// 전체 바 너비 = barW, 채워진 비율 = pct(0~100)
// UI_Bars의 바들: y=0 빨강(완전), y=8 노랑(완전), y=32~128 작은 바들
// 사용: 큰 바 (Row0: 빨강 x=0~48, 파랑 x=48~96, 초록 x=96~144) 각 48×8
function PixelBar({ pct, colorSx, scale=3, style={} }) {
  // colorSx: 0=빨강, 48=파랑, 96=초록
  const barNativeW = 48
  const barNativeH = 8
  const displayW = barNativeW * scale  // 144px
  const displayH = barNativeH * scale  // 24px
  const filledW  = Math.round(displayW * Math.min(100, pct) / 100)

  return (
    <div style={{
      position: "relative", width: displayW, height: displayH,
      imageRendering: "pixelated",
      flexShrink: 0,
      ...style,
    }}>
      {/* 빈 바 배경 (마지막 바 = 흰 빈 바, x=0, y=24, 48x8) */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url("${UI_BARS}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${304*scale}px ${128*scale}px`,
        backgroundPosition: `0px -${24*scale}px`,
        imageRendering: "pixelated",
      }} />
      {/* 채워진 바 (clip으로 잘라내기) */}
      <div style={{
        position: "absolute", left: 0, top: 0,
        width: filledW, height: displayH,
        overflow: "hidden",
      }}>
        <div style={{
          width: displayW, height: displayH,
          backgroundImage: `url("${UI_BARS}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${304*scale}px ${128*scale}px`,
          backgroundPosition: `-${colorSx*scale}px 0px`,
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
      padding: "6px 16px",
      background: "#1a1a2e",
      borderBottom: "3px solid #2a2a4a",
      gap: 12, flexShrink: 0,
      imageRendering: "pixelated",
    }}>
      <style>{`
        @keyframes headerBob {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-2px); }
        }
      `}</style>

      {/* ── 아바타 프레임 ── */}
      <div style={{
        position: "relative",
        width: 48, height: 48,
        background: "#2a1a3a",
        border: "3px solid #8B6914",
        borderRadius: 6,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        boxShadow: "inset 0 0 0 1px #c8900a",
        imageRendering: "pixelated",
      }}>
        <PlayerAvatar scale={1.4} />
      </div>

      {/* ── 이름 + 레벨 + EXP바 ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:3, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {/* 이름 */}
          <span style={{
            fontSize: 13, fontWeight: 700, color: "#f5e6c8",
            textShadow: "1px 1px 0 #000",
            fontFamily: "monospace",
          }}>{name}</span>
          {/* 레벨 뱃지 */}
          <div style={{
            background: "#7c3f00", border: "2px solid #c8900a",
            borderRadius: 4, padding: "1px 6px",
            fontSize: 10, fontWeight: 700, color: "#f5c518",
            fontFamily: "monospace",
          }}>
            Lv.{level}
          </div>
        </div>
        {/* EXP 바 (파랑) */}
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          {/* 별 아이콘 (EXP) — UI_Icons row0, col3(x=48) */}
          <PixelIcon sx={48} sy={0} scale={1.5} />
          <PixelBar pct={expPct} colorSx={48} scale={2} />
          <span style={{ fontSize:9, color:"#88aaff", fontFamily:"monospace" }}>
            {exp}/{expNext}
          </span>
        </div>
        {/* 오늘 집중 */}
        <div style={{ fontSize:10, color:"#22c98a", fontWeight:700, fontFamily:"monospace" }}>
          오늘 집중 {formatFocusSec(focusSec)}
        </div>
      </div>

      <div style={{ flex:1 }} />

      {/* ── 골드 ── */}
      <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
        {/* 코인 아이콘 — UI_Icons row0, col6(x=96) */}
        <PixelIcon sx={96} sy={0} scale={2} />
        <span style={{
          fontSize: 12, fontWeight: 700, color: "#f5c518",
          fontFamily: "monospace", textShadow: "1px 1px 0 #000",
        }}>{gold.toLocaleString()}</span>
      </div>

      {/* ── 날짜 ── */}
      <div style={{
        fontSize: 11, color: "#aaa",
        fontFamily: "monospace",
        flexShrink: 0,
      }}>{dateStr}</div>

      {/* ── 연속 도전 ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        background: "rgba(139,63,0,0.4)",
        border: "2px solid #8B6914",
        borderRadius: 6, padding: "4px 8px",
        flexShrink: 0,
      }}>
        {/* 불꽃 아이콘 — UI_Icons row0, col9(x=128, 번개) or 실제 불꽃찾기 */}
        <PixelIcon sx={128} sy={0} scale={1.5} />
        <span style={{
          fontSize: 11, fontWeight: 700, color: "#f5c518",
          fontFamily: "monospace", textShadow: "1px 1px 0 #000",
        }}>{streak}일 연속</span>
      </div>

      {/* ── 홈 버튼 ── */}
      {showHome && (
        <button
          onClick={() => navigate("/town")}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#f5c518"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "#8B6914"}
          style={{
            background: "#2a1a0a", border: "2px solid #8B6914",
            borderRadius: 6, padding: "5px 10px",
            color: "#f5e6c8", fontSize: 11,
            cursor: "pointer", fontFamily: "monospace",
            display: "flex", alignItems: "center", gap: 4,
            flexShrink: 0, fontWeight: 700,
            transition: "border-color 0.15s",
            textShadow: "1px 1px 0 #000",
          }}>
          🏠 홈
        </button>
      )}
    </div>
  )
}