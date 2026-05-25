# Sonnet PFAF v2 — Fresh translate + two-agent consensus

## Context

Tu, Sonnet, esi mūsų app'o (geliu-db, lapasid.lt) production voice'as.
Pirmas mėginimas (Opus translate → tavo refine pass) sukūrė BANDAGE STACK'Ą:
cumulative drift, severity over-dramatization (Aconitum „mirtinai pavojingas
— net pirštais palietus..."), grammar glitches outliers (Sansevieria
„laikomas labai toksiškais"), length inconsistency.

User pasakė: **NE bandage approach. Restart nuo nulio.**

V2 yra **fresh EN → LT translate** per tave su explicit style guidelines +
**two-agent consensus** (translator + verifier per chunk).

## User style guidelines (PRIVALOMA laikytis)

### 1. TRUMPUMAS (KRITISKAI)
- Default: **1-2 sakiniai**
- Rich content (EN > 300 chars): max **3 sakiniai** — tik jei būtina
- NIEKADA 4+ sakinių wall'o, jokios verbose elaboration
- Kiekvienas sakinys PRIVALOMAS turėti unique info — nepasikartoti
- ✅ „Visas augalas labai toksiškas. Vienas lapas vaikui gali būti mirtinas."
- ❌ „Augalas turi įvairių junginių. Visos dalys nuodingos. Net mažas
   kiekis pavojingas. Vaikams ypač rizikinga..." (4 sakiniai = trim į 1-2)

### 2. SEVERITY KALIBRACIJA (proportional, ne theatrical)
- Baseline: „nuodingas" / „toksiškas"
- Aukštesnis: „labai toksiškas" / „stiprus pavojus"
- Lethal: „net mažais kiekiais gali būti mirtinas"
- ❌ NIEKADA „MIRTINAS UŽMUŠ MIRSI" theatrical drama
- ❌ NIEKADA „net pirštais palietus, kai kuriems žmonėms ima tirpti oda"
   tone (overstated kai realybėje mažas tirpimas)
- ✅ TIESI: „Vienas lapas vaikui gali būti mirtinas." (žodis „mirtinas"
   leistinas KAI lethal in realistic dose)

### 3. TIESI KALBA
- ✅ „Vienas lapas vaikui pavojingas"
- ❌ „Net vienas lapas gali sukelti tragišką pabaigą"
- Action verbs over hedged advice
- Concrete numbers/parts (lapai/sėklos/sultys) kai žinomi

### 4. KAI NEPAVOJINGAS — pasakyti TIESIAI
- ✅ „Saugu. Saponinai praktiškai neįsisavinami." (jeigu PFAF taip teigia)
- ❌ „Saponinai, nors nuodingi, žmogaus žarnyne prastai įsisavinami, todėl
   dauguma jų pereina be žalos..." (defensive over-explanation)

### 5. PET/HUMAN SPLIT
Kai dual-context (Aloe, Lilium, Tradescantia):
- Clear split: „Šunims, katėms toksiška. Žmonėms vaistinė nauda — gel'is
   nudegimams." (du sakiniai, du auditorijos)
- NE smush'inti į vieną long sakinį su contradictions

### 6. FACT FIDELITY (privaloma)
- Visi compound names: glikozid, saponin, alkaloid, oksalat, taninas, cianid,
  antrachinon, etc. — IŠLAIKYTI iš EN
- Severity intensity preserved (highly toxic → labai toksiškas)
- Targets preserved (cats → katėms, children → vaikams)
- Mechanisms preserved (skin contact, ingestion, etc.)

### 7. STRIP MARKERS
Visi `[NNN]`, `[1, 238]`, `[K]` reference markers iš source — pašalinti.
NIEKADA palikti EN markers LT output'e.

### 8. NO PFAF DISCLAIMER
NIEKADA pridėti „Plants For A Future can not take responsibility..." prefix.

## Workflow — TWO-AGENT CONSENSUS

### Setup (orchestrator runs)

```bash
node scripts/translate-pfaf-v2.mjs --identify
```

Generuoja ~32 chunks (~30 entries each) į `data/pfaf-v2-chunks/chunk-001.json`.
Each chunk: `{ entries: [{ latin, knownHazards (EN) }] }` — NO existing LT
contamination, fresh slate.

### Phase 1 — Translator agents (5 paraleliai per turn)

Per chunk spawn agent with prompt:

```
INPUT: ~/lapasid/data/pfaf-v2-chunks/chunk-NNN.json
OUTPUT: ~/lapasid/data/pfaf-v2-chunks/chunk-NNN-translated.json

TASK: Translate each entry's knownHazards (EN) → knownHazardsLtV2 (LT).

═══ STYLE GUIDELINES (PRIVALOMA) ═══
[insert all 8 guidelines from above]

═══ CHAIN OF THOUGHT (per entry, internal) ═══
1. Read EN
2. Identify: compound names, severity level, targets, mechanism
3. Calibrate severity: is this baseline / high / lethal?
4. Length: how many sentences fit content?
5. Draft LT translation
6. Self-check: facts preserved? severity proportional? tone calibrated?
7. Output final knownHazardsLtV2

═══ OUTPUT SCHEMA ═══
{
  chunkIndex,
  totalChunks,
  entries: [{ latin, knownHazards, knownHazardsLtV2 }]
}

NE PALEISK apply — paliek orchestrator'iui po verifier pass.
```

### Phase 2 — Verifier agents (5 paraleliai per turn)

Per chunk-NNN-translated.json spawn verifier with prompt:

```
INPUT: ~/lapasid/data/pfaf-v2-chunks/chunk-NNN-translated.json
OUTPUT: ~/lapasid/data/pfaf-v2-chunks/chunk-NNN-verified.json

TASK: Verify each entry's knownHazardsLtV2 against knownHazards (EN source).

═══ VERIFICATION CHECKLIST (per entry) ═══

1. FACT FIDELITY:
   - All compound names preserved? (glikozid/saponin/alkaloid/oksalat/etc.)
   - Severity intensity matches EN? (highly toxic → labai toksiškas, ne tik
     „toksiškas"; mild → silpnas, ne „labai")
   - Targets preserved? (cats/dogs/horses → katėms/šunims/žirgams)
   - Mechanisms preserved? (skin contact → odos kontaktas/palietus;
     ingestion → nurijus/suvalgius)
   - Numerical thresholds preserved? (one seed → viena sėkla, large doses
     → dideliais kiekiais)

2. STYLE COMPLIANCE:
   - Length: 1-2 sentences default, max 3 if truly rich. **4+ sentences = flag!**
   - Severity calibration: proportional or over-dramatic?
   - Tiesi kalba (no theatrical „TRAGIŠKA PABAIGA"-style)?
   - PFAF disclaimer absent?
   - Reference markers [NNN] absent?
   - LT only (no EN residue)?

3. GRAMMAR sanity:
   - Subject/verb agreement matches?
   - No mixed singular/plural?

═══ OUTPUT SCHEMA ═══
{
  chunkIndex,
  totalChunks,
  entries: [{
    latin,
    knownHazards,
    knownHazardsLtV2,
    status: 'ok' | 'flagged',
    flagReason?: string,   // if flagged: brief description
    suggestedFix?: string  // if flagged: proposed corrected LT
  }]
}

CONSERVATIVE: jei in doubt, flag. Geriau extra manual review nei silent fact loss.

NE PALEISK apply.
```

### Phase 3 — Apply

```bash
node scripts/translate-pfaf-v2.mjs --apply-all
```

Replaces `knownHazardsLt` su `knownHazardsLtV2` kuriose `status: 'ok'`.
Flagged entries — keep current `knownHazardsLt` as fallback, log for
manual review.

### Phase 4 — Manual review (jei flagged > 0)

Orchestrator reviews flagged entries, applies `suggestedFix` jei valid,
or manual edit.

## Commit

Po visi chunks done + apply'inta:

```bash
git add data/pfaf.json data/pfaf-v2-chunks/
git commit -m "data(pfaf): v2 fresh translate + two-agent consensus (N/942 applied)"
git push origin main
```

## Cleanup (po success)

Old refine chunks `data/pfaf-refine-chunks/` paliekam as historical reference.
Mūsų `_lthazardsRefined` flag'as paliekamas ant v2-flagged entries (= still Sonnet refined output kept as fallback).

## Expected timing

- Identify: ~5s
- Phase 1 (translator): 32 chunks × ~3-4min × 5 paraleliai = ~25min
- Phase 2 (verifier): same = ~25min
- Apply: ~10s
- Manual review (jei flagged): variable
- **Total: ~55-60min** Sonnet session

## Cost

$0 (per max plan).
