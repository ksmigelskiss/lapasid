/**
 * Generates PWA icon: 1024×1024 sage-green background,
 * centered plant_pot.png with soft drop shadow / glow.
 * Run: node scripts/generate-icon.mjs
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT  = path.resolve(__dir, '..')

const SIZE   = 1024
const BG     = { r: 116, g: 137, b: 98, alpha: 1 }  // sage-500 #748962
const PAD    = 180   // padding around the pot
const POT_W  = SIZE - PAD * 2

// 1. Resize pot image to fit, keeping aspect ratio
const pot = await sharp(`${ROOT}/public/plant_pot.png`)
  .resize(POT_W, POT_W, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer()

const { width: pw, height: ph } = await sharp(pot).metadata()

// 2. Position: horizontally centered, slightly above center (feels more natural)
const left = Math.round((SIZE - pw) / 2)
const top  = Math.round((SIZE - ph) / 2) - 20

// 3. Create glow layer — blurred white behind the pot
const glowSize = Math.round(POT_W * 0.85)
const glowLeft = Math.round((SIZE - glowSize) / 2)
const glowTop  = Math.round((SIZE - glowSize) / 2) - 20

const glow = await sharp({
  create: { width: glowSize, height: glowSize, channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 0.18 } }
}).blur(40).png().toBuffer()

// 4. Compose: bg → glow → pot
const icon = await sharp({
  create: { width: SIZE, height: SIZE, channels: 4, background: BG }
})
  .composite([
    { input: glow, left: glowLeft, top: glowTop },
    { input: pot,  left, top },
  ])
  .png()
  .toBuffer()

// 5. Save multiple sizes
const sizes = [1024, 512, 192, 180]
mkdirSync(`${ROOT}/public/icons`, { recursive: true })

for (const s of sizes) {
  await sharp(icon).resize(s, s).toFile(`${ROOT}/public/icons/icon-${s}.png`)
  console.log(`✓ icon-${s}.png`)
}

// Also overwrite main plant_pot.png used as favicon (180px)
await sharp(icon).resize(180, 180).toFile(`${ROOT}/public/apple-touch-icon.png`)
console.log('✓ apple-touch-icon.png')

console.log('\nDone! Update index.html and manifest.json.')
