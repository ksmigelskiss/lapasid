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

// „LapasID.lt" kaip SVG vektorinis PATH (Arial, gen offline per
// scripts/gen-wordmark-path.mjs). KRITIŠKA: serverless Linux (Vercel) NETURI
// Arial/Helvetica → <text> renderintų tofu dėžutes (□□□). Path = grynos
// geometrijos, renderinasi vienodai bet kur be jokio šrifto runtime.
// Metrics gen'inta size=100 → runtime scale = fs/100.
const WORDMARK = {
  adv: 450.24, y2: 19.87,
  d: "M52.05 0L7.32 0L7.32-71.58L16.80-71.58L16.80-8.45L52.05-8.45L52.05 0M96.04-6.40Q91.16-2.25 86.65-0.54Q82.13 1.17 76.95 1.17Q68.41 1.17 63.82-3Q59.23-7.18 59.23-13.67Q59.23-17.48 60.96-20.63Q62.70-23.78 65.50-25.68Q68.31-27.59 71.83-28.56Q74.41-29.25 79.64-29.88Q90.28-31.15 95.31-32.91Q95.36-34.72 95.36-35.21Q95.36-40.58 92.87-42.77Q89.50-45.75 82.86-45.75Q76.66-45.75 73.71-43.58Q70.75-41.41 69.34-35.89L60.74-37.06Q61.91-42.58 64.60-45.97Q67.29-49.37 72.36-51.20Q77.44-53.03 84.13-53.03Q90.77-53.03 94.92-51.46Q99.07-49.90 101.03-47.53Q102.98-45.17 103.76-41.55Q104.20-39.31 104.20-33.45L104.20-21.73Q104.20-9.47 104.76-6.23Q105.32-2.98 106.98 0L97.80 0Q96.44-2.73 96.04-6.40M95.31-22.80L95.31-26.03Q90.53-24.07 80.96-22.71Q75.54-21.92 73.29-20.95Q71.04-19.97 69.82-18.09Q68.60-16.21 68.60-13.92Q68.60-10.40 71.26-8.06Q73.93-5.71 79.05-5.71Q84.13-5.71 88.09-7.93Q92.04-10.16 93.90-14.01Q95.31-16.99 95.31-22.80M126.61 19.87L117.82 19.87L117.82-51.86L125.83-51.86L125.83-45.12Q128.66-49.07 132.23-51.05Q135.79-53.03 140.87-53.03Q147.51-53.03 152.59-49.61Q157.67-46.19 160.25-39.97Q162.84-33.74 162.84-26.32Q162.84-18.36 159.99-11.99Q157.13-5.62 151.68-2.22Q146.24 1.17 140.23 1.17Q135.84 1.17 132.35-0.68Q128.86-2.54 126.61-5.37L126.61 19.87M125.78-25.63Q125.78-15.62 129.83-10.84Q133.89-6.05 139.65-6.05Q145.51-6.05 149.68-11.01Q153.86-15.97 153.86-26.37Q153.86-36.28 149.78-41.21Q145.70-46.14 140.04-46.14Q134.42-46.14 130.10-40.89Q125.78-35.64 125.78-25.63M207.28-6.40Q202.39-2.25 197.88-0.54Q193.36 1.17 188.18 1.17Q179.64 1.17 175.05-3Q170.46-7.18 170.46-13.67Q170.46-17.48 172.19-20.63Q173.93-23.78 176.73-25.68Q179.54-27.59 183.06-28.56Q185.64-29.25 190.87-29.88Q201.51-31.15 206.54-32.91Q206.59-34.72 206.59-35.21Q206.59-40.58 204.10-42.77Q200.73-45.75 194.09-45.75Q187.89-45.75 184.94-43.58Q181.98-41.41 180.57-35.89L171.97-37.06Q173.14-42.58 175.83-45.97Q178.52-49.37 183.59-51.20Q188.67-53.03 195.36-53.03Q202-53.03 206.15-51.46Q210.30-49.90 212.26-47.53Q214.21-45.17 214.99-41.55Q215.43-39.31 215.43-33.45L215.43-21.73Q215.43-9.47 215.99-6.23Q216.55-2.98 218.21 0L209.03 0Q207.67-2.73 207.28-6.40M206.54-22.80L206.54-26.03Q201.76-24.07 192.19-22.71Q186.77-21.92 184.52-20.95Q182.28-19.97 181.05-18.09Q179.83-16.21 179.83-13.92Q179.83-10.40 182.50-8.06Q185.16-5.71 190.28-5.71Q195.36-5.71 199.32-7.93Q203.27-10.16 205.13-14.01Q206.54-16.99 206.54-22.80M225.54-15.48L234.23-16.85Q234.96-11.62 238.31-8.84Q241.65-6.05 247.66-6.05Q253.71-6.05 256.64-8.52Q259.57-10.99 259.57-14.31Q259.57-17.29 256.98-18.99Q255.18-20.17 248-21.97Q238.33-24.41 234.59-26.20Q230.86-27.98 228.93-31.13Q227-34.28 227-38.09Q227-41.55 228.59-44.51Q230.18-47.46 232.91-49.41Q234.96-50.93 238.50-51.98Q242.04-53.03 246.09-53.03Q252.20-53.03 256.81-51.27Q261.43-49.51 263.62-46.51Q265.82-43.51 266.65-38.48L258.06-37.30Q257.47-41.31 254.66-43.55Q251.86-45.80 246.73-45.80Q240.67-45.80 238.09-43.80Q235.50-41.80 235.50-39.11Q235.50-37.40 236.57-36.04Q237.65-34.62 239.94-33.69Q241.26-33.20 247.71-31.45Q257.03-28.96 260.72-27.37Q264.40-25.78 266.50-22.75Q268.60-19.73 268.60-15.23Q268.60-10.84 266.04-6.96Q263.48-3.08 258.64-0.95Q253.81 1.17 247.71 1.17Q237.60 1.17 232.30-3.03Q227-7.23 225.54-15.48M291.26 0L281.79 0L281.79-71.58L291.26-71.58L291.26 0M333.79 0L307.96 0L307.96-71.58L332.62-71.58Q340.97-71.58 345.36-70.56Q351.51-69.14 355.86-65.43Q361.52-60.64 364.33-53.20Q367.14-45.75 367.14-36.18Q367.14-28.03 365.23-21.73Q363.33-15.43 360.35-11.30Q357.37-7.18 353.83-4.81Q350.29-2.44 345.29-1.22Q340.28 0 333.79 0M317.43-63.13L317.43-8.45L332.71-8.45Q339.79-8.45 343.82-9.77Q347.85-11.08 350.24-13.48Q353.61-16.85 355.49-22.53Q357.37-28.22 357.37-36.33Q357.37-47.56 353.69-53.59Q350-59.62 344.73-61.67Q340.92-63.13 332.47-63.13L317.43-63.13M391.55 0L381.54 0L381.54-10.01L391.55-10.01L391.55 0M415.43 0L406.64 0L406.64-71.58L415.43-71.58L415.43 0M448.24-7.86L449.51-0.10Q445.80 0.68 442.87 0.68Q438.09 0.68 435.45-0.83Q432.81-2.34 431.74-4.81Q430.66-7.28 430.66-15.19L430.66-45.02L424.22-45.02L424.22-51.86L430.66-51.86L430.66-64.70L439.40-69.97L439.40-51.86L448.24-51.86L448.24-45.02L439.40-45.02L439.40-14.70Q439.40-10.94 439.87-9.86Q440.33-8.79 441.38-8.15Q442.43-7.52 444.38-7.52Q445.85-7.52 448.24-7.86",
}

// ── 1. Vizualus „LapasID.lt" ženklas (bottom-right, subtle) ───────
// Input/Output: PNG buffer. Dydis proporcingas pločiui (3% / 3.5% pad).
export async function applyVisibleMark(pngBuf) {
  const meta = await sharp(pngBuf).metadata()
  const W = meta.width, H = meta.height
  if (!W || !H) throw new Error('watermark: invalid image dims')
  const pad = Math.round(W * 0.035)
  const fs = Math.round(W * 0.030)
  const scale = fs / 100
  const tx = (W - pad) - WORDMARK.adv * scale   // dešinė briauna prie W-pad
  const ty = (H - pad) - WORDMARK.y2 * scale     // descender dugnas prie H-pad
  const svg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(4)})">` +
    `<path d="${WORDMARK.d}" fill="${FILL}" fill-opacity="${OPACITY}" ` +
    `stroke="#ffffff" stroke-opacity="${(OPACITY * 0.85).toFixed(3)}" stroke-width="7" paint-order="stroke"/>` +
    `</g></svg>`
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
