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

// UI_Buttons.png 색상 팔레트 — 시트에서 직접 추출한 정확한 색상
// 각 색의 픽셀 구조 (사각형 14px 세로):
//   y=0: 외곽선(border) / y=1: highlight / y=2~9: main(8px) / y=10: midhi / y=11~12: dark / y=13: 외곽선
// ── 통합 디자인 토큰 (전 페이지에서 import해서 사용) ──────────
// 픽셀 외곽선 색
export const PIX = "#3f2832"

// 본문 패널 색 (밝은 베이지 톤)
export const BODY_HI   = "#fdf9f3"
export const BODY_MAIN = "#faf5ee"
export const BODY_DARK = "#e8ddd0"

// 강조 라임/그린 톤 (헤더 등)
export const LIME_HI   = "#ffe5ae"
export const LIME_MAIN = "#ffdd7e"
export const LIME_DARK = "#dfb645"

// 강조 갈색 톤 (헤더 대안)
export const BROWN_HI   = "#ead4aa"
export const BROWN_MAIN = "#e4a672"
export const BROWN_DARK = "#b86f50"

// 강조 노란 톤 (warning)
export const AMBER_HI   = "#fee761"
export const AMBER_MAIN = "#feae34"
export const AMBER_DARK = "#f77622"

// 상태 색
export const COLOR_FOCUS    = "#71b850"   // 집중
export const COLOR_UNFOCUS  = "#d94040"   // 미집중
export const COLOR_NEUTRAL  = "#8a7a60"   // 중립 텍스트
export const COLOR_TEXT     = "#2a1a0a"   // 본문 글자
export const COLOR_TEXT_SUB = "#895129"   // 서브 글자

// 픽셀 round-corner clipPath (4모서리 1px 잘라냄)
export const pixClip = "polygon(3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px),0 3px)"
export const pixClipSm = "polygon(2px 0,calc(100% - 2px) 0,100% 2px,100% calc(100% - 2px),calc(100% - 2px) 100%,2px 100%,0 calc(100% - 2px),0 2px)"

// 픽셀 박스 그라디언트 — 본문 (위 hi → main → 아래 dark + border)
// 픽셀 박스 그라디언트 — 본문 (위/아래 모두 PIX 외곽선)
export const bodyGrad = `linear-gradient(180deg,${PIX} 0,${PIX} 3px,${BODY_MAIN} 3px,${BODY_MAIN} calc(100% - 6px),${BODY_DARK} calc(100% - 6px),${BODY_DARK} calc(100% - 3px),${PIX} calc(100% - 3px),${PIX} 100%)`

// 픽셀 박스 그라디언트 — 라임 헤더 (하단 PIX 제거: 본문 상단과 중복 방지)
export const limeGrad = `linear-gradient(180deg,${PIX} 0,${PIX} 3px,${LIME_MAIN} 3px,${LIME_MAIN} calc(100% - 3px),${LIME_DARK} calc(100% - 3px),${LIME_DARK} 100%)`

// 픽셀 박스 그라디언트 — 갈색 헤더 (하단 PIX 제거)
export const brownGrad = `linear-gradient(180deg,${PIX} 0,${PIX} 3px,${BROWN_MAIN} 3px,${BROWN_MAIN} calc(100% - 3px),${BROWN_DARK} calc(100% - 3px),${BROWN_DARK} 100%)`

// 좌우 외곽선 box-shadow (픽셀 박스의 좌/우 1px 외곽선)
export const sideShadow = `inset 3px 0 0 ${PIX}, inset -3px 0 0 ${PIX}`

// ────────────────────────────────────────────────────────────

const UI_BUTTONS = `${UI}/UI_Buttons.png`  // 참고용 (사용 안 함)
export const BUTTON_PALETTE = {
  brown:  { border:"#3f2832", hi:"#ead4aa", main:"#e4a672", midhi:"#ead4aa", dark:"#b86f50" },
  gray:   { border:"#181425", hi:"#ffffff", main:"#c0cbdc", midhi:"#ffffff", dark:"#8b9bb4" },
  green:  { border:"#3f2832", hi:"#63c74d", main:"#3e8948", midhi:"#63c74d", dark:"#265c42" },
  blue:   { border:"#3f2832", hi:"#2ce8f5", main:"#0095e9", midhi:"#2ce8f5", dark:"#124e89" },
  orange: { border:"#3f2832", hi:"#fee761", main:"#feae34", midhi:"#fee761", dark:"#f77622" },
  red:    { border:"#3f2832", hi:"#ee686e", main:"#e43b44", midhi:"#ee686e", dark:"#9e2835" },
  purple: { border:"#3f2832", hi:"#f6757a", main:"#b55088", midhi:"#f6757a", dark:"#68386c" },
  tan:    { border:"#3f2832", hi:"#f9e6cf", main:"#f6ca9f", midhi:"#f9e6cf", dark:"#e69c69" },
  white:  { border:"#3f2832", hi:"#ffffff", main:"#dbdbdb", midhi:"#ffffff", dark:"#b4b4b4" },
  lime:   { border:"#3f2832", hi:"#ffe5ae", main:"#ffdd7e", midhi:"#ffe5ae", dark:"#dfb645" },
}
// variant → color 매핑
const VARIANT_TO_COLOR = {
  primary:   "green",
  secondary: "brown",
  danger:    "red",
  home:      "blue",
  warning:   "orange",
  info:      "blue",
}

// 좌/우 4×14 픽셀 캡 SVG 생성 — 실제 sprite와 동일한 round-corner 픽셀 패턴
// pattern: 14행 × 4열의 역할 코드 ("BD"=border, "HI"=highlight, "MN"=main, "DK"=dark, "."=transparent)
export const LEFT_CAP_PATTERN = [
  [".", ".", "BD", "BD"],  // y=0
  [".", "BD", "HI", "HI"], // y=1
  ["BD", "HI", "HI", "MN"], // y=2
  ["BD", "HI", "MN", "MN"], // y=3
  ["BD", "HI", "MN", "MN"], // y=4
  ["BD", "HI", "MN", "MN"], // y=5
  ["BD", "HI", "MN", "MN"], // y=6
  ["BD", "HI", "MN", "MN"], // y=7
  ["BD", "HI", "MN", "MN"], // y=8
  ["BD", "HI", "HI", "MN"], // y=9
  ["BD", "DK", "HI", "HI"], // y=10
  ["BD", "DK", "DK", "DK"], // y=11
  [".", "BD", "DK", "DK"],  // y=12
  [".", ".", "BD", "BD"],   // y=13
]
export const RIGHT_CAP_PATTERN = [
  ["BD", "BD", ".", "."],
  ["HI", "HI", "BD", "."],
  ["MN", "HI", "HI", "BD"],
  ["MN", "MN", "HI", "BD"],
  ["MN", "MN", "HI", "BD"],
  ["MN", "MN", "HI", "BD"],
  ["MN", "MN", "HI", "BD"],
  ["MN", "MN", "HI", "BD"],
  ["MN", "MN", "HI", "BD"],
  ["MN", "HI", "HI", "BD"],
  ["HI", "HI", "DK", "BD"],
  ["DK", "DK", "DK","BD"],
  ["DK", "DK", "BD", "."],
  ["BD", "BD", ".", "."],
]

// state별 색상 매핑
export function getStateColors(p, state) {
  let main = p.main, hi = p.hi, dark = p.dark
  if (state === "hover") {
    main = p.midhi
  } else if (state === "pressed") {
    main = p.dark
    hi = p.main
  }
  return { border: p.border, hi, main, dark }
}

export function PixelCap({ pattern, palette, state, scale }) {
  const colors = getStateColors(palette, state)
  const roleColor = { BD: colors.border, HI: colors.hi, MN: colors.main, DK: colors.dark }
  // SVG width/height는 정수 px로 강제 (sub-pixel rendering 방지)
  const w = Math.round(4 * scale)
  const h = Math.round(14 * scale)
  return (
    <svg width={w} height={h} viewBox="0 0 4 14"
         preserveAspectRatio="none"
         shapeRendering="crispEdges"
         style={{ flexShrink: 0, display: "block", verticalAlign: "top" }}>
      {pattern.map((row, y) =>
        row.map((role, x) => role === "." ? null : (
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1}
                fill={roleColor[role]} />
        ))
      )}
    </svg>
  )
}

// 가운데 stretch용 그라디언트 (14px 세로 픽셀 라인)
export function pixelMiddleBackground(p, state) {
  const colors = getStateColors(p, state)
  // 14등분: 1/14씩
  const u = 100 / 14
  return `linear-gradient(180deg,
    ${colors.border} 0%, ${colors.border} ${4}%,
    ${colors.hi}     ${4}%, ${colors.hi}     ${8}%,
    ${colors.main}   ${u*2}%, ${colors.main}   ${u*10}%,
    ${p.midhi}       ${u*10}%, ${p.midhi}       ${u*11}%,
    ${colors.dark}   ${u*11}%, ${colors.dark}   ${u*13}%,
    ${colors.border} ${u*13}%, ${colors.border} 100%)`
}

// 픽셀 버튼 — sprite와 동일한 픽셀 round corner를 SVG로 정확히 그림
export function PixelButton({ children, onClick, color, variant = "primary",
                       scale = 2.5, textColor, disabled = false,
                       fullWidth = false, height,
                       style = {} }) {
  const [hov, setHov] = useState(false)
  const [pressed, setPressed] = useState(false)
  const finalColor = color ?? VARIANT_TO_COLOR[variant] ?? "brown"
  const p = BUTTON_PALETTE[finalColor] || BUTTON_PALETTE.brown

  const NATIVE_H = 14
  // 정수 scale 강제 — sub-pixel 갭 방지 (SVG width/height가 정수라야 cap이 정확히 붙음)
  const rawPx = height ? height / NATIVE_H : scale
  const px = Math.max(1, Math.round(rawPx))
  const dispH = NATIVE_H * px
  const state = disabled ? "normal" : (pressed ? "pressed" : (hov ? "hover" : "normal"))

  const lightBg = (finalColor === "white" || finalColor === "tan" || finalColor === "gray" || finalColor === "lime")
  const defaultTextColor = lightBg ? "#2a1a0a" : "#FFFDD0"
  const finalTextColor = textColor || defaultTextColor

  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false) }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: "relative",
        display: fullWidth ? "block" : "inline-block",
        width: fullWidth ? "100%" : "auto",
        minWidth: 8 * px,
        height: dispH,
        background: "transparent",
        border: "none", padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
        boxSizing: "border-box",
        ...style,
      }}>
      {/* invisible spacer — button width를 라벨 컨텐츠 + cap 너비로 자동 결정 */}
      {!fullWidth && (
        <span style={{
          visibility: "hidden",
          fontSize: Math.max(10, Math.floor(px * 4.5)),
          fontWeight: 700,
          fontFamily: "monospace",
          padding: `0 ${Math.max(4, 2 * px) + 4 * px}px`,
          whiteSpace: "nowrap",
          display: "inline-block",
          lineHeight: 1,
          height: dispH,
        }}>
          {children}
        </span>
      )}
      {/* 가운데 stretch — absolute로 좌/우 cap 사이 정확히 채움 (sub-pixel 갭 완전 차단) */}
      <div style={{
        position: "absolute",
        left: 4 * px,        // 좌측 cap 너비
        right: 4 * px,       // 우측 cap 너비
        top: 0, bottom: 0,
        background: pixelMiddleBackground(p, state),
        display: "flex", alignItems: "center", justifyContent: "center",
        color: finalTextColor,
        fontSize: Math.max(10, Math.floor(px * 4.5)),
        fontWeight: 700,
        fontFamily: "monospace",
        textShadow: lightBg ? "none" : "1px 1px 0 rgba(0,0,0,0.4)",
        whiteSpace: "nowrap",
        userSelect: "none",
        padding: `0 ${Math.max(4, 2 * px)}px`,
        // 자식 button이 inline 컨텐츠 width 계산에 영향 안 받도록
        boxSizing: "border-box",
      }}>
        <span style={{
          transform: pressed ? `translateY(${px}px)` : "none",
          display: "inline-block",
          lineHeight: 1,
        }}>
          {children}
        </span>
      </div>
      {/* 좌측 cap — absolute, 1px 안쪽으로 (가운데 위에 살짝 겹침 → sub-pixel 갭 메꿈) */}
      <div style={{ position: "absolute", left: 0, top: 0,
                    width: 4 * px + 1, height: dispH, pointerEvents: "none" }}>
        <PixelCap pattern={LEFT_CAP_PATTERN} palette={p} state={state} scale={px} />
      </div>
      {/* 우측 cap */}
      <div style={{ position: "absolute", right: 0, top: 0,
                    width: 4 * px + 1, height: dispH, pointerEvents: "none",
                    display: "flex", justifyContent: "flex-end" }}>
        <PixelCap pattern={RIGHT_CAP_PATTERN} palette={p} state={state} scale={px} />
      </div>
    </button>
  )
}

// 14×14 사각형 버튼 — sprite 전체 픽셀 패턴 (가로 cap 2px, 세로 cap 2px)
// '.'=transparent, 'B'=border, 'H'=hi, 'M'=main, 'D'=dark
const SQUARE_PATTERN = [
  "..BBBBBBBBBB..",
  ".BHHHHHHHHHHB.",
  "BHHMMMMMMMMHHB",
  "BHMMMMMMMMMMHB",
  "BHMMMMMMMMMMHB",
  "BHMMMMMMMMMMHB",
  "BHMMMMMMMMMMHB",
  "BHMMMMMMMMMMHB",
  "BHMMMMMMMMMMHB",
  "BHHMMMMMMMMHHB",
  "BDHHHHHHHHHHDB",
  "BDDDDDDDDDDDDB",
  ".BDDDDDDDDDDB.",
  "..BBBBBBBBBB..",
]

// 정사각형 픽셀 버튼 — 박스 안에 아이콘/텍스트
// 외곽은 SVG로 픽셀 정확히 그리고, 내부 아이콘은 박스 위에 absolute 배치
export function PixelSquareButton({ children, onClick, color, variant = "primary",
                                     scale = 4, disabled = false, style = {} }) {
  const [hov, setHov] = useState(false)
  const [pressed, setPressed] = useState(false)
  const finalColor = color ?? VARIANT_TO_COLOR[variant] ?? "brown"
  const p = BUTTON_PALETTE[finalColor] || BUTTON_PALETTE.brown
  const px = Math.max(1, Math.round(scale))
  const NATIVE = 14
  const disp = NATIVE * px
  const state = disabled ? "normal" : (pressed ? "pressed" : (hov ? "hover" : "normal"))
  const colors = getStateColors(p, state)
  const roleColor = { B: colors.border, H: colors.hi, M: colors.main, D: colors.dark }

  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false) }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: "relative",
        width: disp, height: disp,
        background: "transparent", border: "none", padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
        display: "inline-block",
        ...style,
      }}>
      {/* 박스 (SVG 픽셀 패턴) */}
      <svg width={disp} height={disp} viewBox="0 0 14 14"
           shapeRendering="crispEdges"
           preserveAspectRatio="none"
           style={{ position: "absolute", inset: 0, display: "block" }}>
        {SQUARE_PATTERN.map((row, y) =>
          row.split("").map((ch, x) => ch === "." ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1}
                  fill={roleColor[ch]} />
          ))
        )}
      </svg>
      {/* 자식 (아이콘) — 박스 위에 absolute로 중앙 정렬 */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        transform: pressed ? `translateY(${px}px)` : "none",
        pointerEvents: "none",
      }}>
        {children}
      </div>
    </button>
  )
}

// 픽셀 패널/팝업 박스 — PixelButton과 같은 미적 통일
// children을 감싸는 픽셀 외곽선 + 헤더(선택) 박스
export function PixelPanel({ children, color = "#c6e472", scale = 2,
                             header, headerColor, padding = 16, style = {} }) {
  const p = BUTTON_PALETTE[color] || BUTTON_PALETTE.tan
  const headerP = BUTTON_PALETTE[headerColor || "brown"] || BUTTON_PALETTE.brown
  const px = scale
  const c = px

  // 패널은 위/아래 픽셀 라인이 버튼보다 단순: border 1 / hi 1 / main fill / dark 1 / border 1
  // background로 위쪽 강조선만 그리고 본체는 단색
  const panelBg = `linear-gradient(180deg,
    ${p.border} 0, ${p.border} ${px}px,
    ${p.hi} ${px}px, ${p.hi} ${px*2}px,
    ${p.main} ${px*2}px, ${p.main} calc(100% - ${px*2}px),
    ${p.dark} calc(100% - ${px*2}px), ${p.dark} calc(100% - ${px}px),
    ${p.border} calc(100% - ${px}px), ${p.border} 100%)`

  // 좌우 외곽선은 box-shadow inset로 추가
  const sideShadow = `inset ${px}px 0 0 ${p.border}, inset -${px}px 0 0 ${p.border}`

  // round corner clip
  const clipPath = `polygon(
    ${c}px 0, calc(100% - ${c}px) 0,
    calc(100% - ${c}px) ${c}px, 100% ${c}px,
    100% calc(100% - ${c}px), calc(100% - ${c}px) calc(100% - ${c}px),
    calc(100% - ${c}px) 100%, ${c}px 100%,
    ${c}px calc(100% - ${c}px), 0 calc(100% - ${c}px),
    0 ${c}px, ${c}px ${c}px
  )`

  return (
    <div style={{
      background: panelBg,
      boxShadow: sideShadow,
      clipPath,
      color: "#2a1a0a",
      fontFamily: "monospace",
      ...style,
    }}>
      {header && (
        <div style={{
          background: pixelMiddleBackground(headerP, "normal"),
          color: "#FFFDD0",
          fontWeight: 700,
          fontSize: Math.max(11, Math.floor(px * 5)),
          padding: `${px*2}px ${px*4}px`,
          textShadow: "1px 1px 0 rgba(0,0,0,0.4)",
          marginTop: -px,  // 패널 외곽선과 살짝 겹치게 (clipPath로 둥글게 처리됨)
        }}>
          {header}
        </div>
      )}
      <div style={{ padding: header ? padding : padding + px*2 }}>
        {children}
      </div>
    </div>
  )
}

// 팝업 내부 카드/뱃지용 픽셀 박스 (외곽선 + 모서리 cut + 그라디언트 단색)
// 헤더 cap 같은 sub-pixel 어긋남 없이 가벼운 div 1개로 처리
//   pad: padding (number 또는 string)
//   children: 내용
//   color: BUTTON_PALETTE 키 (tan/brown/green/red/orange 등)
//   hoverable: hover 시 색 살짝 밝게
//   onClick: 클릭 가능
export function PixelBox({ children, color = "tan", scale = 2, pad = 8,
                            hoverable = false, onClick, style = {} }) {
  const [hov, setHov] = useState(false)
  const p = BUTTON_PALETTE[color] || BUTTON_PALETTE.tan
  const px = Math.max(1, Math.round(scale))
  const c = px

  // 픽셀 박스 = 위 1px 외곽선 + main 채움 + 아래 1px dark + 1px 외곽선
  const main = hoverable && hov ? p.hi : p.main
  const bg = `linear-gradient(180deg,
    ${p.border} 0, ${p.border} ${px}px,
    ${main} ${px}px, ${main} calc(100% - ${px*2}px),
    ${p.dark} calc(100% - ${px*2}px), ${p.dark} calc(100% - ${px}px),
    ${p.border} calc(100% - ${px}px), ${p.border} 100%)`
  // 좌우 외곽선
  const sideShadow = `inset ${px}px 0 0 ${p.border}, inset -${px}px 0 0 ${p.border}`
  // 4모서리 1픽셀 cut (round corner)
  const clipPath = `polygon(
    ${c}px 0, calc(100% - ${c}px) 0,
    calc(100% - ${c}px) ${c}px, 100% ${c}px,
    100% calc(100% - ${c}px), calc(100% - ${c}px) calc(100% - ${c}px),
    calc(100% - ${c}px) 100%, ${c}px 100%,
    ${c}px calc(100% - ${c}px), 0 calc(100% - ${c}px),
    0 ${c}px, ${c}px ${c}px
  )`

  return (
    <div onClick={onClick}
         onMouseEnter={hoverable ? () => setHov(true) : undefined}
         onMouseLeave={hoverable ? () => setHov(false) : undefined}
         style={{
           background: bg,
           boxShadow: sideShadow,
           clipPath,
           // 외곽선 안쪽으로 padding (px*2만큼 추가)
           padding: typeof pad === "number" ? `${pad + px}px ${pad + px*2}px` : pad,
           color: "#2a1a0a",
           cursor: onClick ? "pointer" : "default",
           ...style,
         }}>
      {children}
    </div>
  )
}

// 헤더 바 — 4모서리 round corner + 가운데 세로 stretch
// 위/아래 7픽셀(round corner)은 sprite로 정확히 그리고, 가운데는 단색 stretch
//   color: BUTTON_PALETTE 키
//   scale: 1 native pixel = scale css px (다른 픽셀 요소와 맞춤)
//   minHeight: 헤더 최소 높이 (px) — 이보다 크면 가운데가 stretch됨
//   children: 헤더 내용 (왼쪽~오른쪽)
//   leftPad/rightPad: 헤더 양 끝 cap 영역 외에 추가로 띄울 padding (px)
export function PixelHeaderBar({ children, color = "brown", scale = 3,
                                   minHeight = 36, style = {} }) {
  const p = BUTTON_PALETTE[color] || BUTTON_PALETTE.brown
  const px = Math.max(1, Math.round(scale))
  // 4모서리 round corner SVG: 좌측 4×7(top) + 4×7(bottom)
  // 직사각형 PixelButton과 동일 패턴이지만 위/아래 분리
  // LEFT_CAP_PATTERN의 위쪽 7행과 아래쪽 7행을 분리해서 사용
  const top    = LEFT_CAP_PATTERN.slice(0, 7)
  const bottom = LEFT_CAP_PATTERN.slice(7, 14)
  const topR    = RIGHT_CAP_PATTERN.slice(0, 7)
  const bottomR = RIGHT_CAP_PATTERN.slice(7, 14)
  const colors = getStateColors(p, "normal")
  const roleColor = { BD: colors.border, HI: colors.hi, MN: colors.main, DK: colors.dark }

  // 가운데 stretch 영역의 좌/우 외곽선 색 (좌측은 BD)
  // top/bottom cap은 4×7 SVG, 그 사이 가운데는 좌측 1px 외곽선 + 1px hi + main + (필요 시 stretch)
  // 하지만 가운데에서도 좌측 외곽선이 필요. 그래서 가운데 좌/우 1픽셀씩은 색으로 깔자.
  const sideShadow = `inset ${px}px 0 0 ${p.border}, inset -${px}px 0 0 ${p.border},
    inset ${px*2}px 0 0 ${p.hi}, inset -${px*2}px 0 0 ${p.hi}`

  // 가운데 stretch 영역 높이 = 전체 - 14*px (위 7 + 아래 7)
  const capH = 7 * px
  const middleH = Math.max(0, minHeight - 14 * px)

  // SVG cap 컴포넌트 (top 또는 bottom 패턴 사용)
  const SvgCap = ({ pattern, w }) => (
    <svg width={4 * px} height={capH} viewBox={`0 0 4 7`}
         shapeRendering="crispEdges"
         preserveAspectRatio="none"
         style={{ flexShrink: 0, display: "block", verticalAlign: "top" }}>
      {pattern.map((row, y) =>
        row.map((role, x) => role === "." ? null : (
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1}
                fill={roleColor[role]} />
        ))
      )}
    </svg>
  )

  return (
    <div style={{
      position: "relative",
      display: "flex", flexDirection: "column",
      flexShrink: 0,
      ...style,
    }}>
      {/* 위쪽 cap row */}
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <SvgCap pattern={top} />
        <div style={{
          flex: "1 1 0", minWidth: 0, height: capH,
          // 위쪽 cap 가운데: y=0 border, y=1 hi, y=2~6 main
          background: `linear-gradient(180deg,
            ${colors.border} 0, ${colors.border} ${px}px,
            ${colors.hi} ${px}px, ${colors.hi} ${px*2}px,
            ${colors.main} ${px*2}px, ${colors.main} ${px*7}px)`,
        }} />
        <SvgCap pattern={topR} />
      </div>
      {/* 가운데 stretch row (있으면) */}
      {middleH > 0 && (
        <div style={{
          height: middleH,
          background: colors.main,
          boxShadow: sideShadow,
        }} />
      )}
      {/* 아래쪽 cap row */}
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <SvgCap pattern={bottom} />
        <div style={{
          flex: "1 1 0", minWidth: 0, height: capH,
          // 아래쪽 cap 가운데: y=0~2 main, y=3 midhi, y=4~5 dark, y=6 border
          background: `linear-gradient(180deg,
            ${colors.main} 0, ${colors.main} ${px*3}px,
            ${p.midhi} ${px*3}px, ${p.midhi} ${px*4}px,
            ${colors.dark} ${px*4}px, ${colors.dark} ${px*6}px,
            ${colors.border} ${px*6}px, ${colors.border} ${px*7}px)`,
        }} />
        <SvgCap pattern={bottomR} />
      </div>
      {/* 자식 — 헤더 위에 absolute로 중앙 배치 */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center",
        padding: `0 ${px*4}px`,
        pointerEvents: "none",  // 자식의 button만 click 가능하게 별도 처리
      }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          pointerEvents: "auto",
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// 인라인 픽셀 뱃지 (작은 라벨)
//   color: 배경색
//   children: 텍스트
export function PixelBadge({ children, color = "tan", scale = 1, style = {} }) {
  const p = BUTTON_PALETTE[color] || BUTTON_PALETTE.tan
  const px = Math.max(1, Math.round(scale))
  const c = px

  // 작은 뱃지: 위/아래 1픽셀씩 외곽선만 (단순화)
  const bg = `linear-gradient(180deg,
    ${p.border} 0, ${p.border} ${px}px,
    ${p.main} ${px}px, ${p.main} calc(100% - ${px}px),
    ${p.border} calc(100% - ${px}px), ${p.border} 100%)`
  const sideShadow = `inset ${px}px 0 0 ${p.border}, inset -${px}px 0 0 ${p.border}`
  const clipPath = `polygon(
    ${c}px 0, calc(100% - ${c}px) 0,
    calc(100% - ${c}px) ${c}px, 100% ${c}px,
    100% calc(100% - ${c}px), calc(100% - ${c}px) calc(100% - ${c}px),
    calc(100% - ${c}px) 100%, ${c}px 100%,
    ${c}px calc(100% - ${c}px), 0 calc(100% - ${c}px),
    0 ${c}px, ${c}px ${c}px
  )`

  // 어두운 색상은 밝은 텍스트
  const lightBg = (color === "white" || color === "tan" || color === "gray" || color === "lime")
  const txtColor = lightBg ? "#2a1a0a" : "#FFFDD0"

  return (
    <span style={{
      display: "inline-block",
      background: bg,
      boxShadow: sideShadow,
      clipPath,
      padding: `${px*2}px ${px*4}px`,
      color: txtColor,
      fontSize: 10, fontWeight: 700,
      fontFamily: "monospace",
      lineHeight: 1.2,
      ...style,
    }}>
      {children}
    </span>
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
      // 그라디언트 제거 → 픽셀 라임 헤더 (위 hi → main → 아래 dark + border)
      background: limeGrad,
      gap: 12, flexShrink: 0,
      imageRendering: "pixelated",
    }}>
      <style>{`
        @keyframes headerBob {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-3px); }
        }
      `}</style>

      {/* ── 아바타 프레임 (픽셀 박스) ── */}
      <div style={{
        position: "relative",
        width: 50, height: 50,
        background: bodyGrad,
        boxShadow: sideShadow,
        clipPath: pixClipSm,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        imageRendering: "pixelated",
      }}>
        <PlayerAvatar scale={1.4} />
        {/* 레벨 뱃지 — 아바타 우하단 (픽셀 박스) */}
        <div style={{
          position: "absolute", bottom: -6, right: -6,
          background: PIX,
          clipPath: pixClipSm,
          padding: "2px 6px",
          fontSize: 9, fontWeight: 700, color: "#FFFDD0",
          fontFamily: "monospace", lineHeight: 1,
        }}>
          {level}
        </div>
      </div>

      {/* ── 이름 + EXP바 + 집중시간 ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
        {/* 이름 + Lv */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: COLOR_TEXT,
            fontFamily: "monospace", letterSpacing: 0.5,
          }}>{name}</span>
          <span style={{
            fontSize: 9, color: "#FFFDD0", fontFamily: "monospace",
            background: PIX,
            clipPath: pixClipSm,
            padding: "2px 6px", lineHeight: 1,
          }}>Lv.{level}</span>
        </div>

        {/* EXP 바 */}
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <PixelIcon sx={48} sy={0} scale={1.4} />
          <div style={{ position:"relative" }}>
            <PixelBar pct={expPct} colorSx={64} scale={2} />
          </div>
          <span style={{ fontSize:9, color: COLOR_TEXT, fontFamily:"monospace" }}>
            {exp}/{expNext}
          </span>
        </div>
      </div>

      {/* 구분선 */}
      <div style={{ width:2, height:36, background: PIX, flexShrink:0, margin:"0 4px" }} />

      {/* ── 집중시간 ── */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                    gap:2, flexShrink:0 }}>
        <span style={{ fontSize:9, color: COLOR_TEXT, fontFamily:"monospace" }}>오늘 집중</span>
        <span style={{ fontSize:13, fontWeight:700, color: COLOR_TEXT,
                       fontFamily:"monospace" }}>
          {formatFocusSec(focusSec)}
        </span>
      </div>

      <div style={{ flex:1 }} />

      {/* ── 연속 도전 (픽셀 박스) ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:5,
        background: bodyGrad,
        boxShadow: sideShadow,
        clipPath: pixClipSm,
        padding:"5px 10px", flexShrink:0,
      }}>
        <PixelIcon sx={144} sy={0} scale={1.5} />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
          <span style={{ fontSize:9, color: COLOR_TEXT, fontFamily:"monospace" }}>연속</span>
          <span style={{ fontSize:12, fontWeight:700, color: COLOR_TEXT,
                         fontFamily:"monospace", lineHeight:1 }}>{streak}일</span>
        </div>
      </div>

      {/* ── 골드 (픽셀 박스) ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:5,
        background: bodyGrad,
        boxShadow: sideShadow,
        clipPath: pixClipSm,
        padding:"5px 10px", flexShrink:0,
      }}>
        <PixelIcon sx={96} sy={0} scale={2} />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
          <span style={{ fontSize:9, color: COLOR_TEXT, fontFamily:"monospace" }}>골드</span>
          <span style={{ fontSize:12, fontWeight:700, color: COLOR_TEXT,
                         fontFamily:"monospace", lineHeight:1 }}>
            {gold.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── 날짜 ── */}
      <div style={{
        fontSize:10, color: COLOR_TEXT, fontFamily:"monospace", flexShrink:0,
      }}>{dateStr}</div>

      {/* ── 홈 버튼 ── */}
      {showHome && (
        <PixelButton
          onClick={() => navigate("/town")}
          color="brown"
          scale={3}>
          🏠 홈
        </PixelButton>
      )}
    </div>
  )
}