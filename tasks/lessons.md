# Lessons

Patternai/klaidos, kurias darau, ir kaip jų išvengti ateityje.

---

## 1. Simplify default'as — neover-engineerinti

**Data:** 2026-05-15
**Trigger:** User'is pastebėjo, kad pridėjau „soon" tier'ą prie widget badge'ų be prašymo (jis prašė tik kad overdue būtų geriau matomas). Plus auth fix'e pridėjau `authReady` await, `credentialDone` race coordination, server-side OAuth flow — viskas tampa nereikalinga, kai grįžom prie veikiančios geliu-db logikos su `signInWithPopup`.

**Patternas:** User'is prašo SPECIFIC tiny improvement. Aš PRIDEDU papildomus tier'us / branches / „kad būtų gražiau" / „kad ateityje galbūt..." optimizations'us.

**Rule:** prieš parašant **bet kokį** naują tier'ą, animation'ą, „backup" kodą ar conditional branch'ą, paklausti savęs:
- Ar user'is to prašė?
- Ar yra konkretus current pain'as ką tai sprendžia?
- Ar atsakymas tik „kad ateityje galbūt..." / „kad būtų gražiau"?

Jei taip į trečiąjį → **NEDARYTI** tyliai. Drop'inti scope'ą iki to, ko prašyta.

**NIUANSAS** (svarbu, 2026-05-15): jei matau ką nors verto, ko user'is gal nemato — **PASIŪLYTI atvirai**, ne pridėti tyliai prie scope'o. User'is sprend'i taip/ne. Skirtumas:

| ❌ Smuggle scope | ✅ Propose ir discuss |
|------------------|----------------------|
| „Pridėjau ring'ą action-needed kortelėms" (be klausimo) | „Matau, kad ring'as galėtų pagelbėti — bet rizikuoja atrodyti kaip decoration. Bandom?" |
| Tyliai įvest „soon" tier'ą prie badge'o | „Galiu pridėt vidurinį tier'ą artėjantiems poreikiams. Reikia?" |

User'is vertina mano matymą, ko jis nemato. Tas svarbu išlaikyti. Bet jokio scope smuggling'o — visada paskelbiu intent'ą, leidžiu pasakyti „ne, paprasčiau".

**Konkretūs pavyzdžiai šioje sesijoje:**
- ✗ „Soon" tier'as widget badge'uose (≤2d iki sekančio → žalia bg) — user nepraše, kūrė vizualinę painiavą
- ✗ Colored ring'as ant action-needed cards — user nepraše, atrodė kaip decoratyvinis rėmelis ne urgency
- ✗ `authReady` await + `credentialDone` race coordination — over-engineered iOS PWA auth
- ✗ Server-side OAuth flow (kai signInWithPopup veikia)
- ✗ Bone halo ant mascot FAB (atrodė kaip projektorius)
- ✗ navigateFallbackDenylist workbox'e be reikalo

Mažiau code'o = mažiau klausimų ką ir kada naudoti.

---

## 2026-05-17 — LLM prompt engineering trap: overfitting ant vieno edge case'o

**Konkretus pavyzdys:** Test'avime „Rosa Knock Out" search'as grąžino single plant + tuščius candidates'us, vietoj 13 serijos cultivars'ų. Pradėjau ciklą po ciklo stiprinti prompt'ą: explicit pavyzdžiai, ❌/✅ contrast'ai, quote interpretation rules, struktūrinis formatting'as su `═══` separator'iais, maxTokens 2500→4000, temperature 0.3→0.2, web_search max_uses 1→2.

Šeši commit'ai per ~30 min, kiekvienas „šitas tikrai veiks". Vis dar fail'ino.

**User'is sustabdė** klausdamas: „pasitikrinam ar tai ka darom nera kad uzsiciklinam vienai prolemai ir taip gadinam bendra logika ja overengineerindami?"

**Realybės check'as po revert'o:** Claude Sonnet'as Rosa Knock Out cultivars'ų pavadinimų **GALIMAI tiesiog nežino su pakankama tikrumu**. Tai LLM training data riba. Joks prompt'o massaging'as šitos ribos neperžengs.

**Pattern atpažinimas:**
- AI grąžina blogą atsakymą
- Mes pridedam prompt rules
- AI vis vien blogai
- Mes pridedam dar griežtesnių rules
- AI ignoruoja
- Mes lower'inam temperature
- AI vis vien savo
- Mes pridedam web_search
- ...

Tai **diminishing returns spiralė**. Kiekvienas pataisas turi neigiamą impactą **visoms** užklausoms (slower, more tokens, more cost), o nauda **vienai** edge case'o užklausai neaiški.

**Big picture:**
- AI yra augimo įrankis, ne visagalė
- Edge case'us sprend'ia **MANUAL admin curation** (Library tab CRUD jau egzistuoja)
- Vieną kartą admin'as įveda → visi user'iai gauna instant per library-first
- LLM data ribos = REALYBĖ, ne fixable per prompt

**Rule sau:**
> Po **trijų** prompt iteracijų toje pačioje problemoje — STOP. Klausti: ar AI tiesiog nežino? Ar manual fallback yra teisingesnis sprendimas? Ar tobulinimas dabar kainuoja kitiems use case'ams?

**Šitoje sesijoje:**
- Pirmi 3 commit'ai (`33244a8` hero hide, `c1ce492` cache guard, `7eab2b1` quote rule) — general improvements, naudingi visiems. ✓
- 4-tas (`d1743b9` token+temp+websearch+restructure) — over-tuning vienai problemai. **Revert'inta.**

**NIUANSAS:** general improvements (hero hide, cache guard) kuriuos sukėlė viena problema — OK, jei jie naudingi platesniam kontekstui. Bet kai jie tampa „bet kokia kaina priversti AI sutikti dėl Rosa Knock Out" — stop'a.

---

## 2026-05-27 — „Long-term TODO" framework'as = užmaskuotas bandaid'as

**Trigger:** Kai admin'as norėjo keisti Brave/Google rastą nuotrauką, susidūriau su problema — `isPublicPhoto` whitelist'as priima TIK Wiki/iNat/Firebase Storage URL'us. Mano pirmas atsakymas buvo:

> „**Trumpalaikė**: opcija B — relax whitelist'as, leisti bet kokį HTTPS URL. **Long-term TODO**: opcija C — re-host į Firebase Storage."

Tada radau, kad `/api/rehost-image` jau egzistuoja (užkoduotas Variant B save flow'ui), ir pakeičiau planą į rehost.

**User'is paaiškino klaidą:**
> „ne long term o current. Kaip sakiau, geriau planuojam ir atmetam nei darom bandaid sprendimus kuriuos reikės perdarinėti"

**Patternas:** Kai sutikau nepatogų constraint'ą (whitelist), iškart pasiūliau du sprendimus — vieną teisingą („long-term"), vieną greitą („trumpalaikį"). Tai užmaskuotas bandaid: pakviečiau user'į pasirinkti GREITĄ, nes „long-term" skamba kaip lėtas.

Tačiau jei žinau, kad sprendimas yra teisingas, jis ne „long-term" — jis **CURRENT**. „Long-term" framework'as duoda leidimą atidėti teisingą darbą ir įkišti bandaid'ą „šiandien".

**Rule sau:**
> Kai siūlau planą su „trumpalaikiu" ir „long-term" variantu — STOP. Klausti:
> 1. Ar „long-term" sprendimas yra realiai teisingas? Tada jis CURRENT.
> 2. Ar užtenka laiko jį padaryti dabar? Beveik visada — taip (jis pats sako „long-term", bet tai dažnai 1-2h darbo).
> 3. Ar „trumpalaikis" turi nors VIENĄ unique benefit'ą, ko teisingas sprendimas neturi? Ne → nedaryti jokio bandaid'o.
>
> Patikrinti CODEBASE ar jau yra reikiama infrastruktūra prieš siūlydamas naują sprendimą. Šiuo atveju — `/api/rehost-image` jau egzistavo, bet aš to neradau pirmu metu.

**Konkretus naudis šitam projektui:**
- Bandaid (whitelist relax) = 5min code change, bet reiškia Brave URL'ai sulūžta per kelias savaites (hotlinking, dingusios nuorodos)
- Teisingas (rehost) = ~30min code change (naudoja egzistuojantį endpoint'ą), Brave nuotraukos saugomos Firebase Storage permanent
- „Trumpalaikis" sprendimas reikalautų: (a) whitelist relax dabar, (b) data migration vėliau (rehost visus broken'us), (c) UI rework
- Teisingas iškart = vienas commit'as, jokios skolos

**Plačiau:** „Trumpalaikis" sprendimas reiškia, kad mes priimam architektūrinę skolą. Skola visada brangesnė vėliau (admin'as turi perdaryti, user'iai mato broken images, debugging time). Code'as, kuris žinai reikės perdarinėti, NĖRA acceptable kaip „šiandien".

---

## N. Multi-layer data flow — kiekvienas layer'is gali ignore'inti curated truth

**Data:** 2026-06-01
**Trigger:** Sansevieria trifasciata bardakas. `species-lt-names.json` TURĖJO `"sansevieria trifasciata": "Trijuostė sansevjera"` nuo seno. Vis tiek display'us rodė „Sansevieria" arba „Sansevierija" / „Trijuoste dracena". Reikėjo KETURIŲ commit'ų pataisymui per skirtingus layer'ius:
- `28dddcd` — pridėti `dracaena trifasciata` override (2017 reclassification)
- `4421929` — perduoti ltName į narrative gen Sonnet'ą
- `51be7ef` — server-side override AI's lietuviskas
- `879a7be` — structural diacritic reconcile (lietuviškas vs lietuviskas)

**Patternas:** mes turim curated data (lt-names, pre-DB), bet pipeline'e yra **AT LEAST 4 layeriai**, kur informacija prarasdavo:

| Layer | Failure mode |
|-------|-------------|
| **L1: lookup** | Entry missing (Dracaena trifasciata po Sansevieria reclass) |
| **L2: AI prompt** | Tool description tells AI to generate own value, ignoring RAG |
| **L3: Structural** | Du atskiri JS object keys su / be diacritics — abu egzistuoja, display reads vienas |
| **L4: Downstream specialists** | Atskiri Sonnet call'ai (narrative, hero gen) negauna RAG context'o |

**Rule:** prieš pridedant naują „authoritative source" (lt-names extension, species-lt-names, future datapoint), užtikrinti, kad VISI naudotojai jį skaito:
1. Phase 1 lookup ✓
2. RAG context build ✓
3. AI tool prompt — INSTRUCTS to use, ne to override
4. Server-side validation/override — safety net jei AI ignore'ina (NOT primary path)
5. Structural consistency (single key name, no diacritic variants)
6. Downstream specialists (narrative gen, hero gen) — pass canonical
7. F1 catalog overlay — preserve correctly

**Anti-pattern (bandaid):** server-side post-AI override. Tai saugo, bet user'is gali nerasti ROOT cause (prompt instructions tells AI to do wrong thing). Geriausia: RAG instructive prompt + override kaip safety net.

**Specifinis Sansevieria atvejis (botaninis context — reikalingas mental model):**
- 2017 Mansoor et al. publikacija: Sansevieria genus susijungė į Dracaena genetiškai
- Botanikai priėmė merge (Kew, POWO)
- BET vernacular community (gardeners, vendors) toliau naudoja „sansevjera"
- Algorithmic Lithuanianization „Dracaena → Dracena → Trijuoste dracena" yra TECHNIŠKAI nuoseklus, bet BOTANIŠKAI klaida
- Curated dictionary (mūsų override) yra autoritetingesnė už AI's training-derived rules

---

## N+1. Short-circuit evaluation hides scope bugs

**Data:** 2026-06-01
**Trigger:** Sansevieria crashed PlantDetail su `ReferenceError: isEnriching is not defined`. Mėnesius kodas veikė. Kodėl būtent Sansevieria?

**Patternas:** Code'as `const x = !heroIllus && isEnriching` per JS short-circuit:
- Augalai SU heroIllus (95%): `!heroIllus = false` → JS NIEKADA neperskaito antrojo operando → no crash
- Augalai BE heroIllus (5%, e.g. Sansevieria pre-enrich): `!heroIllus = true` → JS bando skaityti `isEnriching` → out-of-scope ReferenceError

`isEnriching` buvo declared'as INNER funkcijoje (ProfileContent) bet referencavomas OUTER komponente. Bug egzistavo nuo įvedimo, bet trigger condition buvo retas.

**Rule:** kai naudoji JS short-circuit (`A && B`, `A || B`, `A ?? B`), VISI operandai turi būti valid reference'ai SCOPE'e net jei rarely evaluated. Jei B yra optional, naudok explicit `const B = (...)`, ne implicit scope leak.

**Test strategy:** edge case'ai (empty data, missing fields, default states) yra trigger conditions. Visada testuoti su PILNAI tuščiu plant'u, ne tik filled fixtures.

---

## N+2. `fromAIResult` defaults — initial save vs re-enrich semantic mismatch

**Data:** 2026-06-01
**Trigger:** User'is re-enrich'ino Karantinas plant'ą → status reset'inosi į 'healthy', plant'as dingo iš Karantinas sekcijos.

**Patternas:** `fromAIResult(aiResult)` (plantTransform.js) grąžina hardcoded defaults personal field'ams: `status: 'healthy'`, `komentaras: ''`, `data_prideta: today()`, `photos: ensureArray(aiResult.photos)`.

INITIAL SAVE: defaults teisingi (klientas pirmasis rašo tuos pačius defaults per dual-write).
RE-ENRICH: defaults DESTROY user state (status='quarantine' → 'healthy', etc.)

Function buvo parašyta INITIAL save context'e. Kai re-use'inta re-enrich path'e (saveUserPlantServer merge:true), defaults overrode user state.

**Rule:** **Pure transformation functions su default'ais ne tinka MERGE patternuose.** Du sprendimai:
1. Strip personal field'us iš function output prieš merge (mūsų fix #61)
2. Du atskiri function variantai: `fromAIResultForCreate` (su defaults) + `fromAIResultForOverlay` (be personal)

Bendras principas: **funkcijos signatures turi išryškinti kontekstą.** `merge: true` su default-filled object'u = silent overwrite bug magnet'as.

---

## N+3. UX iteration sometimes ends in revert — that's fine

**Data:** 2026-06-01
**Trigger:** StatusMenu redizainas: dropdown → bottom sheet (consistent su ZonePicker) → user feedback'as „prieš tai patiko" → revert į dropdown.

**Patternas:** Trys atskiri commit'ai vienam UX elementui:
1. #55 default-hide („slėpti Sveikas chip")
2. #62 bottom sheet refactor (didesnis touch target, consistency)
3. #63 revert į dropdown + chip visada matomas

Total: ~150 lines code churn už net effect ≈ niekas iš originalaus state'o.

**Rule:** **UX iteration cost yra real**, bet NĖRA failure. Be šitų iteracijų user'is nežinotų, kad jam patiko original — net pats sakė „prieš tai patiko". Vertingas insight'as gimsta išbandant.

**Mitigation patterns:**
- Mažus UX exp'us labai aiškiai paženklinti commit'e („ux-experiment", „revert-on-feedback OK")
- Po revert'o — RAŠYTI down KODĖL revert'inta, ne tik kad revert'inta. Kitą kartą pasiūlys problem'ą iš kito kampo.
- NĖRA need apkraustyti save'osi dėl iteracijos churn'o — visada parodoma user'iui prieš commit'inant.

**Konkretus insight'as iš #63 revert'o:** „semantic state" vs „absence state" turi skirtingą default-hide treatment'ą:
- Status (healthy/sick/karantinas/numire): kiekviena reikšmė nešioja semantic state'ą → always show
- Zone (assigned vs Nepriskirta): absence vs presence → hide when absent OK

---

## N+4. Cache-Control silent default == perceived „slow loading"

**Data:** 2026-06-01
**Trigger:** User'is matė visible photo resize Dashboard kortelėse cycling'inant tarp augalų. Biblioteka cards (watercolor) — fast, Dashboard cards (real photos) — slow.

**Patternas:** Firebase Storage uploads DEFAULTINA į `max-age=3600` (1h) jei `cacheControl` metadata nepateikta. Service Worker workbox cache RULE'as match'ino firebasestorage URLs, bet HTTP cache'as silpnas. Dashboard cycling A→B→A→B užtekdavo invalidate'inti SW LRU eviction'u plant'uose su retų visit'ų.

Catalog heroes (heroGen) JAU turėjo `cacheControl: 'public, max-age=31536000, immutable'` — kodėl Biblioteka jaučiasi greitai. User uploads (uploadImage) — pamiršta metadata → silent slow.

**Rule:** Visiems Storage upload'ams setting'inti EXPLICIT `cacheControl` metadata, net jei feature'as ne performance-driven. Default'as „1 hour" tinka log files'ams, NETINKA media assets'ams. Path uniqueness (timestamp filename'e) garantuoja immutability.

**Future watchlist:** kiekvieną `uploadBytes()` call'ą code review'inti dėl metadata.
