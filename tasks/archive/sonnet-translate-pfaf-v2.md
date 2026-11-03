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

### 2. SEVERITY KALIBRACIJA — TIK 3 LYGIAI (NE intensifiers, NE drama)

Mūsų schema turi 3 narrative severity lygius. Naudok TIK juos —
NE intermediate variants kaip „labai toksiškas" arba „šiek tiek nuodingas".

**Lygis 1: DIRGINA** (lokali reakcija, ne sisteminis pavojus)
  • EN cues: irritating, contact dermatitis, mild rash, skin irritation
  • LT: „dirgina odą" / „dirgina burną" / „gali sukelti dermatitą"
  • Tonas: informuoti, be panikos
  • ✅ „Sultys jautriems žmonėms gali sukelti dermatitą."

**Lygis 2: TOKSIŠKAS** (sisteminis pavojus, BET realiai survivable)
  • EN cues: toxic, poisonous, vomiting, nausea, gastrointestinal upset
  • LT: „toksiškas" (be intensifiers — NE „labai toksiškas")
  • Tonas: be gąsdinimu, bet user'is turi žinoti
  • ✅ „Visos augalo dalys toksiškos. Nurijus sukelia vėmimą, viduriavimą."

**Lygis 3: MIRTINAS** (lethal in realistic dose)
  • EN cues: highly toxic, lethal, fatal, deadly, death recorded,
    „one seed/leaf can kill", „fatal in small amounts"
  • LT: „mirtinas" arba „net mažais kiekiais mirtinas"
  • Tonas: be gąsdinimu, BET su konkrečiu perspėjimu — „tikrai atsargiai"
  • ✅ „Visos dalys mirtinos. Vienas lapas vaikui gali būti mirtinas."

❌ NIEKADA:
  • „labai toksiškas" (intensifier — ne mūsų taxonomy)
  • „MIRTINAS UŽMUŠ MIRSI" drama
  • „net pirštais palietus, kai kuriems žmonėms ima tirpti oda"
     (overstated kai realybėje silpnas tirpimas)
  • „tragiška pabaiga" tipo žodžiai

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

## Workflow — THREE-AGENT CONSENSUS

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

### Phase 2 — Literature editor agents (5 paraleliai per turn)

Per chunk-NNN-translated.json spawn LT literature/style editor with prompt:

```
INPUT: ~/lapasid/data/pfaf-v2-chunks/chunk-NNN-translated.json
OUTPUT: ~/lapasid/data/pfaf-v2-chunks/chunk-NNN-edited.json

TASK: Lithuanian language POLISHING — polish each entry's knownHazardsLtV2
for natural LT, fluent grammar, idiomatic phrasing. **NO content changes.**

═══ EDITOR ROLE (NE creator) ═══

Tu esi LT literature editor. Tavo darbas — sklandinti translator'iaus draft'ą
į natūralią, sklandzią lietuvių kalbą. Kaip patyręs lietuvių kalbos žurnalo
redaktorius, kuris polishuoja autoriaus rankraštį prieš spausdinimą.

═══ EDITOR CHECKLIST ═══

1. GRAMMAR AGREEMENT:
   - Subject/predicate agreement (giminė, skaičius, asmuo)
   - Pavyzdys BUG: „Augale yra glikozidų — laikomas labai toksiškais"
     („laikomas" sg.masc. + „toksiškais" pl.instr. = mismatch)
   - Fix: „Augalas turi glikozidų — labai toksiškas" (consistent singular)

2. NATURAL LT (no calques):
   - „kontaktas su oda" → „pakliuvus ant odos" arba „palietus" (more natural)
   - „turi atvejų kai..." → „pasitaiko, kai..." arba „žinoma, kad..."
   - „dažniausiai prasilenkia nekenkdami" → „nesusidaro žalos" (cleaner)

3. SENTENCE FLOW:
   - Smooth transitions, ne abrupt
   - Ar jungtukai (tačiau, todėl, dėl to) naudojami logiškai?
   - Punktuacija (kableliai, brūkšniai) — tinkama?

4. WORD ECONOMY:
   - Tautologijos (e.g. „nors nuodingi, bet prastai įsisavinami" — drop „bet")
   - Adjective redundancy
   - Implicit subjects (kai aiškūs iš konteksto, drop)

5. TONE PRESERVATION:
   - Severity level (dirgina/toksiškas/mirtinas) NEKEISTI
   - Voice persona „Sodininkas friend" — direct, warm, ne formali
   - NE dramatize'inti („tragiška pabaiga" tipas)
   - NE de-escalate'inti (jeigu translator pasakė „mirtinas", palik)

6. FACT PRESERVATION (HARD RULE):
   - Compound names — KEEP ALL (glikozid, saponin, alkaloid, etc.)
   - Severity intensity — KEEP (nedrop'inti „mirtinas" į „toksiškas")
   - Targets — KEEP (katėms, šunims, žirgams, žmonėms)
   - Mechanisms — KEEP (nurijus, palietus, etc.)
   - Numbers/parts — KEEP (vienas lapas, sėklos, sultys)

7. STYLE COMPLIANCE:
   - 1-2 sakiniai default (3 max). Jei translator'is parašė 4+, trim.
   - NIEKADA intermediate intensifiers („labai toksiškas")
   - NIEKADA theatrical drama
   - PFAF disclaimer absent
   - Reference markers [NNN] absent

═══ OUTPUT SCHEMA ═══
{
  chunkIndex,
  totalChunks,
  entries: [{
    latin,
    knownHazards,            // EN source (reference)
    knownHazardsLtV2,        // translator's draft (reference)
    knownHazardsLtEdited,    // YOUR polished version (final candidate)
    changesNotes?: string    // optional: brief note kas pakeista
  }]
}

NE PALEISK apply.
```

### Phase 3 — Verifier agents (5 paraleliai per turn)

Per chunk-NNN-edited.json spawn verifier with prompt:

```
INPUT: ~/lapasid/data/pfaf-v2-chunks/chunk-NNN-edited.json
OUTPUT: ~/lapasid/data/pfaf-v2-chunks/chunk-NNN-verified.json

TASK: Verify each entry's knownHazardsLtEdited (post-literature-editor) against
knownHazards (EN source). Final gateway before catalog deployment.

═══ VERIFICATION CHECKLIST (per entry) ═══

1. FACT FIDELITY:
   - All compound names preserved? (glikozid/saponin/alkaloid/oksalat/etc.)
   - Severity LYGIS matches EN? Use ONLY 3 levels: dirgina / toksiškas / mirtinas.
     Flag jeigu „labai toksiškas" arba kitas intermediate intensifier.
     EN „highly toxic" + lethal dose evidence → „mirtinas", ne „labai toksiškas".
     EN „toxic" be lethal evidence → „toksiškas" (be intensifier).
     EN „mild irritation" → „dirgina".
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
    knownHazardsLtV2,        // translator draft
    knownHazardsLtEdited,    // literature editor polished
    knownHazardsLtFinal,     // SAME as Edited if OK, OR your fix if minor issue
    status: 'ok' | 'flagged',
    flagReason?: string,
    suggestedFix?: string
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

## Expected timing (3-pass)

- Identify: ~5s
- Phase 1 (translator): 32 chunks × ~3-4min × 5 paraleliai = ~25min
- Phase 2 (literature editor): same = ~25min
- Phase 3 (verifier): same = ~25min
- Apply: ~10s
- Manual review (jei flagged): variable
- **Total: ~80-90min** Sonnet session

Trade-off: extra 25min effort (3rd agent pass) buys grammar/style polishing
PRIES verifier gateway. Saugiau toxicity content zona.

## Cost

$0 (per max plan).
