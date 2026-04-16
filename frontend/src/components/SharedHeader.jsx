import { useNavigate } from "react-router-dom"

// 전체 페이지 공용 상단 헤더
// showHome: 홈(타운) 복귀 버튼 표시 여부
export default function SharedHeader({ showHome = false }) {
  const navigate = useNavigate()

  const today   = new Date()
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`

  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 20px",
                  background: "#0d1520", borderBottom: "1px solid #1a2a4a",
                  gap: 12, flexShrink: 0 }}>

      {showHome && (
        <button
          onClick={() => navigate("/town")}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#f5c518"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "#2a3a5a"}
          style={{ background: "#1a2a3a", border: "1px solid #2a3a5a", borderRadius: 8,
                   padding: "6px 12px", color: "#aaa", fontSize: 12, cursor: "pointer",
                   display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                   transition: "border-color 0.15s" }}>
          🏠 홈
        </button>
      )}

      {/* 아바타 + 닉네임 / 레벨 / EXP */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 44, height: 44, background: "#2a3a5a", borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 24, border: "2px solid #4a6af5", flexShrink: 0 }}>
          🧑
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, color: "#fff" }}>
            닉네임
          </div>
          <div style={{ fontSize: 11, color: "#7ec8f5", fontWeight: 700 }}>Lv.12</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <div style={{ width: 100, height: 5, background: "#1a2a4a", borderRadius: 3 }}>
              <div style={{ width: "60%", height: "100%",
                            background: "linear-gradient(90deg, #f5c518, #e0a800)",
                            borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 9, color: "#666" }}>360/600</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ fontSize: 11, color: "#aaa" }}>{dateStr}</div>
      <div style={{ fontSize: 11, color: "#f5c518", fontWeight: 700,
                    background: "rgba(245,197,24,0.1)", padding: "4px 10px", borderRadius: 8 }}>
        🔥 연속 7일 도전중
      </div>
    </div>
  )
}
