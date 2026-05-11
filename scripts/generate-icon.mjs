/**
 * Generuoja PWA + iOS app icon'us iš T4Mark SVG.
 * Brand'iškai = T4Icon „antspaudas" (Bone mark on Forest square).
 *
 * Naudojama:
 *   public/icons/icon-{1024,512,192,180}.png  — PWA manifest + Android
 *   public/apple-touch-icon.png  — iOS home screen (180×180)
 *   public/favicon-{32,16}.png   — naršyklės tab favicon
 *
 * Run: node scripts/generate-icon.mjs
 */
import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT  = path.resolve(__dir, '..')

// Brandbook v1.0 paletė
const INK    = '#f1ebdd'   // Bone (PAPER) — bars + leaf color ant tamsaus fono
const PAPER  = '#1c3a2a'   // Forest (INK) — square background

const MASTER_SIZE = 1024              // master render — vėliau downsample
const MARK_RATIO  = 0.62              // T4Icon spec: mark size = container × 0.62
const MARK_SIZE   = Math.round(MASTER_SIZE * MARK_RATIO)
const MARK_OFFSET = Math.round((MASTER_SIZE - MARK_SIZE) / 2)

// T4Mark SVG (viewBox 120×120) — 11 barcode bars + 2 lapai + vena.
// Bars + leaves fill=INK, vena stroke=PAPER (counter color).
const BARS = [
  { x: 16, w: 4, h: 50 }, { x: 24, w: 2, h: 50 }, { x: 30, w: 6, h: 50 },
  { x: 40, w: 3, h: 50 }, { x: 47, w: 5, h: 50 }, { x: 56, w: 2, h: 50 },
  { x: 62, w: 4, h: 70 }, { x: 72, w: 3, h: 50 }, { x: 79, w: 6, h: 50 },
  { x: 89, w: 2, h: 50 }, { x: 95, w: 4, h: 50 },
]

const t4MarkSvg = `<svg width="${MARK_SIZE}" height="${MARK_SIZE}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  ${BARS.map(b => `<rect x="${b.x}" y="${104 - b.h}" width="${b.w}" height="${b.h}" rx="1" fill="${INK}"/>`).join('\n  ')}
  <path d="M64 30 C 62 12 80 2 106 0 C 102 20 88 32 68 34 C 66 34 64 32 64 30 Z" fill="${INK}"/>
  <path d="M62 34 C 56 32 46 32 40 36 C 44 42 54 42 60 38 Z" fill="${INK}"/>
  <path d="M66 30 Q 82 18 104 4" stroke="${PAPER}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
</svg>`

// 1 · Render T4Mark SVG → PNG buffer
const markBuffer = await sharp(Buffer.from(t4MarkSvg)).png().toBuffer()

// 2 · Kombinuojam ant Forest square (iOS prideda savo corner radius — palik square)
const iconBuffer = await sharp({
  create: {
    width: MASTER_SIZE,
    height: MASTER_SIZE,
    channels: 4,
    background: PAPER,
  }
})
  .composite([{ input: markBuffer, left: MARK_OFFSET, top: MARK_OFFSET }])
  .png()
  .toBuffer()

// 3 · Save'inam visus reikiamus dydžius
mkdirSync(`${ROOT}/public/icons`, { recursive: true })

const pwaSizes = [1024, 512, 192, 180]
for (const s of pwaSizes) {
  await sharp(iconBuffer).resize(s, s).toFile(`${ROOT}/public/icons/icon-${s}.png`)
  console.log(`✓ public/icons/icon-${s}.png`)
}

// iOS home screen (apple-touch-icon) — 180×180 standartas
await sharp(iconBuffer).resize(180, 180).toFile(`${ROOT}/public/apple-touch-icon.png`)
console.log('✓ public/apple-touch-icon.png')

// Naršyklės favicon — mažesni
await sharp(iconBuffer).resize(32, 32).toFile(`${ROOT}/public/favicon-32.png`)
console.log('✓ public/favicon-32.png')

await sharp(iconBuffer).resize(16, 16).toFile(`${ROOT}/public/favicon-16.png`)
console.log('✓ public/favicon-16.png')

console.log('\nDone! Patikrink index.html + manifest.json.')
