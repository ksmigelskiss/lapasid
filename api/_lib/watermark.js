// Hero watermark — Data Protection Phase A.
//
// Trys sluoksniai ant katalogo watercolor hero PNG (NE ant thumb — žr. žemiau):
//   1. VIZUALUS — subtilus „LapasID.lt" tekstas bottom-right (opacity 0.30).
//      Atgraso casual copy + brandina + nemokama reklama kai dalinasi.
//   2. EXIF/XMP — © copyright metadata (best-effort, lengvai nuvalomas, bet pigus).
//   3. FORENSIC LSB — nematomas catalog ID + timestamp įmaišytas į pikselių
//      žemiausius bitus. Įrodo provenance net nukirpus matomą ženklą. Survive'ina
//      PNG re-save; NEsurvive'ina JPEG/WebP re-compress ar screenshot (žinomas
//      LSB stego limitas — Phase B/C robustesni metodai).
//
// KODĖL tik hero, ne thumb:
//   • thumb = center-cropped 1:1 WebP (lossy) → LSB sunaikinamas, o center-crop
//     nukirptų bottom-right vizualų ženklą;
//   • thumb rodomas ~150px kortelėse → vizualus ženklas būtų neįskaitomas triukšmas.
//   Pilnas hero PNG = high-res scrapinamas asset'as → jį ir saugom.
//
// Idempotent backfill'ui: embedForensic prieš rašant tikrina extractForensic.

import sharp from 'sharp'

const MAGIC = 'LPSID1'        // 6 baitai — payload signature
const FILL = '#1f3d12'        // tamsiai žalia (LapasID brand)
const OPACITY = 0.30

// ── 1. Vizualus „LapasID.lt" ženklas (bottom-right, subtle) ───────
// Input/Output: PNG buffer. Dydis proporcingas pločiui (3% / 3.5% pad).
export async function applyVisibleMark(pngBuf, { text = 'LapasID.lt' } = {}) {
  const meta = await sharp(pngBuf).metadata()
  const W = meta.width, H = meta.height
  if (!W || !H) throw new Error('watermark: invalid image dims')
  const pad = Math.round(W * 0.035)
  const fs = Math.round(W * 0.030)
  const stroke = Math.max(1, fs * 0.07)
  const svg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<text x="${W - pad}" y="${H - pad}" text-anchor="end" ` +
    `font-family="Helvetica, Arial, sans-serif" font-size="${fs}" font-weight="600" ` +
    `fill="${FILL}" fill-opacity="${OPACITY}" ` +
    `stroke="#ffffff" stroke-opacity="${OPACITY * 0.85}" stroke-width="${stroke}" paint-order="stroke">` +
    `${text}</text></svg>`
  )
  return sharp(pngBuf).ensureAlpha()
    .composite([{ input: svg, top: 0, left: 0 }])
    .png({ palette: false })
    .toBuffer()
}

// ── Payload (de)serialize: MAGIC(6) + LEN(4 BE) + JSON ────────────
function encodePayload(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8')
  const magic = Buffer.from(MAGIC, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(json.length, 0)
  return Buffer.concat([magic, len, json])
}

// Sequential LSB bit-stream iš FULLY-OPAQUE pikselių R/G/B kanalų.
// Skip'inam ne-opaque (alpha<255) — PNG encoder gali zero'inti transparent RGB,
// o vizualaus ženklo semi-transparent tekstas irgi ne-opaque → konsistencija.
function* opaqueBitWriter(data, width, height, channels) {
  for (let p = 0; p < width * height; p++) {
    const b = p * channels
    if (data[b + 3] !== 255) continue
    for (let c = 0; c < 3; c++) yield b + c   // yield baito indeksą rašymui
  }
}

// ── 2+3. Forensic LSB + EXIF ──────────────────────────────────────
export async function embedForensic(pngBuf, payloadObj, { exif = true } = {}) {
  const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const bytes = encodePayload(payloadObj)
  const totalBits = bytes.length * 8

  const writer = opaqueBitWriter(data, width, height, channels)
  let written = 0
  for (let bit = 0; bit < totalBits; bit++) {
    const nx = writer.next()
    if (nx.done) throw new Error(`watermark: insufficient opaque capacity (${written}/${totalBits} bits)`)
    const byteIdx = bit >> 3
    const bitVal = (bytes[byteIdx] >> (7 - (bit & 7))) & 1
    data[nx.value] = (data[nx.value] & 0xFE) | bitVal
    written++
  }

  const build = () => sharp(data, { raw: { width, height, channels } }).png({ palette: false })
  if (exif) {
    try {
      return await build().withMetadata({ exif: { IFD0: {
        Copyright: '(c) LapasID - lapasid.lt',
        Artist: 'LapasID',
      } } }).toBuffer()
    } catch (e) {
      console.warn('[watermark] EXIF write failed, embedding without:', e?.message)
    }
  }
  return await build().toBuffer()
}

// Skaitom payload atgal (verifikacijai / leak-check). null jei nėra/sugadintas.
export async function extractForensic(pngBuf) {
  const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const reader = opaqueBitWriter(data, info.width, info.height, info.channels)
  const readBytes = (n) => {
    const out = Buffer.alloc(n)
    for (let i = 0; i < n; i++) {
      let byte = 0
      for (let k = 0; k < 8; k++) {
        const nx = reader.next()
        if (nx.done) return null
        byte = (byte << 1) | (data[nx.value] & 1)
      }
      out[i] = byte
    }
    return out
  }
  const header = readBytes(10)
  if (!header || header.slice(0, 6).toString('ascii') !== MAGIC) return null
  const len = header.readUInt32BE(6)
  if (len <= 0 || len > 100000) return null
  const json = readBytes(len)
  if (!json) return null
  try { return JSON.parse(json.toString('utf8')) } catch { return null }
}
