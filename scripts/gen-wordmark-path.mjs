// Offline gen: „LapasID.lt" → SVG vektorinis path (font-independent).
// Serverless (Vercel Linux) NETURI Arial/Helvetica → <text> renderina tofu.
// Path'as renderinasi vienodai bet kur be jokio šrifto runtime.
//   node scripts/gen-wordmark-path.mjs
import opentype from 'opentype.js'
import { readFileSync } from 'node:fs'

const FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
const TEXT = 'LapasID.lt'
const SIZE = 100   // em — runtime scale = fs/100

const font = opentype.parse(readFileSync(FONT).buffer)
const path = font.getPath(TEXT, 0, 0, SIZE)       // baseline y=0
const d = path.toPathData(2)
const adv = font.getAdvanceWidth(TEXT, SIZE)
const bb = path.getBoundingBox()

console.log('export const WORDMARK = {')
console.log(`  text: ${JSON.stringify(TEXT)},`)
console.log(`  size: ${SIZE},`)
console.log(`  adv: ${adv.toFixed(2)},`)
console.log(`  y1: ${bb.y1.toFixed(2)}, y2: ${bb.y2.toFixed(2)},`)
console.log(`  d: ${JSON.stringify(d)},`)
console.log('}')
