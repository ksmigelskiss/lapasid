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
   versijuojamas toksikologijos žinynas git'e → kompiliuojamas į nekintamus leidimus → programėlė
   skaito tik leidimą per vieną resolverį; AI iš saugos kelio runtime pašalinamas. Siūlau jį
   priimti kaip stuburą.
4. **Namų rizikos MVP (PR #7) — vertingas UI ir logika, bet NE leisti kaip yra:** jis prijungia
   nepatikrintą juodraštį ir rodo klasės *blogiausią atvejį* kaip šio augalo riziką (pvz.
   **Kalankė katei/šuniui/žmogui = „MIRTINAS"**), o medikų kortelėje — nepatikrintus gydymo
   tekstus. Tai tiksliai tas „cry-wolf" ir atsakomybės scenarijus, nuo kurio perspėjo konsiliumas.
5. **Skubiausia (dienos, nepriklauso nuo jokio sprendimo):** užrakinti katalogo rašymą — bet tai
   **ne „30 min." pataisa**: klientas rašo į katalogą iš 4 vietų (įsk. kiekvieno vartotojo
   sinchronizaciją), juos reikia perkelti į serverį. Saugumo PR #3 šios skylės **neuždaro**,
   o jo rules pakeitimas **sulaužytų naujų vartotojų registraciją** (patikrinta kode, §6.1).
   Be to, kiekvienas naujas vartotojas gauna `beta: true` → AI limitų realiai **nėra niekam**;
   po PR #3 neribotą Sonnet prieigą vis dar turi bet kas su Google paskyra (§4.7).
6. **Naujas strateginis klausimas — backend'as.** Naujam CORE serverio beveik nereikia:
   toksiškumo leidimas = statinis JSON, resolveris = gryna funkcija, namų profilis = 5 vėliavėlės,
   kurias galima laikyti **tik įrenginyje**. Tai sumažina GDPR, saugumo ir kaštų naštą eilės
   tvarka. Siūlau „local-first CORE + esama Firebase programėlė kaip Pro/kolekcijos sluoksnis"
   (§7) — evoliucija, ne perrašymas nuo nulio.
7. **Du infrastruktūros faktai, kurių nepastebėjo nė vienas agentas:** Vercel Hobby planas jau
   pasiekęs 12 funkcijų lubas (kiekvienas siūlomas naujas endpoint'as — K3 pataisa, paskyros
   ištrynimas, eksportas, Wallet — nebeįsideploy'ins) ir Hobby planas **draudžia komercinį
   naudojimą** (Stripe/Pro = $20/mėn. Vercel Pro arba kitas hostingas).

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
| P2 | **Kaip prijungti toksiškumo modelį** | Architektūra: resolveris kaip client+server **mirror**, enrich lieka CORE šaltinis. Namų rizika: prijungė juodraštį tiesiogiai (variantas „B"). Toksiškumas: B **atmestas** — AI parašyti tekstai įgautų autoritetą be patikros; vienas resolveris, be mirror; kompiliuotas leidimas. | **Toksiškumo variantas (C).** Mirror'ių istorija jau sukėlė regresiją (`\b` bug); statiniam leidimui serverio kopijos nereikia. PR #7 UI ir logika pernaudojami, duomenų šaltinis keičiamas. |
| P3 | **AI toksiškumo narratyvas** | AI agentas: optimizuoti (caching, vertėjas per Haiku, `strict` savybes laukams). Toksiškumas: **pašalinti** narratyvą ir toksiškumo laukus iš Phase 2 — runtime AI saugos kelyje = nepatikrintas tekstas kas kartą. | **Neinvestuoti į narratyvą.** Pašalinti, kai bus leidimas (Fazė 3). Caching'as tam keliui — nebeaktualus; `aiModels.js`, testai, SDK — naudingi nepriklausomai. |
| P4 | **Sunkumas: lubos ar tipinis** | Namų rizika: rodo klasės `rusies_jautrumas` (= lubos) → Kalankė „MIRTINAS". Toksiškumas §10.6: lubos ≠ tipinis pavojus, rodyti tipinį, lubas — tik medikui. Konsiliumas 46: binaras gąsdina be reikalo. | **Tipinis sunkumas per gentį/rūšį; lubos — tik medikų kortelėje kaip kontekstas.** Iki tol PR #7 neleisti. |
| P5 | **Kur saugoti namų profilį** | Namų rizika: `collections/{cid}.settings.household` (matomas visiems kolekcijos nariams; K3 atveju — bet kam). Produktas: `users/{uid}` arba `localStorage`. Liability red-team: „laikyti lokaliai". | **Įrenginyje (local-first)**, sinchronizacija — tik jei vartotojas aiškiai nori (Pro/kelių įrenginių). Žr. §7. |
| P6 | **Vaiko amžius** | Saugumas G1, Toksiškumas: tik boolean. Namų rizika: neprivalomi intervalai 0–3/4–6/7+. Produktas: „iki 6 m." / „paauglys". | **Dvi vėliavėlės:** „mažas vaikas (iki ~6 m.)" ir „vyresni vaikai". 71 % ekspozicijų ≤5 m. (pediatro lęšis) — ši riba neša rizikos signalą be identifikuojančių duomenų. Jei profilis tik įrenginyje — GDPR klausimas beveik išnyksta. |
| P7 | **Pagalbos numeris kortelėse** | Founder'io sprendimas birželį (`50-vizija` F.3): **be numerio** iki partnerystės. Produktas: numeris disclaimer'yje. Namų rizika: `null` + TODO. Pediatro lęšis: „pigiausia tikra vertė app'e". | **Rodyti 112 + Apsinuodijimų informacijos numerį su „patikrinta YYYY-MM-DD"**, tikrinti kas ketvirtį. Faktų patikra: +370 5 236 2052 patvirtintas paieškoje; antras numeris (+370 687 53378) **nerastas** — nenaudoti. Sprendimas savininkui (§8, S11). |
| P8 | **Namų rizikos ataskaita: Free ar Pro** | Konsiliumas 46 (#4): kolekcijos saugumo ataskaita = **Pro**. Produktas: namų rizikos sąrašas = **Free**, bet kolekcija nemokamai tik ~10 augalų (tai netiesioginis paywall saugumui). | **Free, be augalų limito saugumo daliai.** Riboti galima priežiūrą/chat, ne rizikos sąrašą. |
| P9 | **Onboarding: foto pirmiausia** | Produktas: numatytasis kelias — foto. Toksiškumas F7: identifikacijos neapibrėžtumas į toksiškumą neperduodamas; poison control #1 problema = augalo tapatybė. | **Foto — taip, bet su patvirtinimu:** „Ar tai X?" + jei kandidatų toksiškumas skiriasi — rodyti blogiausią ir prašyti patvirtinti. |
| P10 | **Hero akvarelės** | Architektūra: CORE. Kaštų modelis: didžiausias per-augalą AI komponentas. | **Brand turtas, ne CORE.** Esami lieka; naujiems — ne prioritetas. |
| P11 | **Wallet** | Produktas: Pro funkcija. Toksiškumas: strateginiuose dokumentuose nėra; natūralus kandidatas — medikų kortelė. | **Pati kortelė — nemokama** (spausdinama/PDF/„pridėti prie pradžios ekrano"). Wallet pass — vėliau, kaip patogumas. Apple Developer ($99/m.) + neaišku, ar asmeninė paskyra gali išduoti pass'us. |
| P12 | **Vieša biblioteka** | Founder'is birželį: vieša, bet nereklamuojama, prod'e flag'as išjungtas. Architektūra: įjungti `VITE_PUBLIC_LIBRARY=1`. Toksiškumas: `/api/catalog/public` jau dabar viešai grąžina nepatikrintą toksiškumą. | Flag'ą įjungti **tik po P0 + toksiškumo Fazės 0**. API endpoint'as jau viešas — tai dar viena priežastis P0 daryti dabar. |

---

## 4. Ko nepastebėjo nė vienas agentas (mano patikrinimai)

### 4.1. Katalogą rašo ne tik piktavaliai — rašo pati programėlė
`firestore.rules` pakeitimas į `isAdmin()` yra 5 min., bet klientas rašo į `catalog` iš:
- `src/hooks/usePlants.js:172, 187` — **kiekvieno vartotojo** augalų sinchronizacija kviečia
  `saveToCatalog(p)` → vartotojo augalo rūšiniai duomenys `merge` užrašomi ant globalaus katalogo;
- `src/utils/catalogPreviewUpsert.js` — paieškos preview įrašai;
- `src/components/SearchModal.jsx:819, 1760` — klientinis save kelias ir bulk cultivar'ai;
- `src/components/admin/AdminPanel.jsx:333, 354, 410` — admin (lieka teisėtas).

Visi klientiniai rašymai apgaubti `try/catch`, tad užrakinus rules jie tyliai nustos veikti (ne
crash) — bet reikia patikrinti, ar bulk cultivar pridėjimas ir preview paieška nesuges. **Įvertis:
~0,5–1 d.** (rules + klientinių kelių pašalinimas/perkėlimas į serverį + patikra), ne 30 min.

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
produktu, bet **išimtis — nemokama programinė įranga, teikiama ne komercinės veiklos metu**;
freemium su mokamu Pro tikėtinai patenka. Tai suteikia naują argumentą birželio „dviejų dalių"
modeliui: atvira saugumo DB (nekomercinė, galbūt institucijos/asociacijos vardu) ir komercinė
programėlė — **atskiri subjektai/produktai**. *Ne teisinė išvada — klausimas teisininkui (§8, S8).*
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
Toksiškumo planas tokius tekstus leidžia tik būsenai `patvirtinta`. Iki patikros kortelė turi
rodyti tapatybę, klases, šaltinius ir kontaktus — be gydymo teksto.

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
antras biuro numeris). Šią sintezę dar peržiūrėjo kitas modelis (žr. §11).

---

## 5. Bendras prioritetizuotas backlog'as

Tvarka: kritinis saugumas → duomenų schema → CORE funkcijos → kita. **Apimtis:** S ≤ 1 d.,
M = 2–5 d., L = 1–3 sav. (vieno žmogaus su AI agentais darbas). **Sprendimai** S1–S16 — §8.

### 5.1. Kritinis saugumas (daryti dabar; nepriklauso nuo krypties)

| ID | Kas | Kodėl | Apimtis | Priklauso nuo |
|---|---|---|---|---|
| B1 | Užrakinti `catalog` ir `plant-passports` rašymą (`isAdmin`/serveris) + pašalinti/perkelti 4 klientinius katalogo rašymus (§4.1) | Bet kas gali „toksiška"→„saugu"; pati app perrašo katalogą; PLD nuo 2026-12-09 | S–M | — |
| B2 | Pataisyti PR #3: registracija (`createPendingUser`), `beta` default `false`, `approved` tikrinimas, serverinis `limitType`, `max_tokens` lubos, `system` serveryje (§4.7, §6.1) | Neribota Claude prieiga bet kam su Google paskyra; PR #3 kaip yra sulaužo registraciją | M | — |
| B3 | Rules testai Firebase emuliatoriumi + rankinis deploy per Console | Rules diegiamos rankiniu būdu, testų nėra | S | B1, B2 |
| B4 | Funkcijų konsolidacija (12 lubos): `passport/*`→1, `viewer*`→1, atsisakyti `vision-unlock` | Kiekvienas naujas endpoint'as sulaužys deploy | S | — |
| B5 | `response.usage` kaštų žurnalas | Matyti realius AI kaštus prieš bet kokius verslo sprendimus | S | — |

### 5.2. Toksiškumo duomenų schema

| ID | Kas | Kodėl | Apimtis | Priklauso nuo |
|---|---|---|---|---|
| T0 | Fazė 0: išjungti PFAF genties fallback'ą; lelija/Hemerocallis × katė = kritinė; `batch-enrich` narratyvo bug'as; nerodyti „saugu" iš vien gyvūnų šaltinio | Vienareikšmės klaidos rodomos jau dabar (Jatrofa, Lotus, lelija) | S | — |
| T1 | `data/toxicity/` minimali schema: klasės + gentys + šeimos su `teiginys{saltiniai, patikimumas, busena}`; vienas sunkumo žodynas; `names.json` (sinonimai) | Vienas autoritetas vietoj 5 sistemų | M | S5 |
| T2 | Mirtinų genčių sąrašas (įsk. puokštes/sezoninius) + 6 orfaninės klasės | 14 iš 16 mirtinų genčių dabar „nėra duomenų" | M | T1 |
| T3 | `vaikas` dimensija, poveikio keliai, **tipinis vs lubos** sunkumas | Be to — Kalankė „mirtina", vaikas = suaugęs | M | T1 |
| T4 | Kompiliatorius → leidimas `v0.1.0` + golden testai + CI vartai | Versija = teisinė gynyba ir regresijų kontrolė | M | T1–T3 |
| T5 | `placement-rules.json` + `contacts.json` (su patikros data) | Deterministinė vietos rekomendacija; patikrinti numeriai | S | T1, S11 |
| T6 | Ekspertų darbo eiga (rolės, pasiūlymai, redaktoriaus režimas, parašai) | Tik kai yra ekspertas | L | T4, S7 |

### 5.3. CORE funkcijos

| ID | Kas | Kodėl | Apimtis | Priklauso nuo |
|---|---|---|---|---|
| C1 | Vienas resolveris ant leidimo (PR #7 logikos perdirbimas, be mirror) | Branduolys visoms kortelėms | M | T4 |
| C2 | Namų profilis įrenginyje (PR #7 redaktorius → `localStorage`) | GDPR minimizavimas, be paskyros | S | S10, S3 |
| C3 | Per-augalo rizika + vietos rekomendacija (PR #7 UI) | Pagrindinė vartotojo vertė | M | C1, T5 |
| C4 | Medikų kortelė: tapatybė + klasės + šaltiniai + versija + kontaktai; gydymo tekstas tik `patvirtinta` | Saugiausia vertė, bet labiausiai eksponuota | S–M | C1 |
| C5 | Kolekcijos rizikų sąrašas (nemokamai, be limito) | „Biggest value / least work" (`46`) | S | C1, C3 |
| C6 | Tapatybės patvirtinimas (foto/paieška): kandidatai, blogiausias atvejis | Poison control #1 problema — identifikacija | M | C1 |
| C7 | Onboarding: profilis → augalai → rezultatas | „Aha" per minutę | M | C2, C3, C6 |
| C8 | Vieša biblioteka su nauja kortele, flag ON | CORE veidas, SEO | S | B1, T0 (idealiai T4) |
| C9 | Pašalinti AI iš saugos kelio (`TOOL_DETAILS` toksiškumo laukai, narratyvas, `aiSupplementaryHazard`) | Nepatikrintas tekstas kas kartą | S | C1 |

### 5.4. Kita

| ID | Kas | Kodėl | Apimtis | Priklauso nuo |
|---|---|---|---|---|
| K1 | Feature flag'ai; užšaldyti priežiūrą/chat/valdiklius; išimti FB, Shop | Fokusas, mažesnis paviršius | S–M | S12 |
| K2 | GDPR minimumas: privatumo politika, ištrynimas, eksportas, Anthropic DPA | Prieš bet kokį serverinį namų duomenų rinkimą | M | S3 (apimtis) |
| K3 | K3 (invite join) + A1–A6 | Tik jei kolekcijų dalinimasis lieka | M | S3, B4 |
| K4 | PR #6 dalinis merge (`aiModels.js`, testai, SDK); chat → Haiku, jei chat lieka | Pigiau, švariau | S | S12 |
| K5 | `pfaf.json`/`pre-db.json` iš kliento bundle'o | 30 MB, IP, greitis | M | — |
| K6 | Dokumentų atnaujinimas (README, PROJECT, DESIGN.md paletė) | Pasenę teiginiai klaidina agentus | S | S3 |
| K7 | Stripe/Pro, Wallet, embed | Tik po CORE ir vartotojų signalo | L | S13–S15, S8 |

### 5.5. Ne kodas (savininko darbai, valandos)

- Akademijos laiškas + 1 psl. koncepcija (patikslinus adresatą, §4.4) — S7.
- Teisininkas 1–2 val.: PLD, subjektų atskyrimas, disclaimer'is, DPA — S8.
- Darbo sutarties IP/nekonkuravimo patikra, „LapasID" prekės ženklo clearance (`60` §5).

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

## 7. Backend'o klausimas: „galime keisti nors nuo nulio" — kaina už vertę

Naujas CORE iš esmės skiriasi nuo to, kam buvo statytas dabartinis backend'as (multi-user
kolekcijų valdymas su realtime sync ir AI enrich'u).

| CORE poreikis | Ko realiai reikia |
|---|---|
| Toksiškumo duomenys | Statinis versijuotas JSON (šimtai KB) — CDN/PWA cache, veikia offline, $0 |
| Resolveris + vietos taisyklės | Gryna funkcija naršyklėje |
| Namų profilis | 5–6 vėliavėlės — `localStorage`; serveriui nežinomos |
| „Mano augalai" CORE prasme | Taksonų sąrašas — irgi gali būti įrenginyje |
| Paieška | Statinis vardų indeksas (`plants.json` jau 5786 vardai) — be AI |
| Atpažinimas iš foto | **Vienintelis** būtinas serverio kvietimas (AI vision su raktu + rate limit) |
| Medikų kortelė | Statinis puslapis iš leidimo + QR |

### Variantai

| | A. Sutvirtinti esamą | **B. Local-first CORE + esama app kaip Pro sluoksnis** | C. Perrašyti nuo nulio |
|---|---|---|---|
| Esmė | Taisom K1–K4, A1–A6, GDPR; namų duomenys Firestore | Naujas CORE veikia be paskyros ir be Firestore; esama Firebase app lieka kolekcijai/priežiūrai/chat už login | Naujas stack'as viskam |
| Saugumo paviršius | Didelis (rules, invites, Storage, 12 endpoint'ų) | CORE — minimalus; Firebase rizikos lieka tik Pro sluoksnyje | Priklauso |
| GDPR | Namų+vaikų duomenys serveryje → DPIA, sutikimai, ištrynimas | Namų duomenys **niekada nepalieka įrenginio** (kol vartotojas neįjungia sync) | Priklauso |
| Kaštai | Firebase + Vercel (komerciniam — $20/mėn.) + AI | CORE ~$0 + AI tik foto atpažinimui | Laikas |
| Rizika | Maža techninė, didelė saugumo/GDPR | Vidutinė (du „režimai") | Didelė — išmetami veikiantys dalykai (katalogas, LT vardai, akvarelės, paieška) |
| Laikas iki CORE | Ilgiausias (pirma sutvarkyti saugumą) | Trumpiausias | Ilgas |

**Mano rekomendacija diskusijai — B.** Tai ne perrašymas: pernaudojami katalogas, LT vardai,
akvarelės, PR #7 UI ir logika, toksiškumo leidimas. Pasikeičia tik tai, kad CORE kelias nebeina
per Firestore ir paskyrą. Esama programėlė (kolekcija, priežiūra, chat, dalinimasis) tampa
„Pro/kolekcijos" sluoksniu, kurio saugumą (K3 ir kt.) taisom tik jei jis lieka gyvas. Bonusas:
atvira saugumo DB kaip statinis, nekomercinis artefaktas dera su PLD išimtimi (§4.3) ir su
akademijos „švaria riba" (`33`).

**Kas turi paaiškėti prieš sprendžiant:** kiek realių vartotojų turi dabartinė app (S2) ir ar
jie naudoja dalinimąsi/priežiūrą.

---

## 8. Sprendimai savininkui (surūšiuota pagal svarbą)

Sujungta iš Produkto 15 klausimų (Q1–Q15), Saugumo 5 klausimų ir naujų radinių; dublikatai
pašalinti. Prie kiekvieno — mano rekomendacija (galima patvirtinti arba keisti). **Nebeklausiama**
(atsakymas akivaizdus — tiesiog darom): ar taisyti `firestore.rules` (Q7, Saugumo Q1–Q2) → taip,
B1–B3; ar daryti GDPR minimumą (Saugumo Q5) → taip, K2.

| # | Sprendimas | Kodėl svarbu / ką blokuoja | Mano rekomendacija |
|---|---|---|---|
| S1 | **Kiek valandų per savaitę realiai + darbo sutarties IP patikra** (Q14) | Nuo to priklauso visa apimtis ir seka | ❓ tavo atsakymas |
| S2 | **Kas ir kiek realiai naudoja app'ą šiandien** (Q4) | Lemia S3 ir S12 (ką galima užšaldyti) | ❓ + Firestore/Sentry skaičiai |
| S3 | **Backend: A / B / C** (§7) | Blokuoja C2, K2, K3, kur gyvena duomenys | B — local-first CORE + esama app kaip Pro sluoksnis |
| S4 | **Sėkmės metrika po 12 mėn.** (Q1) | Ką matuojam ir ko nedarom | „Namų ūkiai, pamatę rizikų sąrašą" + ekspertų peržiūrėtų teiginių dalis |
| S5 | **Toksiškumo žinynas kaip stuburas** (TOXICITY_DATA §12) | Blokuoja T1–T6 ir visą CORE | Taip, bet **minimali versija** pradžiai (vienas failas + testai + versija), pilna darbo eiga — kai bus ekspertas |
| S6 | **„Gana" scenarijus ir išėjimo sąlyga** (Q15) | Apsaugo nuo amžino „dar truputį" | ❓ (pvz. „DB atiduodam institucijai, jei po 12 mėn. < X namų ūkių") |
| S7 | **Akademijos laiškas per 2 sav.** (Q5) | Ekspertų laikas — butelio kaklelis | Taip; adresatą patikslinti (VVKT?), prašyti peržiūrėti mirtinų genčių sąrašą + 10 augalų |
| S8 | **Teisininkas** (Q11) | Prieš viešą reklamavimą ir prieš Stripe | 1–2 val.: PLD + ar atskirti DB ir app subjektus |
| S9 | **Žinomos toksiškumo klaidos, kurias žinai tu** (Q6) | Įeina į T0/T2 | ❓ |
| S10 | **Namų profilio modelis** | GDPR apimtis | Telefone; „mažas vaikas (iki ~6 m.)", „vyresni vaikai", gyvūnai |
| S11 | **Pagalbos numeris kortelėse** (birželį: „be numerio") | Pediatro lęšis: pigiausia tikra vertė | 112 + patikrintas apsinuodijimų informacijos numeris su data |
| S12 | **Priežiūra ir „charakteriai"** (Q2, Q3) | Kur nedirbam | Užšaldyti už flag'ų, esamiems palikti |
| S13 | **Stripe/Pro šį ketvirtį** (Q8, Q9) | Hostingo kaina, PLD | Ne; pirma CORE |
| S14 | **Wallet** (Q12) | — | Kortelė nemokama visiems; Wallet pass vėliau |
| S15 | **Embed** (Q13) | — | Po leidimo, be reklamos iki ekspertų parašo |
| S16 | **Agreguoti duomenys** (Q10) | Pasitikėjimas | „Ne" dabar; įrašyti į privatumo politiką kaip pažadą |

---

## 9. Priklausomybės (kas ką blokuoja)

```
P0 catalog lock ─┬─► vieša biblioteka (flag) ─► embed
                 └─► bet koks ekspertų darbas (kitaip pataisos perrašomos)
Toks. Fazė 0 ───────► PR #7 rodymas vartotojams
S5 (architektūra) ─► Toks. Fazė 1 ─► Fazė 2 (leidimas v0.1) ─► PR #7 perdirbimas ─► onboarding
S3 (backend) ──────► kur gyvena namų profilis ─► GDPR apimtis (S10) ─► K3 reikalingumas
S7 laiškas ────────► ekspertų parašai ─► medikų kortelės gydymo tekstas ─► „Patvirtinta" ženklas
S8 teisininkas ────► Stripe/Pro, viešas reklamavimas
Vercel lubos ──────► K3 endpoint, ištrynimas, eksportas, Wallet
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

_Pildoma: Fable 5.1 adversarinė šios sintezės peržiūra — kas klaidinga, per drąsu ar praleista._

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
| `data/pfaf-*-chunks/` (~5 MB tarpiniai LLM vertimų failai) | Po S5 | S5 |
| FB postinimas, `ShopWidget`, `/api/dev-toxicity-test` iškvietimas, `vision-unlock` | K1, B4 | S12 |
| `README.md`, `PROJECT.md` perrašymas; `DESIGN.md` → Brandbook v1.0 | K6 | S3 |
