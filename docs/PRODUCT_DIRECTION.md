# PRODUCT DIRECTION — LapasID (2026-11-03)

> **Statusas:** Produkto vadovo peržiūra po krypties pakeitimo. Rašyta remiantis visa
> repozitorijos dokumentacija (README, PROJECT, DESIGN, docs/, tasks/konsiliumas-2026-06/).
> **Prieštaravimai su sena kryptimi:** pažymėti ⚠️ skiltyje.

---

## ⚠️ Senos krypties prieštaravimai su nauja

Toliau išvardyti dokumentai apibūdina **seną kryptį**, kuri šiame dokumente laikoma tik istorija:

| Failas | Sena kryptis | Nauja pozicija |
|--------|-------------|----------------|
| `tasks/konsiliumas-2026-06/01-briefing.md` | NFC žymos kaip wedge, marketplace kaip tikslas | Žymos = upsell, marketplace = „durys, ne darbų sąrašas" |
| `tasks/konsiliumas-2026-06/10-regulatory-strategas.md` | EU GPSR/HN 75 kaip „priekyje" | GPSR augalus išbraukia; HN 75 — tik žvalgyba |
| `tasks/konsiliumas-2026-06/10-b2b-hortikultura.md` | B2B pardavėjų kasa | Atidėta iki išorinio signalo |
| `README.md` nuoroda į `geliai.app` | Senas domenas | Aktualus lapasid.lt |
| Priežiūros app kaip „pagrindas" (seni planai) | Laistymo/tręšimo prognozės kaip core UVP | Dabar antraeilis sluoksnis |

---

## 1. Kas nemokama, kas paywall — ir kodėl

### Principas

**Saugumo informacija = VISADA nemokama. Paslaugos ant jos viršaus = Pro.**

Pagrindimas: `tasks/konsiliumas-2026-06/60-galutine-santrauka.md` §4 tiesiogiai nurodo:
„INFO RIBA: saugumas — VISADA 100% atviras (missijos šerdis, niekada nemonetizuojamas)."
Tai ir teisiškai protinga — užrakintas saugumo įspėjimas ieškinį pritrauktų greičiau nei bet kuri kita klaida.

### Nemokama (Free)

| Funkcija | Kodėl nemokama |
|----------|---------------|
| Augalo toksiškumo kortelė (visi gyventojai: žmonės/vaikai, šunys, katės) | Missija, acquisition, niekada neužrakinamas |
| Namų rizikos sąrašas (kurie augalai konfliktą su nurodytu profilio) | Pagrindinis vartotojo poreikis; paywall čia = atstumianti |
| Toksikologinė kortelė medikams/veterinarui (PDF/ekrano versija) | Emergency use case; užrakinti = etiškai ir teisiškai pavojinga |
| Augalo saugumo statusas katalogelyje (žalioji/raudonoji/pilkoji juosta) | Acquisition hook — socialiniuose tinkluose dalinamasi nemokama info |
| Nuorodos į LT Apsinuodijimų centrą ir vet pagalbą | Privaloma (žr. §6); niekada neužrakinti |
| Bazinė augalų paieška (pavadinimas, foto) | Onboarding kanalas — mokamas onboarding = mažiau vartotojų |
| Iki ~10 augalų kolekcija | Laisvas startas; skaičius tikslinamas pagal pirmuosius vartotojus |

### Pro (paywall) — siūloma €29–39/metus

| Funkcija | Kodėl Pro | Pastaba |
|----------|-----------|---------|
| Neribotas augalų skaičius kolekcijoje | Klasikinis freemium lubas | Tikslinamas per pirmus 3 mėn. |
| Priežiūros prognozės (laistymas/tręšimas) + istorija | Naudinga, bet ne gyvybiškai būtina | Esama funkcija, tik „paslėpti" |
| Augalų priežiūros „charakteriai" / AI pokalbiai | Linksmybė, ne saugumas | Gali likti ir nemokama, jei retai naudojama |
| Multi-vartotojo kolekcija (invitations, rolės) | Šeimos/bendro naudojimo scenarijus | Galima Pro arba atskiras planas |
| Pažengusi priežiūros statistika (heatmap, rewards) | Nišinė, entuziastams | |
| Eksportas (PDF kolekcijos ataskaita, Wallet pass) | Patogumo funkcija | Wallet — žr. §4 |

### Ko NEREIKĖTŲ daryti

- **Neužrakinti augalo puslapio.** Toksikologinė info turi būti matoma net be prisijungimo.
- **Nestatyti paywall'o prieš namų rizikos ataskaitą.** Vartotojas nurodo vaiką/katę → tada jam sakoma „mokėk" = momentinis išpuolimas.
- **Nepirkti taško su „Verified" ženkleliu.** Akademijos verifikacija turi eiti į duomenis, ne į mokamo tier'o rinkodarą.

---

## 2. Onboarding „susidėk savo augalus" — kaip padaryti greitą

### Problema

Šiuo metu onboarding = „rask augalą per paieška, pridėk, kartok." Tai tinka entuziastui su 3 augalais; sugriūva su 15. Nauja kryptis reikalauja, kad vartotojas **prieš bet ką** nustatytų namų profilį (vaikas / katė / šuo) ir tada matytų, kurie jo augalai kuria riziką.

### Siūlomas 3-etapų srautas

**Etapas 1 — Namų profilis (30 sekundžių, pirmasis ekranas)**

```
Kas gyvena tavo namuose?
  [ ] Mažas vaikas (iki 6 m.)
  [ ] Paauglys (6–14 m.)
  [ ] Šuo
  [ ] Katė
  [ ] Paukštis
  [ ] Kitas gyvūnas
  [Tęsti →]
```

Svarbūs apribojimai (žr. §6 ir `45-liability-redteam`):
- Neklausti tikslaus amžiaus/vardo — tik `boolean` kategorija
- Duomenis laikyti tik lokaliai/vartotojo paskyroje; neperduoti trečiosioms šalims
- Galimybė praleisti ir nustatyti vėliau

**Etapas 2 — Augalų sudėjimas (trys keliai lygiagrečiai)**

| Kelias | Aprašas | Greitis | Tinka |
|--------|---------|---------|-------|
| **Foto** | Nufotografuoj augalą → AI identifikuoja (esama Claude vision funkcija) | Lėčiausias (5–10 s), bet be spausdinimo | Naudotojai su vienu augalu |
| **Paieška** | Rašo pavadinimą (LT arba lot.) → greita autokompletė iš katalogo | Vidutinis (2–3 s) | Tie, kurie žino augalo vardą |
| **Sąrašas iš katalogo** | Naršo kategorijas (Araceae, sukulentai…) → spausti „Pridėti" | Lėčiausias, bet vizualiai patrauklus | Entuziastai |

Rekomenduojamas **numatytasis kelias: foto**, nes mažiausiai reikalauja žinių. Paieška = antrinė.

**Etapas 3 — Momentinis rezultatas**

Iš karto po pirmo augalo:

```
Tavo namuose: 🐱 katė
Monstera deliciosa — ⚠️ VIDUTINIŠKAI TOKSIŠKAS katėms
  → Kalcio oksalatai: burnos/gerklės dirginimas
  Laikyk nepasiekiamoje vietoje
[Pridėti daugiau augalų] [Peržiūrėti visus]
```

Vartotojas per 60 sekundžių gauna **realią naudą** dar neprisijungęs/neprisiregistravęs. Tai „aha" momentas, kuris motyvuoja tęsti.

### Techniniai reikalavimai

- Foto identifikavimas: **jau veikia** (`api/` Claude vision pipeline)
- Namų profilis: nauja `household` struktūra Firestore `users/{uid}` dokumente; arba `localStorage` iki prisijungimo
- Konfliktų rodymas: `resolveToxinProfile(plant, household)` — jau apibrėžta `docs/toksiskumo-integracija.md`

---

## 3. Akademijos bendradarbiavimo modelis

### Kas galėtų būti partneris

Remiantis `tasks/konsiliumas-2026-06/33-akademijos-partnerystes-planas.md`:

1. **Lietuvos apsinuodijimų kontrolės ir informacijos biuras** (Vilniaus universiteto ligoninė Santaros klinikos) — pirminis kontaktas; turi ir žmonių, ir (neoficialiai) gyvūnų toksikologijos ekspertizę
2. **LSMU (Lietuvos sveikatos mokslų universitetas)** — veterinarijos ir medicinos fakultetai; galimi toksikologo ir veterinaro sign-off partneriai
3. **VDU Botanikos sodas** — augalų identifikavimo ir nomenklatūros autoritetas
4. **Lietuvos botanikų draugija** — savanoriškas tinklas su botanikų ekspertize

### Ką gautų akademija

| Nauda | Detalė |
|-------|--------|
| **Autorystės ženklinimas** | „Verifikuota: [Institucija], [Ekspertas], [Data]" kiekvieno augalo toksiškumo kortelėje |
| **Visuomenės švietimo platforma** | Prieiga prie tūkstančių vartotojų, kurie aktyviai ieško saugumo informacijos |
| **Duomenų bazė tyrimams** | Anoniminiai duomenys apie tai, kurie augalai dažnai klausiami (žr. §5 apie rizikas) |
| **Finansavimo paraiškos vehikulis** | Institucija gali teikti paraiškas ne/pelno ar mokslinių tyrimų fondams (pvz., LMT, Europos Komisija); LapasID = techninis partneris |
| **Viešas geras** | Atvirasis saugumo duomenų rinkinys, prieinamas mokslininkams ir visuomenei |

### Ką gautų LapasID

| Nauda | Detalė |
|-------|--------|
| Duomenų tikslumas | Eksperto verifikuotas toksiškumo aprašas (svarbiausias turtas) |
| Autoritetas | „Verified" ženklelis vietoj „~85–90% solidumas" (kaip dabar `toksiskumo-klasifikacija.md` žymi) |
| Atsakomybės dalinimas | Ekspertas sign-off mažina teisinę riziką (nors neelimina visiškai — žr. §6) |
| Non-dilutinis finansavimas | Institucija kaip paraiškų vehikulis = finansavimas be nuosavybės praradimo |
| Distribucija | Institucijos tinklai: sveikatos priežiūros specialistai, veterinarai, mokyklos |

### Siūlomas pirmasis žingsnis

**Vienas laiškas** Apsinuodijimų biurui: (a) prašymas patvirtinti 10 dažniausių augalų toksikologinius aprašus, (b) klausimas apie partnerystės galimybes. Ne 30 psl. paraiška.

### Svarbios ribos

- Akademija verifikuoja **duomenis**, ne produkto komercinį sluoksnį — riba turi būti aiški sutartyje
- Missijos duomenys lieka **vieši ir nemokami** nepriklausomai nuo partnerystės sąlygų
- Partnerio buvimas **nesuteikia teisės** daryti simptomų triage ar medicininius patarimus (žr. §6)

---

## 4. Apple/Google Wallet — toksikologinė kortelė kaip Pass

### Kas tai būtų

**Scenarijus:** Vartotojas išsaugo savo namų augalų toksikologinę suvestinę į telefoną kaip Wallet pass'ą. Jei įvyksta apsinuodijimas, gydytojui/veterinarui parodo kortelę su:
- Augalo pavadinimas (LT + lot.)
- Toksiškumas (žmogui, katei, šuniui)
- Aktyvus junginys ir mechanizmas
- Antidotas (jei yra)
- LT Apsinuodijimų centro numeris

### Techninis įgyvendinamumas

**Apple Wallet (PKPass)**

| Aspektas | Realybė |
|----------|---------|
| Formatas | `.pkpass` — ZIP su `pass.json` + PNG vaizdai |
| Generavimas | Serverside: Node.js biblioteka `passkit-generator` arba `@walletpass/pass-js` |
| Sertifikatas | Apple Developer Program ($99/m) + Pass Type ID sertifikatas (vienkartinis darbas ~1–2 val.) |
| Atnaujinimai | Push atnaujinimai per APNs — augalo duomenys pasikeičia → kortelė atsisiunčia naują versiją |
| Sudėtingumas | **Vidutinis** — serverinis endpoint (`api/generate-wallet-pass`), JSON schema, PNG šablonai |

**Google Wallet (Generic Pass)**

| Aspektas | Realybė |
|----------|---------|
| Formatas | JWT su Google Wallet API | 
| Generavimas | Google Wallet API (REST) + Service Account kredencialai |
| Kaina | Nemokamai (Google Developer programa) |
| Atnaujinimai | PATCH per API — realus laikas |
| Sudėtingumas | **Vidutinis** — analogiškas Apple, skirtingas formatas |

### Ką reikėtų padaryti (apytikris įvertinimas)

1. `api/generate-wallet-pass` serverless endpoint (~2–3 dienos)
2. PKPass/Google JSON šablonas toksikologinei kortelei (~1 diena)
3. Apple Developer sertifikatas + Google Service Account (~1–2 val.)
4. Frontend mygtukas „Išsaugoti į Wallet" augalo puslapyje (~0.5 dienos)
5. Testavimas iOS/Android (~1 diena)

**Iš viso: ~5–7 darbo dienos** nuo nulio iki veikiančio prototype.

### Rekomendacija

**Daryti, bet ne dabar.** Prioritetas: (1) namų profilis + konfliktų rodymas, (2) onboarding, (3) tada Wallet. Wallet yra gera Pro funkcija — vartotojas, kuris nori offline toksikologinę kortelę kišenėje, yra tiksliai tas Pro klientas, kuris moka €39/m.

**Svarbus apribojimas:** Kortelė = statiškas fakto lapas. Jokio „kas daryti jei" teksto — tik faktai + kontaktai. Tai išlaiko ją „informacijos", ne „medicininio patarimo" pusėje (žr. §6).

---

## 5. Nuasmenintų agreguotų duomenų verslo panaudojimo galimybės ir rizikos

### Galimybės

| Galimybė | Aprašas | Vertė |
|----------|---------|-------|
| **Populiariausių augalų katalogas** | Kurie augalai dažniausiai laikomi LT namuose (pagal kolekcijų duomenis) | Hortikulturos pramonė; mažmeninė prekyba |
| **Saugumo įspėjimų dažnis** | Kurie augalai dažniausiai sukelia „toksiškas + vaikas namuose" kombinaciją | Vaikų sveikatos institucijai; Apsinuodijimų centrui |
| **Sezoninis paieškos grafikas** | Kurie augalai ieškomi prieš Velykas, Kalėdas ir kt. | Mažmenininkams kampanijų planavimui |
| **Geografinė distribucija** | Regioniniai augalų populiarumo skirtumai | Botanikos soduose, švietime |
| **Embed statistika** | Kuriuose domeninuose puslapiuose dažniausiai naudojamas saugumo widget'as | PR ir distribucijos analizei |

### Rizikos

**GDPR/duomenų apsaugos rizikos:**

| Rizika | Konkretus pavojus | Kaip sumažinti |
|--------|------------------|----------------|
| Re-identifikacija | Mažoje rinkoje (LT) retas augalas + zona + namuose vaikas = identifikuojamas asmuo | Minimalus k-anonimatas; neskelbti rūšių su <50 vartotojų |
| Namų profilis = jautri informacija | „Vaikas + katė + reta augalų kombinacija" gali identifikuoti šeimą | Namų profilio NIEKADA neįtraukti į aggregatus; tik augalų populiarumas |
| Vaikų duomenys | GDPR 8 str. — ypatingas statusas; net indirektiniai vaikų duomenys (kol mama laiko toksišką augalą) | DPIA (duomenų apsaugos poveikio vertinimas) prieš bet kokį agregavimą |
| Sutikimas | Vartotojai gali nesitikėti, kad jų augalų rinkinys bus parduodamas/dalinamas | Aiški privatumo politika; opt-in, ne opt-out |

**Verslo rizikos:**

| Rizika | Detalė |
|--------|--------|
| Pasitikėjimo praradimas | Jei išaiškėtų, kad „saugumo programa" parduoda duomenis — tai tiesioginis missijos išdavimas |
| Mažas TAM | LT vartotojų bazė per maža prasmingam B2B datasetui (šimtai, ne tūkstančiai) |
| Konkurentai gauna duomenis | Jei Plantbeeb ar kitas pirkėjas gauna LT augalų rinkos žemėlapį — galima konkurencinė žala |

### Rekomendacija

**Neskubėti.** Realiausias panaudojimas artimiausioje perspektyvoje — **vidinis** (savo produkto tobulinimui: žinoti, kurie augalai dažniausiai klausiami → tų aprašus tobulinti pirmiau). Išorinis monetizavimas — tik kai vartotojų bazė bus ≥5000 aktyvių + aiški sutikimo sistema + DPIA baigtas.

---

## 6. Didžiausios produkto rizikos

### R1 — Atsakomybė už medicininę/veterinarinę informaciją ⛔ (KRITINĖ)

**Problema:** Jei vartotojas pamatė „vidutiniškai toksiškas" ir neskambino veterinarui, o gyvūnas mirė — gali būti teisinė pretenzija.

**Teisinis kontekstas** (iš `45-liability-redteam.md`):
- **ES MDR Rule 11**: Software, kuris teikia simptomų vertinimą ir rekomenduoja „skambinti ar palaukti" = medicinos prietaisas (Class IIb/III). Solo founder'iui tai neįmanoma sertifikuoti.
- **ES PLD 2024/2853** (įsigalioja 2026-12-09): Griežtoji atsakomybė už patį app'ą. Svarbiausia — `firestore.rules:86` šiuo metu leidžia BET KURIAM authed vartotojui rašyti į katalogą. Reikalinga **skubi pataisa**.
- **False reassurance**: Jei rodom „nėra duomenų" vizualiai taip, kad atrodo „saugu" — tai atskiras atsakomybės pagrindas.

**Kaip valdyti:**
1. Niekada neteigti „saugu" ten, kur nėra duomenų — rodyti „duomenų nėra, elkis atsargiai"
2. Jokio simptomų triage srauto — tik statiniai faktai + kontaktai
3. Aiškus disclaimer kiekvienoje toksikologinėje kortelėje: „Tai informacijos, ne medicininio patarimo šaltinis. Skubiais atvejais skambink: LT Apsinuodijimų centras +370 5 236 2052 (24/7) | Veterinarijai — artimiausia 24/7 klinika"
4. Akademijos/toksikologo sign-off ant kiekvieno patikrinto aprašo
5. Skubi Firestore taisyklių pataisa: catalog WRITE tik `isAdmin`

### R2 — Duomenų tikslumas ⚠️ (AUKŠTA)

**Problema:** Esamas `deriveToxicity.js` yra ~85–90% tikslus (paties kodo komentaras). Kai kuriais atvejais severity gali būti sukeista (žr. `backlog.md` — Alocasia bug). Sistemingai netikslūs duomenys × toksikologinė tematika = aukšta žalos tikimybė.

**Kaip valdyti:**
1. Aiškiai žymėti duomenų patikimumo lygį (AUKŠTAS/VIDUTINIS/ŽEMAS) vartotojui matomai
2. Akademijos verifikacijos eilė — pradėti nuo 15 dažniausių augalų
3. `toksiskumo-klasifikacija.md` junginio klasių sistema (jau parengta) → integruoti į UI
4. Aktyvus klaidų pranešimo mechanizmas vartotojams

### R3 — GDPR ir vaikų duomenys ⚠️ (AUKŠTA)

**Problema:** Namų profilis su „mažas vaikas" kategorija — LT GDPR default sutikimo amžius reikia patikrinti (ES default 16 m.). Vaikų namų duomenys = padidinta apsauga.

**Kaip valdyti:**
1. DPIA (duomenų apsaugos poveikio vertinimas) — reikalingas prieš produkcinį namų profilio paleidimą
2. Namų profilis: tik `boolean` kategorijos, ne tikslus amžius/vardas
3. Duomenys tik vartotojo paskyroje; nebenaudoti agregavimui be aiškaus opt-in
4. Privatumo politikos atnaujinimas

### R4 — Duomenų bazės licencijos ⚠️ (VIDUTINĖ)

**Problema:** `tasks/konsiliumas-2026-06/60-galutine-santrauka.md` §1 nurodo, kad trijų stipriausių DB (pfaf, pre-db, lt-names) komercinis pamatas „teisiškai trapus."

**Kaip valdyti:**
1. Saugumo/toksiškumo sluoksnis jau švari (deriveToxicity + ASPCA + originalūs aprašai) — startas galimas su juo
2. PFAF/kitos duomenų bazės aprašams — licencijų valymas prieš viešą publikavimą
3. Laisvai naudojami šaltiniai: WCVP CC BY, USDA GRIN, Wikidata CC0 — migruoti pirmiau

### R5 — Konkurencija (ŽEMA-VIDUTINĖ)

**Problema:** Plantbeeb (~2026 sektoriaus mastu) gali pridėti toksiškumą ir sunaikinti differentiatorių.

**Kaip valdyti:**
- Mūsų pranašumas — LT lokalizacija + akademijos partnerystė + founder'io misija (jie „neeis ten, kur neapsimoka")
- Statyti embed/distribucijos kanalą greitai — kai esame standartas, sunkiau pakeisti
- Duomenys lieka atviri (negalima gynybinė strategija = jie bus vieši bet kuriuo atveju)

---

## 7. 10–15 klausimų savininkui prieš VISION.md

Atsakymai į šiuos klausimus reikalingi, kad VISION.md galėtų nubrėžti realų, ne hipotetinį kelią.

### Produkto strategija

**Q1.** Kokia yra vienintelė metrika, kuria po 12 mėn. sakysi „pavyko"? (Aktyvių vartotojų skaičius? Embed'ų domenai? Pro mokančiųjų skaičius? Akademijos partnerystė užmegzta? Ar kažkas kitas?)

**Q2.** Priežiūros app (laistymo prognozės, istorija, care rewards) — ar tai turi likti visam vartotojui nemokama, likti Pro, ar galima visai atjungti kaip sekundinio prioriteto funkciją? Ar yra nors vienas vartotojas, kuris liktų tik dėl priežiūros app?

**Q3.** Augalų „charakteriai" ir AI pokalbiai (`PlantChat`) — ar matai konkrečią auditoriją, kuri už tai mokėtų? Ar tai likintina kaip nemokama engagement funkcija, ar užrakinti už Pro, ar visai išvalyti?

**Q4.** Koks yra tikslinis vartotojo portretas šiandien — pagal tai, kas faktiškai naudoja app'ą (ne kas norėtų naudoti)?

### Duomenų ir akademijos klausimas

**Q5.** Ar jau buvo bet koks kontaktas su LT Apsinuodijimų kontrolės biuru ar kitomis institucijomis? Jei ne — ar esi pasiruošęs išsiųsti pirmąjį laišką per artimiausias 2 savaites?

**Q6.** Kiek `deriveToxicity.js` ir esamas toksiškumo sluoksnis yra tikslus pagal tavo žinias? Ar yra žinomos klaidos, kurios dar nepataitytos?

**Q7.** `firestore.rules:86` — catalog WRITE atviras authed vartotojams. Ar tai žinoma ir kada planuojama ištaisyti? (Galimas Firestore taisyklių pataisa per ~30 min.)

### Verslo modelis

**Q8.** Stripe integravimas ir Pro — ar tai yra priimamas eksperimentas artimiausiam kvartalui? Jei ne, kodėl ne?

**Q9.** Kokia yra minimali mokančiųjų vartotojų riba, kurią pasiekus turėtum paskatą tęsti Pro palaikymą?

**Q10.** Nuasmeninti agreguoti duomenys — ar tai apskritai domina kaip ateities galimybė, ar reikėtų iš karto ir tvirtai atsisakyti kaip nesuderinamos su missija?

### Techniniai ir teisiniai

**Q11.** Ar buvo kas nors atlikta GDPR/DPIA klausimu (privatumo politika, duomenų tvarkymo įrašai)? Ar yra juristas, kuriam galima paklausti dėl PLD 2024/2853 ekspozicijos?

**Q12.** Apple/Google Wallet kortelė — ar tai atrodo kaip tinkama Pro funkcija, ar greičiau tai turėtų būti nemokama (visi vartotojai turėtų galimybę parodyti kortelę medikui)?

**Q13.** Kalbant apie embed widget'ą (augalo saugumo kortelė kitų svetainių naudojimui) — ar tai yra kažkas, ką norėtum aktyviai reklamuoti/siūlyti, ar tik turėti techniškai?

### Prioritetai ir ribos

**Q14.** Kiek laiko per savaitę realiai galima skirti produkto plėtrai šiuo metu (įskaitant kitų įsipareigojimų kontekstą — darbo sutarties IP/nekonkuravimo sąlygas, apie kurias kalbama `60-galutine-santrauka.md`)?

**Q15.** Koks yra „gana" scenarijus — situacija, kurioje projektas generuoja pakankamai ir vartotojo vertės, ir tavo laiko pasitenkinimo, net jei niekada netaps „venture" dydžiu? Ir kokia yra situacija, kurioje sakysi „metam ir pardavinėjam/dovanojam duomenų bazę"?

---

## Priedas: Senų dokumentų ir kodo neatitikimai

| Vieta | Neatitikimas | Prioritetas |
|-------|-------------|-------------|
| `README.md` antraštė | „geliai.app" (senas vardas DESIGN.md pavadinime) vs `lapasid.lt` | Žemas (kosmetinis) |
| `backlog.md` toksiškumo bug | Alocasia portodora: žmonių/gyvūnų severity gali būti sukeistas | Vidutinis |
| `firestore.rules:86` | Catalog WRITE atviras visiems authed vartotojams | **KRITINIS** (žr. §6 R1) |
| `deriveToxicity.js` / `api/_lib/deriveToxicity-server.js` | MIRROR principas — keičiami tik kartu (lessons.md N+11), tačiau nėra automatinio tikrinimo | Vidutinis |
| `tasks/konsiliumas-2026-06/01-briefing.md` §NFC | Aprašo NFC žymą kaip „pamatą" | Istorija (neatnaujinti, tik žinoti) |

---

_Dokumentas parašytas 2026-11-03. Remtasi: README.md, PROJECT.md, DESIGN.md, docs/toksiskumo-*.md,
tasks/konsiliumas-2026-06/ (00–60), tasks/backlog.md, tasks/lessons.md._
