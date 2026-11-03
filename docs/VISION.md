# LapasID — vizija (JUODRAŠTIS v0.1, 2026-11-03)

> **Kam šis dokumentas.** Savininkui ir diskusijai „kaip su partneriu": kur einame, kodėl, kas
> iš senos versijos lieka, kas perkuriama, ir verslo pusė — keliuose puslapiuose, ne šimte.
> Techninis pagrindas, prieštaravimai ir darbų sąrašas — [`SINTEZE.md`](SINTEZE.md).
>
> **Žymėjimas:** ✅ **nuspręsta** (nurodytas šaltinis) · 🟡 **PRIELAIDA** — laukia tavo
> patvirtinimo · ❓ **atvira** — reikia tavo atsakymo. Kol 🟡 nepatvirtinta, tai mano pasiūlymas,
> ne sprendimas.

---

## 1. Viena eilutė

🟡 **LapasID — lietuviškas, nemokamas ir patikimas atsakymas į klausimą „ar šis augalas pavojingas
mano vaikui ar augintiniui — ir ką su tuo daryti?"**

Ne augalų priežiūros programėlė su toksiškumo ženkleliu, o atvirkščiai: **saugumo šaltinis**, prie
kurio gali prisijungti priežiūra.

## 2. Kodėl tai verta daryti

- ✅ Toksiškumas kitur rodomas paviršutiniškai (vienas „toxic" ženkliukas), angliškai, be skirtumo
  tarp katės, šuns ir vaiko, ir dažnai klaidingai „saugu", kai duomenų tiesiog nėra
  (konsiliumas `45`, `46`).
- ✅ Tai tavo asmeninis „pyktis-kuras" — founder-market fit (`32-founder-market-fit`).
- ✅ Didieji žaidėjai (Plantbeeb, PictureThis) LT lokalizacija ir namų rizikos sluoksniu neužsiims —
  „jiems neapsimoka, tau rūpi" (`60` §3).
- ✅ Kartelė — **ne venture**: pelninga laiko atžvilgiu, mylima, naudinga visuomenei (`60` §3A).

## 3. Kam

🟡 **Pagrindinis vartotojas:** šeima su mažu vaiku ir/ar kate/šunimi, kuri turi ar perka kambarinių
augalų ir nori ramybės, ne paskaitos.
🟡 **Antrinis:** medikas/veterinaras, kuriam reikia greitai suprasti, su kuo susidūrė (kortelė).
🟡 **Tretinis (vėliau):** augalų entuziastai (priežiūra, kolekcija) — dabartinės programėlės auditorija.
❓ Kas realiai naudoja programėlę šiandien ir kiek jų? (SINTEZE S3)

## 4. Ką produktas daro (CORE)

1. ✅ **Pasakai, kas gyvena namuose** — mažas vaikas / vyresni vaikai / katė / šuo / paukštis /
   graužikas. Jokių vardų ar tikslaus amžiaus.
2. ✅ **Susidedi augalus** — foto, paieška arba sąrašas; tapatybę patvirtini („Ar tai X?").
3. ✅ **Matai, kas kam pavojinga** — atskirai kiekvienam namų nariui, su sunkumu (lengvas dirgiklis ≠
   sisteminis nuodas) ir sąžiningu „nėra duomenų" vietoj netikro „saugu".
4. ✅ **Gauni padėjimo patarimą** — „geriau ne namuose" / „aukščiau, nepasiekiamai" / „gali stovėti
   žemai" — formuluojamą kaip faktą, ne garantiją.
5. ✅ **Turi kortelę medikui/veterinarui** — spausdinama, pasidalinama, veikia be interneto.
6. 🟡 Viskas aukščiau — **nemokamai, be augalų skaičiaus limito, be privalomos registracijos.**

## 5. Ko NIEKADA nedarome (raudonos linijos) ✅

Šaltinis: konsiliumas `45-liability-redteam`, `46`; patvirtino visi 6 agentai.

- Jokio „simptomai → skambink/palauk" srauto (tai medicinos prietaisas pagal ES MDR).
- Jokio „namų saugumo balo" (skaičius gali meluoti „saugu").
- Jokių „skambink dabar" ženklų be įvykio — tik kontaktai, kai jų reikia.
- Niekada „saugu" be šaltinio konkrečiai rūšiai (katei, šuniui, vaikui).
- Jokių pirmosios pagalbos instrukcijų pasauliečiui — tik faktai + kontaktai + „kreipkis".
- Jokio AI generuojamo saugos teksto realiu laiku.
- Saugumo informacija niekada už paywall.
- Vartotojų duomenų niekada neparduodam.

## 6. Kaip užtikrinam, kad duomenys teisingi

🟡 **Toksiškumo žinynas — atskiras, versijuojamas duomenų rinkinys** (toksiškumo agento pasiūlymas,
`agentai-2026-11/TOXICITY_DATA.md` §12):
- Tiesa = junginių klasės + šeimų/genčių priskyrimai su šaltiniais ir peržiūros būsena, ne AI tekstai.
- Kiekvienas leidimas turi versiją: galima pasakyti „ką žinojome, iš kur, kas patikrino, ką
  vartotojas matė" — tai ir teisinė gynyba.
- **Įspėti galima anksčiau nei nuraminti:** pavojus rodomas su vienu patikimu šaltiniu, „netoksiška"
  — tik su rūšiai specifiniu šaltiniu.
- Ekspertai tikrina ~20 klasių + šeimų taisykles, ne tūkstančius augalų — realu savanoriškai.
- 🟡 **Pradedam nuo minimalios versijos:** keli JSON failai git'e, šaltiniai prie kiekvieno teiginio,
  versijos numeris, testai. Ekspertas peržiūri per skaičiuoklę/GitHub — ne per specialią sistemą.
  Pilna darbo eiga programėlėje — tik jei ekspertas jos paprašys.
- 🟡 **Sunkumo nemažinam be šaltinio:** jei duomenys sako „gali būti mirtina", nerašom „lengva" vien
  todėl, kad atrodo perdėta — keičiam formuluotę ir ieškom šaltinio.

🟡 **Akademija/ekspertai — pirmas darbas, ne paskutinis:** pirma — pažįstami veterinarai,
toksikologai, gydytojai (❓ ar tokių turi?); tada laiškas apsinuodijimų informacijos tarnybai
(tikėtina, dabar VVKT skyrius) + vienas puslapis koncepcijos. Prašom ne „patvirtinti viską", o
peržiūrėti mirtinų genčių sąrašą ir 10 dažniausių augalų. Ženklas
„Patikrinta [institucija]" atsiranda tik po realaus parašo (✅ `50-vizija` F.1).

## 7. Produkto sluoksniai

| Sluoksnis | Kas | Kaina vartotojui | Statusas |
|---|---|---|---|
| **1. Atvira saugumo biblioteka** | Viešas augalų puslapis su toksiškumu kiekvienam namų nariui, randamas per Google; kortelė; (vėliau) embed | Nemokama, be paskyros | ✅ kryptis (`60`, `43`) |
| **2. Namų rizika** | Profilis + mano augalai + rizikų sąrašas + padėjimas + kortelė | Nemokama, 🟡 be paskyros (duomenys telefone) | 🟡 |
| **3. Pro / kolekcija** | Priežiūros prognozės, istorija, „charakteriai", kelių įrenginių sinchronizacija, dalinimasis šeimai | 🟡 €29–39/m. — **ne šį ketvirtį** | ❓ |
| **4. Durys** | Partnerystės, institucijos, (galbūt) įsigijimas | — | ✅ „0 valandų, kol nėra išorinio signalo" (`43`) |

## 8. Ką pasiimam iš senos versijos, ką perkuriam

**PASIIMAM (veikia, vertinga):**
| Turtas | Kodėl vertingas |
|---|---|
| Augalų katalogas + **LT vardų žodynas** (lt-names, sinonimai, iNat) | Unikalus LT darbas — paieškos ir tapatybės pamatas |
| **Akvarelės** (hero iliustracijos) + watermark | Brand'o veidas; jau sugeneruotos |
| `toxin-classes.json` + `genus-toxin-map.json` | Žinyno sėkla (kaip juodraštis, ne tiesa) |
| ASPCA duomenys, `deriveToxicity` | Įrodymai ir neatitikimų detektorius |
| **Namų rizikos MVP UI** (PR #7): profilio redaktorius, rizikos sekcija, kortelė, spausdinimas | Paruošta; prijungti prie patikimų duomenų, išimti „Skambink dabar" ženklelį |
| Vieša biblioteka + `PublicPlantCard` + viešų laukų allowlist | CORE paviršius jau pastatytas |
| Foto atpažinimas, paieškos UI | Onboarding'ui |
| Admin redaktorius (`LibraryEditorV2`, „pending → approve") | Būsimos ekspertų peržiūros UX |
| Dizaino sistema (Brandbook v1.0 kode), PWA, testai, CI, Sentry | Infrastruktūra |

**PERKURIAM (pamatas netinka naujai krypčiai):**
| Kas | Kodėl | Kuo keičiam |
|---|---|---|
| Toksiškumo „tiesa" | Enrich'o šalutinis produktas, klaidos, perrašoma | Versijuojamas žinynas |
| AI toksiškumo narratyvas | Nepatikrintas tekstas kas kartą | Patvirtinti statiniai tekstai |
| Namų duomenų laikymas | Serveryje = GDPR + saugumo našta | 🟡 Telefone (local-first) |
| AI proxy saugumas | Bet kas su Google paskyra — neribotas Sonnet | Serveris nustato limitus ir prompt'us |
| Katalogo rašymas | Rašyti gali bet kuris prisijungęs | Tik serveris/admin |
| Prieiga | Programėle naudotis gali tik tavo patvirtinti žmonės | CORE — be prisijungimo |
| Medikų kortelė | Priklauso nuo serverio įrašo, rodo nepatikrintus gydymo tekstus | Adresas = augalas + duomenų versija; tik faktai + šaltinių nuorodos |
| Onboarding | Sukurtas kolekcininkui | Profilis → augalai → rezultatas per minutę |
| Sunkumo skalė | 3 skirtingi žodynai, nėra „mirtinas" | Viena skalė; mažinama tik su šaltiniu |

**UŽŠALDOM (lieka esamiems vartotojams, naujų investicijų nėra):** priežiūros prognozės, care
rewards, valdikliai, plant-sitter, paso care log'as, chat/„charakteriai", kolekcijų dalinimasis. 🟡

**IŠMETAM:** FB postinimas, parduotuvės valdiklis, PFAF kaip toksiškumo šaltinis (lieka tik
įrodymu), 30 MB nuosavų duomenų kliento bundle'e, NFC/marketplace planai. (Kodo našlaičiai ir
duomenų atsarginės kopijos jau išvalyti — žr. SINTEZE §12.)

## 9. Technologija (paprastai)

🟡 **Viename sakinyje (SINTEZE §7, „B-lite"):** CORE — statiniai, Google randami augalų saugumo
puslapiai, sugeneruoti iš versijuoto duomenų failo; „mano augalai" ir namų profilis — telefone;
esama Firebase programėlė užšaldoma už savo prisijungimo.
- **Kodėl:** žmogus, kurio katė graužė leliją, vakare googlina — o ne siunčiasi programėlę ir laukia
  tavo patvirtinimo. Plius: mažiausiai darbo, mažiausiai saugumo skylių, ~€0 kaina.
- Serverio reikia tik foto atpažinimui (AI) ir užšaldytai programėlei.
- **Ką prarandam:** kelių įrenginių sinchronizaciją; Safari neįdiegtai svetainei po 7 d. ištrina
  duomenis (sprendimas — „įdiek programėlę" + eksportas; profilis — 5 varnelės); analitiką reikia
  daryti atskirai, anonimiškai.

## 10. Verslo pusė (be 100 puslapių)

**Realybė (✅ konsiliumas + raudonoji komanda):**
- Sauga = **pritraukimas ir misija, ne pajamos.** Yuka: 80 mln. vartotojų → ~$7 mln. pajamų.
- Realios LT B2C pajamos pirmais metais — **€0,5–2 tūkst.**, ne dešimtys tūkstančių.
- Hobio masto išlaikymas — **€30–150/mėn.** (dominuoja AI). Pro lūžis — ~10–20 mokančių.
- Marketplace, NFC, pardavėjų kasa, duomenų pardavimas — **mirę** (pagrindimas `60` §2).

**Kas pasikeitė nuo birželio (nauji faktai):**
- Local-first šerdis daro nemokamą dalį beveik **nemokamą ir mums** → misija gali gyventi be pajamų.
- **Vercel nemokamas planas draudžia komercinį naudojimą** → Pro = +$20/mėn. hostingui arba kitas
  hostingas.
- **ES produktų atsakomybės direktyva (nuo 2026-12-09):** išimtis tik nemokamai **ir atvirojo
  kodo** programinei įrangai ne komercinės veiklos metu; freemium su Pro — tikėtinai ne, ir
  komercinė programėlė atsako už tai, ką rodo, kad ir kas publikuotų duomenis. Geriausia gynyba —
  versijuoti, šaltiniais pagrįsti duomenys ir jokio triažo. 1–2 val. teisininko prieš viešą paleidimą.

**Pinigų keliai (eilės tvarka pagal realumą):**
1. 🟡 **Non-dilutive per akademiją** — institucija kaip paraiškos vehikulis, tu — techninis partneris
   (`33`). Finansuoja būtent nemokamą sluoksnį.
2. 🟡 **Pro** — tik kai CORE veikia ir yra vartotojų; be lūkesčių, kaip eksperimentas.
3. ✅ **Durys** — Plantbeeb ar panašus gali panorėti LT saugumo sluoksnio; uždirbama per brand'ą ir
   santykius, ne statoma.

❓ **Svarbiausias verslo klausimas tau:** kiek valandų per savaitę realiai, ir koks „gana"
scenarijus — kada sakai „pavyko", o kada „užbaigiam ir atiduodam DB institucijai"?

## 11. Kaip atrodo sėkmė po 12 mėn.

🟡 Pasiūlymas:
- **Pagrindinis skaičius:** namų ūkiai, pamatę savo rizikų sąrašą.
- **Kokybės skaičius:** kokia dalis rodomų teiginių peržiūrėta eksperto (tikslas — visos mirtinos
  gentys).
- **Ryšio skaičius:** bent viena institucija, oficialiai prisidedanti prie peržiūros.
- **Kaina:** išlaikymas ≤ €50/mėn. be Pro pajamų (❓ tavo lubos?).

## 12. Didžiausios rizikos

| Rizika | Ką darom |
|---|---|
| Klaidingas „saugu" ar perdėtas „mirtina" | Asimetrinis slenkstis, tikslios formuluotės, mažinimas tik su šaltiniu, „nėra duomenų" |
| Neteisingai atpažintas augalas | Tapatybės patvirtinimas, blogiausias kandidatas, kai neaišku |
| Ekspertai neatsako | Produktas juda nepriklausomai; sąžiningos „nepatikrinta" etiketės |
| Atsakomybė (PLD) | Versijuoti duomenys, jokio triažo, teisininko konsultacija |
| Founder'io laikas | Local-first = mažiau priežiūros; užšaldyti antraeilius |

---

**Sekantis žingsnis:** pereinam per ❓ ir 🟡 punktus (SINTEZE §8 — surūšiuota pagal svarbą), ir
šis juodraštis tampa v1.0.
