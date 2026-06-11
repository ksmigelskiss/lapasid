# Founder-realybės skeptiko lenta — LapasID konsiliumas 2026-06

## 0. Atskaitos taškas: koks iš tikrųjų yra biudžetas

Default scenarijus — „šalia darbo + AI agentai". Tvarus šalutinio projekto biudžetas: **12–18 val./sav.** (2–3 val. vakarais × 4–5 d. + 5–8 val. savaitgalį), iš kurių gilaus darbo — realiai 8–12 val. Tyrimai rodo, kad burnout yra **#1 solo founder'ių žlugimo priežastis** (54% burnout rodiklis, 75% patiria nerimo epizodus; 70% solo founder'ių žlunga per 2 metus vs 40% komandų) ([ShipSquad Solo Founder Index 2026](https://shipsquad.ai/blog/solo-founder-index-2026), [Cerevity 2025](https://cerevity.com/tech-founder-burnout-statistics-2025-73-report-hidden-mental-health-crisis/)). Tai reiškia: strategija, kuri reikalauja >18 val./sav. ilgiau nei 3 mėn., nėra „šalia darbo" strategija — ji yra paslėptas full-time sprendimas.

Antras kalibras: 70% micro-SaaS niekada nepasiekia $1K MRR; realistiškas pirmo €1K MRR laikas geram solo projektui — **6–12 mėn. nuo monetizacijos įjungimo** ([Indie Hackers / Habit Pixel: 8 mėn.](https://www.indiehackers.com/post/from-0-to-1k-mrr-in-8-months-bootstrapping-habit-pixel-as-a-solo-dev-53d8687d15), [SoftwareSeni](https://www.softwareseni.com/solo-founder-saas-metrics-from-0-to-10k-mrr-in-6-months-with-realistic-timelines/)). LapasID monetizacija šiandien **neįjungta iš viso** (03-assets §2: paywall — tik UI, Stripe kode nėra). Laikrodis iki pirmo euro dar net nepradėjo tiksėti.

---

## 1. Galimybių žemėlapis: penkių kelių valandų modelis

### Kelias A — B2B tags-first (V1 deklaruotas „pamatas")

| Veikla | Val./sav. | Deleguotina AI? |
|---|---|---|
| Seller paieška, šalti kontaktai, pasiūlymai | 3–4 | Iš dalies (draft'ai taip, santykis ne) |
| Sales call'ai + vizitai (sodo centrai, augintojai) | 5–8 | **NE** — founder'io veidas privalomas |
| Hardware: tiekėjų derybos, QA, NFC encoding, pakavimas, siuntimas | 4–8 | **NE** — fizinis darbas |
| Onboarding + support | 2–3 | Iš dalies |
| Produkto palaikymas | 2–4 | Taip (didelis svertas) |
| **VISO** | **16–27** | **~60% NEdeleguotina** |

**Kur lūžta.** Trys nepriklausomi lūžiai: (1) Founder-led sales playbook'ai reikalauja 2–3 val./d. pardavimams ir 5–10 discovery call'ų/sav. ([Justin McKelvey](https://justinmckelvey.com/blog/founder-led-sales), [Heavybit](https://www.heavybit.com/library/article/founder-led-sales-strategy)) — B2B skambučiai vyksta darbo valandomis, kurių dirbantis founder'is **neturi** (vizitai įmanomi savaitgaliais, bet tai valgo atsistatymo laiką = burnout greitkelis). (2) „Toxicity Dial" su sukamu žiedu — custom mechaninė gamyba; net paprasti NFC hang-tags kainuoja **€0,95–1,19/vnt mažais kiekiais** ([Shop NFC: 20 vnt — €1,19; 500 vnt — €0,99; 2000 vnt — €0,95](https://shopnfc.com/en/nfc-gadgets/34-220-nfc-hang-tags-ntag213.html)), o custom spauda pas Seritag prasideda nuo 5000+ vnt užsakymų ([Seritag](https://seritag.com/nfc-tags/22mm-onmetal-ntag213)) — H-C1 marža €0,20–0,50 matematiškai neegzistuoja iki didelio masto. (3) Sezoniškumas: dabar birželis; sodo centrų pikas — pavasaris; rimto B2B piloto langas realiai nusikelia į 2027 m. kovą–gegužę.

**€1K MRR:** per L1 — niekada (pats V1 doc'as pripažįsta „hobby economics" €5–8/mėn/seller, D2). Per L2 (€15–30/mėn) reikia 33–66 mokančių sellers; SMB ciklas 2–4 sav./deal ([Optifai benchmarks](https://optif.ai/learn/questions/sales-cycle-length-benchmark/)), bet su 5–8 val./sav. pardavimams — **18–24+ mėn.**

### Kelias B — B2C premium-first

| Veikla | Val./sav. | Deleguotina AI? |
|---|---|---|
| Stripe + paywall prijungimas (vienkartinis: ~30–50 val. per 3–4 sav.) | burst | Didžiąja dalimi |
| PFAF/pre-db karantinas iš mokamo sluoksnio (vienkartinis: ~40–80 val.) | burst | Didžiąja dalimi |
| LT SEO turinio fabrikas („ar X nuodingas katei") | 2–3 | **TAIP — didžiausias svertas** |
| Marketinas/bendruomenė (FB grupės, IG) | 2–4 | Iš dalies (veidas — ne) |
| Support + produktas | 3–5 | Taip |
| **VISO** | **9–14** | **~75% deleguotina** |

**Kodėl čia velocity pranašumas didžiausias.** Visa grandinė — grynas softas, t. y. įrodytos founder'io stiprybės zona (03-assets §5: 3 sav. → scrape pipeline + 3 parseriai + 2-fazė paieška + 59 testai). Stripe subscription integracija su AI agentais — 1–2 sav. realaus laiko ([Stripe docs](https://docs.stripe.com/billing/subscriptions/build-subscriptions); Airwallet precedentas — 2 sav.). H-M4 funnel'io SEO dalis („ar toksiška katėms") yra būtent ta vieta, kur vienas žmogus su agentais gali per mėnesį sugeneruoti ir patikrinti 300–500 LT puslapių — to joks LT konkurentas nepadarys, o PictureThis LT rinkos neprioretizuos ($5,7M/mėn revenue jiems LT yra apvalinimo paklaida — [Appfigures](https://appfigures.com/resources/insights/20220610?f=3)).

**Lubos.** Freemium mediana — **2,1% download-to-paid** ([RevenueCat State of Subscription Apps](https://www.revenuecat.com/state-of-subscription-apps/)). LT: jei per 12 mėn. organiškai 5–15K registruotų, 2% × blended €3 ARPU = **€300–900 MRR**. €1K MRR pasiekiamas, bet ties LT lubomis — 12–18 mėn. ir reikės PL arba B2B priedo. Pirmas euras: **1–2 mėn.** (greičiausias iš visų kelių, nes viskas, išskyrus mokėjimus, jau pastatyta).

### Kelias C — Marketplace-first

Valandos: seller acquisition 8–12 + buyer demand 4–6 + ops/ginčai 4–8 + produktas 4–6 = **20–32 val./sav.** Dvipusė rinka reikalauja nuolatinio hustle, ginčų sprendimas nedeleguotinas. €1K MRR per 7–10% GMV = €10–14K GMV/mėn = ~600–800 sandorių po €18/mėn — LT mastu **24–36 mėn.** Tai full-time verslas, apsimetantis feature'u. Kaip PIRMAS kelias — nesuderinamas su jokia realybe; kaip pasyvi vitrina (dabartinis „Noriu/Pirkti") — gerai, nes kainuoja ~0 val.

### Kelias D — Grants-first

EIC Accelerator: **~300 val. paraiškai, 2,7% sėkmės rodiklis** ([STRATA FAQ](https://www.strata.team/eic-accelerator-frequently-asked-questions-faq/), [EK](https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en)) — tikėtinos vertės prasme tai blogiausia valandos investicija visame žemėlapyje. InoStartas realiau: **€40–200K, iki 85% intensyvumas, iki 24 mėn.** ([Inovacijų agentūra](https://inovacijuagentura.lt/site/finansavimo-kvietimai/inostartas.html), [esinvesticijos.lt](https://2021.esinvesticijos.lt/kvietimai/inostartas)) ir AI agentai paraiškos draft'inimą atpigina iki ~60–100 founder-valandų. BET: reikia UAB, buhalterijos, MTEP (TRL 2–5) rėmų, į kuriuos produktinė inžinerija telpa tik per prievartą, plius ataskaitų našta ~3–5 val./sav. laimėjus. Grant'as ≠ pajamos: **€0 MRR, 0 klientų signalo**, o 6–9 mėn. laukimas atideda PMF mokymąsi. Kaip PIRMAS žingsnis — procrastinacija su papildomais žingsniais. Kaip antras žingsnis PO traction — legitimus full-time vartų mechanizmas.

### Kelias E — Data-licensing-first

**Miręs atvykus.** Trys stipriausios DB teisiškai trapios (03-assets §1: PFAF = CC BY-NC-SA, pre-db = 3 autorinės knygos, lt-names = scraped) — negali licencijuoti to, ko pats nevaldai. Enterprise data deal'ai prasideda nuo $12–25K/m, bet reikalauja 90–180 d. ciklo, pilotų ir **provenance dokumentacijos** ([Autobound OEM guide](https://www.autobound.ai/blog/oem-data-licensing-guide), [Prospeo](https://prospeo.io/s/saas-sales-cycle)) — būtent to, ko neturime. Vienintelis tikrai unikalus dataset'as (diedDate + deathReason + lesson) dar neturi masto. Laikas iki €1K MRR: neapibrėžtas → ∞.

### Suvestinė

| Kelias | Val./sav. tvariai | % nedeleguotina AI | Pirmas € | €1K MRR | Burnout rizika |
|---|---|---|---|---|---|
| B2B tags-first | 16–27 | ~60% | 6–9 mėn. | 18–24+ mėn. | **KRITINĖ** (geležis+sales+darbas) |
| **B2C premium-first** | **9–14** | **~25%** | **1–2 mėn.** | **12–18 mėn.** | Žema-vidutinė |
| Marketplace-first | 20–32 | ~55% | 9–12 mėn. | 24–36 mėn. | Kritinė |
| Grants-first | burst 60–300 val. | ~30% (draft'ai AI) | niekada (ne pajamos) | — | Vidutinė (biurokratija = 2-as darbas) |
| Data-licensing-first | 100+ val. remediation | ~40% | ∞ (licencijos) | ∞ | — |

---

## 2. Trys strategijos iš founder-realybės lentos

### Strategija 1 — „Pajamų laikrodis pirmiausia" (default rekomendacija)

- **Wedge:** per 4–6 sav. įjungti Stripe + karantinuoti PFAF/pre-db turinį iš mokamo sluoksnio (nemokamas toksiškumas lieka — etinis pažadas H-C6 nepažeidžiamas, nes deriveToxicity + ASPCA faktai + Care INTERVALS yra „original-and-defensible"). Lygiagrečiai — LT SEO turinio fabrikas AI agentais.
- **Seka:** mokėjimai → 90 d. konversijos matavimas → LT SEO compounding → tik tada spręsti dėl PL ar B2B priedo.
- **Pajamos:** Lite €2,99 / Pro €6,99 (H-C7/C8 kainodara OK); pirmas euras ~30–60 d.; €300–900 MRR per 12 mėn.
- **Iš founder'io:** 10–14 val./sav., €0 kapitalo (Stripe fees only), full-time — NE.
- **Rizika:** LT lubos ties ~€1K MRR; 2,1% konversijos mediana gali būti per optimistiška PWA be app store. Mitigacija — hard paywall eksperimentas atskiroms funkcijoms (hard paywall konvertuoja 5× geriau: 12,1% vs 2,2%, [RevenueCat](https://www.revenuecat.com/state-of-subscription-apps/)).

### Strategija 2 — „Hibridas: B2C variklis + L2 ženklas be geležies"

- **Wedge:** Strategija 1 + lygiagrečiai 3–5 sellers (pradedant nuo esamo Geliustebuklai santykio) parduoti „LapasID Patvirtinta" L2 už €15–30/mėn su **QR lipdukais, ne NFC** (spausdinti QR — centai/vnt vs €0,95+ NFC; jokio encoding, jokio QA, paštu išsiunčiama per 20 min.). NFC atidedamas, kol L2 įrodys paklausą.
- **Seka:** žyma tampa ne pamatu, o **upsell'u** — apvertimas to, ką realybė jau padarė (Įtampa 9: indas ir marketplace pastatyti, žyma ne).
- **Pajamos:** 10 sellers × €25 + €400 B2C = ~€650 MRR per 9–12 mėn.; €1K MRR — 12–15 mėn.
- **Iš founder'io:** 13–16 val./sav., iš jų 2–3 val. seller pokalbiams (savaitgaliais, max 2 vizitai/mėn. — kietas capas prieš burnout); kapitalas <€300; full-time — NE.
- **Rizika:** sales valandos konkuruoja su poilsio laiku; jei po 5 pokalbių 0 sellers pasirašo — L2 hipotezė krenta ir grįžtama į gryną Strategiją 1 (pigi falsifikacija — tai feature, ne bug).

### Strategija 3 — „Full-time vartai per InoStartas" (sąlyginė, TIK po traction)

- **Wedge:** kai Strategija 1/2 parodo ≥€500 MRR arba ≥20 mokančių, steigti UAB ir teikti InoStartas (€40–200K, 85% intensyvumas) su AI-draft'inta paraiška (~60–100 founder-val. burst per 6–8 sav.), MTEP rėmuose pakuojant failure-mode learning (H-MO6) + LT korpuso tyrimą.
- **Seka:** grant finansuoja 12–18 mėn. dalinį/pilną full-time → tada (ir tik tada) NFC/fizinis sluoksnis + botanikos sodų partnerystės, kurioms reikia darbo valandų dienos metu.
- **Pajamos:** grant ≠ MRR; tai laiko pirkimas, ne verslo modelis.
- **Iš founder'io:** burst 60–100 val. + UAB admin ~2 val./sav. amžinai; sprendimo taškas dėl full-time — čia, ne anksčiau.
- **Rizika:** 6–9 mėn. laukimas; MTEP rėmų prievarta; EIC Accelerator (2,7%, 300 val.) — **neiti iš viso**, kol nėra €8K+ MRR lygio įrodymų.

**Bendras principas visoms trims:** kiekviena valanda geležiai/pardavimams yra valanda, atimta iš įrodytos velocity juostos (softas). 300 EIC valandų = visa mokėjimų integracija + duomenų remediation + PL lokalizacija kartu sudėjus.

---

## 3. Kill-list (H-* su įrodymais)

| Hipotezė | Verdiktas | Įrodymas |
|---|---|---|
| **H-C1** (L1 žymos = wedge, €0,20–0,50 marža, perka nuo 1 d.) | **KILL kaip wedge** | NFC unit cost €0,95–1,19 mažais kiekiais (Shop NFC); custom spauda nuo 5000 vnt (Seritag); pats V1 pripažįsta €5–8/mėn/seller „hobby economics" (D2); +16–27 val./sav. su ~60% nedeleguotina — nesuderinama su „šalia darbo" |
| **H-P4 / H-P5** (Toxicity Dial: sukamas žiedas, NFC ritė, graviruotas smaigulys) | **KILL V1 horizonte** | Custom mechaninė gamyba (tooling, prototipai, QA) — nulis kodo bazėje (03-assets §4: jokio NDEFReader, QR pasui net negeneruojamas), o off-the-shelf tokio produkto nėra. Atidėti iki post-revenue/post-grant |
| **H-M2** (€15K ARR Y1) | **KILL kaip Y1 planas** | €15K ARR = €1,25K MRR = ~420 mokančių prie €3 ARPU = ~20K userių LT'oje per metus, kai mokėjimų kodo dar nėra, o freemium mediana 2,1% (RevenueCat). Realistiška Y1: €4–8K ARR |
| **H-M3** (investuojamumas per 18–22 mėn.) | **SILPNINTI → 30–40 mėn. arba full-time** | 40 B2B sellers reikalauja sales valandų, kurių šalia darbo biudžete nėra; 5–10 discovery call'ų/sav. norma (founder-led sales playbook'ai) fiziškai netelpa |
| **H-R6** (grants = „realistic capital path") | **KILL EIC dalį; InoStartas — sąlyginai PALIKTI** | EIC: 2,7% sėkmė, ~300 val. (STRATA/EK) — neigiamos tikėtinos vertės loterija solo founder'iui. InoStartas realus, bet kaip 2-as žingsnis po traction, ne „path before venture money" |
| **H-S1 / H-S2** („Žyma — pamatas", L1 nuo 1 dienos) | **APVERSTI** | Reali build seka jau apversta (Įtampa 9); valandų modelis rodo, kad pamatas = tai, kas generuoja pajamas su mažiausiai nedeleguotinų valandų — t. y. app+paywall, o žyma yra upsell |
| **H-M5** (botanikos sodai = launch kanalas su free žymomis) | **SILPNINTI** | Free žymos = kaštai + fulfillment valandos + 0 pajamų signalo; partnerystės su institucijomis = dienos-valandų darbas. Tinka credibility/PR su kietu capu (≤2 val./sav.), ne kaip launch variklis |
| **H-C4** (L4 marketplace 7–10% GMV) | **SILPNINTI timeline** | €1K MRR = €10–14K GMV/mėn = 600–800 sandorių — LT mastu 24–36 mėn. ir full-time ops; kaip „rezultatas" teisingai, bet Y1–Y2 finansinėse projekcijose jo būti negali |
| **H-MO1/H-MO2** (duomenų moat) | **SILPNINTI** | Moat'o inventoriaus 3 didžiausi blokai nemonetizuojami be remediation (PFAF NC; pre-db — 3 autorinės knygos; 03-assets §1), o remediation = dar ~40–80 nesuplanuotų valandų PRIEŠ pirmą mokamą eurą |

---

## 4. Top-5 neapibrėžtumai ir pigiausi testai

1. **Tikrasis founder'io valandų biudžetas.** Visi modeliai aukščiau remiasi 12–18 val./sav. prielaida. Testas: 2 sav. kalendoriaus auditas (kada realiai atsiranda LapasID valandos, kiek jų gilios). Kaina: €0, 0 papildomų valandų.
2. **Ar bent vienas LT vartotojas sumokės?** Vienintelis klausimas, kurio atsakymas keičia viską. Testas: Stripe + esamų userių email („Pro ankstyvoji kaina €19/m pirmiems 50") → matuoti per 30 d. Kaina: ~30–50 val., <€100.
3. **Seller WTP už L2 be geležies.** Testas: 5 pokalbiai (pradžiai Geliustebuklai) su konkrečiu pasiūlymu — €15/mėn už „Patvirtinta" ženklą + QR lapus. 3+/5 „taip" = Strategija 2; 0–1/5 = gryna Strategija 1. Kaina: 10–15 val., €50 lipdukams.
4. **QR pakanka ar NFC būtina?** Prieš bet kokį geležies eurą. Testas: 100 spausdintų QR lipdukų pas vieną seller + scan loggeris (03-assets §3: passport view analitika NErenkama — 1 dienos darbas ją įjungti, būtina sąlyga testui). Kaina: ~10 val., €30.
5. **InoStartas MTEP tinkamumas.** Testas: nemokama Inovacijų agentūros konsultacija (paraiskos@inovacijuagentura.lt) + 1 val. su grant konsultantu — ar produktinė inžinerija + failure-mode learning telpa į TRL 2–5 rėmus. Kaina: ~4 val., €0–150.

---

## 5. Šaltiniai

- RevenueCat, State of Subscription Apps (freemium 2,1% vs hard paywall 12,1%): https://www.revenuecat.com/state-of-subscription-apps/ ir https://www.revenuecat.com/state-of-subscription-apps-2025/
- Indie Hackers — Habit Pixel $0→$1K MRR per 8 mėn. solo: https://www.indiehackers.com/post/from-0-to-1k-mrr-in-8-months-bootstrapping-habit-pixel-as-a-solo-dev-53d8687d15
- SoftwareSeni — solo founder SaaS timeline'ai (mediana $1–3K MRR per 6 mėn., 70% micro-SaaS <$1K): https://www.softwareseni.com/solo-founder-saas-metrics-from-0-to-10k-mrr-in-6-months-with-realistic-timelines/
- ShipSquad Solo Founder Index 2026 (54% burnout, 70% solo žlugimas per 2 m.): https://shipsquad.ai/blog/solo-founder-index-2026
- Cerevity — founder burnout 2025: https://cerevity.com/tech-founder-burnout-statistics-2025-73-report-hidden-mental-health-crisis/
- Shop NFC — NFC hang tags NTAG213 kainos (€0,95–1,19/vnt): https://shopnfc.com/en/nfc-gadgets/34-220-nfc-hang-tags-ntag213.html
- Seritag — custom spauda nuo 5000+ vnt: https://seritag.com/nfc-tags/22mm-onmetal-ntag213
- STRATA — EIC Accelerator FAQ (~300 val. paraiškai, ~2,7% sėkmė): https://www.strata.team/eic-accelerator-frequently-asked-questions-faq/
- European Commission — EIC Accelerator: https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en
- Inovacijų agentūra — InoStartas (€40–200K, iki 85%, 24 mėn.): https://inovacijuagentura.lt/site/finansavimo-kvietimai/inostartas.html ir https://2021.esinvesticijos.lt/kvietimai/inostartas
- Justin McKelvey — Founder-Led Sales (5–10 calls/sav., 2–3 val./d.): https://justinmckelvey.com/blog/founder-led-sales
- Heavybit — founder-led sales strategija (20–30% laiko pardavimams pre-PMF): https://www.heavybit.com/library/article/founder-led-sales-strategy
- Optifai — B2B sales cycle benchmarks (SMB <$25K: 2–4 sav.): https://optif.ai/learn/questions/sales-cycle-length-benchmark/
- Prospeo — SaaS sales cycle (enterprise 90–180 d., 70% reikalauja piloto): https://prospeo.io/s/saas-sales-cycle
- Autobound — OEM data licensing guide (deal dydžiai/ciklai): https://www.autobound.ai/blog/oem-data-licensing-guide
- Appfigures — PictureThis revenue insights: https://appfigures.com/resources/insights/20220610?f=3
- Sensor Tower — PictureThis (~$5M/mėn App Store): https://app.sensortower.com/overview/1252497129?country=US
- Dataintelo — plant ID apps rinka ($210M → $680M, 14,2% CAGR): https://dataintelo.com/report/plant-identification-apps-market
- Stripe — subscription integration docs: https://docs.stripe.com/billing/subscriptions/build-subscriptions
- Founder Reports — solopreneur statistika (distribution = #1 problema 99%): https://founderreports.com/solopreneur-statistics/
