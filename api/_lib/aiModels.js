/**
 * aiModels — VIENINTELIS šaltinis AI modelių pavadinimams (+ cache žymeklis).
 *
 * KODĖL: iki šiol `'claude-sonnet-4-6'` buvo hardcode'intas 5 vietose
 *   • api/claude.js
 *   • api/claude/stream.js
 *   • api/save-plant.js
 *   • api/_lib/toxicityNarrativeGenerator-server.js
 *   • scripts/batch-enrich-catalog.mjs
 * Modelio keitimas reikalaudavo 5 atskirų edit'ų ir rizikavo drift'u
 * (vienur pakeista, kitur ne). Dabar — viena vieta.
 *
 * MIGRACIJOS PASTABA (pilnas planas: docs/AI_REVIEW.md §3):
 *   `claude-sonnet-4-6` ($3 / $15 už 1M tok.) TEBEGALIOJA — tai NE deprecated
 *   modelis, tik karta atgal. `claude-sonnet-5-5` ($2 / $10) yra PIGESNIS IR
 *   naujesnis. BET: perėjus į sonnet-5-5 / opus-5-5, priverstinis
 *   `tool_choice: { type: 'tool', name: ... }` grąžina HTTP 400 — reikia keisti
 *   į `tool_choice: { type: 'auto' }` + `strict: true` ant tool'o. Todėl
 *   aktyvus modelis ČIA laikomas `sonnet-4-6`, kol tas pakeitimas atliktas ir
 *   patikrintas preview deploy'e. Keitimas = viena eilutė žemiau.
 */

export const CLAUDE_MODELS = {
  // Aktyvus production modelis. NEKEISTA — forced tool_choice tebeveikia.
  sonnet: 'claude-sonnet-4-6',

  // Migracijos tikslas (žr. docs/AI_REVIEW.md §3 — reikia tool_choice pakeitimo).
  sonnetNext: 'claude-sonnet-5-5',

  // Pigus modelis vertimams / chat'ui. ~30× pigesnis už sonnet-4-6
  // ($0.10 / $0.50 vs $3 / $15). Kandidatas chat + toxicity-vertimo keliui
  // (žr. docs/AI_REVIEW.md §4).
  haiku: 'claude-haiku-5-5',
}

/**
 * Vercel AI Gateway (OpenAI-suderinamas /chat/completions) modelių slug'ai.
 * Formatas: `creator/model`.
 *
 * PASENĘS: `anthropic/claude-sonnet-4.5` yra karta atgal. Rekomendacija —
 * patikrinti dabartinį slug'ą per Gateway `/v1/models` endpoint'ą ir
 * bump'inti (žr. docs/AI_REVIEW.md §3). Nekeista automatiškai, nes slug'o
 * negalima patvirtinti be gyvo Gateway rakto.
 */
export const GATEWAY_MODELS = {
  brief: 'anthropic/claude-sonnet-4.5',
  image: 'google/gemini-3-pro-image',
}

/**
 * Ephemeral prompt-cache žymeklis. Dedamas ant STABILAUS prefikso (tools +
 * sistemos prompt'as), kad pasikartojantys enrich call'ai (batch, re-enrich)
 * skaitytų bendrą prefiksą iš cache (~10× pigiau cached tokenams).
 * Žr. docs/AI_REVIEW.md §3 (caching).
 */
export const EPHEMERAL_CACHE = { type: 'ephemeral' }
