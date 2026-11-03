# LapasID — agentų darbo sintezė (2026-11-03)

> **Kas tai.** Vienas dokumentas, sujungiantis 6 agentų darbą (7 šakos, PR #1–#7), birželio
> konsiliumo išvadas ir papildomus faktų patikrinimus. Skirtas sprendimams priimti vienoje vietoje.
> **Kaip skaityti.** §0 — 2 min. santrauka. §3 — kur agentai nesutaria. §8 — sprendimai, kurių
> reikia iš savininko (su mano rekomenduojamu atsakymu).
> **Ribos.** Agentų ataskaitos nekeistos — nukopijuotos į [`agentai-2026-11/`](agentai-2026-11/).
> Nieko nemerge'inta į `main`, nedeploy'inta. Vizija savininkui — [`VISION.md`](VISION.md);
> dokumentacijos žemėlapis — [`README.md`](README.md).

---

## 0. Santrauka (TL;DR)

1. **Kryptis aiški ir visi 6 agentai ją palaiko:** CORE = kambarinių augalų toksiškumo DB +
   namų rizika (kas gyvena namuose → kas kam pavojinga → kur laikyti → kortelė medikui).
   Priežiūra ir „charakteriai" — antraeiliai. Tai tiesus birželio konsiliumo „1 segmento"
   (atvira saugumo biblioteka) tęsinys.
2. **Pagrindinė problema — ne UI, o pati „tiesa".** Patikimos toksiškumo DB kaip objekto
   **nėra**: toksiškumas yra enrich pipeline'o šalutinis produktas iš ASPCA/PFAF euristikų, su
   įrodytomis klaidomis (19 iš 31 toksiškų genčių runtime nesutampa su struktūriniu modeliu;
   Jatrofa — be toksiškumo; lelija katei → „vidutinis"; Lotus gauna kito augalo puslapį), ir
   **bet kuris prisijungęs vartotojas gali ją perrašyti**. Viskas, ką norime statyti (namų rizika,
   medikų kortelė, akademija, Wallet), stovi ant šito pamato.
3. **Stipriausias architektūrinis pasiūlymas — toksiškumo agento (PR #5):** kuruojamas,
   versijuojamas toksikologijos žinynas git'e → leidimai su versija → programėlė skaito tik
   leidimą per vieną resolverį; AI iš saugos kelio runtime pašalinamas. Siūlau jį priimti kaip
   stuburą, bet **minimalia versija** (vienas aplankas, šaltiniai prie kiekvieno teiginio,
   ~100 eil. kompiliatorius, CI testai, GitHub PR kaip peržiūra) — pilna ekspertų darbo eiga
   programėlėje — tik kai bus ekspertas (§5.2).
4. **Namų rizikos MVP (PR #7) — vertingas UI ir logika, bet NE leisti kaip yra:** jis prijungia
   nepatikrintą juodraštį, **Kalankę** katei/šuniui/žmogui rodo kaip „MIRTINAS" su ženkleliu
   **„Skambink dabar" augalo puslapyje be jokio įvykio**, o medikų kortelėje — nepatikrintus gydymo
   tekstus. Sprendimas — ne savavališkai mažinti sunkumą (tai būtų nuraminimas be eksperto), o
   keisti formuluotę, šalinti ženklelį ir mažinti tik su šaltiniu (§3 P4).
5. **Skubu, bet nedega.** Vieša biblioteka prod'e išjungta, o programėle be tavo rankinio
   patvirtinimo naudotis negali niekas. Bet: (a) bet kuris prisijungęs gali perrašyti katalogo
   toksiškumą, o `/api/catalog/public` jį jau grąžina viešai; (b) saugumo PR #3 šios skylės
   **neuždaro**, o jo rules pakeitimas **sulaužytų registraciją** (§6.1); (c) kiekvienas naujas
   vartotojas gauna `beta: true` → AI limitų realiai **nėra niekam**, o neribotą Sonnet prieigą
   per `/api/claude` turi bet kas su Google paskyra, net nepatvirtintas (§4.7); (d) toksiškumo
   kodo pataisos **nepataiso jau išsaugotų** katalogo duomenų — reikia perskaičiavimo arba viešo
   endpoint'o maskavimo (§4.9).
6. **Naujas strateginis klausimas — kas yra CORE techniškai.** Siūlau vieną sakinį (§7):
   *CORE — statinė, Google indeksuojama augalo × namų nario saugumo puslapių biblioteka,
   generuojama iš versijuoto JSON git'e, naudojama be prisijungimo; „mano augalai" ir namų
   profilis — telefone su eksportu; kortelė adresuojama taksonu + versija; Firebase programėlė
   užšaldoma už savo login'o.* Stipriausias argumentas — **pasiekiamumas** (žmogus 23 val. googlina
   „ar lelija nuodinga katei", o ne atsidaro app'ą), ne GDPR. Evoliucija, ne perrašymas.
7. **Infrastruktūros faktai, kurių agentai nepaminėjo** (nors 12 funkcijų lubos žinomos nuo
   birželio, `00-STATE.md`): kiekvienas siūlomas naujas endpoint'as (K3, ištrynimas, eksportas,
   Wallet) nebeįsideploy'ins be konsolidacijos, o Vercel Hobby **draudžia komercinį naudojimą**
   (Stripe/Pro = $20/mėn. Vercel Pro arba kitas hostingas).

---

## 1. Ką padarė kiekvienas agentas

| PR | Agentas | Šaka | Tipas | Būsena |
|---|---|---|---|---|
| #1 | Produkto vadovas | `claude/loving-knuth-s27sqt` | `docs/PRODUCT_DIRECTION.md` | draft |
| #2 | Saugumo/privatumo auditas | `claude/hopeful-pascal-y1ra5g` | `docs/SECURITY_AUDIT.md` | draft |
| #3 | ↳ kritiniai taisymai | `claude/security-critical-fixes` | kodas (4 failai) | draft |
| #4 | Architektūra | `claude/sleepy-franklin-a43lnd` | `docs/ARCHITECTURE.md`, `docs/REFACTOR_PLAN.md` | draft |
| #5 | Toksiškumo duomenys | `claude/toxicity-data-pipeline-lxu0ej` | `docs/TOXICITY_DATA.md` + audito skriptas | draft |
| #6 | AI sluoksnis | `claude/beautiful-edison-92r77m` | kodas + `docs/AI_REVIEW.md` | draft |
| #7 | Namų rizikos MVP | `feature/household-risk` | kodas (17 failų) + `docs/namu-rizika-mvp.md` | draft |

**Produkto vadovas (PR #1).** Nubrėžė freemium ribą (visa saugumo info nemokama; Pro —
priežiūra, neribota kolekcija, eksportas/Wallet, €29–39/m.), 3 žingsnių onboarding'ą (namų
profilis → foto/paieška → rezultatas per 60 s), akademijos partnerystės mainus (pirmas žingsnis —
vienas laiškas Apsinuodijimų biurui), Wallet įgyvendinamumą (~5–7 d.d., „daryti, bet ne dabar"),
agreguotų duomenų rizikas („neskubėti") ir 15 klausimų savininkui. Silpnoji vieta — kai kurie
skaičiai ir teiginiai perimti iš senų dokumentų be patikros (žr. §3, §4).

**Saugumo auditas (PR #2, #3).** Serverio sluoksnis (JWT, SSRF, secrets) tvarkingas, bet
**Firestore rules** turi kritinių spragų: K1 atviras AI relay, K2 bet kas gali tapti admin'u,
K3 bet kas gali įsirašyti į svetimą kolekciją, K4 AI limitai apeinami. PR #3 taiso K1/K2/K4;
**K3 — #1 likęs kritinis** (reikia serverinio `/api/accept-invite`). Plius 6 aukšti, 5 vidutiniai,
ir išsami GDPR dalis (minimizavimas, sutikimas, ištrynimas, eksportas, Anthropic DPA). Paneigė
`tasks/audit-2026-06-02.md` teiginį „backbone saugus".

**Architektūra (PR #4).** `ARCHITECTURE.md` — tikslus žemėlapis iš kodo (11 HTTP endpoint'ų,
7 Firestore kolekcijos, enrich pipeline, AI kvietimai). `REFACTOR_PLAN.md` — kiekvienas modulis
suklasifikuotas CORE / OPCIJA / ATSISAKYTI + atskyrimas feature flag'ais. Pagrindinė išvada:
duomenų sluoksnis yra, namų-rizikos produkto branduolys — ne. Silpnoji vieta — planas laiko
enrich pipeline'ą CORE toksiškumo šaltiniu ir siūlo dar vieną client/server mirror porą (žr. §3).

**Toksiškumo duomenys (PR #5).** Giliausias darbas. Rado 5 lygiagrečias toksiškumo sistemas,
empiriškai patikrino (`scripts/audit-toxicity-sources.mjs`): PFAF iš principo nedokumentuoja
kambarinių (Kalanchoe 36 rūšys / 0 su pavojų tekstu), 85 PFAF „genties" įrašai turi kitos
genties turinį, ASPCA crosswalk pasiekia tik 23 % toksiškų įrašų, lelija katei prarandama.
Palygino 6 alternatyvas ir rekomendavo vieną: kompiliuojamas, versijuotas, ekspertų kuruojamas
žinynas su asimetriniu įrodymų slenksčiu („įspėti galima anksčiau nei nuraminti"), deterministine
vietos taisyklių lentele ir ekspertų darbo eiga per klases+šeimas (ne per tūkstančius augalų).
Migracija 5 fazėmis.

**AI sluoksnis (PR #6).** Centralizavo modelių pavadinimus, pridėjo prompt caching, SDK
`0.39 → 0.137`, bendrą vision-auth modulį, +51 testą (`api/` anksčiau neturėjo jokių). Rado:
migracija į `sonnet-5-5` sulaužytų enrich'ą (priverstinis `tool_choice` → 400); chat per Haiku
5.5 — ~30× pigiau; enrich ~$0,09/augalą; nemokamas vartotojas ~$0,25–1/mėn.; `aiUsage`
skaitiklis neturi reset logikos (5/5/2 limitai realiai „visam laikui", ne per mėnesį).

**Namų rizikos MVP (PR #7).** Vienintelis agentas, statęs CORE produktą: namų profilis,
`resolveToxinProfile` + `assessHouseholdRisk` (gryna logika, 27 testai), per-augalo rizika su
vietos rekomendacija, spausdinama/dalinama toksikologinė kortelė, viešas `/t/{plantId}`.
Kruopščiai laikėsi liability ribų (be balo, be triažo, „nėra duomenų ≠ saugu", numeriai
nespėjami). Problemos — duomenų pusėje (žr. §3, §4).

---

## 2. Kur agentai sutaria (konsensusas)

- **Kryptis:** toksiškumas + namų rizika = CORE; priežiūra/chat = antraeiliai; NFC/marketplace/
  ES „mandatas" = istorija. (Visi 6.)
- **Saugumo informacija niekada neužrakinama už paywall.** (Produktas, Toksiškumas, konsiliumas.)
- **Katalogo rašymas turi būti užrakintas** — bent 5 iš 6 agentų tai įvardija.
- **Raudonosios liability linijos:** jokio simptomų→sprendimo srauto (MDR Rule 11), jokio
  „saugumo balo", „nėra duomenų ≠ saugu", sunkumo gradacija, katė ≠ šuo. (Produktas, Toksiškumas,
  Namų rizika, konsiliumas 45/46.)
- **GDPR minimizavimas:** jokio vaiko vardo/tikslaus amžiaus. (Visi, kurie lietė temą.)
- **Akademija/toksikologas** — būtinas, kad duomenys taptų „patvirtinti"; pirmas žingsnis — vienas
  laiškas, ne paraiška.
- **Trūksta mirtinų genčių** (`LILIUM`, `HEMEROCALLIS`, `NERIUM`, `CONVALLARIA`…) — Toksiškumas ir
  Namų rizika nepriklausomai priėjo tą pačią išvadą.
- **Dokumentai pasenę** (README/PROJECT framing, DESIGN.md paletė, `src/ARCHITECTURE.md` Stripe,
  „auditas 100 % uždarytas") — keli agentai.

---

## 3. Kur agentai PRIEŠTARAUJA (ir mano siūlomas sprendimas)

| # | Tema | Kas sako ką | Siūlomas sprendimas |
|---|---|---|---|
| P1 | **Katalogo rašymo skubumas** | Saugumo auditas: „žemas prioritetas" (§3.3), PR #3 jo netaiso. Produktas, Architektūra, Toksiškumas, AI: P0/kritinis. | **P0.** Su PLD ir viešu `/api/catalog/public` tai saugos produkto integralumo klausimas. Ir tai ne vien rules: žr. §4.1. |
| P2 | **Kaip prijungti toksiškumo modelį** | Architektūra: resolveris kaip client+server **mirror**, enrich lieka CORE šaltinis. Namų rizika: prijungė juodraštį tiesiogiai (variantas „B"). Toksiškumas: B **atmestas** — AI parašyti tekstai įgautų autoritetą be patikros; vienas resolveris, be mirror; kompiliuotas leidimas. | **Toksiškumo variantas (C), minimalia forma (D1).** Mirror'ių istorija jau sukėlė regresiją (`\b` bug); statiniam leidimui serverio kopijos nereikia. PR #7 UI ir logika pernaudojami, duomenų šaltinis keičiamas. |
| P3 | **AI toksiškumo narratyvas** | AI agentas: optimizuoti (caching, vertėjas per Haiku, `strict` savybes laukams). Toksiškumas: **pašalinti** narratyvą ir toksiškumo laukus iš Phase 2 — runtime AI saugos kelyje = nepatikrintas tekstas kas kartą. | **Neinvestuoti į narratyvą.** Pašalinti, kai bus leidimas (Fazė 3). Caching'as tam keliui — nebeaktualus; `aiModels.js`, testai, SDK — naudingi nepriklausomai. |
| P4 | **Sunkumas: lubos ar tipinis** | Namų rizika: rodo klasės `rusies_jautrumas` (= lubos) → Kalankė „MIRTINAS". Toksiškumas §10.6: lubos ≠ tipinis pavojus. Konsiliumas 46: binaras gąsdina be reikalo. Fable (peržiūra): sumažinti be eksperto = nuraminimas be įrodymo — prieštarauja asimetriniam slenksčiui. | **Vertės nemažinti savavališkai.** Keisti formuluotę („gali sukelti sunkų apsinuodijimą; dažniausiai — vėmimas, viduriavimas"; klasė ir augalo dalis įvardinti), šalinti „Skambink dabar" ženklelį augalo puslapyje, o mažinti tik per `overrides` įrašą **su šaltiniu** (pvz. ASPCA Kalankei). |
| P5 | **Kur saugoti namų profilį** | Namų rizika: `collections/{cid}.settings.household` (matomas visiems kolekcijos nariams; K3 atveju — bet kam). Produktas: `users/{uid}` arba `localStorage`. Liability red-team: „laikyti lokaliai". | **Įrenginyje (local-first)**, sinchronizacija — tik jei vartotojas aiškiai nori (Pro/kelių įrenginių). Žr. §7. |
| P6 | **Vaiko amžius** | Saugumas G1, Toksiškumas: tik boolean. Namų rizika: neprivalomi intervalai 0–3/4–6/7+. Produktas: „iki 6 m." / „paauglys". | **Dvi vėliavėlės:** „mažas vaikas (iki ~6 m.)" ir „vyresni vaikai". 71 % ekspozicijų ≤5 m. (pediatro lęšis) — ši riba neša rizikos signalą be identifikuojančių duomenų. Jei profilis tik įrenginyje — GDPR klausimas beveik išnyksta. |
| P7 | **Pagalbos numeris kortelėse** | Founder'io sprendimas birželį (`50-vizija` F.3): **be numerio** iki partnerystės. Produktas: numeris disclaimer'yje. Namų rizika: `null` + TODO. Pediatro lęšis: „pigiausia tikra vertė app'e". | **Rodyti 112 + Apsinuodijimų informacijos numerį su „patikrinta YYYY-MM-DD"**, tikrinti kas ketvirtį. Faktų patikra: +370 5 236 2052 patvirtintas paieškoje; antras numeris (+370 687 53378) **nerastas** — nenaudoti. Sprendimas savininkui (§8, S11). |
| P8 | **Namų rizikos ataskaita: Free ar Pro** | Konsiliumas 46 (#4): kolekcijos saugumo ataskaita = **Pro**. Produktas: namų rizikos sąrašas = **Free**, bet kolekcija nemokamai tik ~10 augalų (tai netiesioginis paywall saugumui). | **Free, be augalų limito saugumo daliai.** Riboti galima priežiūrą/chat, ne rizikos sąrašą. |
| P9 | **Onboarding: foto pirmiausia** | Produktas: numatytasis kelias — foto. Toksiškumas F7: identifikacijos neapibrėžtumas į toksiškumą neperduodamas; poison control #1 problema = augalo tapatybė. | **Foto — taip, bet su patvirtinimu:** „Ar tai X?" + jei kandidatų toksiškumas skiriasi — rodyti blogiausią ir prašyti patvirtinti. |
| P10 | **Hero akvarelės** | Architektūra: CORE. Kaštų modelis: didžiausias per-augalą AI komponentas. | **Brand turtas, ne CORE.** Esami lieka; naujiems — ne prioritetas. |
| P11 | **Wallet** | Produktas: Pro funkcija. Toksiškumas: strateginiuose dokumentuose nėra; natūralus kandidatas — medikų kortelė. | **Pati kortelė — nemokama** (spausdinama/PDF/„pridėti prie pradžios ekrano"). Wallet pass — vėliau, kaip patogumas. Apple Developer ($99/m.) + neaišku, ar asmeninė paskyra gali išduoti pass'us. |
| P12 | **Vieša biblioteka** | Founder'is birželį: vieša, bet nereklamuojama, prod'e flag'as išjungtas. Architektūra: įjungti `VITE_PUBLIC_LIBRARY=1`. Toksiškumas: `/api/catalog/public` jau dabar viešai grąžina nepatikrintą toksiškumą. | Flag'ą įjungti **tik po P0 + toksiškumo Fazės 0 + duomenų perskaičiavimo** (§4.9). |
| P13 | **Ar rodyti nepatikrintą turinį viešai** | `50-vizija` F.1 (birželis): rodyti `savybes` viešai kaip „preliminarų juodraštį". Toksiškumas §15: įspėjimus — taip su etikete, „saugu" — niekada be patikros. | Tai **turinio politikos** pakeitimas, ne tik flag'o laikas: viešai — tik įspėjimai su etikete „parengta pagal šaltinius, laukia eksperto"; jokio „netoksiška" be rūšiai specifinio šaltinio. |
| P14 | **Ar enrich + hero lieka CORE** | Architektūra: „always-on CORE". AI: enrich ~$0,09/augalą. Toksiškumas: toksiškumą iš enrich išimti. | **Enrich nebėra CORE.** Lieka katalogo turiniui (aprašai, priežiūra, nuotraukos) — antraeiliam sluoksniui. |
| P15 | **Vaikas vs suaugęs** | Namų rizika: vaikui naudoja suaugusio jautrumą. Toksiškumas: vaikui niekada ne žemiau suaugusio, sprendžia pediatras toksikologas. | Suderinama, bet **neišspręsta**: atviras klausimas ekspertui (T3). |

---

## 4. Ko nepastebėjo nė vienas agentas (mano patikrinimai)

### 4.1. Katalogą rašo ir pati programėlė
`firestore.rules` pakeitimas į `isAdmin()` yra 5 min., bet klientas rašo į `catalog` iš:
- `src/utils/catalogPreviewUpsert.js` (`SearchModal.jsx:1923`) — paieškos preview įrašai
  (su toksiškumu) — **aktyvus kelias**;
- `src/components/SearchModal.jsx:819, 1760` — klientinis save kelias (tik kai
  `VITE_USE_SERVERSIDE_SAVE` išjungtas; prod'e įjungtas) ir bulk cultivar'ai;
- `src/hooks/usePlants.js:172, 187` — tik vienkartinėje legacy migracijoje (`runMigrationsOnce`);
- `src/components/admin/AdminPanel.jsx:333, 354, 410` — admin (lieka teisėtas).
`api/save-plant.js` rašo per admin SDK — rules jo neliečia.

Klientiniai rašymai apgaubti `try/catch` → užrakinus rules preview įrašai tyliai nustos kurtis (ne
crash). **Įvertis: S** (rules + preview kelio sprendimas + emuliatoriaus patikra). Produkto
agento „30 min." arčiau tiesos, nei pirmame šios sintezės juodraštyje teigiau.

### 4.2. Infrastruktūros lubos
- **12 funkcijų lubos (Vercel Hobby)** — jau pasiektos (`00-STATE.md`, birželį 13-a funkcija
  sulaužė deploy'ą). Dabar 12: `claude`, `claude/stream`, `save-plant`, `generate-hero`,
  `plant-image`, `rehost-image`, `catalog/public`, `viewer`, `viewer/water`, `passport/care`,
  `passport/water`, `vision-unlock`. Agentų siūlomi nauji: `/api/accept-invite` (K3),
  paskyros ištrynimas (G4), eksportas (G5), Wallet pass. Išeitys: sujungti (`passport/*` → 1,
  `viewer*` → 1, `vision-unlock` — atsisakyti pagal Refactor planą → atsilaisvina 3) arba mokamas planas.
- **Hobby = tik nekomerciniam naudojimui** (Vercel fair-use). Stripe/Pro → Vercel Pro $20/mėn.
  arba kitas hostingas. Tai keičia „Pro lūžio" aritmetiką (`34-kastu-modelis`).

### 4.3. Teisė: PLD skiria nekomercinį ir komercinį
PLD 2024/2853 (taikoma produktams, pateiktiems rinkai po **2026-12-09**) programinę įrangą laiko
produktu. Išimtis (2 str. 2 d.) — **nemokama ir atvirojo kodo** programinė įranga, kuriama ar
teikiama ne komercinės veiklos metu. Freemium su mokamu Pro tikėtinai patenka, o **komercinė
programėlė atsako už tai, ką rodo**, nepriklausomai nuo to, kas publikuoja duomenų failą — tad
„atskirta atvira DB" atsakomybės nuo app'o nenuima (pirmame juodraštyje tai buvo per optimistiška).
Išvada: geriausia gynyba — versijuoti, šaltiniais pagrįsti duomenys ir jokio triažo, ne subjektų
inžinerija. *Ne teisinė išvada — klausimas teisininkui (§8).*
Taip pat: LT skaitmeninio sutikimo amžius **14 m.** (ne 16, kaip rašo keli dokumentai).

### 4.4. Apsinuodijimų biuro adresatas gali būti pasenęs
Paieška rodo, kad apsinuodijimų informacijos funkcija dabar yra **Valstybinės vaistų kontrolės
tarnybos (VVKT) Farmakologinio budrumo ir apsinuodijimų informacijos skyriuje** (Studentų g. 45A,
Vilnius), ne Santaros klinikose, kaip rašo Produkto dokumentas. Oficialaus puslapio iš sesijos
pasiekti nepavyko — **patikrinti prieš siunčiant pirmą akademijos laišką.**

### 4.5. „Vienos eilutės" modelio keitimas ne visur vienos eilutės
Naujesni modeliai (`sonnet-5-5`, `haiku-5-5`) atmeta nestandartinį `temperature` (400).
`SearchModal.jsx` siunčia `temperature: 0.3` per `/api/claude` (4 vietos), enrich — irgi 0.3.
Tad **paieška → Haiku/Sonnet 5.5 sulūžtų** be kliento pakeitimų; **chat → Haiku** saugus
(`useChatStream` temperature nesiunčia). `claude-sonnet-4-6` nėra deprecated — skubos migruoti nėra.

### 4.6. Medikų kortelė rodo nepatikrintus gydymo nurodymus
PR #7 kortelė rodo `medikui_lt` (pvz. „Aktyvuota anglis, K+ korekcija, EKG… ANTIDOTAS: DigiFab")
iš AI agentų parengto, toksikologo **nepatikrinto** juodraščio (`_meta.patikimumas` ~85–90 %).
Toksiškumo planas tokius tekstus leidžia tik būsenai `patvirtinta`. Dar geriau (Fable): kortelė
apskritai **necituoja gydymo savais žodžiais** — ją pasirašyti toksikologui būtų sunku. Kortelė =
tapatybė (LT + lotyniškas vardas, sinonimai, nuotrauka, suvalgyta dalis), junginių klasės,
**nuorodos** į šaltinius (ASPCA, apsinuodijimų centras), leidimo versija + hash, kontaktai. Mažiau
darbo ir mažiau atsakomybės. Taip pat: PR #7 rodo **„Skambink dabar"** ženklelį augalo puslapyje
(`HouseholdRiskSection.jsx:84`) vien todėl, kad augalas namuose — be jokio įvykio. Tai triažo
spalvos „cry-wolf"; šalinti.

### 4.7. AI limitai realiai neveikia, o K1 uždarytas tik iš dalies
- `src/hooks/useAuth.js:24` `createPendingUser` kiekvienam naujam vartotojui rašo **`beta: true`**,
  o `api/_firestore.js` `checkLimit` beta vartotojams limitų netaiko. Tad 5/5/2 nemokami limitai
  (ir AI agento kaštų įverčiai „su caps") realiai negalioja niekam, kol admin'as neperjungia beta.
- Po PR #3: anoniminis relay uždarytas, bet `/api/claude` ir `/api/claude/stream` **netikrina
  `approved`**, limitą taiko **tik kai klientas atsiunčia `limitType`**, priima kliento `system`,
  `tools` ir **neribotą `maxTokens`**. Bet kuris Google paskyros turėtojas (net nepatvirtintas)
  gali naudoti endpoint'ą kaip bendrą Claude proxy mūsų sąskaita. `src/utils/plantAI.js:13`
  ir toliau kviečia be `limitType`.
- Reikia: serveris pats nustato `limitType` pagal endpoint'ą, tikrina `approved`, riboja
  `max_tokens`, `beta` pagal nutylėjimą `false` (nustato tik admin), system prompt'ą formuoja
  serveris. Ilgainiui — edge rate-limit.

### 4.8. Koreliuotos klaidos
Visi 6 agentai — to paties modelio šeima, skaitė tuos pačius konsiliumo dokumentus ir dalį
teiginių pakartojo nepatikrinę („30 min. pataisa", „LT sutikimo amžius tikrintinas (16)",
antras biuro numeris). Šią sintezę dar peržiūrėjo kitas modelis (Fable, §11) — tai sumažina, bet
nepanaikina koreliuotų klaidų (ta pati modelių šeima). Duomenų teiginiai perpatikrinti skriptu ir
kodu; **teisiniai — ne teisininko**.

### 4.9. Kodo pataisos nepataiso jau išsaugotų duomenų
Toksiškumas išvedamas **išsaugojimo metu** ir `merge` užrašomas į `catalog/{slug}`. Išjungus PFAF
genties fallback'ą `deriveToxicity*` kopijose, esami įrašai nepasikeis: `/api/catalog/public` ir
toliau grąžins Lotus „stiprus", Lilium „vidutinis gyvūnams", Jatrofą be toksiškumo. Fazė 0 turi
apimti **arba** katalogo perskaičiavimo skriptą (pirma `--dry-run`), **arba** viešo endpoint'o
`savybes.pavojai` maskavimą iki leidimo. Pigiausia — maskuoti (T0b).

---

## 5. Bendras prioritetizuotas backlog'as

Tvarka: kritinis saugumas → duomenų schema → CORE funkcijos → kita. **Apimtis:** S ≤ 1 d.,
M = 2–5 d., L = 1–3 sav. (vieno žmogaus su AI agentais darbas). Sprendimai S1–S14 ir numatytieji
D1–D5 — §8.

> **Niekas nedega.** Vieša biblioteka prod'e išjungta, o programėle be rankinio patvirtinimo
> naudotis negali niekas. Bet viešas `/api/catalog/public` ir neribotas `/api/claude` veikia
> jau dabar — todėl 5.1 ir T0 — šią savaitę.

### 5.0. Pradėti iškart, lygiagrečiai su kodu (ne kodas)

| ID | Kas | Kodėl | Apimtis | Priklauso nuo |
|---|---|---|---|---|
| N1 | **Eksperto paieška:** pirma — pažįstami vet/toksikologai/gydytojai (S2); tada laiškas VVKT apsinuodijimų informacijos skyriui + 1 psl. koncepcija; prašymas — peržiūrėti mirtinų genčių sąrašą + 10 augalų | Ekspertų laikas — butelio kaklelis; šaltas laiškas valstybės įstaigai be konkretaus žmogaus tikėtinai „nuskęs" | S | S2 |
| N2 | Teisininkas 1–2 val.: PLD, disclaimer'is, Anthropic DPA, duomenų licencija | Prieš viešą reklamavimą ir prieš Stripe | S | S8 |
| N3 | Darbo sutarties IP/nekonkuravimo patikra, „LapasID" prekės ženklo clearance (`60` §5) | Gali pakeisti viską | S | S1 |

### 5.1. Kritinis saugumas (šią savaitę; nepriklauso nuo krypties)

| ID | Kas | Kodėl | Apimtis | Priklauso nuo |
|---|---|---|---|---|
| B1 | Užrakinti `catalog` ir `plant-passports` rašymą (`isAdmin`/serveris); `catalogPreviewUpsert` → išjungti arba per serverį (§4.1) | Bet kas gali „toksiška"→„saugu" | S | — |
| B2a | Pataisyti PR #3: `createPendingUser` be `beta`/`aiUsage`/`subscription`; `beta` default `false`; `/api/claude*` tikrina `approved`; serveris pats nustato `limitType` pagal endpoint'ą; `max_tokens` lubos | Registracija nesugestų; neribota Claude prieiga uždaryta | S | — |
| B2b | `system` prompt'ai ir įrankiai formuojami serveryje (klientas siunčia tik kontekstą) | Jailbreak/prompt injection; reikalinga tik jei chat/AI paieška lieka | M | S12 |
| B3 | Rules testai Firebase emuliatoriumi + rankinis deploy per Console | Rules diegiamos rankiniu būdu, testų nėra | S | B1, B2a |
| B4 | Funkcijų konsolidacija (12 lubos): `passport/*` ir `viewer*` → po vieną catch-all; atsisakyti `vision-unlock` | Kiekvienas naujas endpoint'as sulaužys deploy | S | — |
| B5 | `response.usage` kaštų žurnalas | Realūs AI kaštai prieš verslo sprendimus | S | — |

### 5.2. Toksiškumo duomenų schema

| ID | Kas | Kodėl | Apimtis | Priklauso nuo |
|---|---|---|---|---|
| T0 | Fazė 0: išjungti PFAF genties fallback'ą (abiejose kopijose); lelija/Hemerocallis × katė = kritinė; `batch-enrich` narratyvo bug'as; nerodyti „saugu" iš vien gyvūnų šaltinio | Vienareikšmės klaidos (Jatrofa, Lotus, lelija) | S | — |
| T0b | **Esami duomenys:** viešame `/api/catalog/public` maskuoti `savybes.pavojai` (arba perskaičiuoti katalogą su `--dry-run`) | Kodo pataisos nepataiso jau išsaugotų įrašų (§4.9) | S | T0 |
| T1 | **Minimalus žinynas** `data/toxicity/`: `classes.json`, `genera.json`, `families.json`, `overrides.json`; kiekvienas teiginys `{saltiniai[], busena, recenzentas?}`; vienas sunkumo žodynas; sinonimai | Vienas autoritetas vietoj 5 sistemų; be ekspertų infrastruktūros | M | D1 |
| T2 | Mirtinų genčių sąrašas **pirmas** (įsk. puokštes/sezoninius: lelijos, poinsetija, svogūnėliai) + 6 orfaninės klasės | 14 iš 16 mirtinų genčių dabar „nėra duomenų" | M | T1 |
| T3 | `vaikas` dimensija (≥ suaugusio, kol nepatikrino pediatras), poveikio keliai; sunkumo mažinimas **tik per `overrides` su šaltiniu** | Kalankė „mirtina" be šaltinio nemažinama, bet formuluojama tiksliai (§3 P4) | M | T1 |
| T4 | ~100 eil. `build-toxicity.mjs` → `public/data/toxicity/vX.json` + hash; `toxinClasses.test.js` + scenarijų testai CI | Versija = teisinė gynyba ir regresijų kontrolė | M | T1–T3 |
| T5 | `placement-rules.json` + `contacts.json` (su patikros data) | Deterministinė vietos rekomendacija; patikrinti numeriai | S | T1, S11 |
| T6 | Ekspertų peržiūra: **GitHub PR + skaičiuoklės eksportas** ekspertui; programėlės darbo eiga (rolės, pasiūlymai, parašai) — tik jei ekspertas to paprašys | Pilna eiga = mėnesiai darbo; nereikia, kol nėra eksperto | S → L | T4, N1 |

### 5.3. CORE funkcijos

| ID | Kas | Kodėl | Apimtis | Priklauso nuo |
|---|---|---|---|---|
| C1 | Vienas resolveris ant leidimo (PR #7 logikos perdirbimas, be mirror) | Branduolys visoms kortelėms | M | T4 |
| C2 | Namų profilis + „mano augalai" įrenginyje su **eksportu/importu**; raginimas įdiegti PWA (Safari ištrina neįdiegtų svetainių duomenis po 7 d. nenaudojimo) | Be paskyros ir be serverio namų duomenų | S–M | S10, S4 |
| C3 | Per-augalo rizika + vietos rekomendacija (PR #7 UI) **be „Skambink dabar" ženklelio**; formuluotės — faktas, ne garantija | Pagrindinė vartotojo vertė | M | C1, T5 |
| C4 | Medikų kortelė, adresuojama **taksonu + versija** (`/t/kalanchoe?v=0.1`): tapatybė, dalis, klasės, nuorodos į šaltinius, versija + hash, kontaktai; **be gydymo perpasakojimo** | Dalinama be serverio; mažiau atsakomybės | S–M | C1 |
| C5 | Kolekcijos rizikų sąrašas (nemokamai, be limito) | „Biggest value / least work" (`46`) | S | C1, C3 |
| C6 | Tapatybės patvirtinimas (foto/paieška): kandidatai, blogiausias atvejis | Poison control #1 problema — identifikacija | M | C1 |
| C7 | Onboarding: profilis → augalai → rezultatas | „Aha" per minutę | M | C2, C3, C6 |
| C8 | **Statiniai, iš anksto sugeneruoti viešos bibliotekos puslapiai** iš leidimo (augalas × namų narys), be login'o | SEO: „ar lelija nuodinga katei" — Google užklausa, ne app'o atidarymas | M | B1, T0b, T4 |
| C9 | Pašalinti AI iš saugos kelio (`TOOL_DETAILS` toksiškumo laukai, narratyvas, `aiSupplementaryHazard`) | Nepatikrintas tekstas kas kartą | S | C1 |
| C10 | Anoniminė, privatumą sauganti naudojimo statistika (be asmens duomenų) | Akademijai ir prioritetams reikia skaičių | S | S4 |

### 5.4. Kita

| ID | Kas | Kodėl | Apimtis | Priklauso nuo |
|---|---|---|---|---|
| K1 | Feature flag'ai; užšaldyti priežiūrą/chat/valdiklius; išimti FB, Shop | Fokusas, mažesnis paviršius | S–M | S12 |
| K2 | GDPR minimumas: privatumo politika, ištrynimas, eksportas, Anthropic DPA (apimtis mažesnė, jei namų duomenys tik telefone) | Teisinė higiena | M | S4, N2 |
| K3 | K3 (invite join) + A1–A6 | Tik jei kolekcijų dalinimasis lieka | M | S5, B4 |
| K4 | PR #6 dalinis merge (`aiModels.js`, testai, SDK); chat → Haiku, jei chat lieka | Pigiau, švariau | S | S12 |
| K5 | `pfaf.json`/`pre-db.json` iš kliento bundle'o | 30 MB, IP, greitis | M | — |
| K6 | Dokumentų atnaujinimas (README, PROJECT, DESIGN.md paletė) | Pasenę teiginiai klaidina agentus | S | S4 |
| K7 | Stripe/Pro, Wallet, embed | Tik po CORE ir vartotojų signalo | L | D2–D4, N2 |

---

## 6. PR'ų likimas (siūlomas)

| PR | Siūlymas | Kodėl |
|---|---|---|
| #1, #2, #4, #5 (docs) | **Merge kaip referencinius dokumentus** (konfliktų nėra — skirtingi failai) | Jie — žinių bazė; sprendimai fiksuojami šiame dokumente |
| #3 (saugumas) | **NEmerge'inti kaip yra — sulaužo registraciją.** Pataisyti: `createPendingUser` nebeturi rašyti `beta`/`aiUsage`/`subscription` (nustato serveris arba skaitytojas pagal nutylėjimą); + catalog/passports rules; + §4.7 likučiai; + srautų patikra emuliatoriumi; rules deploy rankiniu būdu | Kritiniai taisymai, bet su blokuojančia klaida |
| #6 (AI) | **Dalinai:** `aiModels.js`, testai, SDK bump, vision-auth (Edge — patikrinti preview) — taip; narratyvo caching — nebeaktualu | Žr. P3 |
| #7 (namų rizika) | **Nemerge'inti kaip yra.** Pernaudoti UI ir `assessHouseholdRisk` struktūrą, perjungti ant leidimo | Žr. P4, §4.6 |

### 6.1. Kodo šakų patikra (atlikta 2026-11-03, worktree'uose, be deploy)

| Ref | Testai | Build |
|---|---|---|
| `main` | 216 ✓ | OK |
| #3 `security-critical-fixes` | 216 ✓ (naujų testų nėra — auth/limit pakeitimai netestuoti) | OK |
| #6 `beautiful-edison` | 267 ✓ | OK (SDK 0.137 įdiegtas, `messages.create/stream`, `cache_control` tipai yra) |
| #7 `household-risk` | 251 ✓ | OK |
| #3 + #6 + #7 kartu | **302 ✓, 0 konfliktų** (abi tvarkos) | OK |

- **Blokuojanti klaida #3:** naujos `users/{uid}` `create` taisyklės draudžia `beta`/`aiUsage`/
  `subscription`, o `createPendingUser` (`src/hooks/useAuth.js:24`) būtent juos rašo → nauji
  vartotojai negalėtų susikurti paskyros dokumento. Taip pat `approved` lieka vartotojo
  rašomas (savęs patvirtinimas — Saugumo V4 lieka).
- **#6 Edge:** `api/_lib/visionAuth.js` naudoja tik Web Crypto (Edge-suderinamas); santykinis
  importas iš `middleware.js` dar nepatikrintas Vercel preview.
- **#7:** iš 16 „mirtinų" genčių žemėlapyje tik 2 (`CYCAS`, `KALANCHOE`); kitos 14 rodomos
  „Trūksta duomenų". `/t/{plantId}` padengtas `vercel.json` catch-all rewrite'u.
- Visuose build'uose — 1,37 MB pagrindinis chunk'as (jau `main`'e; dalis — `pfaf.json`/`pre-db.json`
  kliento bundle'e, Saugumo V5).

---

## 7. CORE techniškai: „galime keisti nors nuo nulio" — kaina už vertę

Naujas CORE iš esmės skiriasi nuo to, kam buvo statytas dabartinis backend'as (multi-user
kolekcijos su realtime sync ir AI enrich'u).

| CORE poreikis | Ko realiai reikia |
|---|---|
| Toksiškumo duomenys | Statinis versijuotas JSON (šimtai KB) — CDN/PWA cache, veikia offline, $0 |
| Viešas augalo saugumo puslapis | Iš anksto sugeneruotas HTML iš leidimo — Google jį randa, login'o nereikia |
| Resolveris + vietos taisyklės | Gryna funkcija naršyklėje |
| Namų profilis, „mano augalai" | Keli laukai įrenginyje + eksportas/importas |
| Paieška | Statinis vardų indeksas (`plants.json` — 5786 vardai) — be AI |
| Medikų kortelė | Adresuojama taksonu + leidimo versija (`/t/kalanchoe?v=0.1`) — dalinama be serverio |
| Atpažinimas iš foto | **Vienintelis** būtinas serverio kvietimas (AI vision + rate limit) |

### Variantai

| | A. Sutvirtinti esamą | B. Local-first app + esama app kaip Pro | **B-lite (rekomenduoju)** | C. Nuo nulio |
|---|---|---|---|---|
| Esmė | Taisom K1–K4, A1–A6, GDPR; CORE statom Firebase app'e | Naujas CORE app'as be paskyros; Firebase app — Pro sluoksnis | **Statiniai saugumo puslapiai iš leidimo + profilis/augalai telefone; Firebase app užšaldoma už savo login'o** | Naujas stack'as viskam |
| Kas gali naudotis | Tik po tavo rankinio patvirtinimo (kaip dabar) | Visi | **Visi, įskaitant Google paiešką** | Visi |
| Saugumo paviršius | Didelis | Vidutinis | **Mažiausias** (CORE — statika + 1 AI endpoint'as) | Priklauso |
| Namų duomenys / GDPR | Serveryje (asmens duomenys, ne ypatingos kategorijos) | Telefone | Telefone | Priklauso |
| Kaštai | Firebase + Vercel + AI | ~$0 + AI foto | **~$0 + AI foto** | Laikas |
| Darbo kiekis | Didžiausias (pirma saugumas) | Didelis (du app'ai) | **Mažiausias** (PR #7 komponentai ant statinių puslapių) | Didžiausias |

**Kodėl B-lite (Fable peržiūros patikslinimas):**
- Stipriausias argumentas — **pasiekiamumas**, ne GDPR: šiandien naudotis app'u gali tik tavo
  patvirtinti žmonės, o žmogus, kurio katė graužė leliją, 23 val. googlina, o ne siunčiasi app'ą.
- GDPR argumentas silpnesnis, nei atrodė: „turi katę / mažą vaiką" vėliavėlės savo `users/{uid}`
  (po K2 pataisos) — asmens duomenys, bet ne ypatingos kategorijos; DPIA nebūtinai privalomas.
- PLD argumento **nėra**: komercinė app atsako už tai, ką rodo, nepriklausomai nuo to, kas
  publikuoja JSON (§4.3).

**Ką B-lite kainuoja (sąžiningai):**
- **Safari** neįdiegtos PWA duomenis ištrina po 7 d. nenaudojimo → profilis „dingsta". Sprendimas:
  raginimas įdiegti + eksportas/importas; profilis — 5 varnelės, atkurti trunka 10 s.
- Nėra kelių įrenginių sinchronizacijos nemokamai (Pro sluoksnio funkcija, jei kada bus).
- Akademijai reikės skaičių → anoniminė statistika (C10).
- PR #7 `/t/{plantId}` remiasi Firestore pasais → perdaryti į `/t/{taksonas}?v=` (C4).
- Esami vartotojai: Firebase app lieka veikti kaip yra (S5).

**Kas turi paaiškėti prieš sprendžiant:** kiek realių vartotojų turi dabartinė app ir ar jie naudoja
dalinimąsi/priežiūrą (S3), ar galima ją užšaldyti (S5).

---

## 8. Sprendimai savininkui (surūšiuota pagal svarbą)

Sujungta iš Produkto 15 klausimų (Q1–Q15), Saugumo 5 klausimų, naujų radinių ir Fable peržiūros;
dublikatai pašalinti.

| # | Klausimas tau | Ką blokuoja | Mano rekomendacija |
|---|---|---|---|
| S1 | **Kiek valandų per savaitę realiai + ar darbo sutartis leidžia** (Q14) | Visą apimtį ir seką | ❓ |
| S2 | **Ar asmeniškai pažįsti veterinarą, toksikologą, gydytoją, botaniką?** + ar siunčiam laišką per 2 sav. (Q5) | N1 — ekspertas yra butelio kaklelis | Pirma pažįstami, tada VVKT laiškas |
| S3 | **Kas ir kiek realiai naudoja app'ą šiandien?** (Q4) | S4, S5, ką galima užšaldyti | ❓ + Firestore/Sentry skaičiai |
| S4 | **CORE forma:** statiniai saugumo puslapiai iš versijuoto JSON + „mano augalai"/profilis telefone (§7) | C2, C8, K2, K3 | Taip (variantas „B-lite") |
| S5 | **Ar patvirtinimo vartai (`approved`) sąmoningi ir ar Firebase programėlę galima užšaldyti** (esamų vartotojų duomenys lieka, naujų funkcijų nėra)? | K3, kiek saugumo darbo reikia | Vartai lieka Pro/kolekcijos daliai; CORE — be login'o |
| S6 | **Sėkmės metrika po 12 mėn.** (Q1) | Ką matuojam, ko nedarom | Namų ūkiai, pamatę rizikų sąrašą + ekspertų peržiūrėtų teiginių dalis |
| S7 | **Mėnesio išlaidų lubos** (be pajamų) | Hostingo ir AI sprendimus | ≤ €50/mėn. (`34`: hobis €30–150) |
| S8 | **Teisininkas 1–2 val.** (Q11) | Viešą reklamavimą, Stripe | Taip, prieš viešą paleidimą |
| S9 | **Žinomos toksiškumo klaidos, kurias žinai tu** (Q6) | T0, T2 | ❓ |
| S10 | **Namų profilio modelis** | C2 | Telefone; „mažas vaikas (iki ~6 m.)", „vyresni vaikai", gyvūnai |
| S11 | **Pagalbos numeris kortelėse** (birželį nuspręsta „be numerio") | T5, C4 | 112 + patikrintas apsinuodijimų informacijos numeris su patikros data |
| S12 | **Priežiūra ir „charakteriai"** (Q2, Q3) | K1, K4, B2b | Užšaldyti už flag'ų, esamiems palikti |
| S13 | **Atviros DB licencija** (pvz. CC BY) — ir ar ASPCA/PFAF sąlygos tai leidžia (nepatikrinta) | Viešą „atvirą DB", embed | Publikuoti tik savus tekstus; ASPCA/PFAF — tik nuorodos |
| S14 | **„Gana" scenarijus ir išėjimo sąlyga** (Q15) | Apsaugo nuo amžino „dar truputį" | ❓ (pvz. „DB atiduodam institucijai, jei po 12 mėn. < X namų ūkių") |

**Numatytieji sprendimai (nebeklausiama; pakeisk, jei nesutinki):**
- **D1** Toksiškumo žinynas — minimali versija (T1–T4), pilna ekspertų darbo eiga tik su ekspertu.
- **D2** Stripe/Pro — ne šį ketvirtį (Q8, Q9).
- **D3** Medikų kortelė nemokama visiems; Wallet pass — vėliau (Q12).
- **D4** Embed — po leidimo, be reklamos iki ekspertų parašo (Q13).
- **D5** Agreguoti duomenys verslui — „ne"; įrašyti į privatumo politiką kaip pažadą (Q10).
- Firestore rules taisom (B1–B3) ir GDPR minimumą darom (K2) — klausti nereikia (Q7, Saugumo Q1–Q2, Q5).

---

## 9. Priklausomybės (kas ką blokuoja)

```
S2 ekspertas ──────► N1 laiškas ─► ekspertų peržiūra (T6) ─► „Patikrinta" ženklas, embed
B1 catalog lock ───► T0b duomenų maskavimas ─► C8 vieša biblioteka (statiniai puslapiai)
T0 Fazė 0 ─────────► PR #7 rodymas vartotojams
D1 ─► T1 ─► T2, T3 ─► T4 leidimas v0.1 ─► C1 resolveris ─► C3, C4, C5 ─► C7 onboarding
S4 CORE forma ─────► C2 profilis telefone ─► K2 GDPR apimtis
S5 užšaldymas ─────► ar reikia K3 (invites) ir B2b
N2 teisininkas ────► Stripe/Pro, viešas reklamavimas
B4 konsolidacija ──► bet koks naujas endpoint'as
```

---

## 10. Šaltiniai

- Agentų ataskaitos (kopijos vienoje vietoje — [`agentai-2026-11/`](agentai-2026-11/)):
  `PRODUCT_DIRECTION.md` (#1), `SECURITY_AUDIT.md` (#2), `ARCHITECTURE.md` + `REFACTOR_PLAN.md`
  (#4), `TOXICITY_DATA.md` (#5; + `scripts/audit-toxicity-sources.mjs`), `AI_REVIEW.md` (#6),
  `namu-rizika-mvp.md` (#7).
- Konsiliumas: `tasks/konsiliumas-2026-06/60-galutine-santrauka.md`, `45-liability-redteam.md`,
  `46-saugumo-feature-sinteze.md`, `50-vizija-v2-draft.md`, `33-akademijos-partnerystes-planas.md`.
- Išoriniai faktai (patikrinta 2026-11-03, antriniais šaltiniais): LT sutikimo amžius 14 m. (White
  & Case, Bird & Bird); PLD taikymas ir nekomercinės PĮ išimtis (Hogan Lovells, IBA); Vercel Hobby
  nekomercinis naudojimas, Pro $20/vietai/mėn.; VVKT apsinuodijimų informacijos skyrius
  (lrvalstybe.lt); Claude modelių kainos ir `tool_choice`/`temperature` ribojimai (Anthropic API
  dokumentacija).

---

## 11. Nepriklausoma peržiūra (kitas modelis)

Fable 5.1 adversariškai peržiūrėjo pirmą šios sintezės juodraštį, perpatikrino teiginius kode ir
duomenyse (perleido audito skriptą). **Patvirtino:** PR #3 sulaužo registraciją; `beta: true` →
limitų nėra; 12 funkcijų; Kalankė „MIRTINAS" PR #7; Sonnet/Haiku 5.5 atmeta `temperature`;
12/12/7 genčių auditas; LT sutikimo amžius 14; +370 5 236 2052 ir VVKT adresas.

**Pakeista po peržiūros (visi pataisymai patikrinti kode):**

| Fable radinys | Kas pakeista |
|---|---|
| „Tipinis vs lubos" = sunkumo mažinimas be eksperto → prieštarauja asimetriniam slenksčiui | P4: nemažinti be šaltinio; keisti formuluotę; mažinti tik per `overrides` su šaltiniu |
| „Skambink dabar" ženklelis augalo puslapyje be įvykio (`HouseholdRiskSection.jsx:84`) | §4.6, C3: šalinti |
| Fazės 0 kodo pataisos nepataiso išsaugotų katalogo duomenų | Nauja §4.9 ir T0b |
| §4.1 perdėta: `usePlants` rašymai — vienkartinė migracija, ne kiekvieno vartotojo sync | §4.1 pataisyta; B1 → S |
| Local-first argumentai klaidingi (GDPR perdėtas, PLD „bonusas" klaidingas), kaštai nepaminėti | §7 perrašyta → „B-lite"; §4.3 pataisyta |
| Pilna toksiškumo architektūra per sunki solo founder'iui | D1: minimali versija; T6 = GitHub PR + skaičiuoklė |
| Akademijos laiškas turi būti pirmas; šaltas laiškas valstybės įstaigai „nuskęs" | 5.0 N1 + S2 „ar pažįsti ekspertą" |
| B2 „dienos" — iš tikrųjų dalis yra endpoint'o perprojektavimas | B2a (S) / B2b (M) |
| Medikų kortelė neturėtų perpasakoti gydymo net patvirtinta | §4.6, C4 |
| Trūko prieštaravimų: viešo juodraščio politika, enrich ne CORE, vaikas vs suaugęs | P13–P15 |
| §8: nereikalingi klausimai; trūksta eksperto, vartų, € lubų, licencijos | §8 perrašyta; D1–D5 numatytieji |
| Vercel 12 funkcijų lubos žinomos nuo birželio — ne „atradimas" | §0 p. 7 pataisyta |

**Fable pastaba, palikta kaip yra:** antras tos pačios šeimos modelis koreliuotas klaidas mažina,
bet nepanaikina; teisiniai teiginiai teisininko nežiūrėti.

---

## 12. Struktūra ir valymas

### 12.1. Padaryta šioje šakoje (grįžtama per git)

| Kas | Kur | Kodėl |
|---|---|---|
| 6 agentų ataskaitos vienoje vietoje | `docs/agentai-2026-11/` (+ `scripts/audit-toxicity-sources.mjs`) | Nereikia ieškoti per 7 šakas |
| Dokumentacijos žemėlapis | `docs/README.md` | „Nuo ko pradėti" |
| `tasks/todo.md` → nuoroda į šį backlog'ą | senas — `tasks/archive/todo-2026-06.md` | Vienas aktyvus darbų sąrašas |
| Archyvuota: desktop UX dokumentai, senas `src/ARCHITECTURE.md` | `docs/archyvas/` | Pasenę (ARCHITECTURE §14) |
| Archyvuota: užbaigtas PlantDetail refaktoras, 3 PFAF vertimo užduotys | `tasks/archive/` | Užbaigta / PFAF nebe toksiškumo autoritetas |
| Ištrinta: 7 duomenų atsarginės kopijos (~32 MB) | `data/*.backup*`, `pfaf-v1-backup.json` | Lieka git istorijoje; `.gitignore` saugo nuo naujų |
| Ištrinta: kodo našlaičiai `History.jsx`, `Wishlist.jsx`, `PinGate.jsx`, `pinLock.js` | `src/` | Niekur neimportuojami (REFACTOR_PLAN) |

Po valymo: `npm test` — 216 ✓, `npm run build` — OK.

### 12.2. Siūloma, bet laukia sprendimo

| Kas | Kada | Priklauso nuo |
|---|---|---|
| Uždaryti PR #1, #2, #4, #5 kaip „perkelta į `docs/agentai-2026-11/`" | Kai ši šaka bus sujungta | Tavo OK |
| PR #3, #6, #7 — palikti šakas perdirbimui (B2, K4, C1–C4), uždaryti po perdirbimo | — | — |
| `data/pfaf-*-chunks/` (~5 MB tarpiniai LLM vertimų failai) | Po T1 | D1 |
| FB postinimas, `ShopWidget`, `/api/dev-toxicity-test` iškvietimas, `vision-unlock` | K1, B4 | S12 |
| `README.md`, `PROJECT.md` perrašymas; `DESIGN.md` → Brandbook v1.0 | K6 | S4 |
