# Sonnet finalization — 87 PFAF flagged entries

## Context

Pirmas Sonnet 3-agent consensus (commit 25d6ce0) baigė 942 entries:
- 768 applied ✅
- 174 flagged (verifier caught issues)

Apply script `scripts/apply-pfaf-v2-fixes.mjs` (commit a73f9a3) auto-applied
87 specific fixes (kuriose `suggestedFix` turėjo full LT replacement text).

Liko 87 entries kurios reikalauja **smart pattern resolution** — Sonnet
verifier paliko instruction-only fixes:
- „Replace 'X' with 'Y'" — needs string substitution in current LT
- „Identical fix as <other entry>" — needs reference trace + replicate
- „Add 'X' to <clause>" — needs targeted insertion

Tavo užduotis: handle'inti šituos 87 entries su pattern-aware logic.

## Input

`~/lapasid/data/pfaf-v2-manual-queue.json`:

```json
{
  "ambiguous": [
    {
      "latin": "Arum dioscoridis",
      "knownHazards": "<EN source>",
      "knownHazardsLtEdited": "<current LT from literature editor>",
      "flagReason": "Substitution needed: 'stiprų deginimo pojūtį' → 'aštrų duriantį pojūtį'",
      "suggestedFix": "Replace 'stiprų deginimo pojūtį' with 'aštrų duriantį pojūtį' (sharp pricking sensation)"
    },
    ...
  ],
  "failedSameAs": [
    {
      "latin": "Prunus serrula",
      "fix": "Same as Prunus avium if death endpoint is required.",
      ...
    }
  ]
}
```

Plus tu turi access prie originalų verified chunks:
- `~/lapasid/data/pfaf-v2-chunks/chunk-NNN-verified.json` — visi entries (ne tik flagged)
- Kai matai „Identical fix as Asplenium" → look up Asplenium entry in verified chunks → extract its knownHazardsLtFinal → see how it differs from LtEdited → replicate same delta to current entry

## Workflow

### Phase 1 — Resolve patterns (ONE agent, single pass)

Per entry'į apply appropriate pattern:

**Pattern A: „Replace 'X' with 'Y'" (most common)**
- Find substring X in current `knownHazardsLtEdited`
- Replace su Y
- If X not found → flag as „pattern-mismatch"

**Pattern B: „Identical fix as <Latin>" / „Same as <Latin>"**
- Find referenced entry in verified chunks (`chunk-NNN-verified.json`)
- Compare referenced entry's `knownHazardsLtEdited` vs `knownHazardsLtFinal`
   (if Final exists) — extract delta
- Apply same delta pattern to current entry's `knownHazardsLtEdited`
- If reference not found OR delta too complex → flag as „reference-trace-failed"

**Pattern C: „Add 'X' to <clause>"**
- Targeted insertion within current LT
- Read whole context (EN source) to understand WHERE to insert
- Don't blindly append — insert at semantic appropriate location

**Pattern D: Anything else (unrecognized pattern)**
- Re-read EN source + suggestedFix
- Make best-effort manual edit preserving fact fidelity + 1-2 sentence rule
- Mark as „manual-edit" in resolution

### Output schema

`~/lapasid/data/pfaf-v2-finalized.json`:

```json
{
  "generatedAt": "...",
  "totalProcessed": 87,
  "resolved": [
    {
      "latin": "Arum dioscoridis",
      "knownHazardsLtResolved": "<final LT text>",
      "pattern": "A-replace" | "B-reference" | "C-insertion" | "D-manual",
      "status": "ok" | "still-flagged",
      "note"?: "if still-flagged: why"
    }
  ]
}
```

## Style guidelines reminder (same kaip v2)

- 1-2 sakiniai default, max 3 if rich
- 3 severity lygiai: dirgina / toksiškas / mirtinas (NE intermediate)
- Fact fidelity: compounds, severity, targets, mechanisms preserved
- Strip [NNN] markers
- No PFAF disclaimer
- LT only, no EN residue

## Apply step (orchestrator runs after)

```bash
node scripts/apply-pfaf-v2-finalized.mjs
```

## Expected timing

- Read manual queue + verified chunks for references: 1-2min
- 87 entries × ~10-15s each = 15-20min
- Output single JSON: data/pfaf-v2-finalized.json
- Apply: ~10s
- **Total: ~20-25min** Sonnet session

## Commit po success

```bash
git add data/pfaf.json data/pfaf-v2-finalized.json
git commit -m "data(pfaf): finalize 87 manual queue entries (100% v2 coverage)"
git push
```
