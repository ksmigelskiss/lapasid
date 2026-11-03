# AI sluoksnio, kaštų ir testų peržiūra

> Data: 2026-11-03 · Šaka: `claude/beautiful-edison-92r77m` · Autorius: Claude Code (peržiūra)
> Apimtis: visi `@anthropic-ai/sdk` ir Vercel AI Gateway kvietimai, jų modeliai,
> caching'as, struktūrizuoti išvedimai, kaštai, Vitest padengimas.
>
> **Niekas nedeploy'inta, prod duomenys neliesti, prod secrets nenaudoti.**
> Visi pakeitimai šakoje + draft PR peržiūrai.

---

## 0. Santrauka (TL;DR)

**Kas padaryta šiame PR (saugu, patikrinta testais / `node --check`):**

1. **Centralizuoti modelių pavadinimai** → `api/_lib/aiModels.js`. Anksčiau
   `'claude-sonnet-4-6'` buvo hardcode'intas **5 vietose**; dabar — vienas šaltinis.
   Elgsena nepakitusi (ta pati modelio reikšmė).
2. **Prompt caching** pridėtas prie dviejų server-side enrich kvietimų
   (`save-plant` Phase 2, toksiškumo narrative) + batch script'o. Stabilus
   ~12k tokenų prefiksas žymimas `cache_control`.
3. **SDK bump** `@anthropic-ai/sdk` `^0.39.0` → `^0.137.0` (naujausia 0.x;
   lockfile sinchronizuotas, visi testai žali). Naujausia apskritai yra **1.4.0**
   (major bump) — rekomenduojama atskiru, testais dengtu žingsniu (§3).
4. **Bendras vision-auth modulis** `api/_lib/visionAuth.js` — pašalintas
   saugumui kritinio `tokenFor()` dublikatas tarp `middleware.js` ir
   `api/vision-unlock.js`.
5. **+51 naujas Vitest testas** (`checkLimit`, `verifyAuthToken`, vision
   `tokenFor`, `normalizeAIResponse`/`normalizeSavybes`/`stripUndefinedDeep`).
   Iš viso **267 testai žali**; `vitest.config.js` dabar apima ir `api/**`.

**Svarbiausios išvados (detaliau žemiau):**

- ⚠️ **Modelio migracijos spąstai:** perėjus į `claude-sonnet-5-5` /
  `claude-opus-5-5`, priverstinis `tool_choice: { type: 'tool' }` grąžina
  **HTTP 400**. Enrich pipeline'as (Phase 2 + narrative) jį naudoja → migracija
  BE `tool_choice` pakeitimo **sulaužytų** enrich'inimą. Todėl modelio reikšmė
  kode palikta `sonnet-4-6`, o pilnas migracijos diff aprašytas §3.
- 🔐 **Saugumas (toksiškumo DB integralumui kritiška):** `firestore.rules:86`
  leidžia `catalog` **rašyti BET KURIAM prisijungusiam vartotojui**. Naujoje
  kryptyje (ekspertų tikrinama toksiškumo bazė) tai reiškia, kad bet kas gali
  perrašyti „toksiška" → „saugu". §9.
- 💸 **Didžiausi kaštų svertai:** (a) `sonnet-4-6` → `sonnet-5-5` = ~33 % pigiau
  ir naujesnis; (b) chat + paieška per **Haiku 5.5** = ~30× pigiau už dabartinį
  Sonnet; (c) caching batch enrich'e ~2× pigiau; (d) Batch API katalogui −50 %. §5, §7.

---

## 1. Apžvelgti AI kvietimai (inventorius)

| Vieta | Modelis (buvo) | Paskirtis | tool_choice | ~Input tok. | max_tokens |
|---|---|---|---|---|---|
| `api/save-plant.js:341` | `claude-sonnet-4-6` | **Phase 2 enrich** (care + savybes) | forced `plant_details` | ~14 000 | 3000 |
| `api/_lib/toxicityNarrativeGenerator-server.js:81` | `claude-sonnet-4-6` | toksiškumo narrative (vertimas + auditor) | forced `toxicity_narrative` | ~4 400 | 600 |
| `scripts/batch-enrich-catalog.mjs:141` | `claude-sonnet-4-6` | batch katalogo enrich (×274) | forced `plant_details` | ~14 000 | 3000 |
| `api/claude.js:38` | `claude-sonnet-4-6` | paieškos/bendras proxy (SearchModal) | iš kliento | ~kinta | 1024 |
| `api/claude/stream.js:42` | `claude-sonnet-4-6` | **chat** (SSE stream) | — (be tools) | ~mažas | 400 |
| `api/_lib/heroGen.js:19` (Gateway) | `anthropic/claude-sonnet-4.5` | hero vision brief / foto atranka | — | ~kinta (+vaizdai) | 400–500 |
| `api/_lib/heroGen.js:20` (Gateway) | `google/gemini-3-pro-image` | hero akvarelės generavimas | — | — | — |

Visi Claude kvietimai eina per `api/` serverless (raktas niekada kliente — gerai).
Vision/hero eina per **Vercel AI Gateway** (OpenAI-suderinamas `/chat/completions`),
autentifikacija per `VERCEL_OIDC_TOKEN` / `AI_GATEWAY_API_KEY`.

> Tokenų įverčiai gauti iš simbolių kiekio (`wc -c`) × ~3,7 sim./tokenas
> (lietuvių proza + JSON schema mišinys). Tai **įverčiai ±~30 %** — tikslūs
> skaičiai matuotini per `response.usage` (žr. §7, matavimo rekomendacija).

---

## 2. Didelis radinys: Phase 2 enrich moka už „negyvą" prompt'o turinį

`PLANT_SYSTEM` (`src/utils/plantPromptConfig.js:266`, **21,8 KB**) naudojamas
**abiejose** fazėse:

- **Phase 1 (paieška)** — `plant_preview` tool'as (`SearchModal.jsx:295`) su
  laukais `candidates`, `fallbackInfo`, `matchLevel`, `confidence`,
  `uncertaintyReason`, `sources` + `web_search` tool'u.
- **Phase 2 (enrich)** — `plant_details` tool'as (`plantPromptConfig.js:31`),
  kuris **neturi NĖ VIENO** iš tų laukų ir **nenaudoja `web_search`**.

Didžioji `PLANT_SYSTEM` dalis (eilutės ~266–515: „WEB SEARCH", „TAXONOMIC
FALLBACK", „DISAMBIGUATION — CANDIDATES", „VENDOR ECHO") yra 100 % skirta
Phase 1, bet **siunčiama ir kiekviename Phase 2 enrich kvietime** — tai
mokamas, nereikalingas input'as ~250 eilučių ir, blogiau, gali klaidinti modelį
(liepia pildyti `candidates`/`fallbackInfo`, kurių schema'oje nėra).

**Rekomendacija:** suskaidyti `PLANT_SYSTEM` → `PLANT_SYSTEM_SEARCH` (pilnas,
Phase 1) + `PLANT_SYSTEM_ENRICH` (tik LT vardų konvencija + `SAVYBES`/toksiškumas
+ šviesos/vandens lentelės). Phase 2 input'as sumažėtų ~40–50 %
(**nepadaryta šiame PR** — reikia atsargaus prompt'o padalinimo + regresijos
patikros abiejose fazėse, nes `PLANT_SYSTEM` yra shared).

---

## 3. SDK ir modelių pavadinimai

### 3.1 SDK

- **Buvo:** `@anthropic-ai/sdk ^0.39.0` (lockfile 0.39.0).
- **Šiame PR:** `^0.137.0` — naujausia **0.x** (saugus to-pačio-major bump;
  `messages.create` / `messages.stream` / `tool_use` paviršius nepakitęs;
  patikrinta: SDK importuojasi, `new Anthropic()` + abu metodai veikia, 267
  testai žali).
- **Naujausia apskritai:** **1.4.0** (TypeScript SDK peršoko į **1.x** — projektas
  buvo visą major atsilikęs). Rekomendacija: migruoti į `1.x` **atskiru žingsniu**
  pagal SDK CHANGELOG + endpoint'ų smoke-testą (major bump gali turėti breaking
  pakeitimų; core messages paviršius greičiausiai suderinamas, bet netikrintas
  gyvai).
- ⚠️ **API-version niuansas:** naujesnės SDK versijos gali numatytai siųsti
  naujesnį `anthropic-version`. Nuo **2026-10-21** API versijos `temperature` /
  `top_p` / `top_k` grąžina **400 visuose modeliuose**. Enrich/narrative kvietimai
  naudoja `temperature: 0.3` → prieš API-version bump reikės juos pašalinti
  (ir perskaičiuoti determinizmą). Šiame PR `temperature` **palikta** (veikia su
  esama SDK/versija).

### 3.2 Modelių pavadinimai

| Pavadinimas | Statusas | Komentaras |
|---|---|---|
| `claude-sonnet-4-6` | ✅ **galioja** | NE deprecated. $3 / $15 už 1M. Bet karta atgal. |
| `claude-sonnet-5-5` | rekomenduojama | $2 / $10 — **pigiau IR naujiau**. Reikia tool_choice fix. |
| `anthropic/claude-sonnet-4.5` (Gateway) | ⚠️ **pasenęs** | Karta atgal; tikrintinas dabartinis Gateway slug'as. |
| `google/gemini-3-pro-image` (Gateway) | ok | Hero generavimui. |

Dabartinės kainos (Anthropic first-party, 2026-10 lentelė):

| Modelis | In $/1M | Out $/1M | cache read $/1M |
|---|---|---|---|
| `claude-sonnet-4-6` | 3,00 | 15,00 | ~0,30 |
| `claude-sonnet-5-5` | 2,00 | 10,00 | 0,20 |
| `claude-haiku-5-5` | 0,10 | 0,50 (iki 100k) | ~0,02 |
| `claude-opus-5-5` | 4,00 | 20,00 | 0,20 |

> Pastaba: projekto kaštų modelis (`tasks/konsiliumas-2026-06/34-kastu-modelis.md:9`)
> remiasi „sonnet-4-6 ~$3/M in, ~$15/M out" — tai **sutampa** su dabartine
> lentele. Vadinasi, prielaidos teisingos, tik modelis yra senesnės kartos.

### 3.3 ⚠️ Migracijos spąstai: forced `tool_choice` → 400

Perėjus į `claude-sonnet-5-5` / `claude-opus-5-5` (ir naujesnius), priverstinis
`tool_choice: { type: 'tool', name: ... }` **IR** `{ type: 'any' }` grąžina
**HTTP 400** (`tool_choice type "tool" and "any" are not supported for this model`).
Enrich (`save-plant`, batch) ir narrative kvietimai jį naudoja.

**Dėl to** aktyvus modelis `api/_lib/aiModels.js` paliktas `sonnet-4-6`.
Pilnas migracijos receptas (atlikti kartu, patikrinti preview deploy'e):

```js
// BUVO (sonnet-4-6 — veikia):
tools: [TOOL_DETAILS],
tool_choice: { type: 'tool', name: 'plant_details' },

// PO migracijos į sonnet-5-5 / opus-5-5:
tools: [{ ...TOOL_DETAILS, strict: true }],   // strict → schema-validūs argumentai
tool_choice: { type: 'auto' },                 // forced nebeleidžiamas
// + sistemos/user prompt'e: „PRIVALOMA iškviesti plant_details tool'ą."
// + palikti esamą „no tool_use → writeStage('failed')" apsaugą (jau yra).
```

`strict: true` reikalauja `additionalProperties: false` + visų laukų `required`
kiekvienam schema object'ui — `TOOL_DETAILS` turi `ltSynonyms` sąmoningai NE
`required` ir nested objects be `additionalProperties`, todėl reikės schema'os
patikslinimų (žr. §6).

---

## 4. Prompt caching

### 4.1 Komandos ankstesnis sprendimas

`tasks/todo.md:13-15` caching'as buvo **atmestas** kaip „low value dėl global-lib
dedup". Logika iš dalies teisinga: kadangi `catalog` yra **bendras** ir Phase 1
catalog-hit praleidžia AI (`SearchModal.jsx:1376`), gyvų pavienių enrich'ų būna
mažai, o 5 min ephemeral cache TTL tarp jų dažniausiai pasibaigia → cache miss.

**Bet** tai negalioja dviem realiems scenarijams, kur caching'as duoda didelį svertą:

1. **Batch enrich** (`batch-enrich-catalog.mjs`, ~274 augalai iš eilės): tas pats
   ~12k tokenų prefiksas (tools + VOICE_PERSONA + PLANT_SYSTEM + RAG_PRIORITY)
   kartojamas 274 kartus per minutes → beveik visada cache **hit**.
2. **Re-enrich bursts** / admin bulk ops.

### 4.2 Skaičiai (batch Phase 2, ~274 augalai)

Stabilus cache'uojamas prefiksas ≈ **12 080 tokenų** (tools ~17 KB + VOICE 4,4 KB +
PLANT_SYSTEM 21,8 KB + RAG_PRIORITY).

| Scenarijus | Phase 2 batch kaina (274×) |
|---|---|
| `sonnet-4-6`, be cache (dabar) | ~**$18,9** |
| `sonnet-5-5`, be cache | ~$12,6 |
| `sonnet-5-5` + caching | ~**$6,6** |
| `sonnet-5-5` + caching + Batch API (−50 %) | ~**$3,3** |

> cache read = $0,20/1M vs input $2/1M → cache'uotam prefiksui ~**10× pigiau**.
> Pirmas call'as rašo cache (~1,25× input), likę 273 skaito.

### 4.3 Kas padaryta šiame PR

`cache_control: { type: 'ephemeral' }` uždėtas ant **stabilaus** sistemos prefikso
(tools render'inami prieš system → patenka į tą patį cache regioną):

- `api/save-plant.js` Phase 2 — prefiksas (VOICE+PLANT_SYSTEM+RAG_PRIORITY)
  atskirtas nuo kintamo `rag.context`; **turinys ir tvarka nepakitę**, tik
  įterptas breakpoint'as.
- `api/_lib/toxicityNarrativeGenerator-server.js` — stabilus VOICE+TRANSLATOR
  sistemos blokas pažymėtas cache.
- `scripts/batch-enrich-catalog.mjs` — tas pats, kur svertas didžiausias.

> **Patikrinti gyvai:** `response.usage.cache_read_input_tokens > 0` po antro
> batch call'o. Jei 0 — ieškoti „tylaus invalidatoriaus" (kintantis turinys
> prefikse). Chat/search proxy caching'as (`api/claude*.js`) **nepridėtas** —
> ten `system` ateina iš kliento; rekomenduojama pridėti atskirai (žr. §5).

---

## 5. Pigesni modeliai ten, kur užtenka

| Kelias | Dabar | Siūloma | Pagrindimas | Rizika |
|---|---|---|---|---|
| **Chat** (`stream.js`) | sonnet-4-6 | **haiku-5-5** | ~30× pigiau ($0,10/$0,50); chat'ui pakanka | balso/kokybės — reikia A/B |
| **Paieška** (`claude.js`) | sonnet-4-6 | haiku-5-5 arba sonnet-5-5 | ident./preview — vidutinis sudėtingumas | atpažinimo tikslumas |
| **Narrative — vertėjas** (`detales`) | sonnet-4-6 | **haiku-5-5** | EN→LT vertimas, 99 % call'ų | žema |
| **Narrative — auditor** (`aiSupplementaryHazard`) | sonnet-4-6 | **likti Sonnet** | saugumui jautrus gap-fill | aukšta — nekeisti |
| **Phase 2 enrich** | sonnet-4-6 | sonnet-5-5 | care+toksiškumo severity sprendimai | vid. (test eval) |

**Chat per Haiku** yra didžiausias nerealizuotas svertas: kaštų modelis
(`34-kastu-modelis.md:28`) ir galutinė santrauka (`60-galutine-santrauka.md:102`,
„Pro teigiama TIK su chat per Haiku") jo prašo, ir kodas patvirtina — chat
**tikrai veikia Sonnet** (`stream.js`). Dokumentai sako „5–10× pigiau"; su
dabartiniu `haiku-5-5` tai **~30×** (sonnet-4-6 $3/$15 → haiku-5-5 $0,10/$0,50).

**Niuansas dėl narrative:** `todo.md:14` atmetė „Haiku narrative (safety-critical
auditor)". Tai teisinga **auditoriaus** rolei (`aiSupplementaryHazard` — pildo tik
pagal whitelist + griežtą įrodymą). Bet tas pats kvietimas atlieka IR **vertėjo**
rolę (`detales` EN→LT), kuri sudaro ~99 % panaudojimų ir Haiku'ui visiškai tinka.
**Rekomendacija:** apsvarstyti narrative **padalijimą** — vertėjas per Haiku,
auditorius (retas whitelist atvejis) per Sonnet. Arba palikti kaip yra (kvietimas
pigus: ~$0,017).

> Šie modelio keitimai **nepadaryti** kode: (a) keičia produkto kokybę/balsą
> (produktinis sprendimas); (b) chat/search keitimas saugus (be forced
> tool_choice), bet reikia kokybės eval. `api/_lib/aiModels.js` jau turi
> `CLAUDE_MODELS.haiku` — keitimas būtų vienos eilutės.

---

## 6. Struktūrizuoti išvedimai toksiškumo duomenims

**Jau įgyvendinta gerai:** toksiškumo duomenys jau gaunami per Anthropic **tool**
schema'as (struktūrizuotas išvedimas):

- `TOOL_DETAILS.savybes` (`plantPromptConfig.js:173`) — `pavojai[]` su enum'ais
  (`tipas`/`target`/`severity`), `pavojingumas`, `valgomumas`, `vaistinis`.
- `NARRATIVE_TOOL` (`toxicityNarrativePrompts.js:34`) — `detales` +
  `aiSupplementaryHazard` su `severity` užrakintu į `stiprus`.

**Problema:** `tool_choice: { type: 'tool' }` priverčia iškvietimą, bet Anthropic
tool argumentai **nėra strict-validuoti** → AI kartais grąžina `savybes` kaip
JSON-**string'ą** ar array'ų (dokumentuotas „Dracaena 2026-05-27" incidentas).
Todėl kode yra gynybinis parse'as (`batch-enrich-catalog.mjs:176`,
`plantTransform.js:127`).

**Rekomendacija:** įjungti `strict: true` ant tool'ų → API garantuoja
schema-validžius argumentus, ir gynybinis string-parse tampa nereikalingas.
Sąlyga: schema turi turėti `additionalProperties: false` + visus laukus
`required` (arba `type: ['...','null']`). `TOOL_DETAILS` reikės:

- pridėti `additionalProperties: false` kiekvienam nested object'ui;
- `ltSynonyms` (dabar ne-`required`) → padaryti `required` + leisti tuščią array,
  arba `type: ['array','null']`.

Tai taip pat **puikiai dera su §3.3 migracija** (perėjus į sonnet-5-5, `strict`
+ `tool_choice:auto` pakeičia forced režimą). Alternatyva — `output_config.format`
struktūrizuoti išvedimai; bet kadangi čia tool'as IR yra išvedimo forma,
`strict: true` ant tool'o tinka geriausiai.

> ⚠️ Architektūrinė pastaba: pagal `PROJECT.md:62-64` ir
> `docs/toksiskumo-klasifikacija.md`, **autoritetingas** toksiškumas ateina iš
> ASPCA/PFAF per deterministinį `deriveToxicity.js` (NE iš AI). AI tėra
> (a) vertėjas ir (b) griežtai apribotas auditorius. Struktūrizuotų išvedimų
> gerinimas nekeičia šios teisingos architektūros — tik sutvirtina AI išvedimo
> patikimumą.

---

## 7. Kaštų įvertinimas

> **Metodas:** tokenai įvertinti iš simbolių kiekio; kainos iš 2026-10 lentelės.
> Įverčiai ±~30 %. **Rekomendacija #1:** įjungti `response.usage` logging'ą
> (input/output/cache tokenai) → tikras €/augalą ir €/vartotoją (tai prašo ir
> `34-kastu-modelis.md:37-39` bei `60-galutine-santrauka.md` „AI COGS
> nepaskaičiuotas").

### 7.1 Vienam augalui enrich'inti

| Komponentas | Modelis | ~In | ~Out | Kaina (dabar, sonnet-4-6) |
|---|---|---|---|---|
| Phase 2 (`plant_details`) | sonnet-4-6 | ~14 000 | ~1 800 | ~**$0,069** |
| Toksiškumo narrative | sonnet-4-6 | ~4 400 | ~250 | ~**$0,017** |
| Hero vision brief (Gateway) | sonnet-4.5 | ~5 000 (+vaizdai) | ~400 | ~$0,02 |
| Hero vaizdas (Gemini) | gemini-3-pro-image | — | — | ~$0,03–0,06* |

- **Tik tekstas** (batch / `skipHero` re-enrich): **~$0,086 / augalą**.
- **Pilnas save** (su hero): **~$0,13–0,17 / augalą**.
- Katalogo bootstrap (274 augalai, tik tekstas): **~$24** vienkartinis.

*Gemini kaina — ne Claude; tikrintina Vercel Gateway dashboard'e. Kaštų modelis
(`34:13`) hero vertina **$0,20–0,50** (įsk. iki 6 kandidatų vision + re-roll) —
tai didžiausias per-augalą komponentas, bet **vienkartinis** per katalogo įrašą
(amortizuojasi tarp visų vartotojų per bendrą catalog).

**Po optimizacijų (sonnet-5-5 + caching + Batch API), tik tekstas:**
~$0,086 → **~$0,012–0,024 / augalą** (batch'e). Katalogo bootstrap: $24 → **~$3–7**.

### 7.2 Vienam vartotojui per mėnesį

Svarbiausia architektūra: **bendras catalog amortizuoja enrich** — catalog-hit
paieška kainuoja **$0** (`SearchModal.jsx:1376`; `34:11`). Taigi per-user kaštus
lemia ne enrich, o **paieška + chat**.

| Scenarijus | Prielaidos | ~Kaina/mėn (dabar) | Su Haiku chat+search |
|---|---|---|---|
| Nemokamas (su caps 5/5/2) | 5 paieškos + 5 chat | ~**$0,25–1,00** | ~**$0,05–0,20** |
| Aktyvus Pro | ~30 paieškų + 50 chat + ~5 naujų enrich | ~**$2,0–3,5** | ~**$0,8–1,3** |

**Kryžminė patikra su flotilės modeliu** (`34:14-19`): ~5k vartotojų → AI €200–600/mėn
→ **€0,04–0,12 / vartotoją / mėn**. Sutampa su aukščiau esančiu nemokamo vartotojo
įverčiu. Pagrindinis svertas abiem — **chat per Haiku**.

> ⚠️ `checkLimit` (`_firestore.js:65`) naudoja kaupiamąjį `aiUsage.{type}`
> skaitiklį **be matomos reset logikos** — neaišku, ar 5/5/2 yra per mėnesį, ar
> per visą laiką. Tai reikia patikslinti (ir svarbu per-user/mėn skaičiavimui).

### 7.3 Optimizacijų suvestinė

| Svertas | Pastanga | Efektas | Kur |
|---|---|---|---|
| Chat → Haiku 5.5 | 1 eilutė* | chat ~30× pigiau | §5 |
| Paieška → Haiku/Sonnet 5.5 | 1 eilutė* | ~30× / ~33× | §5 |
| sonnet-4-6 → sonnet-5-5 (enrich) | +tool_choice fix | ~33 % | §3.3 |
| Prompt caching (batch) | **padaryta** | batch ~2× | §4 |
| Batch API katalogui | vid. | −50 % batch | §7.1 |
| `PLANT_SYSTEM` split | vid. | Phase 2 in −40–50 % | §2 |
| `response.usage` logging | maža | matomumas (COGS) | §7 |

\* per `api/_lib/aiModels.js`, bet reikia kokybės eval + (paieškai) forced
tool_choice patikros.

---

## 8. Vitest padengimas

### 8.1 Buvusi būklė

- 7 test failai, **216 testų** — tik **gryni duomenų util'ai**
  (`forecastBase`, `wateringForecast`, `fertilizingForecast`, `deriveToxicity`,
  `toxinClasses`, `NotesContent`, `StatusTransitionSheet`).
- `vitest.config.js` apėmė **tik `src/**`** → `api/` funkcijos **visai nedengtos**.
- Sąmoningai nedengta (`docs/quality-infra.md`): komponentų render, E2E/Playwright,
  OAuth. CI yra **„aliarmas, ne užtvaras"** (`quality-infra.md:55`).
- Pirmas testų paleidimas kadaise pagavo realią toksiškumo `\b` regresiją
  (`921311e`) — t.y. testai čia jau įrodę vertę.

### 8.2 Spragos ir kas pridėta šiame PR

`api/` neturėjo **jokių** testų, nors ten gyvena auth + limitų + enrich logika.
Pridėta **+51 testas** (iš viso **267**), `vitest.config.js` dabar apima `api/**`:

| Naujas failas | Dengia | Kodėl kritiška |
|---|---|---|
| `api/_firestore.test.js` | `checkLimit`, `FREE_LIMITS` | laisvojo tier'o vartai — saugo AI biudžetą; beta/prenumeratos aplinkkeliai |
| `api/_lib/firestore-admin.test.js` | `verifyAuthToken` (mock firebase-admin) | **P0-1 saugumo fix** — kad validus→uid, invalidus→null, niekada nemeta |
| `api/_lib/visionAuth.test.js` | `tokenFor`, `PEPPER` | vision gate crypto — determinizmas + žinomas vektorius |
| `src/utils/plantTransform.test.js` | `ensureArray`, `normalizeAIResponse`, `normalizeSavybes`, `stripUndefinedDeep` | enrich boundary — toksiškumo struktūra + Firestore crash apsauga; dokumentuotos regresijos |

### 8.3 Dar nepadengta (rekomendacija)

- **Handler-lygio srautas** (`claude.js`/`stream.js`/`save-plant.js`): 401 be
  token'o, 403 limit_reached, idempotency. Reikia `req`/`res` + SDK + fetch mock'ų
  (sudėtingiau; verta — ten gyvena 403/401 sprendimai). Grynoji jų logika
  (`checkLimit`, `verifyAuthToken`) jau padengta.
- **`deriveToxicity-server.js`** — turi būti **MIRROR** su `src/utils/deriveToxicity.js`
  (`PROJECT.md:63`). Rekomendacija: testas, tikrinantis, kad abi kopijos duoda
  identišką rezultatą tam pačiam įvedimui (šis mirror jau sukėlė `\b` regresiją).
- **`middleware.js` Edge import'o** patikra preview deploy'e (žr. §9).

---

## 9. Saugumo ir architektūros pastabos

### 9.1 🔐 `catalog` rašymas atviras bet kuriam vartotojui (KRITIŠKA)

`firestore.rules:84-87`:

```
match /catalog/{docId} {
  allow read:  if request.auth != null;
  allow write: if request.auth != null;   // ← bet kuris prisijungęs
}
```

Naujoje kryptyje (**toksiškumo bazė kaip core, tikrinama mokslo akademijos
ekspertų**) tai reiškia: bet kuris prisijungęs vartotojas gali **perrašyti bendro
katalogo toksiškumo duomenis** (pvz. „toksiška" → „saugu"). Tai tiesiogiai
prieštarauja patikimos, ekspertų tikrinamos bazės vizijai ir kelia atsakomybės
riziką (galutinė santrauka mini PLD 2024/2853 griežtą atsakomybę nuo 2026-12-09,
`60-galutine-santrauka.md:117-119`). Pačios rules'ės tai pripažįsta: „Vėliau, kai
pridėsim moderation'ą, write'us apribosim".

**Rekomendacija:** `catalog` write → `isAdmin()` (arba moderator/ekspertas),
o vartotojų save'ai eina per server-side `save-plant` (jau tikrina `isAdmin`
admin mode'e). Tai pamatas „open DB + academia" krypčiai.

### 9.2 Vision-auth dublikatas (sutvarkyta)

`tokenFor()` + `PEPPER` buvo **dubliuoti** `middleware.js` ir `api/vision-unlock.js`
(abu komentarai įspėjo „TURI tiksliai sutapti"). Šiame PR iškelta į bendrą
`api/_lib/visionAuth.js` (tik Web API → Edge-suderinamas) + unit testai.
⚠️ **Edge middleware import'as tikrintinas Vercel preview deploy'e** (negaliu
patikrinti Edge runtime'o lokaliai).

### 9.3 `temperature` ir API-version — žr. §3.1.

---

## 10. md dokumentų vs kodo neatitikimai ir sena kryptis

Pagal užduoties instrukciją — pažymiu neatitikimus; seną kryptį naudoju tik kaip istoriją.

**Sena kryptis (istorija, nebeaktuali pagal naują KONTEKSTĄ):**

- `docs/lapasid/README.md` — desktop care-app redizainas, dvi šakos/domenai; nei
  žodžio apie toksiškumo-DB kryptį. **Legacy.**
- `README.md` / `PROJECT.md` — „augalų kolekcijos valdymo PWA" (care-app-as-core),
  toksiškumas kaip viena sub-feature. **Legacy framing** (bet techniniai faktai
  galioja).
- `60-galutine-santrauka.md` V1 vizija (NFC/QR/etiketės, „ES reguliacijos
  priekyje", €15K→€280K ARR) — **eksplicitiškai nužudyta** tame pačiame dokumente;
  nauja kryptis (3 segmentai: atvira DB + akademija / Pro / marketplace) atitinka
  dabartinį KONTEKSTĄ.

**Neatitikimai (kodas ↔ dokumentai):**

1. **Chat modelis:** kaštų dokumentai sako „chat per Haiku (jei dabar Sonnet)"; kodas
   patvirtina — chat **tikrai** Sonnet (`stream.js`). Svertas realus, nerealizuotas.
2. **PFAF:** `README.md:15` laiko PFAF core toksiškumo šaltiniu; `10-data-ai-moat.md`
   ir `60` įspėja, kad PFAF yra **NC-licencijuotas** (ne-komercinis) teisinis
   įsipareigojimas, kurį reikia pašalinti prieš monetizaciją — **o** `todo.md:119`
   tebeplanuoja „PFAF `sonnet-*` pipeline" (naują AI darbą su tais pačiais
   duomenimis). Prieštara spręstina strategiškai.
3. **Caching:** `todo.md:13` atmetė caching'ą kaip „low value" — teisinga gyviems
   pavieniams enrich'ams, bet **ne batch'ui** (žr. §4). Šiame PR caching'as
   pridėtas būtent batch/enrich keliui.
4. **Dvi toksiškumo sistemos:** `docs/toksiskumo-integracija.md` aprašo naują
   `resolveToxinProfile` sluoksnį VIRŠ esamo `pavojai[]` (abi koegzistuos);
   `pavojai[]` lieka fallback. Verta sekti, kad nesusidvigubintų tiesa.
5. **Deploy šaka:** `docs/lapasid/README.md:55` sako prod = `desktop-ux`;
   `README.md:82` sako deploy = `main`. Pasenęs dokumentas.

---

## 11. Rekomendacijų prioritetai

| # | Veiksmas | Prioritetas | Pastanga | Statusas |
|---|---|---|---|---|
| 1 | `catalog` write → admin/ekspertas (§9.1) | 🔴 aukštas (saugumas) | maža | rekomendacija |
| 2 | `response.usage` kaštų logging (§7) | 🔴 aukštas | maža | rekomendacija |
| 3 | Chat → Haiku 5.5 (+eval) (§5) | 🟠 vidutinis | maža | rekomendacija |
| 4 | Enrich → sonnet-5-5 + tool_choice/strict fix (§3.3, §6) | 🟠 vidutinis | vidutinė | rekomendacija |
| 5 | Prompt caching enrich/batch (§4) | 🟢 — | — | **padaryta** |
| 6 | Centralizuoti modeliai + SDK bump (§3) | 🟢 — | — | **padaryta** |
| 7 | Vision-auth DRY + api/ testai (§8) | 🟢 — | — | **padaryta** |
| 8 | `PLANT_SYSTEM` split Phase 1 / Phase 2 (§2) | 🟠 vidutinis | vidutinė | rekomendacija |
| 9 | SDK → 1.x (major) (§3.1) | 🟢 žemas | vidutinė | rekomendacija |
| 10 | Batch API katalogui (§7.1) | 🟢 žemas | vidutinė | rekomendacija |

---

## 12. Priedas: šio PR failų sąrašas

**Nauji:**
- `api/_lib/aiModels.js` — centralizuoti modeliai + cache žymeklis.
- `api/_lib/visionAuth.js` — bendras vision token algoritmas.
- `api/_firestore.test.js`, `api/_lib/firestore-admin.test.js`,
  `api/_lib/visionAuth.test.js`, `src/utils/plantTransform.test.js` — testai.
- `docs/AI_REVIEW.md` — ši ataskaita.

**Pakeisti:**
- `api/claude.js`, `api/claude/stream.js`, `api/save-plant.js`,
  `api/_lib/toxicityNarrativeGenerator-server.js`, `scripts/batch-enrich-catalog.mjs`,
  `api/_lib/heroGen.js` — modelių centralizavimas + caching.
- `api/vision-unlock.js`, `middleware.js` — bendras visionAuth modulis.
- `package.json`, `package-lock.json` — SDK `^0.137.0`.
- `vitest.config.js` — apima `api/**` testus.
