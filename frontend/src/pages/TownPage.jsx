import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import SharedHeader from "../components/SharedHeader"
import { getReviewQueue } from "../api/index.js"

// ── Cute Fantasy 에셋 경로 ──
const AF  = "/assets/Cute_Fantasy_Free"    // 무료 (타일용)
const A   = "/assets/Cute_Fantasy"         // 유료
const OD  = `${A}/Outdoor decoration`      // 공백 있는 폴더
const UI   = "/assets/Cute_Fantasy_UI/UI"

const PLAYER_SHEET  = `${A}/Player/Player.png`
const INN_IMG       = `${A}/Buildings/Buildings/Unique_Buildings/Inn/Inn_Blue.png`
const FARMER_NPC    = `${A}/NPCs (Premade)/Farmer_Bob.png`
const CHEF_NPC      = `${A}/Player/ponix.png`
const LUMBERJACK_NPC= `${A}/Player/popo.png`
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
const WATER_BORDER  = `${A}/Tiles/Water/Water_Tile_1.png`
const FARM_TILE_SRC = `${A}/Tiles/FarmLand/FarmLand_Tile.png`  // 유료, 9-slice용
const CROPS_IMG     = `${A}/Crops/Crops.png`                   // 2행 = row2(y=32)
const CHICKEN_IMG   = `${A}/Animals/Chicken/Chicken_01.png`
const DUCK_IMG      = `${A}/Animals/Duck/Duck_01.png`
const FROG_IMG      = `${A}/Animals/Frog/Frog_01.png`
const UI_POPUP = "/assets/Cute_Fantasy_UI/UI/UI_Pop_Up.png"  // 96x96, 4개 말풍선
const TILE = 16;
const SC = 3; // scale
const T = TILE * SC; // 48px
const UI_ICONS  = `${UI}/UI_Icons.png`
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
// ── Player 스프라이트 행 (32px 단위) ──
// row0=대기, row1=오른쪽 대기, row2=위쪽 대기
// row3=아래 이동, row4=오른쪽 이동, row5=위쪽 이동
// 왼쪽은 row1(대기)/row4(이동)을 scaleX(-1) 반전으로 재사용
const DIR_ROW = {
  down:  { idle: 0, walk: 3, flip: false },
  up:    { idle: 2, walk: 5, flip: false },
  right: { idle: 1, walk: 4, flip: false },
  left:  { idle: 1, walk: 4, flip: true  },
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
@keyframes animalFrames6 {
  from { background-position-x: 0px; }
  to   { background-position-x: -384px; }
}
@keyframes animalFrames8 {
  from { background-position-x: 0px; }
  to   { background-position-x: -512px; }
}
`
// Water_Tile.png (48×80, 3col×5row, SC=3배 렌더):
//   row0 y=0  → 상단 풀+물 경계 → 상단에 그대로, 하단엔 scaleY(-1) 뒤집어 재사용
//   row1 y=16 → col0=좌경계(L), col1=물내부(MID), col2=우경계(R)
const W = {
  TL:  [0,   0],  TOP: [16,  0],  TR:  [32,  0],
  L:   [0,  16],  MID: [16, 16],  R:   [32, 16],
  BL:  [0,  32],  BOT: [16, 32],  BR:  [32,  32],  // row0 재사용 + scaleY(-1)
};
const BOTTOM_KEYS = new Set(["BL","BOT","BR"]);

const waterTile = (sx, sy, flip = false) => ({
  width: T, height: T,
  backgroundImage: `url(${WATER_BORDER})`,
  backgroundPosition: `${-sx * SC}px ${-sy * SC}px`,
  backgroundSize: `${48 * SC}px ${48 * SC}px`,
  backgroundRepeat: "no-repeat",
  imageRendering: "pixelated",
  display: "inline-block",
  flexShrink: 0,
  transform: flip ? "scaleY(1)" : "none",
});

function Pond({ cols = 5, rows = 3}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex" }}>
          {Array.from({ length: cols }).map((_, c) => {
            const isTop  = r === 0,        isBot   = r === rows - 1;
            const isLeft = c === 0,        isRight = c === cols - 1;

            const key =
              isTop && isLeft  ? "TL" : isTop && isRight  ? "TR" : isTop  ? "TOP" :
              isBot && isLeft  ? "BL" : isBot && isRight  ? "BR" : isBot  ? "BOT" :
              isLeft           ? "L"  : isRight            ? "R"  :          "MID";

            const [sx, sy] = W[key];
            const flip = BOTTOM_KEYS.has(key);
            return <div key={c} style={waterTile(sx, sy, flip)} />;
          })}
        </div>
      ))}
    </div>
  );
}

// ── RoadPath 컴포넌트 ──
// Grass_Tiles_1.png (256×160, 16col×10row, SC=3배 렌더)
// 길 타일 위치: col0~3, row2~5  (왼쪽 상단 3행 1열 요소)
//   TL=c0r2  TOP=c1r2  TR=c3r2
//   L =c0r3  MID=c1r3  R =c3r3
//   BL=c0r5  BOT=c1r5  BR=c3r5
const GRASS1_IMG = "/assets/Cute_Fantasy/Tiles/Grass/Grass_Tiles_1.png"

const P = {
  TL:  [0*16,  5*16],  TOP: [1*16,  5*16],  TR:  [2*16,  5*16],
  L:   [0*16,  6*16],  MID: [1*16,  6*16],  R:   [2*16,  6*16],
  BL:  [0*16,  7*16],  BOT: [1*16,  7*16],  BR:  [2*16,  7*16],
}

const pathTile = (sx, sy) => ({
  width: T, height: T,
  backgroundImage: `url(${GRASS1_IMG})`,
  backgroundPosition: `${-sx * SC}px ${-sy * SC}px`,
  backgroundSize: `${256 * SC}px ${160 * SC}px`,
  backgroundRepeat: "no-repeat",
  imageRendering: "pixelated",
  display: "inline-block",
  flexShrink: 0,
})

function RoadPath({ cols = 8, rows = 2 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex" }}>
          {Array.from({ length: cols }).map((_, c) => {
            const isTop  = r === 0,        isBot  = r === rows - 1
            const isLeft = c === 0,        isRight = c === cols - 1

            const key =
              isTop && isLeft  ? "TL" : isTop && isRight  ? "TR" : isTop  ? "TOP" :
              isBot && isLeft  ? "BL" : isBot && isRight  ? "BR" : isBot  ? "BOT" :
              isLeft           ? "L"  : isRight            ? "R"  :          "MID"

            const [sx, sy] = P[key]
            return <div key={c} style={pathTile(sx, sy)} />
          })}
        </div>
      ))}
    </div>
  )
}

// ── TomatoFarm 헬퍼 ──
// Fences.png (64×64, 4col×4row, 16px 타일): c0r0=기둥, c2r0=가로레일, c0r1=세로레일
const fenceTile = (sx, sy, w = T, h = T, repeatX = false, repeatY = false) => ({
  width: w, height: h,
  backgroundImage: `url("${FENCE_IMG}")`,
  backgroundPosition: `${-(sx * SC)}px ${-(sy * SC)}px`,
  backgroundSize: `${64 * SC}px ${64 * SC}px`,
  backgroundRepeat: repeatX ? "repeat-x" : repeatY ? "repeat-y" : "no-repeat",
  imageRendering: "pixelated",
  flexShrink: 0,
})

// FarmLand_Tile.png (유료, 112×128, 7col×8row): 9-slice용 (col0-2, row0-2)
//   TL(0,0) T(1,0) TR(2,0) / L(0,1) M(1,1) R(2,1) / BL(0,2) B(1,2) BR(2,2)
const farmSliceTile = (col, row) => ({
  width: T, height: T,
  backgroundImage: `url(${FARM_TILE_SRC})`,
  backgroundPosition: `${-col * T}px ${-row * T}px`,
  backgroundSize: `${112 * SC}px ${128 * SC}px`,
  backgroundRepeat: "no-repeat",
  imageRendering: "pixelated",
  display: "inline-block",
  flexShrink: 0,
})

// Crops.png 2행(row index 2, y=32): col6=빨간토마토, col3~5=녹색작물
// scale=1.5 → 24×24px (닭 64px 대비 작은 식물 크기)
const CROP_SCALE = 1.5
const CROP_SIZE  = 16 * CROP_SCALE  // 24px
const cropTile = (col) => ({
  width: CROP_SIZE, height: CROP_SIZE,
  backgroundImage: `url(${CROPS_IMG})`,
  backgroundPosition: `${-col * 16 * CROP_SCALE}px ${-32 * CROP_SCALE}px`,
  backgroundSize: `${112 * CROP_SCALE}px ${688 * CROP_SCALE}px`,
  backgroundRepeat: "no-repeat",
  imageRendering: "pixelated",
})

// 4×3 내부 타일에 토마토 패턴 (col6=토마토, col3/4/5=잎)
const CROP_PATTERN = [
  [0, 3, 6, 5],
  [4, 2, 5, 2],
  [6, 4, 2, 3],
]

function TomatoFarm({ innerCols = 4, innerRows = 3, children, onClick }) {
  const POST   = T
  const innerW = innerCols * T
  const innerH = innerRows * T
  const totalW = POST + innerW + POST
  const totalH = POST + innerH + POST

  return (
    <div onClick={onClick}
      onMouseEnter={e => onClick && (e.currentTarget.style.filter = "brightness(1.1)")}
      onMouseLeave={e => onClick && (e.currentTarget.style.filter = "none")}
      style={{ position:"relative", width:totalW, height:totalH,
               cursor: onClick ? "pointer" : "default",
               filter:"none", transition:"filter 0.2s" }}>

      {/* 레이블 */}
      <div style={{ position:"absolute", bottom:-22, left:"50%", transform:"translateX(-50%)",
                    background:"rgba(0,0,0,0.85)", color:"#FFC107", fontSize:9, fontWeight:700,
                    padding:"2px 8px", borderRadius:6, border:"1px solid #6b3d1f",
                    whiteSpace:"nowrap", zIndex:10 }}>🍅 토마토 농장</div>

      {/* 9-slice 밭 바닥 (내부 innerCols×innerRows) */}
      <div style={{ position:"absolute", left:POST, top:POST, zIndex:1,
                    display:"flex", flexDirection:"column" }}>
        {Array.from({ length: innerRows }).map((_, r) => (
          <div key={r} style={{ display:"flex" }}>
            {Array.from({ length: innerCols }).map((_, c) => {
              const fc = c === 0 ? 1 : c === innerCols - 1 ? 3 : 2
              const fr = r === 0 ? 0 : r === innerRows - 1 ? 2 : 1
              return <div key={c} style={farmSliceTile(fc, fr)} />
            })}
          </div>
        ))}
      </div>

      {/* 토마토 작물 배치 (바닥 위) */}
      {CROP_PATTERN.map((row, r) =>
        row.map((cropCol, c) => (
          <div key={`${r}-${c}`}
            style={{ position:"absolute",
                     left: POST + c * T + (T - CROP_SIZE) / 2,
                     top:  POST + r * T + (T - CROP_SIZE) / 2,
                     zIndex:2, ...cropTile(cropCol) }} />
        ))
      )}

      {/* ── 울타리 상단 ──
           [0,0]코너 | [1,0]레일좌끝 | [2,0]레일중간×n | [3,0]레일우끝 | [0,0]코너
           총 너비 = (innerCols+2)*T = totalW */}
      <div style={{ position:"absolute", left:0, top:0, zIndex:5, ...fenceTile(16,16) }} />
      <div style={{ position:"absolute", left:T, top:0, zIndex:4, ...fenceTile(32,0) }} />
      <div style={{ position:"absolute", left:2*T, top:0, zIndex:4, ...fenceTile(32,0)}} />
      <div style={{ position:"absolute", left:3*T, top:0, zIndex:4, ...fenceTile(32,0)}} />
      <div style={{ position:"absolute", left:innerCols*T, top:0, zIndex:4, ...fenceTile(32,0) }} />
      <div style={{ position:"absolute", left:(innerCols+1)*T, top:0, zIndex:5, ...fenceTile(48,16) }} />

      {/* ── 울타리 좌측 · 우측 — [0,1] repeat-y ── */}
      <div style={{ position:"absolute", left:0, top:T, width:T, height:innerH, zIndex:3,
                    ...fenceTile(0, 16) }} />
      <div style={{ position:"absolute", left:0, top:2*T, width:T, height:innerH, zIndex:3,
                    ...fenceTile(0, 16) }} />
      <div style={{ position:"absolute", left:0, top:3*T, width:T, height:innerH, zIndex:3,
                    ...fenceTile(0, 32) }} />\
      <div style={{ position:"absolute", left:(innerCols+1)*T, top:T, width:T, height:innerH, zIndex:3,
                    ...fenceTile(0, 16),transform:"scaleX(-1)" }} />
      <div style={{ position:"absolute", left:(innerCols+1)*T, top:2*T, width:T, height:innerH, zIndex:3,
                    ...fenceTile(0, 16),transform:"scaleX(-1)" }} />
      <div style={{ position:"absolute", left:(innerCols+1)*T, top:3*T, width:T, height:innerH, zIndex:3,
                    ...fenceTile(0, 32),transform:"scaleX(-1)" }} />              


      {/* 내부 콘텐츠 (닭 등) */}
      <div style={{ position:"absolute", left:POST, top:POST,
                    width:innerW, height:innerH, zIndex:3 }}>
        {children}
      </div>
    </div>
  )
}



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

// 배회하는 동물 — 스프라이트시트에서 특정 행의 프레임을 순환하며 랜덤 이동
// sheetW/H: 스프라이트시트 전체 픽셀 크기
// frameSize: 한 프레임의 픽셀 크기 (정사각형 가정)
// animRow: 사용할 행 인덱스
// numFrames: 해당 행의 프레임 수
// animDuration: 한 사이클(초)
function WanderingAnimal({ src, sheetW, sheetH, frameSize, animRow, numFrames, animDuration, scale=2, areaW, areaH, initX, initY }) {
  const fw   = frameSize * scale
  const fh   = frameSize * scale
  const maxX = areaW - fw - 4
  const maxY = areaH - fh - 4

  const [pos, setPos] = useState({
    x: initX ?? 4 + Math.random() * Math.max(0, maxX - 4),
    y: initY ?? 4 + Math.random() * Math.max(0, maxY - 4),
  })
  const [facing, setFacing] = useState(-1)
  const posRef    = useRef(pos)
  const targetRef = useRef({ x: pos.x, y: pos.y })
  const frameRef  = useRef(null)
  const timerRef  = useRef(null)

  useEffect(() => {
    function pickTarget() {
      targetRef.current = {
        x: 4 + Math.random() * Math.max(0, maxX - 4),
        y: 4 + Math.random() * Math.max(0, maxY - 4),
      }
    }
    timerRef.current = setInterval(pickTarget, 2200 + Math.random() * 3000)

    function tick() {
      const { x: tx, y: ty } = targetRef.current
      const { x, y } = posRef.current
      const dx = tx - x, dy = ty - y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 1.2) {
        const spd = 0.38
        const nx = Math.max(0, Math.min(maxX, x + (dx / dist) * spd))
        const ny = Math.max(0, Math.min(maxY, y + (dy / dist) * spd))
        posRef.current = { x: nx, y: ny }
        setPos({ x: nx, y: ny })
        if (Math.abs(dx) > 0.3) setFacing(dx > 0 ? -1 : 1)
      }
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      clearInterval(timerRef.current)
      cancelAnimationFrame(frameRef.current)
    }
  }, [maxX, maxY])

  // backgroundPositionY = 해당 행의 Y 오프셋 (음수)
  const bgPosY  = -(animRow * frameSize * scale)
  const animKey = `animalFrames${numFrames}`

  return (
    <div style={{ position:"absolute", left: pos.x, top: pos.y, transform:`scaleX(${facing})`, zIndex:3 }}>
      <div style={{
        width: fw, height: fh,
        backgroundImage: `url(${src})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${sheetW * scale}px ${sheetH * scale}px`,
        backgroundPositionY: `${bgPosY}px`,
        imageRendering: "pixelated",
        animation: `${animKey} ${animDuration}s steps(${numFrames}) infinite`,
      }} />
    </div>
  )
}

// NPC 스프라이트 (64x64 per frame, 6열)
// scale=1.5 → 화면 96x96px (플레이어와 동일)
function NpcSprite({ src, sheetW, sheetH, name, hasNotif, onClick, style={}, scale=3.0, nameMt=4, bubbleOffset=-52 }) {
  const SC = scale
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
      {hasNotif && <NotifBadge topOffset={bubbleOffset} />}
      <div style={{
        width: 64*SC, height: 64*SC,
        backgroundImage: `url("${src}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${sheetW*SC}px ${sheetH*SC}px`,
        backgroundPosition: "0px 0px",
        imageRendering: "pixelated",
        animation: "idleBob 1.5s ease-in-out infinite",
      }} />
      {name && (
        <div style={{
          marginTop: nameMt,
          background: "rgba(0,0,0,0.85)", color: "#FFFDD0",
          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
          border: "1px solid #6b3d1f", whiteSpace: "nowrap", zIndex: 10,
        }}>{name}</div>
      )}
    </div>
  )
}

function NotifBadge({ topOffset=-52 }) {
  // UI_Pop_Up.png 96x96 → 4개 말풍선 (각 48x48)
  // c0r0 = 꼬리 아래쪽 말풍선 (sx=0, sy=0)
  const SC = 2  // 48 → 96px
  return (
    <div style={{ position:"absolute", top:topOffset, left:"50%",
                  transform:"translateX(-50%)", zIndex:10 }}>
      {/* 픽셀아트 말풍선 배경 */}
      <div style={{
        position:"relative",
        width: 48*SC, height: 48*SC,
        backgroundImage: `url("${UI_POPUP}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${96*SC}px ${96*SC}px`,
        backgroundPosition: `0px 0px`,
        imageRendering: "pixelated",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <span style={{
          fontSize: 16, fontWeight: 900, color:"#c42f1c",
          textShadow:"0 1px 2px rgba(0,0,0,0.3)",
          lineHeight:1, marginTop:-10,  // 말풍선 꼬리 위 중앙
        }}>!</span>
      </div>
    </div>
  )
}

function NameTag({ name, isMe=false }) {
  return (
    <div style={{
      position:"absolute", bottom:-10, left:"50%", transform:"translateX(-50%)",
      background: isMe ? "#FFC107" : "rgba(0,0,0,0.85)",
      color: isMe ? "#2a1a0a" : "#FFFDD0",
      fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:8,
      border: isMe ? "1px solid #c89100" : "1px solid #6b3d1f",
      whiteSpace:"nowrap", zIndex:10,
      boxShadow: isMe ? "0 0 10px rgba(245,197,24,0.5)" : "none",
    }}>{name}</div>
  )
}

// 내 캐릭터 — 방향키 이동 + 4방향 walk 애니메이션 (96x96px 고정)
function MyChar({ name, burningBubble, dir="down", isWalking=false }) {
  const { flip } = DIR_ROW[dir]
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
          <div style={{ background:"rgba(13,26,46,0.96)", border:"2px solid #FFC107",
                        borderRadius:10, padding:"8px 14px",
                        boxShadow:"0 4px 20px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize:10, color:"#FFC107", fontWeight:800, marginBottom:6 }}>
              🔥 Burning Time
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", gap:24, marginBottom:3 }}>
              <span style={{ fontSize:9, color:"#888" }}>공부시간</span>
              <span style={{ fontSize:12, color:"#FFC107", fontWeight:700,
                             fontFamily:"monospace" }}>{burningBubble.studyTime}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", gap:24 }}>
              <span style={{ fontSize:9, color:"#888" }}>집중시간</span>
              <span style={{ fontSize:12, color:"#FFC107", fontWeight:700,
                             fontFamily:"monospace" }}>{burningBubble.focusTime}</span>
            </div>
          </div>
          <div style={{ position:"absolute", bottom:-7, left:"50%", transform:"translateX(-50%)",
                        width:0, height:0, borderLeft:"6px solid transparent",
                        borderRight:"6px solid transparent", borderTop:"8px solid #FFC107" }} />
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
        transform: flip ? "scaleX(-1)" : "none",
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
    npc: { name: "포닉스", emoji: "🐥​" },
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
          studyTime: secToHHMM(data.today_study_sec ?? data.today_focus_sec),  // 전체 수강 시간
          focusTime: secToHHMM(data.today_focus_sec),                          // 집중한 시간만
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
    <div style={{ width: "100%", height: "100%", background: "#2a1a0a",
                  color: "#FFFDD0", fontFamily: "'Noto Sans KR', sans-serif",
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

        {/* ══ 연못 ══ */}
        {/* Water_Tile.png (48×80, 3col×5row, 16px 타일):
            row0 y=0  → 상단 풀+물 경계 테두리
            row1 y=16 → col0=좌경계, col1=물내부, col2=우경계
            row2 y=32 → 순수 풀 (사용 안 함)
            row3 y=48 → 하단 물 경계/그림자
            row4 y=64 → 흙
            scale=3 → 16px→48px 렌더
            WATER_TILE(Water_Middle.png) = 순수 물 내부 반복용 */}
        <div style={{ position:"absolute", left:"2%", top:"4%", zIndex:1 }}>
          {/* 9-slice 연못 본체 */}
          <Pond cols={5} rows={3} />

          {/* 분수대 */}
          <Sprite src={FOUNTAIN_IMG} w={32} h={80} scale={2.5}
            style={{ position:"absolute", left:90, top:20, zIndex:3 }} />

          {/* 오리 (배회 + 6프레임 walk, row1) */}
          <WanderingAnimal src={DUCK_IMG}
            sheetW={256} sheetH={640} frameSize={32} animRow={1} numFrames={6} animDuration={0.6}
            scale={2} areaW={240} areaH={144} initX={25} initY={48} />

          {/* 개구리 (배회 + 8프레임 hop, row1) */}
          <WanderingAnimal src={FROG_IMG}
            sheetW={320} sheetH={128} frameSize={32} animRow={1} numFrames={8} animDuration={0.8}
            scale={2} areaW={240} areaH={144} initX={155} initY={60} />
        </div>

        {/* ══ 토마토 농장 (오른쪽 상단) ══ */}
        <div style={{ position:"absolute", right:"3%", top:"30%", zIndex:2 }}>
          <TomatoFarm innerCols={4} innerRows={3} onClick={() => navigate("/party")}>
            <WanderingAnimal src={CHICKEN_IMG}
              sheetW={256} sheetH={512} frameSize={32} animRow={1} numFrames={6} animDuration={0.6}
              scale={2} areaW={192} areaH={144} initX={30} initY={60} />
            <WanderingAnimal src={CHICKEN_IMG}
              sheetW={256} sheetH={512} frameSize={32} animRow={1} numFrames={6} animDuration={0.7}
              scale={2} areaW={192} areaH={144} initX={100} initY={90} />
            <WanderingAnimal src={CHICKEN_IMG}
              sheetW={256} sheetH={512} frameSize={32} animRow={1} numFrames={6} animDuration={0.55}
              scale={2} areaW={192} areaH={144} initX={140} initY={30} />
          </TomatoFarm>
        </div>

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
        {/* cols=30 → 30×48=1440px, overflow:hidden 으로 맵 밖은 잘림 */}
        <div style={{ position:"absolute", left:0, right:0, top:"calc(50% - 48px)",
                      overflow:"hidden", zIndex:3 }}>
          <RoadPath cols={30} rows={3} />
        </div>

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
            backgroundImage:`url("${AF}/Outdoor_decoration/Outdoor_Decor_Free.png")`,
            backgroundRepeat:"no-repeat",
            backgroundSize:`${112*1.5}px ${192*1.5}px`,
            backgroundPosition:`-${(i%3)*16*1.5}px -${128*1.5}px`,
            imageRendering:"pixelated",
          }} />
        ))}

        {/* ══ 랜덤 소품 (Outdoor_Decor.png r0c0~r2c5) ══
            배치 금지구역:
              연못:  left 2~24%, top 4~24%
              농장:  right 3~21% (left 79~97%), top 4~24%
              Inn:   left 6~25%, top 14~46%
              메인길: top 37~60%
        */}
        {(() => {
          // Outdoor_Decor.png: 144×416, 16px 타일
          // r0c0~r2c5 (6col × 3row = 18종)
          const DECOR_TILES = [
            { sx:  0, sy:  0 }, { sx: 16, sy:  0 }, { sx: 32, sy:  0 },
            { sx: 48, sy:  0 }, { sx: 64, sy:  0 }, { sx: 80, sy:  0 },
            { sx:  0, sy: 16 }, { sx: 16, sy: 16 }, { sx: 32, sy: 16 },
            { sx: 48, sy: 16 }, { sx: 64, sy: 16 }, { sx: 80, sy: 16 },
            { sx:  0, sy: 32 }, { sx: 16, sy: 32 }, { sx: 32, sy: 32 },
            { sx: 48, sy: 32 }, { sx: 64, sy: 32 }, { sx: 80, sy: 32 },
          ]
          const SHEET_W = 144
          const SHEET_H = 416
          const SC   = 1.5
          const SIZE = Math.round(16 * SC)

          function isForbidden(lPct, tPct) {
            if (lPct >= 2  && lPct <= 24 && tPct >= 4  && tPct <= 24) return true // 연못
            if (lPct >= 78 && lPct <= 98 && tPct >= 4  && tPct <= 24) return true // 농장
            if (lPct >= 6  && lPct <= 25 && tPct >= 14 && tPct <= 46) return true // Inn
            if (tPct >= 37 && tPct <= 60) return true  // 메인 길
            return false
          }

          function seededRand(seed) {
            const x = Math.sin(seed + 1) * 10000
            return x - Math.floor(x)
          }

          const items = []
          const COUNT = 30
          let placed = 0, attempt = 0

          while (placed < COUNT && attempt < 1000) {
            attempt++
            const lPct = 3  + seededRand(attempt * 7  + 13) * 90
            const tPct = 14 + seededRand(attempt * 3  + 71) * 50
            if (isForbidden(lPct, tPct)) continue
            const tile = DECOR_TILES[Math.floor(seededRand(attempt * 11 + 37) * DECOR_TILES.length)]
            items.push({ left: lPct.toFixed(1)+"%", top: tPct.toFixed(1)+"%", ...tile, key: attempt })
            placed++
          }

          return items.map(item => (
            <div key={`decor-${item.key}`} style={{
              position:           "absolute",
              left:               item.left,
              top:                item.top,
              zIndex:             2,
              width:              SIZE,
              height:             SIZE,
              backgroundImage:    `url("${OD}/Outdoor_Decor.png")`,
              backgroundRepeat:   "no-repeat",
              backgroundSize:     `${SHEET_W * SC}px ${SHEET_H * SC}px`,
              backgroundPosition: `-${item.sx * SC}px -${item.sy * SC}px`,
              imageRendering:     "pixelated",
              pointerEvents:      "none",
            }} />
          ))
        })()}

        {/* ══ Inn 교실 건물 ══ */}
        <div onClick={() => { setNotifs(p=>({...p,teacher:false})); navigate("/lecture") }}
          onMouseEnter={e=>e.currentTarget.style.transform="translateY(-4px)"}
          onMouseLeave={e=>e.currentTarget.style.transform="none"}
          style={{ position:"absolute", left:"7%", top:"15%", zIndex:4,
                   cursor:"pointer", transition:"transform 0.2s" }}>
          <div style={{ position:"relative" }}>
            {notifs.teacher && <NotifBadge />}
            <div style={{ position:"absolute", bottom:-22, left:"50%", transform:"translateX(-50%)",
                          background:"rgba(0,0,0,0.85)", color:"#F9E076", fontSize:9, fontWeight:700,
                          padding:"2px 8px", borderRadius:6, border:"1px solid #6b3d1f",
                          whiteSpace:"nowrap", zIndex:10 }}>교실</div>
            <Sprite src={INN_IMG} w={240} h={192} scale={1.5}
              style={{ filter:"drop-shadow(0 6px 14px rgba(0,0,0,0.6))" }} />
          </div>
        </div>

        {/* ══ NPC — 한원석 교수님 (Farmer Bob) — 길 위, 왼쪽 ══ */}
        <NpcSprite src={FARMER_NPC} sheetW={384} sheetH={832}
          name="한원석 교수님" hasNotif={notifs.quest}
          onClick={() => openNpc("quest","quest")}
          nameMt={-44}
          style={{ position:"absolute", left:"18%", top:"38%", zIndex:6 }} />

        {/* ══ NPC — 실습 조교님 (Chef Chloe) — 길 위, 중앙 ══ */}
        <NpcSprite src={CHEF_NPC} sheetW={64} sheetH={64} scale={1.5}
          name="포닉스" hasNotif={notifs.schedule}
          onClick={() => openNpc("schedule","schedule")}
          style={{ position:"absolute", left:"38%", top:"38%", zIndex:6 }} />

        {/* ══ 내 캐릭터 ══ */}
        <div style={{ position:"absolute", left:`${charPos.x}%`, top:`${charPos.y}%`,
                      transform:"translateX(-50%)", zIndex:9,
                      transition:"left 0.05s linear, top 0.05s linear" }}>
          <MyChar name="준식이" burningBubble={studyStats}
            dir={charDir} isWalking={isWalking} />
        </div>

        {/* ══ 포석호 (Lumberjack) — 길 위, 오른쪽 ══ */}
        <NpcSprite src={LUMBERJACK_NPC} sheetW={64} sheetH={64} scale={1.5}
          name="포석호" hasNotif={notifs.quiz}
          onClick={() => openNpc("quiz","pet")}
          bubbleOffset={-84}
          style={{ position:"absolute", left:"62%", top:"38%", zIndex:6 }} />


      </div>

      {/* 우측 하단 고정 버튼 (대시보드 + 도감) */}
      <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", gap: 10, zIndex: 100 }}>
        {/* 대시보드: UI_Icons row0 col5 (파란 번개/에너지) */}
        <FixedBtn icon={{ sx: 80, sy: 16 }} label="대시보드" onClick={() => navigate("/dashboard")} />
        {/* 도감: UI_Icons row0 col3 (별) */}
        <FixedBtn icon={{ sx: 160, sy: 16 }} label="도감" onClick={() => setPopup("inventory")} />
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

function FixedBtn({ icon, label, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
               cursor: "pointer", userSelect: "none" }}>
      <div style={{ width: 54, height: 54,
                   background: hov ? "#c89100" : "#c89100",
                   border: "3px solid #c89100",
                   borderBottom: hov ? "3px solid #c89100" : "5px solid #6b3d1f",
                   borderRadius: 10,
                   display: "flex", alignItems: "center",
                   justifyContent: "center",
                   boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                   transform: hov ? "translateY(2px)" : "none",
                   transition: "transform 0.1s, border-bottom 0.1s" }}>
        <PixelIcon sx={icon.sx} sy={icon.sy} scale={2} />
      </div>
      {label && (
        <span style={{ fontSize: 9, color: "#FFC107", fontWeight: 700,
                       textShadow: "0 1px 3px rgba(0,0,0,0.8)", whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
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
            background: "#2a1a0a", border: "2px solid #FFC107",
            borderRadius: 10, padding: "7px 12px",
            minWidth: 130, boxShadow: "0 0 12px rgba(245,197,24,0.25)",
          }}>
            <div style={{ fontSize: 10, color: "#FFC107", fontWeight: 800,
                          marginBottom: 5, letterSpacing: 0.5 }}>
              🔥 Burning Time
            </div>
            <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "center", marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: "#aaa" }}>공부시간</span>
              {/* 🔌 TODO: studyTime ← GET /api/user/today-stats */}
              <span style={{ fontSize: 12, color: "#FFC107", fontWeight: 700,
                             fontFamily: "monospace" }}>
                {burningBubble.studyTime}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "#aaa" }}>집중시간</span>
              {/* 🔌 TODO: focusTime ← GET /api/user/today-stats */}
              <span style={{ fontSize: 12, color: "#FFC107", fontWeight: 700,
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
                        borderTop: "8px solid #FFC107" }} />
        </div>
      )}

      {/* 알림 말풍선 (NPC 전용) */}
      {hasNotif && (
        <div style={{ marginBottom: 3, position: "relative" }}>
          <div style={{ background: "#FFFDD0", border: "2px solid #2a1a0a", borderRadius: 8,
                        padding: "1px 9px", fontSize: 14, fontWeight: 900,
                        color: "#c42f1c", lineHeight: 1.4 }}>!</div>
          <div style={{ position: "absolute", bottom: -6, left: "50%",
                        transform: "translateX(-50%)", width: 0, height: 0,
                        borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
                        borderTop: "6px solid #2a1a0a" }} />
        </div>
      )}

      {/* 이름 태그 */}
      <div style={{
        background: isMe ? "#FFC107" : "rgba(0,0,0,0.78)",
        color: isMe ? "#2a1a0a" : "#FFFDD0",
        fontSize: tagSize, fontWeight: 700, padding: "2px 9px", borderRadius: 10, marginBottom: 5,
        border: `1px solid ${isMe ? "#c89100" : "#6b3d1f"}`, whiteSpace: "nowrap",
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
          onMouseEnter={e => { e.currentTarget.style.background="#e8c550"; e.currentTarget.style.borderColor="#c89100" }}
          onMouseLeave={e => { e.currentTarget.style.background="#FFFDD0"; e.currentTarget.style.borderColor="#F9E076" }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                   padding: "11px 12px", marginBottom: 7, background: "#FFFDD0",
                   borderRadius: 8, cursor: "pointer", border: "2px solid #F9E076",
                   transition: "all 0.15s" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2a1a0a" }}>{q.title}</div>
            <div style={{ fontSize: 10, color: "#c89100", marginTop: 2 }}>{q.npc.emoji} {q.npc.name}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, fontWeight: 700,
                           background: q.status === "완료" ? "#fff4a0" : "#fff4a0",
                           color: q.status === "완료" ? "#895129" : "#6b3d1f",
                           border: q.status === "완료" ? "1px solid #F9E076" : "1px solid #c89100" }}>
              {q.status}
            </span>
            <span style={{ fontSize: 10, color: "#a86838" }}>
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
                    marginBottom: 16, paddingBottom: 14, borderBottom: "2px solid #F9E076" }}>
        <div style={{ width: 60, height: 60, background: "#fff4a0", borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 34, border: "3px solid #c89100", flexShrink: 0 }}>
          {quest.npc.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "#c89100", marginBottom: 2 }}>퀘스트 의뢰인</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#2a1a0a" }}>{quest.npc.name}</div>
        </div>
        <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, fontWeight: 700,
                       background: quest.status === "완료" ? "#fff4a0" : "#fff4a0",
                       color: quest.status === "완료" ? "#895129" : "#6b3d1f",
                       border: quest.status === "완료" ? "2px solid #F9E076" : "2px solid #c89100" }}>
          {quest.status}
        </span>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#2a1a0a", lineHeight: 1.75, marginBottom: 14,
                      background: "#FFFDD0", borderRadius: 8, padding: 12,
                      border: "1px solid #F9E076" }}>{quest.desc}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11,
                      color: "#c89100", marginBottom: 6 }}>
          <span>진행률</span>
          <span>{quest.progress.current} / {quest.progress.total} {quest.progress.unit}</span>
        </div>
        <div style={{ height: 14, background: "#F9E076", borderRadius: 7,
                      overflow: "hidden", border: "2px solid #c89100" }}>
          <div style={{ width: pct + "%", height: "100%", borderRadius: 5,
                        background: quest.status === "완료"
                          ? "linear-gradient(90deg,#F9E076,#c89100)"
                          : "linear-gradient(90deg,#FFC107,#c89100)",
                        transition: "width 0.6s ease" }} />
        </div>
        <div style={{ fontSize: 10, color: "#c89100", marginTop: 4, textAlign: "right" }}>{pct}% 달성</div>
      </div>
      <div style={{ background: "#fff4a0", borderRadius: 10, padding: 12,
                    marginBottom: 16, border: "2px solid #c89100" }}>
        <div style={{ fontSize: 11, color: "#6b3d1f", fontWeight: 700, marginBottom: 8 }}>🎁 보상</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {quest.rewards.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6,
                                   background: "#FFFDD0", padding: "8px 12px",
                                   borderRadius: 8, border: "2px solid #F9E076" }}>
              <span style={{ fontSize: 20 }}>{r.emoji}</span>
              <div>
                <div style={{ fontSize: 10, color: "#c89100" }}>{r.type}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#c89100" }}>+{r.amount}</div>
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
                               background: "#FFFDD0", borderRadius: 8,
                               border: "2px solid #F9E076" }}>
          <span style={{ color: "#c89100", fontWeight: 700, minWidth: 52 }}>{s.time}</span>
          <span style={{ flex: 1, marginLeft: 12, color: "#2a1a0a", fontWeight: 600 }}>{s.subject}</span>
          <button
            onClick={() => { onClose(); navigate("/lecture") }}
            style={{ color: "#c89100", cursor: "pointer", fontSize: 12,
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

const LLM_BASE = "http://localhost:8001"

function PetPopup({ onClose, reviewQueue = [] }) {
  // 재출제 관련 state
  const [retryQueue,   setRetryQueue]   = useState([])
  const [retryIdx,     setRetryIdx]     = useState(0)
  const [retryDone,    setRetryDone]    = useState(false)
  const [retryLoading, setRetryLoading] = useState(true)

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

  // 재출제 대상 로드 (70점 이하)
  useEffect(() => {
    fetch(`${BASE}/quiz/scores/retry?threshold=70`, {
      headers: { "X-User-Id": "1" }
    })
      .then(r => r.json())
      .then(data => { setRetryQueue(Array.isArray(data) ? data : []); setRetryLoading(false) })
      .catch(() => setRetryLoading(false))
  }, [])

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

  // 재출제 퀴즈 답변 (LLM 연결)
  async function sendRetryAnswer() {
    if (!input.trim() || loading) return
    const txt = input.trim(); setInput("")
    setMessages(prev => [...prev, { type:"user", text:txt }]); setLoading(true)
    try {
      const res = await fetch(`${LLM_BASE}/api/chat`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ message: txt }),
      })
      const data = await res.json()
      if (data.is_reask) {
        setMessages(prev => [...prev, { type:"system", text:"🔁 이전에 이해도가 낮았던 내용을 다시 질문할게요" }])
      }
      const reply = (data.reply ?? "").replace(/\s*\[/g, "\n[")
      setMessages(prev => [...prev, { type:"npc", text: reply }])
      if (data.score_data) {
        const sd = data.score_data
        setMessages(prev => [...prev, {
          type:"score", total:sd.total, concept:sd.concept,
          accuracy:sd.accuracy, detail:sd.detail,
          matched:sd.matched_keywords??[], missing:sd.missing_keywords??[],
          match:sd.match??"", comment:sd.comment??"",
        }])
        // 백엔드 저장
        fetch(`${BASE}/quiz/score`, {
          method:"POST", headers:{ "Content-Type":"application/json", "X-User-Id":"1" },
          body: JSON.stringify({
            lecture_title: retryQueue[retryIdx]?.lecture_title ?? "재출제",
            total: sd.total, concept: sd.concept, accuracy: sd.accuracy,
            detail: sd.detail, similarity: sd.similarity??0,
            matched_keywords: sd.matched_keywords??[],
            missing_keywords: sd.missing_keywords??[],
            match_result: sd.match??"", comment: sd.comment??"",
          }),
        }).catch(() => {})
      }
      if (data.is_finished) {
        const next = retryIdx + 1
        if (next >= retryQueue.length) {
          setTimeout(() => setRetryDone(true), 600)
        } else {
          setRetryIdx(next)
          // 다음 재출제 문항 시작
          setTimeout(async () => {
            try {
              const item = retryQueue[next]
              const retryPrompt = item.retry_level === "hard"
                ? `아까 못 맞춘 [${item.lecture_title}] 내용이에요. 다시 한번 확인해볼게요!`
                : `[${item.lecture_title}] 관련 내용을 조금 더 연습해봐요 😊`
              const r2 = await fetch(`${LLM_BASE}/api/chat`, {
                method:"POST", headers:{"Content-Type":"application/json"},
                body: JSON.stringify({ message: retryPrompt }),
              })
              const d2 = await r2.json()
              setMessages(prev => [...prev, { type:"npc",
                text:(d2.reply??"다음 문제예요!").replace(/\s*\[/g,"\n[") }])
            } catch { setMessages(prev => [...prev, { type:"npc", text:"다음 재출제 문제예요!" }]) }
            setLoading(false); setTimeout(() => chatRef.current?.scrollTo(0,9999), 50)
          }, 600)
          return
        }
      }
    } catch {
      setMessages(prev => [...prev, { type:"npc", text:"(연결 오류) LLM 서버를 확인해주세요." }])
    } finally { setLoading(false); setTimeout(() => chatRef.current?.scrollTo(0,9999), 50) }
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
        <div style={{ marginBottom: 10, background: "#fff4a0", border: "2px solid #c89100",
                      borderRadius: 6, padding: "4px 12px", fontSize: 10,
                      color: "#6b3d1f", fontWeight: 700, display: "inline-block" }}>
          📝 복습 대기 {reviewQueue.length}개
        </div>
      )}

      {/* 모드 탭 */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        <button style={{
          flex:1, padding:"7px 0", fontSize:12, fontWeight:700, cursor:"pointer",
          background: mode==="question" ? "#c89100" : "#F9E076",
          color: mode==="question" ? "#FFFDD0" : "#c89100",
          border: mode==="question" ? "2px solid #c89100" : "2px solid #F9E076",
          borderBottom: mode==="question" ? "3px solid #c89100" : "2px solid #F9E076",
          borderRadius:6,
        }} onClick={() => setMode("question")}>
          ❓ 질문하기
        </button>
        {reviewQueue.length > 0 && (
          <button style={{
            flex:1, padding:"7px 0", fontSize:12, fontWeight:700, cursor:"pointer",
            background: mode==="review" ? "#c89100" : "#F9E076",
            color: mode==="review" ? "#FFFDD0" : "#c89100",
            border: mode==="review" ? "2px solid #c89100" : "2px solid #F9E076",
            borderBottom: mode==="review" ? "3px solid #c89100" : "2px solid #F9E076",
            borderRadius:6,
          }} onClick={() => setMode("review")}>
            📝 복습 ({reviewQueue.length})
          </button>
        )}
        {!retryLoading && retryQueue.length > 0 && (
          <button style={{
            flex:1, padding:"7px 0", fontSize:12, fontWeight:700, cursor:"pointer",
            background: mode==="retry" ? "#c42f1c" : "#fff0f0",
            color: mode==="retry" ? "#FFFDD0" : "#9c1c0b",
            border: mode==="retry" ? "2px solid #9c1c0b" : "2px solid #F9E076",
            borderBottom: mode==="retry" ? "3px solid #2a1a0a" : "2px solid #F9E076",
            borderRadius:6,
          }} onClick={() => {
            setMode("retry")
            // 재출제 LLM 세션 시작
            const item = retryQueue[0]
            if (item && messages.length <= 1) {
              setLoading(true)
              const levelMsg = item.retry_level === "hard" ? "많이 어려웠던" : item.retry_level === "medium" ? "조금 헷갈렸던" : "거의 다 알았던"
              fetch(`${LLM_BASE}/api/chat`, {
                method:"POST", headers:{"Content-Type":"application/json"},
                body: JSON.stringify({
                  lecture_filename: item.lecture_title.includes("생명") ? "bio_1.json"
                                  : item.lecture_title.includes("지구") ? "ear_1.json" : "bio_1.json",
                  subject: item.lecture_title,
                  focus_timestamps: [],
                }),
              })
              .then(r => r.json())
              .then(d => {
                setMessages([{
                  type:"npc",
                  text:`${levelMsg} [${item.lecture_title}] 내용을 다시 복습해봐요! 점수: ${item.total}점 → 목표: 70점↑\n\n` +
                       (d.reply??"").replace(/\s*\[/g,"\n[")
                }])
              })
              .catch(() => setMessages([{ type:"npc", text:`[${item.lecture_title}] 내용 복습 시작해봐요!` }]))
              .finally(() => setLoading(false))
            }
          }}>
            🔥 재출제 ({retryQueue.length})
          </button>
        )}
      </div>

      {/* 복습 모드 — 현재 문제 카드 */}
      {mode === "review" && !reviewDone && reviewQueue[current] && (
        <div style={{ background:"#fff4a0", borderRadius:8, padding:"10px 14px",
                      marginBottom:12, border:"2px solid #c89100" }}>
          <div style={{ fontSize:10, color:"#6b3d1f", marginBottom:4, fontWeight:700 }}>
            [{reviewQueue[current].subject}] — {current+1}/{reviewQueue.length}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:"#2a1a0a" }}>{reviewQueue[current].question}</div>
        </div>
      )}

      {/* 재출제 현재 문제 카드 */}
      {mode === "retry" && !retryDone && retryQueue[retryIdx] && (
        <div style={{ marginBottom:10, background:"#fff0f0", border:"2px solid #c42f1c",
                      borderRadius:6, padding:"8px 12px", fontSize:11 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ color:"#9c1c0b", fontWeight:700 }}>
              🔥 재출제 {retryIdx+1}/{retryQueue.length}
            </span>
            <span style={{
              fontSize:10, fontWeight:700, borderRadius:4, padding:"1px 7px",
              background: retryQueue[retryIdx].retry_level==="hard" ? "#c42f1c"
                        : retryQueue[retryIdx].retry_level==="medium" ? "#895129" : "#c89100",
              color:"#FFFDD0",
            }}>
              {retryQueue[retryIdx].retry_level==="hard" ? "재학습" : retryQueue[retryIdx].retry_level==="medium" ? "부분보완" : "마무리"}
            </span>
          </div>
          <div style={{ fontSize:12, color:"#2a1a0a" }}>{retryQueue[retryIdx].lecture_title}</div>
          <div style={{ fontSize:11, color:"#9c1c0b", marginTop:4 }}>
            이전 점수: <strong>{retryQueue[retryIdx].total}점</strong>
            {retryQueue[retryIdx].missing?.length > 0 && (
              <span style={{ marginLeft:8, fontSize:10 }}>
                부족 키워드: {retryQueue[retryIdx].missing_keywords?.slice(0,3).join(", ")}
              </span>
            )}
          </div>
        </div>
      )}
      {mode === "retry" && retryDone && (
        <div style={{ textAlign:"center", padding:"12px 0", marginBottom:10 }}>
          <div style={{ fontSize:28, marginBottom:6 }}>🎉</div>
          <div style={{ fontSize:13, fontWeight:700, color:"#2a1a0a" }}>재출제 완료!</div>
          <div style={{ fontSize:11, color:"#c89100" }}>모든 취약 항목을 복습했어요.</div>
        </div>
      )}

      {/* 복습 완료 */}
      {mode === "review" && reviewDone && (
        <div style={{ textAlign:"center", padding:"16px 0", marginBottom:12 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
          <div style={{ fontSize:14, fontWeight:700, color:"#2a1a0a", marginBottom:4 }}>복습 완료!</div>
          <div style={{ fontSize:11, color:"#c89100" }}>미뤄둔 퀴즈를 모두 풀었어요.</div>
        </div>
      )}

      {/* 채팅 영역 */}
      <div style={{ borderTop:"2px solid #F9E076", paddingTop:12 }}>
        <div ref={chatRef}
          style={{ height: mode === "review" ? 160 : 220, overflowY:"auto", display:"flex",
                   flexDirection:"column", gap:6, marginBottom:10 }}>
          {messages.map((m,i) => (
            <div key={i} style={{ display:"flex",
                                   justifyContent: m.type==="user" ? "flex-end"
                                                 : m.type==="system"||m.type==="score" ? "center"
                                                 : "flex-start",
                                   alignItems:"flex-end", gap:4 }}>
              {m.type==="npc" && <span style={{ fontSize:14, flexShrink:0 }}>🐻‍❄️</span>}
              {m.type==="system" && (
                <div style={{ fontSize:10, color:"#6b3d1f", background:"#F9E076",
                              border:"1px solid #c89100", borderRadius:6, padding:"3px 10px" }}>{m.text}</div>
              )}
              {m.type==="score" && (
                <div style={{ width:"90%", background:"#FFFDD0", border:"2px solid #c89100",
                              borderRadius:8, padding:"8px 10px", fontSize:11 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontWeight:700, color:"#6b3d1f" }}>📊 이해도</span>
                    <span style={{ fontSize:16, fontWeight:700,
                                   color: m.total>=70?"#895129":m.total>=40?"#895129":"#c42f1c" }}>
                      {m.total}점
                    </span>
                    <span style={{ fontSize:9, fontWeight:700, borderRadius:8, padding:"1px 6px",
                                   background: m.match==="일치"?"#fff4a0":m.match==="부분일치"?"#F9E076":"#fff0f0",
                                   color: m.match==="일치"?"#895129":m.match==="부분일치"?"#895129":"#c42f1c",
                                   border:`1px solid ${m.match==="일치"?"#c89100":m.match==="부분일치"?"#c89100":"#d94040"}` }}>
                      {m.match||"채점됨"}
                    </span>
                  </div>
                  {[{label:"개념",val:m.concept,max:40},{label:"정확",val:m.accuracy,max:40},{label:"구체",val:m.detail,max:20}].map(item=>(
                    <div key={item.label} style={{ marginBottom:4 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#6b3d1f", marginBottom:1 }}>
                        <span>{item.label}</span><span>{item.val}/{item.max}</span>
                      </div>
                      <div style={{ height:3, background:"#e8c550", borderRadius:2, overflow:"hidden" }}>
                        <div style={{ width:`${(item.val/item.max)*100}%`, height:"100%", borderRadius:2,
                                      background:item.val/item.max>=0.7?"#895129":item.val/item.max>=0.4?"#c89100":"#c42f1c" }} />
                      </div>
                    </div>
                  ))}
                  {(m.matched?.length>0||m.missing?.length>0) && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:5 }}>
                      {m.matched?.slice(0,4).map(k=>(
                        <span key={k} style={{ background:"#fff4a0",color:"#895129",border:"1px solid #c89100",
                                               borderRadius:10,padding:"1px 5px",fontSize:9 }}>✓ {k}</span>
                      ))}
                      {m.missing?.slice(0,3).map(k=>(
                        <span key={k} style={{ background:"#fff0f0",color:"#c42f1c",border:"1px solid #d94040",
                                               borderRadius:10,padding:"1px 5px",fontSize:9 }}>✗ {k}</span>
                      ))}
                    </div>
                  )}
                  {m.comment && <div style={{ marginTop:5,fontSize:10,color:"#6b3d1f",borderTop:"1px solid #e8c550",paddingTop:4 }}>💬 {m.comment}</div>}
                </div>
              )}
              {(m.type==="npc"||m.type==="user") && (
                <div style={{ maxWidth:"78%", padding:"7px 11px", borderRadius:10,
                               fontSize:12, lineHeight:1.5, whiteSpace:"pre-wrap", wordBreak:"break-word",
                               background: m.type==="user" ? "#c89100" : "#FFFDD0",
                               color: m.type==="user" ? "#FFFDD0" : "#2a1a0a",
                               border: m.type==="user" ? "none" : "1px solid #F9E076" }}>
                  {m.text}
                </div>
              )}
            </div>
          ))}
          {loading && <div style={{ fontSize:11, color:"#a86838", paddingLeft:22 }}>입력 중...</div>}
        </div>

        {!(reviewDone || (mode==="retry" && retryDone)) && (
          <div style={{ display:"flex", gap:6 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && (mode==="review" ? sendReviewAnswer() : mode==="retry" ? sendRetryAnswer() : sendQuestion())}
              placeholder={mode==="review" ? "답변을 입력하세요..." : "궁금한 것을 물어보세요..."}
              disabled={loading}
              style={{ flex:1, background:"#FFFDD0", border:"2px solid #F9E076",
                       borderRadius:8, padding:"8px 12px", color:"#2a1a0a",
                       fontSize:12, outline:"none", opacity:loading?0.6:1 }} />
            <PixelBtn
              onClick={mode==="review" ? sendReviewAnswer : mode==="retry" ? sendRetryAnswer : sendQuestion}
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
    <PopupOverlay onClose={onClose} title="도감 (뱃지 모음집)" >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {BADGES.map(b => (
          <div key={b.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: 12, borderRadius: 8, textAlign: "center",
            background: b.earned ? "#FFFDD0" : "#FFFDD0",
            border: b.earned ? "3px solid #c89100" : "2px solid #F9E076",
            opacity: b.earned ? 1 : 0.5,
          }}>
            <div style={{ fontSize: 28, marginBottom: 4,
                          filter: b.earned ? "none" : "grayscale(100%)" }}>{b.emoji}</div>
            <div style={{ fontSize: 10, color: b.earned ? "#2a1a0a" : "#895129",
                          fontWeight: b.earned ? 700 : 400 }}>{b.name}</div>
            {b.earned && (
              <div style={{ fontSize: 9, color: "#c89100", marginTop: 4, fontWeight: 700,
                            background: "#fff4a0", border: "1px solid #c89100",
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
    primary:   { bg: hov ? "#a86838" : "#c89100", border: "#c89100", shadow: "#6b3d1f", text: "#FFFDD0" },
    secondary: { bg: hov ? "#F9E076" : "#F9E076", border: "#c89100", shadow: "#6b3d1f", text: "#2a1a0a" },
    danger:    { bg: hov ? "#c42f1c" : "#c42f1c", border: "#9c1c0b", shadow: "#2a1a0a", text: "#fff0f0" },
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
          background: "#F9E076",
          border: "4px solid #c89100",
          borderBottom: "6px solid #c89100",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {/* 헤더 */}
          <div style={{
            background: "linear-gradient(180deg, #F9E076 0%, #e8c550 100%)",
            borderBottom: "3px solid #c89100",
            padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
            <span style={{
              fontSize: 14, fontWeight: 700, color: "#2a1a0a",
              flex: 1, textShadow: "none",
            }}>{title}</span>
            <button onClick={onClose} style={{
              background: "#c42f1c", border: "2px solid #9c1c0b",
              borderBottom: "3px solid #9c1c0b", borderRadius: 4,
              width: 24, height: 24, color: "#F9E076",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
          {/* 본문 */}
          <div style={{
            background: "#FFFDD0",
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