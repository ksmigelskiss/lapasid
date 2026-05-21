// Test RAG context builder for AI Phase 2

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataPath = (file) => join(__dirname, '..', 'data', file)

globalThis.fetch = async (url) => {
  const path = url instanceof URL ? url.pathname : url.replace(/^file:\/\//, '')
  return { ok: true, json: async () => JSON.parse(readFileSync(path, 'utf-8')) }
}

const { buildPlantRagContext, buildSlimRagContext } = await import('../src/utils/buildPlantRagContext.js')

console.log('=== RAG CONTEXT TEST ===\n')

const tests = [
  'Monstera deliciosa',  // popular houseplant — Cheng + PFAF + ASPCA
  'Pilea peperomioides', // Cheng favorite
  'Aloe vera',           // ASPCA + PFAF rich
  'Convallaria majalis', // toxic native — wikipedia LT good
]

for (const latin of tests) {
  const result = await buildPlantRagContext(latin)
  console.log(`\n${'='.repeat(70)}\n${latin}\n${'='.repeat(70)}`)
  console.log('Sources used:', result.sources)
  console.log('Confidence:', result.confidence)
  console.log('Flags:', {
    hasIdentity: result.hasIdentityData,
    hasLt: result.hasLtName,
    hasTox: result.hasToxicity,
    hasCare: result.hasCare,
    hasCheng: result.hasCheng,
  })
  console.log('Context length:', result.context.length, 'chars')
  console.log('Token estimate:', Math.round(result.context.length / 4), 'tokens')
  console.log('\n--- Context preview (first 1500 chars) ---')
  console.log(result.context.slice(0, 1500))
  console.log('...')
}

console.log('\n\n=== SLIM CONTEXT (for Stage 1) ===')
for (const latin of tests) {
  console.log('\n' + latin + ':')
  console.log(await buildSlimRagContext(latin))
}
