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
