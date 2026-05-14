import { Droplets, Leaf, Thermometer, AlertTriangle, Moon, Sun } from 'lucide-react'
import Mascot from '../brand/Mascot'

// Mood → Mascot state mapping'as. Mascot expresses primary emotion via posture
// (idle / wilt), badge overlay (žiūr. MOOD_BADGE) — specific signal kategorija
// (thirsty=droplet, sleeping=moon, etc.).
function moodToMascotState(mood) {
  switch (mood) {
    case 'thirsty':
    case 'sad':
    case 'sick':
    case 'quarantine': return 'wilt'    // body posture rodo, kad augalui blogai
    case 'happy':
    case 'sleeping':
    case 'waking':
    default:           return 'idle'    // alive default; happy = pasitenkina breath'u
  }
}

// ── PlantPersona ──────────────────────────────────────────────
// Kawaii potted succulent icon (matches the reference image).
// For non-happy moods a small lucide badge appears in the corner.

const MOOD_BADGE = {
  thirsty:    { Icon: Droplets,      bg: '#e0f2fe', color: '#0284c7' },  // sky
  sad:        { Icon: Leaf,          bg: '#fef3c7', color: '#d97706' },  // amber
  sick:       { Icon: Thermometer,   bg: '#fee2e2', color: '#dc2626' },  // red
  quarantine: { Icon: AlertTriangle, bg: '#fee2e2', color: '#b91c1c' },  // red dark
  sleeping:   { Icon: Moon,          bg: '#ede9fe', color: '#7c3aed' },  // violet
  waking:     { Icon: Sun,           bg: '#fef9c3', color: '#ca8a04' },  // yellow
}

export function PlantPersona({ mood = 'happy', size = 40 }) {
  const CIRCLE = '#2e7d52'   // sage-500 — matches FAB "+" button
  const STR    = '#ffffff'
  const SW     = 3.5
  const lp     = { fill: 'none', stroke: STR, strokeWidth: SW, strokeLinecap: 'round', strokeLinejoin: 'round' }

  const badge = MOOD_BADGE[mood] ?? null
  const badgeSz = Math.max(9, Math.round(size * 0.30))
  const padSz   = Math.max(3, Math.round(size * 0.09))

  return (
    <div
      className="relative inline-flex flex-shrink-0"
      style={{ width: size, height: size, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.28))' }}
    >
      <svg
        width={size}
        height={size}
        viewBox="-10 -10 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Sage circle — slightly larger than the character area */}
        <circle cx="50" cy="50" r="58" fill={CIRCLE} />

        {/* ── Leaves ── */}
        <path {...lp} d="M 50 45 Q 40 15 50 10 Q 60 15 50 45" />
        <path {...lp} d="M 45 45 Q 25 25 30 15 Q 40 30 50 40" />
        <path {...lp} d="M 35 45 Q 15 40 15 30 Q 25 40 45 42" />
        <path {...lp} d="M 55 45 Q 75 25 70 15 Q 60 30 50 40" />
        <path {...lp} d="M 65 45 Q 85 40 85 30 Q 75 40 55 42" />

        {/* ── Rim ── */}
        <rect {...lp} x="25" y="45" width="50" height="8" rx="2" />

        {/* ── Pot body ── */}
        <path {...lp} d="M 30 53 L 34 83 Q 35 88 40 88 L 60 88 Q 65 88 66 83 L 70 53 Z" />

        {/* ── Side arm decorations ── */}
        <path {...lp} d="M 29 65 Q 18 68 22 78" />
        <path {...lp} d="M 71 65 Q 82 68 78 78" />

        {/* ── Face ── */}
        <circle cx="41" cy="70" r="2.5" fill={STR} />
        <circle cx="59" cy="70" r="2.5" fill={STR} />
        <line {...lp} x1="33" y1="74" x2="37" y2="74" strokeWidth="2.5" />
        <line {...lp} x1="63" y1="74" x2="67" y2="74" strokeWidth="2.5" />
        <path {...lp} d="M 47 75 Q 50 79 53 75" strokeWidth="2" />
      </svg>

      {/* Mood badge — top-right corner */}
      {badge && (
        <div
          className="absolute flex items-center justify-center rounded-full shadow-sm"
          style={{
            top: 0,
            right: 0,
            width:  badgeSz + padSz * 2,
            height: badgeSz + padSz * 2,
            background: badge.bg,
            border: '1.5px solid white',
          }}
        >
          <badge.Icon size={badgeSz} color={badge.color} />
        </div>
      )}
    </div>
  )
}

// ── PlantAvatar ───────────────────────────────────────────────
// Animus plant mascot (per <Mascot>) + mood badge overlay.
// Mascot perteikia bendrą emotion (idle/wilt) per posture; badge overlay
// pridėjus specific signalą (droplet=thirsty, moon=sleeping, etc.).
//
// Naudojama PlantChat'e (chat avatar header'iuose + per-message ikonas)
// ir PlantDetail'e (mood indicator). Sukinti blink'ą OFF small size'uose
// (≤32px) — animacija per smulkmena chat'o tankame faile.

export function PlantAvatar({ mood = 'happy', size = 40 }) {
  const badge   = MOOD_BADGE[mood] ?? null
  const badgeSz = Math.max(8, Math.round(size * 0.30))
  const padSz   = Math.max(2, Math.round(size * 0.08))
  const blink   = size > 32  // big avatar — blink'inam, small — nereikia

  return (
    <div className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
      <Mascot type="plant" state={moodToMascotState(mood)} size={size} blink={blink} />
      {badge && (
        <div
          className="absolute flex items-center justify-center rounded-full shadow-sm"
          style={{
            top: 0, right: 0,
            width:  badgeSz + padSz * 2,
            height: badgeSz + padSz * 2,
            background: badge.bg,
            border: '1.5px solid white',
          }}
        >
          <badge.Icon size={badgeSz} color={badge.color} />
        </div>
      )}
    </div>
  )
}

// ── AIFace ────────────────────────────────────────────────────
// Kawaii gardener — straw hat, round face, simple body.
// Same sage circle + white strokes as PlantPersona.

export function AIFace({ size = 32 }) {
  const CIRCLE = '#2e7d52'
  const STR    = '#ffffff'
  const SW     = 3
  const lp     = { fill: 'none', stroke: STR, strokeWidth: SW, strokeLinecap: 'round', strokeLinejoin: 'round' }

  return (
    <div
      className="inline-flex flex-shrink-0"
      style={{ width: size, height: size, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.28))' }}
    >
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}>
        <svg width={size} height={size} viewBox="-10 -10 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Sage circle */}
          <circle cx="50" cy="50" r="58" fill={CIRCLE} />

          {/* ── Hat crown ── */}
          <path {...lp} d="M 34 47 Q 34 8 50 6 Q 66 8 66 47 Z" />

          {/* ── Hat brim ── */}
          <rect {...lp} x="13" y="44" width="74" height="8" rx="4" />

          {/* ── Small leaf on hat ── */}
          <path {...lp} strokeWidth={SW * 0.85}
            d="M 50 44 Q 43 33 40 28 Q 47 36 50 44 Z" />
          <path {...lp} strokeWidth={SW * 0.85}
            d="M 50 44 Q 57 33 60 28 Q 53 36 50 44 Z" />

          {/* ── Head ── */}
          <circle {...lp} cx="50" cy="67" r="18" />

          {/* ── Face ── */}
          <circle cx="43" cy="64" r="2.5" fill={STR} />
          <circle cx="57" cy="64" r="2.5" fill={STR} />
          <path {...lp} d="M 42 73 Q 50 79 58 73" />

          {/* ── Body / shoulders ── */}
          <path {...lp} d="M 32 85 Q 26 95 24 104" />
          <path {...lp} d="M 68 85 Q 74 95 76 104" />
          <path {...lp} d="M 32 85 Q 50 93 68 85" />
        </svg>
      </div>
    </div>
  )
}
