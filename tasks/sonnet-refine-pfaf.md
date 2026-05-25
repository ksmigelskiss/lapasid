# Sonnet refinement task — PFAF knownHazardsLt natural voice pass

## Context (kuo tu, Sonnet, busi naudingas)

Šis lapas augalų app'as `geliu-db` (production lapasid.lt) — LT kalbos PWA, augalų care + toxicity info. Visi Phase 2 narrative'us tu (Sonnet) generuoji produkcijoje (`claude-sonnet-4-6`). T.y. tu IR ESI app'o voice'as.

BET: pre-DB cache layer (PFAF toxicity text) — buvo translate'inta Opus modeliu vakar (2026-05-25). Opus translations yra **fact-accurate** (visi compound names, severity, mechanisms preserved), BET stilistiškai labiau **academic** nei tavo (Sonnet) production voice. Per pre-save view'ą user'is mato Opus voice. Per Phase 2 post-save view'ą — tavo voice. **Du voice'us per pipeline = inconsistent.**

Tavo užduotis: **perfrazuoti EXISTING LT translations į natūralesnį voice'ą BE faktų pakeitimo.** Plačiai 986 entries. Naudoji tą patį batch agent approach, kuriuo Opus vakar dirbo (5 paralleliai per turn, 20 chunks).

## Step 1 — paruošti refine chunks

```bash
node scripts/refine-pfaf-hazards.mjs --identify
```

Tas sugeneruos `data/pfaf-refine-chunks/chunk-001.json` ... `chunk-020.json`. Kiekvieno schema:

```json
{
  "chunkIndex": 1,
  "totalChunks": 20,
  "entries": [
    {
      "latin": "Aconitum",
      "knownHazards": "EN source for fact reference",
      "knownHazardsLt": "Current Opus LT translation (refine this)"
    }
  ]
}
```

## Step 2 — spawn agents per chunk (5 paraleliai per turn)

Per kiekvienam agent'ui (chunk):

### Agent prompt template

```
INPUT: ~/lapasid/data/pfaf-refine-chunks/chunk-NNN.json
OUTPUT: ~/lapasid/data/pfaf-refine-chunks/chunk-NNN-refined.json

TASK: Refine each entry's `knownHazardsLt` field for natural voice.
Add new field `knownHazardsLtRefined` per entry (DON'T modify original).

Output schema:
{ chunkIndex, totalChunks, entries: [{ latin, knownHazards, knownHazardsLt, knownHazardsLtRefined }] }

═══ CRITICAL RULES (read every entry) ═══

Tu esi LT botanikos teksto REDAKTORIUS, NE kūrėjas. Tavo job:
perfrazuoti EXISTING LT translations į natūralesnį voice'ą BE FAKTŲ PAKEITIMO.

1. ✓ KEEP visus faktus iš input knownHazardsLt:
   - Junginiai (glikozidai, saponinai, alkaloidai, oksalatai, taninai etc.)
   - Severity intensity („labai toksiškas", „itin nemalonus", „mirtinas")
   - Targets (gyvūnams / žmonėms / katėms / šunims)
   - Mechanisms (kontaktas su oda, nurijus, dermatitas)
   - Symptoms (vėmimas, tirpimas, paralyžius)
   - Numerical thresholds (5-10g, 2-3 sėklos)

2. ✗ NEPRIDEKI naujų faktų — net jei „manai žinai" daugiau.
   Tu PERFRAZUOJI, ne creator. Jokių „cita..." ar „literatūroje minima...".

3. ✗ NEPRALEISK source detalių. Compound names + severity + mechanisms
   PRIVALOMA likti.

4. ✗ NETRADUOK EN → LT. Tas jau padaryta. Tu TIK PERFRAZUOJI LT → LT
   tobulesnis LT.

5. ✗ JEI input yra short („Pavojų nežinoma") — tas reiškia trivial,
   NEPRIDĖTI fakto. Return „Pavojų nežinoma" toliau.

═══ STYLE — voice persona „Sodininkas" ═══

Tu pats žinai šitą iš production'os. Kompaktiškai:

- Talk WITH user (ne AT)
- Action verbs, ne hedged advice
- Concrete specificity (skaičiai, location, konkretūs simptomai)
- Warmth without baby-talk
- LT botanikos terminai be jargon overload
- NO English inserts, NO anglicisms
- NO marketing buzzwords

═══ PAVYZDYS REFINEMENT ═══

INPUT knownHazardsLt:
"Visas augalas labai toksiškas — net paprastas kontaktas su oda
kai kuriems žmonėms sukelia tirpimą."

EN reference:
"The whole plant is highly toxic - simple skin contact has caused
numbness in some people[1]."

REFINED (Sonnet voice):
"Augalas mirtinai pavojingas — net pirštais palietus, kai kuriems
žmonėms ima tirpti oda."

(Notice: facts preserved — toxic, skin contact, numbness, some people.
Voice — more direct, „pirštais palietus" instead of formal „kontaktas
su oda", more natural „ima tirpti" instead of „sukelia tirpimą".)

═══ INSTRUKCIJOS ═══

1. Read chunk-NNN.json
2. Per kiekvienam entry:
   a. Read knownHazardsLt (current Opus)
   b. Reference knownHazards (EN source for fact check)
   c. Generate knownHazardsLtRefined — natural voice version
   d. Mental verify: all compound names + severity present?
3. Write chunk-NNN-refined.json with same structure + knownHazardsLtRefined field

NE PALEISK --apply-all — paliek orchestrator'iui po visus chunks baigti.
```

### Recommended batching

5 chunks per turn paraleliai per Agent tool. 4 batches (5+5+5+5) baigtų visus 20.

## Step 3 — verify + apply

Po visi 20 chunks done:

```bash
node scripts/refine-pfaf-hazards.mjs --apply-all
```

Script'as turi automatic verification:
- Length sanity (refined ≤ 1.5× original)
- Key terms preservation (glikozid, saponin, alkaloid, oksalat, etc.)
- Rejected entries — keep original Opus translation (no override)

Output: pfaf.json updated su refined entries. `_lthazardsRefined: true` marker per entry.

## Step 4 — commit + push

```bash
git add data/pfaf.json data/pfaf-refine-chunks/
git commit -m "data(pfaf): Sonnet voice refinement (986 entries)"
git push origin main
```

## Hallucination safeguards (CRITICAL)

Per agent prompts MULTIPLE TIMES we say "KEEP facts". Plus script verification
catches drops. Plus orchestrator (tu, Sonnet) gali sanity-check'inti
post-apply su sample queries.

If concerned about a specific entry — spot check po apply: lyginti
`knownHazards` (EN source), `knownHazardsLt` (still has old Opus where rejected),
`_lthazardsRefined: true` markeris.

## Expected time

- Identify: ~5s
- 20 chunks × 5 parallel agents × ~3-5min per turn = ~12-20min total
- Apply: ~10s
- Verification: automatic per script

Total ~25min Sonnet session work.

## Cost

$0 (per max plan, no Anthropic API calls).
