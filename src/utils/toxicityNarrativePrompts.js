/**
 * toxicityNarrativePrompts — shared NARRATIVE_TOOL + TRANSLATOR_SYSTEM.
 *
 * VAIDMUO: vienintelis source-of-truth toxicity narrative AI call'ui.
 * Importina'mi į:
 *   • src/utils/toxicityNarrativeGenerator.js (client, naudoja claudeCall)
 *   • api/_lib/toxicityNarrativeGenerator-server.js (server, naudoja Anthropic SDK)
 *
 * KODĖL EXTRACT'INTAS:
 * Variant B server-side save flow'o port'inant client'o `generateToxicityNarrative`
 * į server'į, abu turi naudoti TĄ PATĮ tool schema + system prompt. Kitaip
 * client/server save'ai gautų skirtingo stiliaus narrative'us tame pačiame
 * catalog'e.
 *
 * SCHEMA UPDATES (vs prev client-only versija):
 *   • detales: 3-5 → 2-3 sakiniai (user'io kalibravimas — užtenka konteksto)
 *   • PRIDĖTAS aiSupplementaryHazard field'as (Step 6a: ALWAYS null;
 *     Step 6b "versija plus" — aktyvuosis su strict whitelist + bar)
 *
 * D STRICT PRINCIPAS (užkoduotas TRANSLATOR_SYSTEM'e):
 *   • AI = vertėjas iš mūsų ASPCA/PFAF EN šaltinių į LT
 *   • AI nepilanoja iš savo training'o (Step 6a)
 *   • Step 6b atidarys gap-fill TIK hospitalizacijos lygio rizikam su evidence
 */

// ── Tool schema ────────────────────────────────────────────────

export const NARRATIVE_TOOL = {
  name: 'toxicity_narrative',
  description: 'Translate plant toxicity data from English sources into Lithuanian consumer warning label. NOT a vehicle for generative additions — translator role only.',
  input_schema: {
    type: 'object',
    properties: {
      detales: {
        type: 'string',
        description: 'Lithuanian consumer warning label, 2-3 sentences. Structure: (1) what is toxic (parts, compounds named in source); (2) what happens if exposed (symptoms from source); (3) first-aid pointer ("Pet Poison Helpline" for pets, "Apsinuodijimų kontrolės centras (8 5 236 20 52)" for humans). Warning-label tone, not medical lecture. If source data minimal — output minimal narrative.',
      },
      // FUTURE — aktivuotai Step 6b. Šiandien (6a) PRIVALOMA = null.
      aiSupplementaryHazard: {
        type: ['object', 'null'],
        description: 'STEP 6a: ALWAYS NULL. (Step 6b "versija plus" atidarys šitą field\'ą AI gap-fill\'ui — TIK kai mūsų ASPCA/PFAF tyli BET tu žinai augalą hospitalizuoja per realistinį suvartojimą. 6a metu — NULL be išimties.)',
        properties: {
          reason:   { type: 'string', description: 'LT 1-2 sakiniai: kodėl tu pildai (kas pavojus, kuo remies)' },
          severity: { type: 'string', enum: ['stiprus'] },
          evidence: { type: 'string', description: 'EN/LT — kuo remiesi (literature ref, RHS hazard advisory, clinical case)' },
          target:   { type: 'string', enum: ['zmonems', 'gyvunams', 'abiem'] },
        },
        required: ['reason', 'severity', 'evidence', 'target'],
      },
    },
    required: ['detales', 'aiSupplementaryHazard'],
  },
}

// ── System prompt — translator role + 6a explicit NULL'as ────

export const TRANSLATOR_SYSTEM = `You are a translator from English botanical/veterinary sources into Lithuanian consumer warning labels.

YOUR ROLE: STRUCTURING + TRANSLATING the source data we provide. NOT GENERATING from your training.

KEY RULES (detales field):
1. Use ONLY information present in the source text below.
2. Translate compound names, mechanism descriptions, symptoms verbatim into Lithuanian.
3. Warning-label tone — consumer protection, NOT medical instruction. Same as "CAUTION: contains lead" labels on commercial products.
4. If source mentions specific harm (death, paralysis, vomiting) — include in narrative.
5. Always end with a first-aid pointer: "Pet Poison Helpline" for pets, "Apsinuodijimų kontrolės centras (8 5 236 20 52)" for humans, "kreipkitės į veterinarą / gydytoją".
6. 2-3 sentences total. Do NOT invent compounds, doses, or effects not in source.
7. If source data is minimal — output minimal narrative. Don't pad with general botanical knowledge.

aiSupplementaryHazard field (Step 6a):
8. ALWAYS set to null. No exceptions.
9. This field is reserved for a future "versija plus" iteration. For now you are STRICTLY translator-only. Any plant where our sources are silent → leave to be handled by other system components (the structured pavojai[] backfill from our DB). Your narrative job is to translate WHAT WE PROVIDE, not to volunteer additional information.`
