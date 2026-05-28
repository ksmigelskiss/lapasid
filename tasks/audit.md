# Pilnas pipeline auditas — 4 ramsčiai (vardai/toksiškumas/laistymas/tręšimas) + write/state architektūra

**Data:** 2026-05-29 · **Metodas:** 4 lygiagretūs agentai, kiekvienas trasavo vieną sritį (whole-file reads, file:line).

---

## TL;DR — verdiktas

**NEREIKIA big-bang perrašymo.** Branduolys sveikas: server-side save (202 + `waitUntil`),
deterministinis toksiškumo derive + AI-kaip-vertėjas, RAG grounding, laistymo blend algoritmas.

**BET** auditas patvirtino — einame bandaid keliu keliose vietose, ir yra **viena kritinė
struktūrinė spraga** + keli tikslumą menkinantys dalykai. Reikia **tikslinių struktūrinių
refaktorų**, ne revoliucijos.

**Aukščiausios vertės pokytis:** user-plant ↔ catalog **denormalizacija** — vartotojo augalai
yra save-momento KOPIJOS, niekada nebesusisinchronizuoja. Admin pataisymai / re-enrich į global
katalogą NIEKADA nepasiekia jau pridėtų augalų. Tai didžiausia tikslumo spraga.

---

## Ramsčių tikslumo įvertinimas

### 1. VARDAI — „leaky at seams", ne sulūžę
Data model (catalogDocId, shared `fromAIResult`/`normalizeAIResponse`/`taxonGroupId`) nuoseklus.
Problemos prie siūlių:
- **Client `fetchDetails` catalog write ignoruoja Phase-2 `lietuviskas`** (`SearchModal.jsx:785-787`) —
  rašo genus-level „Dracena", o user-plant gauna „Dracena trijuostė". *Serveris (prod) teisingas.*
  → tik flag-off kelyje, bet drift.
- **Du `verificationStatus` rule-set'ai** (catalog vs user-plant `plantTransform.js:301` vs `SearchModal:795`) —
  tas pats save gali duoti catalog=`auto-verified`, user-plant=`unverified`.
- **Genus-fallback guard word-count, ne rank-based** (`searchStage1.js:201`, mano fix) — single-token
  canonical'as gali prasprūsti. Patikslinti: `parseLatinName(latin).rank==='genus' && !plant.species`.
- **Du latin parser'iai** — `latinName.js` (švarus) + `preDb.js:86` fragile regex. Suvienodinti.

### 2. TOKSIŠKUMAS — saugumui kritiški radiniai (patvirtinta empiriškai)
Client↔server **byte-identiški** (gerai). BET:
- **Oksalatai žmonėms = 2 padalos (over-statement) — ROOT CAUSE:** `deriveToxicity.js:145` mild branch
  `/\b(irritat|...)\b` turi **trailing `\b`** → „irritat**ion**" niekada nematch'ina → krenta į generic
  `toxic`→`vidutinis` (`:148`). `derivePfafTipas` (`:161`) `\b` NETURI → grąžina `dirginantis`. Todėl
  Monstera = pill „DIRGINA" su **2 padalom** (tipas ir severity nesutaria). **Tavo pastebėjimas — tikslus.**
- **⚠️ SAUGUMAS (under-report):** ASPCA severity = match-CONFIDENCE, ne reali toksiškumas
  (`:248`). Pavojingas augalas su „medium" match → silpnas (per žemai).
- **⚠️ SAUGUMAS (under-report):** `target: sup.target==='abiem' ? 'zmonems'` (`save-plant.js`,
  `SearchModal:756`) — tyliai numeta gyvūnų pavojaus pusę „abiem" atveju.
- Dead `buildSavybes` (`preDbBaseResult.js:181`) su stale severity logika.

### 3. LAISTYMAS + TRĘŠIMAS — algoritmas sveikas, DATA mažiausiai pagrįsta
- **Scheduling blend (history+theory, snooze, dormancy) — gerai sukurtas, NEliesti.**
- **⚠️ `laistymasIntervalas`+`tresimas` yra `required` (`plantPromptConfig.js:258`) BET RAG neturi
  struktūrinių laistymo/tręšimo skaičių** → AI haliucinuoja skaičius iš training memory ir pateikia
  kaip faktą. Tai mažiausiai pagrįsti laukai — tiesiogiai prieštarauja #1 tikslumo tikslui.
- **Schlumbergera „žiema<vasara" ROOT CAUSE:** blanket „Žiemą laistyti rečiau" (`stage2Constants.js:26`)
  + succulent default `{vasara:18,žiema:42}` + **nėra winter-active carve-out**. Žiemą žydintys epifitai
  (Schlumbergera/Rhipsalis) reikalauja DAUGIAU vandens žiemą. Data-gen bug, ne scheduler.
- **Du scheduling engine'ai, 3 skirtingos sezono ribos:** `forecastBase.getSeason` (Oct–Mar) vs
  `PlantCareCard.pickInterval` (Nov–Feb) vs `dormancyForecast`. NFC passport card reimplementina
  interval picking, ignoruoja history/blend/snooze. `FertilizingStatus` skaito neegzistuojantį lauką
  `laistymasIntervalas.tresimasIntervalas` (`PlantCareCard.jsx:117`) — visada null.
- **Silent save abort** (`save-plant.js:222-228, 376-381`) — jei AI negrąžina care, catalog praleidžiamas
  BET user-plant vis tiek įrašomas → augalas kolekcijoj be care, be klaidos, be catalog entry.

---

## Kryžminiai struktūriniai radiniai (rank pagal vertę)

### P0 — kritinė spraga
1. **User-plant ↔ catalog denormalizacija.** User-plants = save-momento kopijos; PlantDetail skaito
   user-plant doc'ą (ne catalog). Tik hero skaitomas live iš catalog (`heroIllustrationFor`). Care,
   aprašymas, toksiškumas, vardai = užšaldyti save metu. Admin/re-enrich pataisymai katalogE
   NIEKADA nepasiekia esamų augalų. **Fix:** PlantDetail reference-data skaityti live iš
   catalog/taxonGroup pagal `lotyniskas` (kaip jau daro hero map per `subscribeHeroMap`), ARBA
   reconcile on-open. Effort ~1-2 d. Pakartoja jau veikiantį subscribeHeroMap pattern'ą.

### P1 — tikslumas (4 ramsčiai)
2. **Care-data grounding:** `laistymasIntervalas`/`tresimas` padaryti NON-required; emit `null` kai
   nepagrįsta → scheduler default'ai perima vietoj haliucinuotų skaičių. + winter-active flag
   (Schlumbergera carve-out).
3. **Toksiškumo severity fixes (SAUGUMAS — peržiūrėti KARTU):**
   (a) trailing `\b` mild branch + oxalate de-escalation cue → oksalatai žmonėms 2→1 padala;
   (b) ASPCA severity atsieti nuo match-confidence; (c) `abiem→zmonems` collapse → emit DVI pavojai
   įrašus (negali under-report'inti gyvūnams). **NB: nekeisti be Kęstučio peržiūros.**
4. **Genus-fallback dublikatų cleanup script** (esami „Alokazija" ×2 ir kt. prieš `6d99682`).

### P2 — struktūrinė skola (drift prevencija)
5. **Client/server duplikacija = struktūrinis bandaid.** 4-6 hand-mirror poros. Jau DRIFT'ino:
   `catalog-server.js:97-120` turi „image-freeze", `catalog.js` neturi. Nėra testo, tikrinančio
   ekvivalentiškumą. **Visas client Phase-2 kelias DEAD prod'e (flag="1")** — tai kiekvienos drift
   poros „source half", laikoma „kaip backup". **Variantas A:** ištrinti dead client Phase-2 kelią
   (greita, -700 eil.). **Variantas B:** konsoliduoti pure logiką į isomorphic shared modules su
   injected data-loader/AI-caller. Rekomendacija: A pirma (jei flag visam laikui ON), tada B likučiui.
6. **Catalog caching redundancija:** du paraleliniai catalog skaitymai — live `onSnapshot` (heroMap)
   + 1h-TTL `loadAllCatalog` (search). Konkuruoja (search iki 1h stale, kortelės live). `bustCatalogCache`
   fire-and-forget + tik client writes bust'ina (server/prod writes NIEKADA). **Fix:** search maitinti
   iš to paties live snapshot; ištrinti `loadAllCatalog`/TTL/`bustCatalogCache`. AdminPanel → `onSnapshot`.

### P3 — dead code (saugu trinti)
- `src/pages/Wishlist.jsx`, `src/pages/History.jsx` — nenaudojami.
- Dead client Phase-2 šaka + `triggerHeroGen` (jei flag visam laikui ON).
- `buildSavybes` (`preDbBaseResult.js:181`), backward-compat aliases (`taxonGroups.js:224,280`).
- `FertilizingStatus` dead field, `PlantCareCard.pickInterval` dublikatas.

---

## Ką PALIKTI (sveika, neliesti)
- Server save: 202 + `waitUntil` (sprendžia abandoned AI-call problemą).
- Deterministinis toksiškumo derive + AI-kaip-vertėjas/auditorius + D-strict whitelist.
- Laistymo blend (history·conf + theory·(1−conf)), snooze, dormancy core.
- RAG grounding architektūra (tik care-intervals trūksta struktūrinio šaltinio).
- shared `normalizeAIResponse`/`fromAIResult`/`taxonGroupId`/`latinName` (jau bendri).

---

## Rekomenduojama eiga
1. **P0** (denormalizacija) — didžiausia vertė, atskira sesija.
2. **P1.3 toksiškumas** — peržiūrėti filtrus KARTU, tada fix + cleanup script.
3. **P1.2 care grounding** + Schlumbergera carve-out.
4. **P2** drift/dead-code valymas (greitai, jei flag patvirtinam visam laikui ON).
