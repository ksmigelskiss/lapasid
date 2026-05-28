// POC: flood-fill bg → transparent (sharp). Iš krašto, kad augalo vidaus
// šviesių vietų neėstų. Tikrinam kokybę ant watercolor prieš integraciją.
// USAGE: node scripts/poc-transparentize.mjs
import sharp from 'sharp'

async function transparentizeBg(inPath, outPath, T = 44) {
  const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: ch } = info
  // bg referencinė spalva = 4 kampų vidurkis
  const idx = (x, y) => (y * w + x) * ch
  const cs = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]
  let br = 0, bg = 0, bb = 0
  for (const [x, y] of cs) { const i = idx(x, y); br += data[i]; bg += data[i + 1]; bb += data[i + 2] }
  br /= 4; bg /= 4; bb /= 4
  const T2 = T * T
  const close = (i) => { const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb; return dr * dr + dg * dg + db * db <= T2 }
  // flood fill iš visų kraštų (4-connected, stack)
  const visited = new Uint8Array(w * h)
  const stack = []
  for (let x = 0; x < w; x++) { stack.push(x, 0, x, h - 1) }
  for (let y = 0; y < h; y++) { stack.push(0, y, w - 1, y) }
  let cleared = 0
  while (stack.length) {
    const y = stack.pop(), x = stack.pop()
    if (x < 0 || y < 0 || x >= w || y >= h) continue
    const p = y * w + x
    if (visited[p]) continue
    const i = p * ch
    if (!close(i)) continue
    visited[p] = 1
    data[i + 3] = 0
    cleared++
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
  }
  await sharp(data, { raw: { width: w, height: h, channels: ch } }).png().toFile(outPath)
  console.log(`${outPath}: cleared ${Math.round(100 * cleared / (w * h))}% bg (T=${T})`)
}

for (const f of ['v2-monstera_deliciosa', 'cream-brighamia_insignis', 'cream-biophytum_sensitivum']) {
  await transparentizeBg(`/tmp/${f}.png`, `/tmp/tr-${f}.png`)
}
console.log('done')
