# LapasID — Catalog & Search Vision (2026-06-02)

**Statusas:** KONCEPCIJA (po 4-agentų konsiliumo). Spec prieš kodą — sutarti scope, kad
fix'ai nesulaužtų esamo save flow.
**Šaltinis:** care+search pipeline mapping (2 Explore agentai) + adversarial konsiliumas
(botanikas / data-architektas / product / red-team). Konsiliumas užginčijo 2 pradinius
sprendimus (trusted-by-default, per-whole-node) — pataisyta žemiau.

---

## 0. Tikslas (founder)

Susirinkti **kuo tikslesnę global plant collection (katalogą)**, kuri ilgainiui bus
**ekspertų verifikuojama** („✓ Verified by [mokslininkas]" badge). „Data is value" —
sutinkam aukoti resursus pirminiam suradimui, kad turėtume vertingą įrašą. F1 amortizacija:
brangus discovery vyksta 1× per taksoną, serv'inama visiems amžinai.

**Konsiliumo reality-check (priimta):** katalogas = **infrastruktūra, ne produktas**.
Silpnas moat (bet kas atkurs houseplant care su AI). Tikras moat = LT-kalbos sluoksnis +
user engagement + seller kanalas. Egzistencinė rizika = retention/PMF, ne vienas klaidingas
įrašas. → Saugoti user'io pirmą patirtį tokiu pat įniršiu kaip katalogo grynumą.

---

## 1. Didysis perframinimas (esmė)

Dabartinė architektūra (F1 overlay + taxonGroups + catalog-first) JAU yra „verifikuojamo
taksonominio medžio fabrikas" — tik nepaženklinta ir su atvirom spragom. Reikia:

> **Apversti „AI-discovered = published/trusted by default" → „AI-discovered = PROVISIONAL
> by default; publishing į shared verified katalogą = gated promotion."**

Vienas šis apvertimas: uždaro saugumo spragą · sprendžia cold-start · saugo katalogo grynumą ·
leidžia seller kanalą · „verified" pradeda reikšti.

---

## 2. 3-sluoksnių katalogas (CREATION ≠ PUBLICATION)

```
User/Seller trigger'ina enrichment
        ↓
  [1] PROVISIONAL   ← rodoma TAM user'iui iškart, žyma „AI, neverifikuota".
        ↓ gated promotion (admin / seller / multi-corroboration / confidence+authority gate)
  [2] COMMUNITY/SELLER ← semi-trusted (nursery contributed; toxicity-omission bias → ne auto)
        ↓ ekspertas sertifikuoja (per-sekciją, freeze)
  [3] VERIFIED      ← „✓ Verified by [vardas]" badge
```

**Role-tiering atsakymas:** NEgate'inam CREATION (nukirstų flywheel — coverage = 1 founder'io
greitis). Gate'inam PUBLICATION (promotion tarp sluoksnių). User'iai gali enrich'inti, bet
rezultatas krenta į provisional, ne į shared verified.

**Cold-start UX:** plantas, kurio nėra verified kataloge → pilnas AI ID + enrichment → provisional
sluoksnis → rodoma user'iui IŠKART su sąžininga žyme. Niekada neblokuoti, niekada „request queue"
kaip pagrindinį kelią.

**Seller kanalas (naujas):** nurseries = curation (motyvas + kompetencija savo SKU) BE founder
bottleneck'o + zero-CAC distribution (QR ant etiketės) + B2B revenue surface. → community/seller
sluoksnis, NE auto-verified (toxicity-omission bias).

---

## 3. Identifikacija: precision ladder + refine-later

- Augalas saugomas bet kuriame lygyje: **gentis / rūšis / veislė** (`identityLevel`).
- Paieška **nutūpia ant patikimiausio lygio** — NE verčia per 15-kandidatų sieną.
- Candidates → **on-demand „Patikslinti →"**, ne privalomas upfront fork (← monstro vengimas).
- **Refine-later:** user kopia genus→species→cultivar. DARO AI re-query care (tikslumas > kaštas).
  - Re-parent'ina USER PLANT pointer'į (NE mutina shared node).
  - **PERSONAL_FIELDS struktūriškai atskirti** kad re-query fiziškai negalėtų jų liesti (task #61
    bug klasė — partition, ne app-level merge-around).
  - **Reversible** (laikom pre-refine pointer'į + refine event) — klaidingą refine galima atšaukti
    neprarandant timeline/foto.
  - Refine po expert-verify: NAUJAS finer node = `provisional` vėl, NE paveldi tėvo badge'o.

**Care precision žyma (`careLevel`):** genties care = „≈ apytikslė". High-variance gentims
(Euphorbia, Begonia, Peperomia, Ficus, Dracaena, Senecio/Curio…) — NE sintetinis vidurkis, o
„care labai skiriasi — identifikuok rūšį". Reikia flagged genčių sąrašo.

---

## 4. Verifikacija (PATAISYTA — per-sekciją, ne per-node)

**Konsiliumas užginčijo „per visą node" — priimta pataisа:**

- **Per-SEKCIJĄ verifikacija:** taksonomija / care / toksiškumas tvirtinami ATSKIRAI.
  (Mokslininkas, tvirtinantis toksiškumą, netvirtina laistymo intervalo.)
- **FREEZE on certify:** node'o sekcija įšaldoma (content hash / snapshot) sertifikavimo metu.
  Bet koks vėlesnis write (user / re-enrich / admin) → **nuima badge** kol re-certify. Badge
  niekada nevouch'ina už turinį, kurio ekspertas nematė.
- **Badge koncentruotas ant TOKSIŠKUMO** — vienintelis laukas, kur user + liability realiai rūpi.
  Care minutiae verifikacija = kaštas be proporcingos vertės.
- **Verslo states (PATAISYTA pavadinimai):**
  - `ai-generated` / `unreviewed` (BUVO `auto-verified` — melas, AI confidence ≠ verifikuota)
  - `community-reviewed` / `seller-provided`
  - `expert-verified` (per-sekciją) → badge

---

## 5. Node identity (must-fix prieš scale)

Dabar: slug iš lotyniško vardo (`catalogDocId`) — **lossy + mutable + meaning-encoding.**
Tai Aglaonema + Nephrolepis bug'ų ŠAKNIS (cultivar-strip regex + 100-char truncate +
sinonimai/reklasifikacijos/hibridai).

**Strategija:**
- **Primary key = opaque immutable** `nd_<ulid>`. Niekada nekeičiamas, nieko nekoduoja.
  User plant rodo į ŠITĄ, ne į vardą.
- **Authority anchor:** GBIF / POWO / WFO / iNat taxonKey kaip realios tapatybės inkaras.
  Du node'ai su tuo pačiu taxonKey = tas pats taksonas = merge kandidatas. Sprendžia sinonimus +
  reklasifikacijas (Sansevieria→Dracaena: authority seka accepted-name pokyčius, ne mes).
- Lotyniškas vardas, rank, cultivar, hybrid (`×`) = **struktūriniai laukai**, ne raktas.
- Slug = non-unique label / SEO handle; visi seni slug'ai → `aliases[]` (seni URL veikia).
- **Mesti** cultivar-strip regex + `.slice(0,100)` truncate.
- Write invariant: cultivar node PRIVALO turėti species/genus `parentNodeId`; reject jei rašytų
  cultivar data ant genus key.

**Merge/split:** loser → tombstone (`merged_into`), resolve on read (jokio orphan). Split (gentis→
2) = manual disambiguation (esamas `needsManualVerification`), niekada auto-repoint.

---

## 6. Toksiškumas (PERRAŠYTI — safety-critical)

- **Struktūra (ne `bool`):** `{ status: toxic|irritant|safe|unknown, audience:[cat,dog,human],
  mechanism, part, route, source, confidence }`. **`unknown` = realus, fail-safe rodomas state**
  (dabar maskuojasi kaip `false` = „saugu").
- **„Nėra duomenų ≠ saugu":** nežinomos genties → rodyti „toksiškumas nerastas ASPCA/PFAF
  (duomenų nebuvimas ≠ įrodyta sauga)", NE žalią ✓.
- **Genties worst-case = saugos grindys, NE rūšies faktas:** rodyti „blogiausias atvejis genties
  viduje, nepatvirtinta šiai rūšiai" (vengia false alarm Solanum/Hippeastrum/Pelargonium tipo).
- **Vienas derivation source** (client+server „MIRROR" kopijos → driftina safety kodą; ištraukti į
  bendrą modulį arba skaičiuoti tik serveryje).
- **Edibility (`valgomumas`) — IŠ ESMĖS apriboti:** AI-generated „pilnai valgomas" = aktyvus
  kvietimas valgyti = liability. Rodyti tik „istoriškai naudota maistui (PFAF)" + griežtas „nesirink
  ką valgyti pagal app". PFAF edibility = foraging DB, ne kambarinių sauga.

---

## 7. Provenance + versioning (verifikacijos kuras)

- **Per-FIELD provenance:** `{ value, source, sourceUrl, retrievedAt, method:ai|scraped|expert,
  confidence, modelVersion, verifiedBy?, verifiedAt? }`. „Cross-checked ASPCA+PFAF" be field-level
  citatos = neverifikuojama.
- **Append-only revisions** per node; „live" = pointer; rollback = pointer move. F1 serv'ina
  last-known-good. Promotion provisional→verified = gate, ne save side-effect.
- **`updatedBy` (uid) + audit** ant kiekvieno catalog write (dabar tik `updatedAt` — negali net
  ištirti kas užnuodijo).
- **Anomaly tripwires:** toksiškumo flip true→false, care numbers > Nσ, name/rank pokytis →
  auto-hold review.
- Anti-rot: source-assertion snapshot (drift detection), dead-link sweep, model-version stamp
  (bulk-invalidate jei modelis halucinavo).

---

## 8. 🔴 URGENT (egzistuoja DABAR)

| # | Radinys | Vieta | Fix |
|---|---|---|---|
| 1 | **Atviras catalog write** — bet kuris authed user gali globaliai apversti toks. | `firestore.rules:86` (`write: if request.auth != null`) | catalog write → `isAdmin()` (kaip taxonGroups:98). **BET:** dabartinis user-save rašo į catalog → fix reikalauja save kelio perkėlimo į provisional/server-gated. NE tik rule. |
| 2 | `auto-verified` = melas (AI conf ≠ verified) | plantTransform:334, taxonGroups:215 | Rename `ai-generated`/`unreviewed` |
| 3 | Edibility AI-generated, ne source-gated, rodoma | plantPromptConfig | Apriboti (žr. §6) |
| 4 | „Nėra duomenų" rodoma kaip „saugu" | deriveToxicity | `unknown` state, fail-safe display |
| 5 | Jokių disclaimer'ių ant toks./edible/passport | passport endpoints | Always-on non-removable disclaimer |
| 6 | Node-ID collisions (Aglaonema/Nephrolepis klasė) | catalog.js slug | §5 identity |
| 7 | Passport readable be auth (scrapable verified data) | firestore.rules:117, api/passport | Auth / rate-limit |
| 8 | Enrichment/hero-gen be rate-limit (cost abuse) | save + generate-hero | Per-user rate-limit |

---

## 9. KEEP / EXTEND / REMOVE / NEW (scope — NE perrašymas)

**KEEP (branduolys):** F1 overlay, taxonGroups inheritance, catalog-first short-circuit,
deterministic Phase 0-0.3, Phase 2 enrichment, watering algoritmas, deriveToxicity (DB).

**EXTEND:** `identityLevel`/`careLevel`, per-field provenance, verslo states rename + per-sekcija,
node opaque ID + authority anchor, structured toxicity.

**REMOVE/SIMPLIFY (monstras):** privalomas upfront candidate fork → on-demand refine; `bulk_series`
dead kodas; 3→1 toxicity source; photoAttempts asimetrija; cultivar-strip regex + truncate;
client/server MIRROR drift; `auto-verified` melas.

**NEW:** provisional sluoksnis + promotion gate; refine-later re-parent; freeze-on-certify;
seller role; versioning/rollback.

→ ~70% declutter+extend, ~20% UX repackage, ~10% naujo kodo. Monstras IŠIMAMAS, ne pernešamas.

---

## 10. Sekos rekomendacija (inkrementaliai, ne big-bang)

1. **Safety hotfix paketas** (URGENT §8 #2-5,7-8 — mažos, izoliuotos): rename `auto-verified`,
   `unknown` toks. state, edibility apribojimas, disclaimer'iai, passport auth, rate-limit.
   (#1 + #6 laukia provisional sluoksnio — žr. žemiau.)
2. **Provisional sluoksnis + save kelio perkėlimas** → tada saugu uždaryti catalog write rule (#1).
3. **Node identity** (opaque ID + authority anchor + drop slug-as-key) → uždaro #6 + collision klasę.
4. **Structured toxicity + per-field provenance** → verifikacijos pamatas.
5. **Per-sekcija verifikacija + freeze + badge** (toksiškumui pirma).
6. **Precision ladder UX + refine-later** (user-facing, po to kai data model tvirtas).
7. **Seller role** (kai modelis stabilus).

---

## 11. Atviri klausimai

- Authority anchor: GBIF taxonKey vs POWO vs iNat — kuris primary? (iNat jau dergiam vardams.)
- Provisional sluoksnis: atskira Firestore kolekcija (`catalog_provisional`) ar `status` laukas
  esamame catalog? (Atskira = švaresnė izoliacija + paprastesnės rules.)
- Promotion gate: rankinis admin vs auto (confidence + authority + N corroboration)?
- Seller verifikacija: kaip įvedam seller role + kiek pasitikim?

---

## 12. Rizikos

- **Scope creep į perrašymą** — todėl inkrementali seka + KEEP branduolys.
- **Save kelio perkėlimas gali sulaužyti dabartinį UX** — todėl provisional pirma, rule užrakinimas
  kartu (ne atskirai).
- **Authority anchor integracija** (GBIF/POWO API) = nauja priklausomybė — pradėti nuo iNat (jau yra).
- **Over-investment grynume vs retention** (product agento įspėjimas) — tikrinti kiekvieną žingsnį:
  „ar tai gerina user'io pirmą patirtį, ar tik katalogo grynumą?"
