# Raudonoji komanda — S1+S2 hibrido ekonomika (scan rate, seller WTP, komoditizacija, SEO)

_Taikinys: 6 lęšių konvergencija į S2 + S1 atrama. Sekretorius pats įvardijo (11-sinteze, pastaba №1): „ekonomika kabo ant dviejų neišmatuotų dydžių — scan rate ir seller WTP". Mano darbas — patikrinti, ar ji kabo, ar jau krenta._

---

## 1. PRE-MORTEM: 2028-ųjų ruduo. S2 hibridas žlugo. Kaip tai įvyko.

**2026 Q3.** Scan counter įdiegtas (K-6, 1 diena — įvyko). QR pilotas pas 2 draugiškus sellers: 500 lipdukų ant €15+ augalų. Po 6 savaičių — **11 scan'ų (2,2%)**. Founder'is interpretuoja optimistiškai: „reikia geresnio CTA". Niekas nepastebi, kad pilotas vyko rugsėjį — ne sezonas, ir kad 7 iš 11 scan'ų — paties seller'io ir jo darbuotojų.

**2026 Q4.** 5 offer-sheet pokalbiai (KF-7 testas). Pasirašo 3 — visi iš founder'io pažįstamų rato arba „LT startup'ą reikia palaikyti" motyvacijos. KF-1 taisyklė (3+/5 = hibridas) formaliai suveikia. **Testas išmatavo gerą valią, ne paklausą.** Lygiagrečiai paleista 50 SEO puslapių „ar X nuodinga katėms".

**2027 H1.** Pirmoji L2 sąskaita: seller dashboard'as rodo **7 scan'us per mėnesį**. Seller'is klausia: „už ką aš moku €25/mėn?" Pirmas churn'as. SEO puslapiai gauna ~40 apsilankymų/mėn — Google AI Overviews atsako „taip, monstera nuodinga katėms" tiesiai SERP'e, paspaudimo nereikia. Stripe veikia: 11 mokančių B2C userių.

**2027 H2.** Per Van Vliet C&C Vilniuje ant importinių vazonų atvažiuoja **Plantbeeb QR „powered by GS1"** — atspausdintas pas augintoją NL, nemokamai seller'iui. LT seller'is klausia: „kuo jūsų lipdukas skiriasi nuo to, kas jau ant vazono?" Atsakymo, kurį suprastų per 30 sekundžių, nėra. L2 pitch'as miršta. Etikečių spaustuvė, su kuria derėtasi 4 mėnesius, pasirenka Floramedia turinio paketą.

**2028.** Sudėtis: 18 mėn. × 13–16 val./sav. ≈ **1 100 founder'io valandų**; ARR €2–4K; 3 mokantys sellers (visi su nuolaida); SEO — 60 apsilankymų/mėn. S3 kolekcinė niša — vienintelė, kur instancijos pasas turėjo realią vertę — **niekada rimtai neišbandyta, nes S2 suvalgė valandas**. Projektas užšaldomas. Žlugimo priežastis ne viena klaida, o **trys kabantys skaičiai (scan rate, scan→signup konversija, seller WTP), kurie visi trys nukrito į apatinę ribą — o planas neturėjo gyvybės nė viename apatinės ribos scenarijuje.**

---

## 2. ATAKOS

### A-1. Scan rate prielaida (S2 „scan analitika = įrodymo variklis"; K-6; HW Strategija A)

**Atakuoju:** S2 teiginį, kad scan'ai „įrodo" L2 vertę, ir HW raporto §1.4 skaičius (43% „yra skenavę", 14% connected packaging).

**Ataka.** Konsiliumo skaičiai — vendor'ių marketingas su suklastotu vardikliu:
- „43% vartotojų yra skenavę QR ant pakuotės" (Bitly) = **kada nors gyvenime**, ne per-unit rodiklis.
- „14% connected packaging" — QR platformų pardavimo blog'ai ([qr-insights](https://www.qr-insights.com/blog/2026-03-19-connected-packaging-cpg-qr-codes-2026)), matuojantys SĖKMINGAS kampanijas su vertės pasiūlymu (nuolaida, prizas, loterija). Tas pats šaltinis pripažįsta: **be stipraus CTA ir gero placement'o scan rate krenta žemiau 0,5%** (scan rate = visi scan'ai ÷ vienetai apyvartoje).
- LapasID QR ant augalo etiketės = **pasyvus informacinis QR be vertės pasiūlymo** — žemiausia kategorija. Realistinis diapazonas: **0,3–2% vienetų**.
- Pilnas funnel'is, kurio NIEKAS konsiliume nesuskaičiavo end-to-end: 10 000 etikečių × 1% scan = 100 paso peržiūrų × ~10% signup (web pasas → PWA registracija, neįrodyta) = 10 userių × 3% paid = **0,3 mokančio vartotojo iš 10 000 etikečių**. „Zero-CAC kanalas" virsta „zero-cost, near-zero-yield".
- MasterTag „70% skaito žymą, 98% pasilieka" — **žymų gamintojo savitarnos apklausa** (B2B raportas §1.3 ją cituoja be skepsio). „Skaito" ≠ „skenuoja".

**Verdiktas: KRITO.** Scan rate ne „gali būti <1%" (S2 išlyga) — jis **tikėtinai bus 0,3–2%, ir tai žinoma iš anksto**. Kas lieka: scan counter vis tiek statyti (1 d.), bet perrėminti iš „įrodymo variklio" į **kill-testą su iš anksto užrašytu slenksčiu** (pvz.: <1% per 1000 etikečių sezono metu = L2 mass-market mirė, lieka S3). Ir antra išvada, kurios niekas nepasakė: **dashboard'as, rodantis seller'iui 7 scan'us/mėn, yra churn variklis** — analitika veikia abiem kryptim.

### A-2. Seller WTP be GMV įrodymo (H-C2; K-4 „flat €15–30/mėn"; KF-7)

**Atakuoju:** prielaidą, kad seller'is mokės €15–30/mėn už ženklą+dashboard'ą, nes „suma telpa į POS benchmark'ą $59–149".

**Ataka.**
- **POS palyginimas — kategorijos klaida.** POS yra operaciškai privalomas (kasa be jo neveikia). LapasID ženklas — diskrecinis marketingas iš ~5% IT/admin eilutės (B2B §1.1), perkamas dėmesiu, kurio seller'is neturi.
- Pati B2B lenta įrodė (§1.4): ornamentals srityje už ženklus mokama **tik su kanalo mandatu** (DE DIY → GlobalG.A.P.). „LapasID Patvirtinta" mandato neturi, vartotojas jo neatpažįsta, o vartotojų WTP už generic ženklą — **+$0,08**.
- **Konkurentas dalija nemokamai:** Joy of Plants QR — nemokamai etikečių gamintojams; Plantbeeb finansuojamas per etikečių pardavimą (MasterTag modelis) — consumer sluoksnis sektoriuje yra **etiketės kainos priedas, ne atskiras SaaS**. LapasID prašo mokėti už tai, ką industrija jau pratusi gauti už dyką.
- **Cirkuliarinė priklausomybė, kurios konsiliumas neišnarpliojo:** vienintelis B2B argumentas be mandato — retention/death-rate ataskaita (B2B §1.6, K-10). Bet tie duomenys atsiranda tik iš vartotojų, kurie ateina per... sellers. Seller moka už duomenis, kuriuos sugeneruos vartotojai, kurių dar nėra. Y1 pardavinėjamas tuščias dashboard'as.
- **Net jei viskas suveikia — lubos juokingos:** 40–60 realių subjektų (K-2) × €30/mėn × 100% penetracija = **€14–21K ARR**. Tai tas pats dydis kaip LT B2C lubos (€20–35K, K-3). Hibridas NEpabėga nuo LT lubų — jis tik **padvigubina darbą toms pačioms luboms**.

**Verdiktas: KRITO kaip Y1 pajamų eilutė.** Kas lieka: KF-7 pre-sold testas — teisinga metodika, bet su pataisom: (1) sellers ne iš pažįstamų rato; (2) matuoti ne parašą, o **3 mėnesio mokėjimą po dashboard'o pamatymo** (churn = tikrasis testas); (3) €50/mėn death-rate pilotas (B2B testas №5) — vienintelis variantas su realiu skausmu (shrinkage 5–15%) už nugaros.

### A-3. Plantbeeb/Floramedia/GS1 komoditizacija (K-8 išlyga; S2 „langas iki 2027–2028"; H-MO4/MO5 liekanos)

**Atakuoju:** S2 prielaidą, kad po komoditizacijos lieka pakankamas diferenciatorius („instancijos pasas + LT kalba + toksiškumo kuracija", B2B §1.3).

**Ataka.**
- **Antro QR problema — niekas jos nemodeliavo.** LT kambariniai augalai atvažiuoja per NL importo kanalą (Van Vliet C&C Vilnius/Kaunas). Nuo 2026 Floramedia Plantbeeb QR spausdinamas **pas augintoją** ([bpnieuws](https://www.bpnieuws.nl/article/9790034/floramedia-maakt-met-plantbeeb-de-qr-code-sectorbreed-beschikbaar/)) — t. y. importinis augalas LT lentynoje JAU turės QR. LapasID lipdukas tampa **antru QR ant to paties vazono**, kurį turi klijuoti seller'is rankomis. Dviejų QR dvikovoje laimi tas, kuris upstream ir nemokamas.
- **„Instancijos pasas" masiniam segmentui = operacinė fantazija.** Per-unit serializacija reikalauja, kad seller'is atspausdintų ir priklijuotų UNIKALŲ kodą kiekvienam augalui pardavimo taške. Plantbeeb laimi būtent tuo, kad seller'iui nereikia daryti NIEKO. O GS1 Digital Link (2027) serializaciją palaiko natively — „instancijos" diferenciatorius turi galiojimo datą.
- **„LT kalba" — ne moat, o konfigūracija.** Floramedia jau dabar spausdina daugiakalbes etiketes visai Europai; lietuvių kalbos pridėjimas finansuotai įmonei = lokalizacijos sprint'as, kurį ji padarys tada, kai LT rinka taps verta dėmesio — t. y. tiksliai tada, kai LapasID pradėtų uždirbti.
- **Laiko aritmetika:** S2 reikia ~12 mėn. vien scan-proof + WTP-proof surinkti (pilotai, sezonai, churn ciklas). Įsitvirtinimo fazė atsitrenkia tiesiai į 2027 GS1 bangą. „Langas iki 2027–2028" realiai yra **langas iki pirmo importinio konteinerio su Plantbeeb QR** — tai gali būti 2026 ruduo.

**Verdiktas: KRITO masiniam L2; IŠGYVENO siaurai.** Kas lieka: toksiškumo kuracija LT kalba (Plantbeeb to nedaro ir greitai nedarys — jų turinys produkto lygio care info) ir instancijos pasas TEN, kur augalas neateina su etikete iš NL: **vietiniai medelynai, kolekcininkai, P2P** — t. y. S3 teritorija, ne S2.

### A-4. „Etikečių spaustuvės partnerystė" (S2 sekos finalas)

**Atakuoju:** S2 teiginį „ilgainiui — etikečių spaustuvės partnerystė prieš GS1 2027 bangą".

**Ataka.**
- **Pasiūlymų asimetrija:** Floramedia franšizė spaustuvei duoda įrodytą produktą, ES turinio DB, GS1 compliance kelią ir augintojų atpažįstamą brand'ą. LapasID duoda... lokalią app'ą su keliais šimtais userių ir licencijos kaštą. Racionali spaustuvė renkasi tą, kurio paklausą jau formuoja jos klientai (augintojai/importuotojai), o ne tą, kurio paklausą dar reikia sukurti.
- **Struktūrinė spraga:** LT — importo rinka ($182M HS06). Kambarinių augalų etiketės atvažiuoja SU augalu iš NL — LT spaustuvė jų nespausdina. LT spausdinimas koncentruojasi ten, kur augina vietiniai: **lauko sodinukai, medelynai** — segmentas, kur (a) toksiškumo turinio paklausa silpniausia, (b) skaitmeninis apetitas mažiausias. T. y. partnerystė taikoma į kanalą, kuris nekontroliuoja būtent to segmento, kuriame LapasID turinys stipriausias.
- Žalia stotelė su NUOSAVA app (sintezė §4.12) konsiliume cituojama kaip „skaitmeninio apetito įrodymas" — bet tai įrodymas atvirkščias: **skaitmeniškiausi LT sellers built-their-own ir nemokės**.

**Verdiktas: KRITO kaip strategijos elementas.** Kas lieka: vienas pokalbis su 1–2 LT spaustuvėmis kaip žvalgyba (kas spausdina medelynams? ar girdėjo apie GS1 2027?) — informacija už €0, bet ne „partnerystės" trajektorija.

### A-5. S1 SEO fabrikas (S1 „LT SEO toksiškumo fabrikas (AI agentai generuoja)"; CS V-A wedge; H-M4 liekana)

**Atakuoju:** S1 atramą, kad AI-generuoti toksiškumo puslapiai = acquisition variklis.

**Ataka.**
- **Zero-click by design.** „Ar monstera nuodinga katėms" — vieno sakinio atsakymas, idealus AI Overview taikinys. Ahrefs (2025-12): AIO buvimas numuša pozicijos-1 CTR **iki 58%**; informacinių AIO užklausų pozicijos-1 CTR — **1,6%** ([Ahrefs](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/)); Seer Interactive: organinis CTR informacinėms užklausoms su AIO -61% ([Search Engine Land](https://searchengineland.com/google-ai-overviews-drive-drop-organic-paid-ctr-464212)). S1 stato fabriką tiksliai toje SERP zonoje, kurią Google jau suvalgė.
- **Policy rizika reali, ne teorinė.** Google „scaled content abuse" politika (2024-03) baudžia masinį turinį nepriklausomai nuo kūrimo būdo; po update **837 iš 49 345 stebėtų svetainių deindeksuotos, 100% jų turėjo AI turinį** (Originality.ai per [SEJ](https://www.searchenginejournal.com/googles-march-2024-core-update-impact-hundreds-of-websites-deindexed/510981/)). Naujas domenas be autoriteto + šimtai AI puslapių = tikslus deindeksuotų profilis. Žodis „fabrikas" pats save inkriminuoja.
- **LT tūrio aritmetika.** LT lenta pati pripažįsta (10-lt-rinka §4.3): tūriai nežinomi, gal šimtai/mėn; CS slenkstis — <500/mėn = nice-to-have. Apatinės ribos scenarijus: 500 paieškų/mėn × 2% AIO-eros CTR = **10 apsilankymų/mėn iš viso fabriko**. Net viršutinė riba (5 000/mėn, CTR 5%) = 250 apsilankymų × 3% signup × 3% paid = **0,2 mokančio userio/mėn**. S1 „pirmas euras per 1–2 mėn" ateina iš ESAMŲ userių per Stripe — SEO fabrikas prie jo neprisideda niekuo.

**Verdiktas: KRITO kaip „fabrikas" ir kaip S1 acquisition ramstis.** Kas lieka: **10 rankinės kuracijos puslapių kaip €0 eksperimentas** (CS testas №3 — teisingas) + tie patys puslapiai kaip **share-artefaktai FB grupėse** (distribucija per social, ne per Google — AIO ten nesiekia). Ir SEO tūrio patikra (1 val., Keyword Planner) PRIEŠ rašant nors vieną puslapį — sintezės testas №7 teisingas, tik jo slenkstis turi gilinti: <500/mėn ne „nice-to-have", o „neegzistuoja".

---

## 3. KO KONSILIUMAS NEPAMATĖ (aklosios zonos)

1. **Antro QR problema.** Niekas nesumodeliavo lentynos, kurioje importinis augalas JAU turi Plantbeeb/GS1 QR, o LapasID siūlo klijuoti antrą. Visa S2 logika implicitiškai tariasi, kad LapasID QR bus vienintelis. Nebus.
2. **Analitika — dviašmenis kalavijas.** K-6 scan analitiką vadina „įrodymo varikliu" (plačiausias konsensusas!), bet niekas nepasakė: tas pats dashboard'as, rodantis seller'iui 7 scan'us/mėn, yra **churn variklis**. Konsiliumas suprojektavo produktą, kuris demonstruoja klientui savo paties nesėkmę realiu laiku.
3. **Funnel'io vidurys tuščias.** Visi ginčijosi dėl scan rate, bet niekas nesuskaičiavo scan→signup→paid grandinės. Scan'as atveda į web pasą /p/{id} — konversija iš paso peržiūros į PWA registraciją (be App Store, be push iOS Safari) niekur neįvertinta. Tai gali būti didesnė skylė nei pats scan rate.
4. **Sezoniškumo aklumas testuose.** Augalų retail — aštriai sezoninis (pavasaris). 4–6 sav. QR pilotas (testas №6) ne sezono metu duos triukšmą, ne signalą. Nė vienas testų aprašymas sezono nemini.
5. **MasterTag duomenys = žymų pardavėjo apklausa.** „70% skaito žymą, 98% pasilieka" tapo B2B retention argumento pamatu be jokio skepsio — tai gamintojo, gyvenančio iš žymų pardavimo, marketingo tyrimas.
6. **Hibrido valandų matematika prieš LT lubas.** S2 reikalauja 13–16 val./sav. dėl pajamų eilutės, kurios teorinis maksimumas (€14–21K ARR) ≈ S1 lubos (€20–35K) su 9–14 val./sav. Konsiliumas hibridą pateikė kaip „6 lęšių konvergenciją", bet nepadarė elementarios €/val. palyginamosios — **S2 priedas prie S1 gali turėti NEIGIAMĄ ribinę grąžą founder'io valandai.**

---

## 4. IŠGYVENUSIŲJŲ SĄRAŠAS (sąžiningai)

- **K-6 (scan analitika, 1 d. darbo)** — išgyveno ir SUSTIPRĖJO, bet perrėminta: ne „įrodymo variklis", o **pigiausias kill-testas su iš anksto užrašytu mirties slenksčiu**. Statyti pirmiausia.
- **K-1 (QR ant esamos etiketės = pigiausias carrier)** — kaštų logika atlaikė viską. €0,00 yra €0,00. Krito tik prie jo prikabinta pajamų eilutė.
- **K-9 (Stripe pirmiausia)** — nepaliesta, tvirta. Vienintelis S1 elementas, generuojantis eurą per 60 d., yra esamų userių paywall, ne SEO.
- **KF-7 metodika („matuojam parašą, ne nuomonę")** — išgyveno su pataisom: svetimi sellers + 90 d. churn matavimas po dashboard'o, ne pasirašymo aktas.
- **S3 (kolekcinė provenance niša)** — atlaikė mano geriausią smūgį ir išėjo STIPRESNĖ: kolekciniai augalai neateina iš NL su etikete (nėra antro QR problemos), instancijos pasas ten turi realią semantiką, pirkėjas (ne seller) moka, NFC ekonomika įrodyta vyno precedentu. Po mano atakų S3 atrodo ne „įrodymo poligonas", o **racionaliausias pirmas B2B-ish žingsnis**.
- **B2B §1.6 death-rate/retention argumentas** — sužeistas (cirkuliarinė duomenų priklausomybė), bet gyvas kaip Y2+ naratyvas: skausmas (shrinkage 5–15%) tikras, €50/mėn pilotas (B2B testas №5) — geriausias iš visų seller testų, nes matuoja mokėjimą už skausmą, ne už ženklą.

**Apatinė eilutė tarybai:** S2 kaip PAJAMŲ strategija Y1 — mirusi; S2 kaip PIGIŲ KILL-TESTŲ rinkinys (counter → 1 pilotas su slenksčiu → svetimų sellers offer-sheet) — gyva ir verta 4–6 savaičių. S1 gyva tik savo Stripe puse; SEO dalis — €0 eksperimentas, ne ramstis. Tikroji konvergencija, kurios konsiliumas nepamatė: visi keliai, atlaikę ataką, veda į **S3 + Stripe**, o ne į S1+S2.

---

## Šaltiniai (fakto-šūviai, naudoti atakose)

- QR scan rate vardiklio realybė (<0,5% be CTA; scan rate = scans ÷ units in circulation): https://www.qr-insights.com/blog/2026-03-19-connected-packaging-cpg-qr-codes-2026
- Vendor benchmark'ų kontekstas: https://bitly.com/blog/qr-code-scan-behavior-by-industry/ ; https://pageloot.com/blog/qr-code-scanning-trends-by-industry-a-breakdown/
- AI Overviews CTR: https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/ (pos-1 CTR -58%; AIO informacinių 1,6%); https://searchengineland.com/google-ai-overviews-drive-drop-organic-paid-ctr-464212 (-61% organinis)
- Google scaled content abuse / deindeksacijos: https://www.searchenginejournal.com/googles-march-2024-core-update-impact-hundreds-of-websites-deindexed/510981/ ; https://blog.google/products-and-platforms/products/search/google-search-update-march-2024/
- Plantbeeb × Floramedia sektoriaus rollout: https://www.bpnieuws.nl/article/9790034/floramedia-maakt-met-plantbeeb-de-qr-code-sectorbreed-beschikbaar/ ; https://floramedia.nl/ontdek-plantbeeb-slimme-plantinformatie-voor-de-groensector/
- Visa kita — iš konsiliumo raportų (10-b2b-hortikultura.md, 10-hardware-nfc.md, 10-marketplace-ekonomistas.md, 10-lt-rinka.md, 10-consumer-strategas.md) su ten nurodytais šaltiniais.
