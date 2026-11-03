# Namų rizikos MVP ir toksikologinė kortelė

_Ataskaita. Šaka: `feature/household-risk`. Data: 2026-11-03._

> **TL;DR.** Įgyvendinta nauja kryptis: (1) namų ūkio profilis (kas gyvena namuose),
> (2) kiekvieno vartotojo augalo rizikos įvertinimas pagal namų narius su aiškiu
> vizualu ir išdėstymo rekomendacija, (3) toksikologinė kortelė medikui / veterinarui
> (spausdinama + pasidalinama). Rizikos logika padengta Vitest testais (27 + 8 render).
> Naudoti **esami** duomenys (`data/toxin-classes.json`, `data/genus-toxin-map.json`);
> trūkstami laukai eksplicitiškai pažymėti žemiau.

---

## 1. Kontekstas ir kryptis

CORE (naujas KONTEKSTAS): kambarinių augalų toksiškumo DB (žmonėms/vaikams, šunims,
katėms ir kt.). Vartotojas susideda augalus, nurodo, kas gyvena namuose, ir mato,
kuris augalas kam ir kiek pavojingas, ką laikyti aukščiau / ant žemės / geriau ne
namuose, bei toksikologinę kortelę medikams/veterinarui.

Ši kryptis **sutampa** su repo strategijos dokumentais (`tasks/konsiliumas-2026-06/`),
kurie namų saugumo intelektą ir medikų kortelę jau įvardijo kaip stipriausią
diferenciatorių. Senoji „pasas–žyma–marketplace" kryptis naudota tik kaip istorija
(žr. `60-galutine-santrauka.md`).

### Perskaityti dokumentai (susiję su užduotimi)
- `docs/toksiskumo-klasifikacija.md` — 19 toksinų klasių, gentis→klasė tier'ai, rūšies jautrumas.
- `docs/toksiskumo-integracija.md` — `resolveToxinProfile(plant, household)` kontraktas (būtent jį ir implementavau).
- `tasks/konsiliumas-2026-06/44-namu-saugumo-intelektas.md`, `46-saugumo-feature-sinteze.md` — feature apimtis.
- `tasks/konsiliumas-2026-06/45-pediatras-toksikologas.md`, `45-veterinaras.md`, `45-liability-redteam.md` — liability/GDPR ribos (griežtai laikytasi, žr. §4).
- `README.md`, `PROJECT.md`, `DESIGN.md`, `src/ARCHITECTURE.md` (per Explore).

---

## 2. Kas įgyvendinta

### 2.1. Rizikos logika (gryna, testuojama) — `src/utils/toxinClasses.js`
- `resolveToxinProfile(plant, household, data?)` — `docs/toksiskumo-integracija.md` kontrakto implementacija:
  gentis → klasės → household → kortelei paruošta struktūra. Sunkumas **išvedamas**
  (max per relevant auditorijas), ne priskiriamas laisvai.
- `assessHouseholdRisk(plant, household)` — namų rizikos sluoksnis: išdėstymo rekomendacija
  + per-narį skiltis + kritinė vėliava.
- `genusOf`, `normalizeHousehold`, `isHouseholdEmpty` ir metaduomenys (etiketės, tonai).
- Duomenys importuojami kaip bundled JSON (maži failai, ~57 KB) — veikia ir naršyklėj, ir Vitest'e.

### 2.2. Namų profilis — `src/components/HouseholdProfileEditor.jsx`
- Redaktorius `ProfileSheet`'e (nustatymų meniu). Laukai: **vaikai** (+ neprivalomas
  apytikslis amžiaus intervalas), **gyvūnai** (katė / šuo / paukštis / graužikas),
  **kiti gyvūnai**.
- Saugoma kolekcijos `settings.household` per esamą `updateSettings()` (anksčiau buvo
  wired, bet nenaudotas). Firestore rules keisti **nereikėjo** (nariai jau gali rašyti
  kolekcijos meta dokumentą).

### 2.3. Per-augalo rizika — `src/components/sauga/HouseholdRiskSection.jsx`
- Rodoma `PlantDetail` → „Augalas" skiltyje (auginamiems ir „nori"). Elementai:
  - **Rekomendacija** su tonu: _Geriau ne namuose_ / _Laikyti aukštai_ / _Galima
    pasiekiamai_ + _Atsargiai (trūksta duomenų)_ / _Pavojų nematyti_.
  - **Pagal namų narį** („TAVO katei: MIRTINAS / TAVO šuniui: …") — rūšies diferenciacija.
  - **Kritinė vėliava** („SKAMBINK DABAR") kai bent vienam nariui mirtina.
  - **Duomenų spragos** — sąžiningai įvardytos.
  - Jei profilis nenustatytas — kvietimas jį užpildyti.

### 2.4. Toksikologinė kortelė — `src/components/sauga/ToxCard.jsx` (+ `ToxCardSheet`, `ToxCardPage`)
- Mobiliai patogi, **spausdinama** (`@media print` → rodoma tik kortelė) ir **pasidalinama**
  (`navigator.share` / kopijavimas). Turinys: lietuviškas + lotyniškas pavadinimas (+ sinonimai),
  statusas + duomenų patikimumas, **toksinų klasės** (mechanizmas, organas, dalis, sunkumo
  lubos, antidotas), **rūšies jautrumas** (žmogus/katė/šuo/paukštis/graužikas), simptomai,
  **„Medikui / veterinarui"** blokas, šaltiniai, „Ką daryti" (be procedūrų) + konfigūruojami
  kontaktai, aiškus **disclaimer** „informacija, ne medicininė konsultacija".
- Pasiekiama: per „Toksikologinė kortelė" mygtuką augalo kortelėj; viešai per `/t/{plantId}`
  (jei augalo pasas įjungtas) — `src/pages/ToxCardPage.jsx`, registruota `src/main.jsx`.

### 2.5. Testai
- `src/utils/householdRisk.test.js` — 27 testai (sunkumo išvedimas, rūšies diferenciacija,
  „nėra duomenų ≠ saugu", rekomendacijų žemėlapis, mažų vaikų modifikatorius, injekuoti fixture'ai).
- `src/components/sauga/toxCard.render.test.jsx` — 8 render smoke-testai (`react-dom/server`).
- Pilnas rinkinys: **251 testas žalias** (`npm test`). `npm run build` — OK.

---

## 3. Ekranų aprašymas (žr. ir PR screenshot'ą)

1. **Namų profilis (ProfileSheet).** „Namų profilis" kortelė: jungiklis „Vaikai"
   (+ amžiaus čipai), gyvūnų čipai, privatumo pastaba.
2. **Per-augalo rizika (PlantDetail → Augalas).** Spalvota rekomendacijos kortelė
   (terracotta = kritinė, caramel = aukštai, forest = maža/saugu, bone = nežinoma),
   po ja per-narį sunkumo žymos, duomenų spragos, mygtukas „Toksikologinė kortelė".
   - Pvz. _Kalankė + katė/šuo_ → „Geriau ne namuose", KATĖMS/ŠUNIMS **MIRTINAS**.
   - Pvz. _Monstera + maži vaikai_ → „Maža rizika" (deeskaluota — oksalatai, ne panika),
     VAIKAMS **LENGVAS** + mažų vaikų pasiekiamumo pastaba.
3. **Toksikologinė kortelė.** Baltas, spausdinamas lapas su disclaimer'iu, klasių
   kortelėmis, rūšies jautrumo žymomis, „Medikui" blokais, kontaktais (su TODO).

---

## 4. Saugumo ir liability principai (griežtai laikytasi)

Iš `45-liability-redteam.md`, `45-pediatras-toksikologas.md`, `45-veterinaras.md`:

| Principas | Kaip įgyvendinta |
|---|---|
| **Jokio „saugumo balo"** | Rodomas rizikų SĄRAŠAS + per-narį žymos, niekada ne skaičius. |
| **Jokio triage** (simptomai → sprendimas) | Kortelė rodo faktus + kontaktus; jokio „palauk / skambink" sprendimo. |
| **„Nėra duomenų ≠ saugu"** | Nepažįstama gentis/klasė → statusas `nezinoma`, atskiras tonas, niekada ne „saugu". |
| **Sunkumo gradacija** | Lokalus dirgiklis (Monstera) deeskaluojamas; sisteminis (Kalankė/Cycas) — kritinis. |
| **Rūšies diferenciacija** | Katė ≠ šuo ≠ paukštis — iš `rusies_jautrumas`. |
| **Jokių pirmosios pagalbos procedūrų** | „Nesukelk vėmimo, negydyk savarankiškai" (vėmimo sukėlimas kontraindikuotas) — tik kryptis į specialistą. |
| **GDPR (vaikų duomenys)** | Neklausiama tikslaus amžiaus/vardo/datos — tik „yra vaikų" + apytikslis intervalas. |
| **Konfigūruojami kontaktai** | Numeriai nespėjami — `src/constants/emergencyContacts.js` su TODO (žr. §5.2). |

---

## 5. Sprendimai, kompromisai ir prieštaravimai

### 5.1. „vaikai (amžius)" vs GDPR — apytiksliai intervalai
Užduotis prašė vaikų **amžiaus**, bet `45-liability-redteam.md §3.6` perspėja, kad
tikslus vaiko amžius/vardas = GDPR vaikų duomenys (baudos iki 4% apyvartos), ir siūlo
tik „yra vaikas" boolean'ą. **Sprendimas:** apytiksliai, neidentifikuojantys intervalai
(0–3 / 4–6 / 7+), **neprivalomi**. Amžius lieka rizikos modifikatorius (maži vaikai =
didesnė ekspozicija, 71% ekspozicijų ≤5 m. — `45-pediatras`), bet be tikslios datos/vardo.
Tai suderina founder'io intenciją su liability riba.

### 5.2. Pagalbos telefonai — konfigūruojami, nespėti (TODO)
Užduotis: „palik kaip konfigūruojamą lauką su TODO, nespėliok numerių." **Sprendimas:**
`emergencyContacts.js` — aktyvūs numeriai (`numeris`) pagal nutylėjimą `null` (kortelė
rodo „nesukonfigūruota (TODO)"). Repo dokumentuose rasti kandidatai (pvz. Apsinuodijimų
biuras +370 5 236 2052) įrašyti tik kaip `siulomas` su žyma „patikrinti" — **nepateikiami
kaip patvirtintas faktas**. 112 paliktas kaip universalus ES faktas. Vet numeriai — tušti
(lokalu; Lietuvoje atskiros gyvūnų linijos nėra).

### 5.3. „Pirmoji pagalba" laukas
Užduotis minėjo „pirmąją pagalbą" kaip kortelės lauką, bet liability dokumentai draudžia
pirmosios pagalbos procedūras (vėmimo sukėlimas kai kuriais atvejais žalingas). **Sprendimas:**
skiltis „Ką daryti" pateikia tik saugią, ne-procedūrinę žinutę + kontaktus; `medikui_lt`
faktai skirti profesionalui, ne naudotojui kaip instrukcija.

### 5.4. MD vs kodas prieštaravimai (pažymėta, kaip prašyta)
- **`DESIGN.md` neatitinka kodo.** `DESIGN.md` aprašo „geliai.app" sage/sky/surface paletę
  ir emoji ikonų sistemą; realus kodas naudoja **LapasID Brandbook v1.0** — forest/bone/
  terracotta tokens, `font-display` (Bricolage), `font-mono` caps, `rounded-btn`, `SeverityBars`.
  Naują UI dariau pagal **kodą** (tikrąją sistemą), ne `DESIGN.md`. Rekomenduojama atnaujinti
  arba pervardyti `DESIGN.md` (galbūt tikroji sistema yra minima kaip `DESIGN_SYSTEM.md`
  komentaruose, bet tokio failo repo nėra).
- **Konsiliumo docs vs užduotis dėl vaiko amžiaus** — žr. §5.1 (suderinta intervalais).

---

## 6. Duomenų spragos (naudoti esami duomenys, trūkstami pažymėti)

1. **Trūksta „lethal whitelist" genčių `genus-toxin-map.json`.** Žemėlapis dengia 72 dažnas
   kambarines gentis, bet **nėra** daugelio dokumentuose įvardytų mirtinų: `LILIUM`,
   `HEMEROCALLIS`, `NERIUM`, `DIGITALIS`, `CONVALLARIA`, `ZAMIA`, `RICINUS`, `ABRUS`,
   `RHODODENDRON`/`AZALEA`, `TAXUS`, `PERSEA`, `ACONITUM`, `COLCHICUM`, `GLORIOSA`
   (yra tik `KALANCHOE`, `CYCAS`). Jos šiuo metu grąžina `nezinoma` (sąžiningai, bet
   nepilna). Klasės (`lily_nephrotoxin`, `cardiac_glycosides` ir kt.) jau egzistuoja —
   reikia tik gentis→klasė įrašų. **Nepridėjau sąmoningai** (accuracy-critical, laukia
   toksikologo patikros; užduotis prašė naudoti esamus duomenis). Rekomenduojamas
   #1 sekantis žingsnis — šaltinis jau yra `docs/toksiskumo-klasifikacija.md §3–5`.
2. **`specialios_veliavos` nėra duomenyse.** Resolveris jas **palaiko** (pvz.
   `liūtis_katei_kritinė`, `avokadas_paukščiui_kritinis`), bet `genus-toxin-map.json` jų kol
   kas neturi → nerodoma. Pridėti kartu su §6.1.
3. **„Kiti gyvūnai"** — nėra toksiškumo duomenų ne katė/šuo/paukštis/graužikas rūšims;
   rodom sąžiningą „nėra duomenų" žymą.
4. **`aprasymai` auditorijoms** — kai kurioms klasėms gali trūkti `gyvunai`/`vaikai` teksto;
   resolveris gražiai fallback'ina (suaugęs žmogus).
5. **Duomenų patikimumas apskritai** — visa toksinų bazė yra research-grade juodraštis,
   **dar nepatvirtintas toksikologo** (akademijos partnerystė, `33-...`). Kortelė tai
   eksplicitiškai nurodo.

---

## 7. Kas NEpadaryta / sekantys žingsniai

- **Užpildyti „lethal whitelist" gentis + specialios_veliavos** (§6.1–6.2) — didžiausia vertė saugai.
- **Zonų saugumo semantika** (zonos tipas „vaiko kambarys" × toksiškas augalas) — docs numatyta,
  bet ne šio MVP apimtyje; zonos šiuo metu turi tik `{id, name}`.
- **Kolekcijos saugumo ataskaita** (visi augalai × profilis viename sąraše) — natūralus plėtinys.
- **Toksikologo verifikacija** — kortelei įgyti „Patvirtinta [toksikologas]" antspaudą.
- **Pagalbos numerių patvirtinimas** (§5.2).

---

## 8. Kaip patikrinti

```bash
npm install
npm test        # 251 testas (rizikos logika + render)
npm run build   # produkcijos build'as
npm run dev     # lokaliai — ProfileSheet → „Namų profilis", augalo kortelė → „Namų rizika"
```

Pakeisti failai/nauji: `src/utils/toxinClasses.js`, `src/utils/householdRisk.test.js`,
`src/constants/emergencyContacts.js`, `src/components/HouseholdProfileEditor.jsx`,
`src/components/sauga/*`, `src/pages/ToxCardPage.jsx`, `src/main.jsx`, `src/App.jsx`,
`src/components/ProfileSheet.jsx`, `src/components/plant-detail/{PlantDetail,ProfileContent}.jsx`,
`src/index.css`.

**Ribos (laikytasi):** dirbta tik `feature/household-risk` šakoje; nieko nedeploy'inta;
produkciniai Firestore/Storage duomenys nekeisti; prod secrets nenaudoti; toksiškumo
duomenys (`data/*.json`) **nekeisti**.
