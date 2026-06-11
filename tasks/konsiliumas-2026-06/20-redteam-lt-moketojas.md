# RAUDONOJI KOMANDA — Taikinys: „LT vartotojas kažkiek mokės"

_Atakuoju prielaidą, kurią sekretorius pats įvardijo kaip saviapgaulės vietą #2: visi 8 lęšiai priėmė, kad LT vartotojas kažkiek mokės, nors precedento niekas nerado. Mano darbas — patikrinti, ar apatinė riba tikrai gali būti nulis, ir kas iš plano lieka, jei ji nulis._

---

## 1. PRE-MORTEM: 2028-ieji. B2C Lietuvoje žlugo. Kaip tai įvyko.

**2026 liepa–rugpjūtis.** Stripe įjungtas per 5 savaites (FR buvo teisus — softas greitas). 300 SEO puslapių „ar X nuodingas katėms" live. Email esamiems useriams: „Pro ankstyvoji kaina €19/m pirmiems 50".

**2026 rugsėjis–gruodis.** Registruotų vartotojų auga pagal LT-rinkos kanalo žemėlapį — FB grupės, dvi mugės, SEO srautelis: ~1 200–1 800 per 6 mėn. Mokančių: **9**. Iš jų 4 — pažįstami ir bendruomenės entuziastai. Kainų testas €19 vs €29: 4 prieš 5. Statistiškai — monetos metimas. Founder'is negali atskirti „LT nemoka" nuo „funnel'is per mažas" — **testas, kuris turėjo „pakeisti viską" (KF-2), grąžino triukšmą.**

**Esminis mechanizmas: ne falsifikacija, o NEfalsifikuojamumas.** Niekas garsiai nesprogo. Kiekvienas testas grįžo „underpowered, inconclusive". Tai blogiau už aiškų „ne" — founder'is dar 6 mėn. investuoja į „funnel'io gerinimą".

**2027 sausis–gegužė.** SEO tūrių patikra (testas #7) patvirtina: LT toksiškumo frazės suminiu ~200–400 paieškų/mėn., Google AI Overviews atsako tiesiai SERP'e — CTR krenta. Paid ads bandymas: €300 biudžetas Meta'oje, CAC per registraciją ~€3–6, per mokantį — €150+ prieš ~€30 LTV. Kanalas uždaromas. PWA App Store'e neegzistuoja — LT vartotojas, ieškantis „augalų atpažinimas", randa PictureThis, niekada LapasID.

**2027 pavasaris — vienintelis B2B langas.** Du sellers paėmė nemokamus QR. Scan rate 0,8% — 40 skenų/mėn. Pardavėjas: „kam man mokėti €19/mėn už 40 skenavimų?" L2 pokalbiai miršta ne dėl kainos, o dėl to, kad **B2C funnel'is, turėjęs pagaminti scan'us, niekada neįsibėgėjo. Šaltojo starto kilpa neperkirsta.**

**2027 ruduo.** MRR ~€60. InoStartas netaikytas — pagal paties FR taisyklę (≥€500 MRR) niekada nepasiekta. PL plėtra neįmanoma: nėra nei kapitalo, nei LT'oje įrodyto modelio, kurį perkelti. Plantbeeb×Floramedia QR banga atvažiuoja per Van Vliet importo kanalą — QR ant etiketės tampa commodity be LapasID.

**2028.** Projektas gyvas kaip hobis. Strateginio plano vertė ≈ 0, nes visos jo šakos (S1 pajamos → S2 įrodymai → InoStartas → PL) buvo nuosekliai užgrandintos ant pirmosios dominos — LT mokančio vartotojo — kuri niekada nenuvirto į „taip" pusę, bet ir niekada aiškiai nenuvirto į „ne".

---

## 2. ATAKOS

### A1. K-3 / sekretoriaus pastaba: „LT-only mokamo consumer app precedento nerasta"

**Ataka:** verifikavau — ir radau, kad teiginys formaliai NETIKSLUS, bet tiesa dar blogesnė, nei konsiliumas manė.

- **Trafi** — patvirtinta: B2C buvo nemokama; founder'is viešai: „we said we can't continue like this, we're not going to make money out of it" → 2016–2017 pivot į B2B/B2G (Jelbi/BVG), 2025 parduota Enghouse. LT consumer'is jiems niekada nemokėjo. ([lucileramackers.com](https://www.lucileramackers.com/english/can-maas-find-a-business-model-that-works), [trendingtopics.eu](https://www.trendingtopics.eu/the-lithuanian-startup-trafi/))
- **Vinted** — patvirtinta: vartotojai nemokėjo NIEKO iki pan-europinio masto; pirkėjo apsaugos mokestis (€0,70 + 5%) LT įvestas tik ~2021 pabaigoje — po vienaragio statuso. Tai transakcinis mokestis ant likvidžios rinkos, ne prenumerata. ([vinted.com/help/342](https://www.vinted.com/help/342-vinted-pirkejo-apsaugos-mokestis))
- **BET: EDUKA klasė** — realus LT-only mokamo consumer skaitmeninio produkto precedentas: tėvai patys perka mokinio licenciją mokslo metams („moku pats" opcija, metinė licencija VIII.1–VII.31). ([eduka.lt/pradzia/licencija](https://eduka.lt/pradzia/licencija)) Taip pat Go3/„Žmonės Cinema" — lokalus mokamas streamingas.

**Verdiktas: teiginys KRITO formuluotėje, bet atgimsta griežtesnis ir pavojingesnis.** Precedentai egzistuoja TIK ten, kur yra (1) būtinybė + institucija (vaiko mokslas, mokykla kaip kanalas) arba (2) kasdienis turinys (TV/kinas). **Hobby/lifestyle utility kategorijoje LT precedentas = 0.** Augalų priežiūra — gryniausias hobby/lifestyle. Eduka ne gelbsti LapasID — ji parodo, ko LapasID NETURI: nei būtinybės framingo, nei institucinio kanalo. Sekretoriaus įtarimas ne tik pasitvirtino — jis buvo per švelnus.

### A2. S1 lubos „€20–35K ARR iš B2C" (CS variantas A; K-3)

**Ataka:** formulė 30–50K MAU × 2,5–3,5% × €20 daro prielaidą, kad 30–50K MAU pasiekiama. LT-rinkos lęšio PATIES kanalo žemėlapis (§1.6) duoda **1 000 vartotojų per 6 mėn. be ad spend** — tai ~2K/metus organika. Iki 30K MAU trūksta 15–30×, ir nėra variklio: App Store kanalo nėra (PWA), SEO tūriai neverifikuoti ir tikėtina šimtai paieškų/mėn., paid ads ekonomika negyva (mano modeliavimas: Meta CPC LT ~€0,2–0,5, landing→reg ~10–20%, reg→pay ~2% → **CAC per mokantį €70–170 prieš LTV ~€30–40** — struktūriškai neigiama 2–5×). Kalibracija iš šalies: VISA LT SVoD rinka — mainstream'iškiausia prenumeratų kategorija — tik ~$19M (Statista 2027 proj.). Augalų app'o realistinė Y1 B2C eilutė: **€0,5–2K ARR, ne €20–35K.**

**Verdiktas: KRITO.** „€20–35K lubos" žodis „lubos" kontrabanda įneša prielaidą, kad lubos pasiekiamos. Vietoj jo: **LT B2C Y1 = €0,5–2K; €20–35K — tik su 3+ metų compounding'u ARBA su distribucijos varikliu, kurio planas neturi.** S1 lieka ne pajamų strategija, o pigus egzistencinis testas.

### A3. Testas #4 („Stripe €19 vs €29 — keičia viską"; KF-2 sprendimo mechanizmas)

**Ataka:** statistinės galios nėra. Skirtumui tarp 2% ir 3% konversijos aptikti reikia tūkstančių ekspozicijų vienai šakai; LT funnel'is per 6 mėn. duos ~500–1 000 ekspozicijų viso. Su 5–15 mokančių neįmanoma atskirti nei kainos efekto, nei net „veikia/neveikia" — n=10 suderinamas ir su 1%, ir su 3% konversija. Konsiliumas perkėlė RevenueCat 2,1% medianas (matuojamas native app SDK milijoninuose funnel'iuose) į PWA mikrorinkos kontekstą — **kategorijos klaida du kartus: ir dėl platformos, ir dėl imties.**

**Verdiktas: SUŽEISTA, performuluotina.** Testas lieka tik kaip BINARINIS egzistencijos įrodymas su absoliučiu kriterijumi: „≥20 nepažįstamų mokančių per 90 d. = signalas; <10 = LT B2C eilutę nurašyti planavime į €0". A/B kainodara LT mastu — neįmanoma; kainą rinktis iš benchmark'ų (€19–24), ne iš testo. Ir privalomas priedas: **5 kokybiniai pokalbiai su sumokėjusiais** — vienintelis būdas gauti signalą iš mažo n.

### A4. S1 „saugos SEO vartai" + H-M4 — 4 sek atsakymas KANIBALIZUOJA registraciją

**Ataka:** saugos intencija yra vienkartinė („ar monstera nuodinga katei?" — gavai NE/TAIP — uždarei tab'ą). Yuka atsakymą duoda TIK app'o viduje (skenas = įdiegimas įvyko PRIEŠ atsakymą); Solid Starts DB nemokama, bet utility (tracking) — app'e. LapasID planas atsakymą atiduoda viešame SEO puslapyje ir viešame pase be jokio tęstinumo kabliuko. Vidinė įtampa, kurios niekas neįvardijo: **kuo geriau veikia „4 sek be paskyros" (saugos pažadas), tuo mažiau lieka priežasčių registruotis.** Konsiliumas šitą įtampą pripažino CS rapore (H-M4 silpninimas: „registracija be paskatos neturi įrodymų"), bet S1 aprašyme ji dingo — SEO vartai suprojektuoti be durų už jų.

**Verdiktas: SUŽEISTA, išgyvena tik su sąlyga.** SEO puslapis privalo turėti suprojektuotą tęstinumo kabliuką, kuris vertingas TIK su paskyra: „išsaugok savo augalų sąrašą ir gauk perspėjimus apie VISUS savo augalus vienu kartu" / augintinio profilis („įvesk, kad turi katę — patikrinsim visą kolekciją"). Be šito SEO = brand awareness, ne funnel.

### A5. KF-2 pozicija A (CS): „free tier mažinti 15→5 augalų"

**Ataka:** konversijos varžto veržimas ant funnel'io, kuriame ~1–2K vartotojų, duoda triukšmo dydžio laimėjimą, bet realius nuostolius trims plano ramsčiams: (1) **word-of-mouth** — free useriai yra VIENINTELIS marketingas (paid ads negyva, A2); (2) **S4 mirtingumo registras (K-10/H-MO6)** — mažiau sekamų augalų = lėčiau kaupiasi vienintelis unikalus duomuo; konsiliumas nepastebėjo, kad KF-2 sprendimas A tiesiogiai badosi su S4; (3) **pasų tinklo efektas** — mažiau augalų kolekcijose = mažiau dalinamų /p/{id}. Konkurentų „kietesni free tiers" yra post-PMF optimizacija ant milijoninių funnel'ių — PictureThis veržia varžtą turėdama 100M downloads, ne 1 500.

**Verdiktas: KRITO kaip „daryti dabar" veiksmas; lieka kaip svirtis po ~10K MAU.** FR pozicija B („palikti, fokus į įjungimą") išgyvena mano ataką. 1 val. query (kiek userių >5 augalų) — daryti vis tiek, bet kaip žvalgybą, ne kaip sprendimo triggerį.

### A6. Numanoma prielaida „LT mokėjimo įpročiai — kliūtis"

**Ataka (apverstinė — čia ginu priešingai, nei tikimasi):** LT vartotojas moka puikiai: Vinted fee, m.Parking, Eduka licencijos, Go3, Spotify LT €8,99/mėn (vidutinė ES kaina prie ~2× mažesnio atlyginimo — t. y. lietuvis toleruoja DIDESNĘ naštą santykinai nei skandinavas; [spotify.com/lt-en/premium](https://www.spotify.com/lt-en/premium/), [cashnetusa.com tyrimas](https://www.cashnetusa.com/blog/which-countries-pay-most-least-spotify-premium/)). **Problema ne mokėjimo įprotis, o kategorijos vertė:** €19/m augalų app'ui = ~20% Spotify metų už hobį, kai DE (turtingiausia ES rinka) per capita kambariniams augalams išleidžia €11–17/m. VISIEMS augalams, ne app'ams. Ir dar: kategorijos lyderis PictureThis konvertuoja per dark-pattern trial'us — net globalus čempionas be prievartos taktikų nekonvertuoja, o LapasID sąmoningai renkasi „sąžiningą" kainodarą 2,8M rinkoje. CS šitą kainą pripažino, bet niekas jos nekvantifikavo: **sąžiningumas + maža rinka + hobby kategorija = trigubas handicap'as ant tos pačios konversijos.**

**Verdiktas:** prielaida „mokės kažkiek" miršta ne nuo perkamosios galios (ji pakankama), o nuo kategorijos: **niekur pasaulyje augalų priežiūros app neparduodamas be App Store impulso ir/arba dark patterns. LapasID atsisako abiejų.**

### A7. PWA distribucijos handicap (CS §1.5 pripažintas, bet neįkainotas)

**Ataka:** CS pats parašė „plant apps užauga per App Store paiešką ir Apple Search Ads — PWA šio kanalo neturi", ir tada visi lęsiai nuėjo toliau, tarsi pakaktų „SEO + fizinis QR". Bet: SEO tūris neverifikuotas (testas #7 dar nepadarytas, slenkstis <500/mėn realus); fizinis QR priklauso nuo sellers — o sellers WTP priklauso nuo scan'ų, kuriuos turi pagaminti vartotojai, kurių nėra be distribucijos. **Tai uždara šaltojo starto kilpa, kurios sintezė nematė, nes S1 ir S2 buvo vertinami kaip vienas kitą stiprinantys — nuliniame taške jie vienas kitą BLOKUOJA.** Plius iOS PWA mechanika: care priminimai (pagrindinė monetizuojama utility — Planta įrodymas) reikalauja home-screen install + notification leidimo; install rate niekas nematavo; mainstream LT vartotojui Safari „Add to Home Screen" — egzotika.

**Verdiktas: SUŽEISTA visa S1+S2 seka.** Išvada ne „grįžti į App Store" (PWA argumentai tebegalioja), o **apversti testų eiliškumą: testas #5 (seller offer-sheets, absoliutus parašų skaičius) yra AUKŠČIAUSIOS informacijos testas ir turi eiti PIRMAS arba lygiagrečiai — ne po B2C signalo, kurio gali tiesiog nebūti.** Jei 3+/5 sellers pasirašo — distribucija (QR ant lentynų) atsiranda NEPRIKLAUSOMAI nuo B2C funnel'io ir kilpa perkertama iš B2B pusės.

---

## 3. KO KONSILIUMAS NEPAMATĖ (aklosios zonos)

1. **Statistinės galios akloji zona.** Pusė „pigių testų" (ypač #4 kainų testas) LT funnel'io apimtyse neturi galios atsakyti į klausimus, kuriems jie skirti. Konsiliumas suprojektavo eksperimentus rinkos dydžiui, kurio neturi. Sprendimai bus priimami iš triukšmo — arba, blogiau, atidėliojami metais, nes „testas dar nieko neparodė". Visiems testams reikia ABSOLIUČIŲ kill-kriterijų (≥N parašų, ≥N mokančių), ne procentų.

2. **S1↔S2 šaltojo starto cirkuliarumas.** B2C funnel'iui reikia QR distribucijos (sellers), seller WTP reikia scan'ų (vartotojai). Sintezė mato „konvergenciją", nuliniame taške tai — aklavietė. Vienintelis perkirtimo taškas — seller parašai PRIEŠ scan duomenis (pre-sold, kaip KF-7 ir siūlo) — bet tada testų seka sintezėje surikiuota klaidingai: Stripe (#4) pirmiau offer-sheets (#5).

3. **Benchmark'ų importo klaida.** RevenueCat 2,1%/4% medianos — native app store pasaulio skaičiai. PWA web-funnel be store, be trial mechanikos, be IAP impulso konvertuoja kitaip (tikėtina žemiau discovery srityje). Niekas nepaklausė, ar benchmark'as iš viso taikytinas platformai, ant kurios pastatytas visas planas.

4. **Sezoniškumo kalendorius prieš testų kalendorių.** PictureThis pajamų pikas — gegužė (Appfigures, CS šaltinis). Konsiliumas vyksta birželį; „6 mėn. B2C testas nuo dabar" matuoja rudens–žiemos DUOBĘ. Jei gruodį mokančių 5–15 — neaišku, ar tai rinkos „ne", ar sezono dugnas. Testo langas turi kirsti pavasarį, arba gruodžio rezultatas diskontuotinas.

5. **Eduka pamoka apie LT mokėtoją.** LT vartotojas moka už skaitmeną tada, kai yra būtinybė + institucinis kanalas (vaiko mokslas per mokyklą) arba kasdienis turinys. Joks iš šių svertų neperkeliamas į augalus — bet ARTIMIAUSIAS analogas būtų „augintinio sauga" framingas (katė = šeimos narys, ne hobis). Konsiliumas safety wedge taikė augalui; stipresnė emocinė ašis — GYVŪNUI. „Patikrink visą savo kolekciją prieš parsinešant katę" — būtinybės framingas, kurio plane nėra.

---

## 4. IŠGYVENUSIŲJŲ SĄRAŠAS (sąžiningai)

- **K-7 „sauga = acquisition wedge, ne pajamų variklis"** — atlaikė geriausią smūgį ir net sustiprėjo: mano atakos žudo monetizaciją, ne acquisition logiką. Yuka/Solid Starts išvados tvirtos.
- **K-3 gilioji pusė „B2C monetizacija užsidaro tik su PL"** — atlaikė ir sustiprėjo: net mainstream LT prenumeratų rinkos (SVoD ~$19M viso) rodo, kad mikrorinkoje hobby prenumerata neegzistuoja kaip verslo eilutė.
- **K-9 Stripe-first** — išgyvena su pataisa: net 5–15 mokančių geriau nei nulis žinojimo, kaštas mažas, o „pirmas euras" turi psichologinę vertę founder'iui. Bet sėkmės kriterijus privalo būti absoliutus ir iš anksto užrašytas.
- **KF-7 sprendimo dizainas „matuojam parašą, ne nuomonę"** — geriausiai suprojektuotas testas visame plane; mano statistinės galios ataka jo nekanda, nes kriterijus absoliutus (3+/5). Tik jo VIETA eilėje klaidinga — turi būti pirmas.
- **FR pozicija KF-2 ginče (free tier nejudinti dabar)** — išgyveno; CS pozicija krito.
- **Velocity kaip turtas (03-assets §5)** — neatakuotinas; bet jis paaiškina, KODĖL planas linksta į „dar vieną softo testą" vietoj nepatogių pardavimo pokalbių — velocity yra ir komforto zona.

**Galutinė raudonosios komandos tezė:** nulinės apatinės ribos scenarijus (5–15 mokančių po 6 mėn.) yra ne rizika, o BAZINIS scenarijus — ir planas jį atlaiko TIK jei strateginis svoris perkeliamas nuo „ar LT vartotojas mokės" (atsakymas: reikšmingai — ne) prie „ar LT seller pasirašys" (vienintelis neatsakytas didelės vertės klausimas). B2C Lietuvoje = poligonas, duomenų fabrikas ir €0–2K kišenpinigiai. Kas planuoja kitaip — planuoja iš triukšmo.

---

### Verifikacijos šaltiniai
- Trafi B2C→B2B: https://www.lucileramackers.com/english/can-maas-find-a-business-model-that-works ; https://www.trendingtopics.eu/the-lithuanian-startup-trafi/
- Vinted pirkėjo apsaugos mokestis (~2021 pab., €0,70+5%): https://www.vinted.com/help/342-vinted-pirkejo-apsaugos-mokestis
- EDUKA klasė — tėvai perka licenciją patys („moku pats", metinė): https://eduka.lt/pradzia/licencija ; https://www.eduka.lt/duk/eduka-klases-licencijos/
- Spotify LT kainos (€8,99 Individual): https://www.spotify.com/lt-en/premium/ ; santykinė našta: https://www.cashnetusa.com/blog/which-countries-pay-most-least-spotify-premium/
- LT SVoD/muzikos streaming rinkos dydis: https://www.statista.com/outlook/dmo/digital-media/video-on-demand/video-streaming-svod/lithuania ; https://www.statista.com/outlook/dmo/digital-media/digital-music/music-streaming/lithuania
- Paid ads CAC modeliavimas — mano skaičiavimas iš viešų CPM/CPC diapazonų, pažymėtas kaip modelis, ne faktas.
