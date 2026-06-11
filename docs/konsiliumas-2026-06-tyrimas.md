# KONSILIUMAS 2026-06 — Tyrimo dokumentacija

> **Kas tai per dokumentas.** Išliekamoji konsiliumo 2026-06 tyrimo dokumentacija: kaip vyko procesas,
> visi atrasti precedentai su šaltiniais, verifikuotų faktų registras ir nužudytų teiginių sąrašas.
> Tikslas — kad įdėtas darbas (12+ agentų, ~1M tokenų research) nepasimestų, ir kad ateityje
> nereikėtų iš naujo tikrinti to, kas jau patikrinta. URL'ai imti tiesiai iš raportų — neišgalvota.
>
> Susiję failai: `tasks/konsiliumas-2026-06/` (visa pirminė medžiaga), `60-galutine-santrauka.md`
> (kelionės santrauka — kas mirė, kur nuėjom). Memory: `vision_eu_regulatory_facts.md`,
> `strategic_vision.md`.

---

## 1. ĮVADAS — kas buvo konsiliumas

Konsiliumas — tai struktūruotas, adversarinis strategijos perskaičiavimas. Užduotis: iš naujo
permąstyti LapasID strategiją iš daugelio kampų ir rasti geriausią STARTO konceptą. Veikiantis
produktas, V1 vizija ir keli kertiniai turtai egzistavo — bet V1 buvo traktuojama kaip HIPOTEZĖ,
ne šventas raštas. Darbas — ją testuoti, griauti ir statyti geriau.

### 1.1. Fazės

| Fazė | Kas | Išvestis |
|---|---|---|
| 0. Kalibracija | Founder'io kriterijų fiksavimas | Opcionalumas (bootstrap-first, venture durys atviros); resursai = strategijos IŠVESTIS; pirma kasa atvira (B2B vs B2C); LT — ginčytinas default |
| 1. Briefing book | Bendras pagrindas visiems agentams | `01-briefing.md`, `02-v1-claims.md` (V1 teiginiai kaip H-* hipotezės), `03-assets.md` (sąžiningas turto inventorius) |
| 2. 8 specialistų panelė | 8 nepriklausomi lęšiai, kiekvienas su web research | `10-*.md` (8 raportai, ~600K tokenų) |
| 3. Raudonoji komanda | 4 adversariniai agentai atakuoja išgyvenusius teiginius | `20-redteam-*.md` |
| 3.5. Gilesni gijos | Founder'io posūkiai po redteam | `30`–`34` (Plantbeeb, demand-signal, founder-market fit, akademija, kaštai) |
| 4. Sprendimo rėmas | Founder'io konsolidacija | `40`–`43` (dviejų dalių modelis → trys segmentai) |

### 1.2. Apimtis ir dalyviai

- **8 specialistų lęšiai (fazė 2):** B2B hortikultūra, marketplace ekonomistas, consumer strategas,
  hardware/NFC, regulatory strategas, data/AI moat, LT rinka, founder-realybė.
- **4 raudonosios komandos agentai (fazė 3):** S2 ekonomika, „LT mokėtojas", konkurencinis war-game,
  aklosios zonos + meta-ataka prieš patį konsiliumą.
- **Sintezė (`11-sinteze.md`):** 13 konsensusų (K-1..13), 8 konfliktai (KF-1..8), kill-board,
  5 strategijos (S1–S5), 10 pigiausių testų.
- **Bendras research:** ~1M tokenų; ~150+ unikalių išorinių šaltinių su URL.

### 1.3. Adversarinio dizaino principas

Kiekvienos fazės išvestis buvo NUODUGNIAI atakuojama kitos fazės. Specialistai statė strategijas →
raudonoji komanda jas griovė → sintezė sutaikė → meta-ataka patikrino, ar pats konsiliumas nemeluoja
sau. Vertingiausi artefaktai pasirodė ne strategijos (jas modelis gali generuoti), o **testai su
realybės kontaktu** (offer-sheets, kalendoriaus auditas) ir **kill-board** (kas neįrodyta).

---

## 2. PRECEDENTŲ ŽINYNAS

> Svarbiausia šio dokumento dalis. Kiekvienas precedentas — konkretus rinkos faktas, kuris
> formavo sprendimus. Struktūra: Kas tai / Kas nutiko / Kodėl mums svarbu / Šaltiniai.

### 2.1. Plantbeeb × Floramedia + GS1 Sunrise 2027 — „antro QR" laikrodis

**Kas tai.** Floramedia — didžiausias ES augalų etikečių gamintojas. Plantbeeb — jų NEMOKAMA
consumer app (native iOS+Android, ko LapasID neturi): vartotojas nuskaito QR ant vazono → gauna
rūšies priežiūros info; nuo 2025-02 — ir foto atpažinimą. „My Beeb" funkcija — JAU turi asmeninę
augalų kolekciją (konverguoja į LapasID teritoriją). Augintojui nieko nereikia daryti — QR jau ant
etiketės, kurią jis perka.

**Kas nutiko.** Nuo 2026 Floramedia deda Plantbeeb QR **sektoriaus mastu**; nuo 2027 — dinaminis QR
„powered by GS1", keisiantis barkodą. GS1 Sunrise 2027: iki 2027-12-31 mažmena privalo skenuoti 2D
kodus kasose — vienas QR tampa ir kasos kodu, ir vartotojo info kanalu. „QR ant augalo" taps norma
BE LapasID pastangų.

**Kodėl mums svarbu.** Tai struktūrinis laikrodis. Plantbeeb į LT ateina NE kaip įmonė, o kaip
SAVYBĖ ant olandiškos etiketės, prilipusios prie augalo per Van Vliet C&C Vilnių/Kauną (NL = ~36%
ES dekoratyvinių). „Antro QR problema": importinis augalas LT lentynoje JAU turės Plantbeeb QR —
LapasID lipdukas tampa antru QR, kurį seller turi klijuoti rankomis. Dviejų QR dvikovoje laimi tas,
kuris upstream ir nemokamas. **LapasID anga:** Plantbeeb yra RŪŠIES lygio (ne egzemplioriaus) —
neturi šito konkretaus augalo istorijos, perdavimo, LT toksiškumo kuracijos, mirties duomenų. Jų
architektūra „QR=rūšis", ne „QR=daiktas su istorija" — pridėti negali lengvai. War-game AZ-4 ir gija
`31` siūlo radikalų ėjimą: tapti Plantbeeb LT-data/toksiškumo TIEKĖJU, ne konkurentu.

**Šaltiniai.**
- https://www.bpnieuws.nl/article/9790034/floramedia-maakt-met-plantbeeb-de-qr-code-sectorbreed-beschikbaar/
- https://www.bpnieuws.nl/article/9804761/met-deze-stap-maken-we-digitale-plantinformatie-schaalbaar-voor-de-hele-keten/
- https://floramedia.nl/ontdek-plantbeeb-slimme-plantinformatie-voor-de-groensector/
- https://plantbeeb.com/en/
- https://www.gs1us.org/industries-and-insights/by-topic/sunrise-2027

### 2.2. Costa Farms × Greg — seller-kanalo modelis JAU veikia (B2B2C)

**Kas tai.** Costa Farms — didžiausias JAV houseplant augintojas. Greg — augalų priežiūros app
($5,4M seed 2021, VC-finansuota), kurios tiesioginė monetizacija silpna.

**Kas nutiko.** Costa Farms deda **paprastą QR** ant etikečių → QR atrakina 3 mėn. nemokamo Super
Greg → augintojas subsidijuoja app'o adoption, app'as duoda augintojui lojalumą. Greg turi atskirą
„Partner with Greg" programą.

**Kodėl mums svarbu.** Tai beveik 1:1 LapasID L1–L3 modelis, jau veikiantis JAV. Dvi implikacijos:
(1) modelis realus — sellers tikrai tai daro (social proof LT pardavimams); (2) **„structurally
hard to copy" (H-MO4/H-MO5) — netiesa: modelis nukopijuotas dar PRIEŠ LapasID atsirandant.**
Wargame perskaitė tai apverstai: tai ne raminantis social proof, o GRĖSMĖS ŠABLONAS — jei
Greg/Planta pasirašytų su EU augintojų konsorciumu (žr. 2.4 Decorum/RFH), tas pats QR+app srautas
atvažiuotų į LT ant importo su jau veikiančiu care app sluoksniu.

**Šaltiniai.**
- https://help.costafarms.com/en/knowledge/how-do-i-sign-up-for-the-greg-app
- https://costafarms.com/pages/greg-app-page
- https://greg.app/partners/
- https://techcrunch.com/2021/05/27/greg-an-app-for-plant-lovers-grows-5-4-million-in-seed-funding/

### 2.3. Palmstreet — vienintelis pavykęs augalų marketplace ir jo anatomija

**Kas tai.** JAV augalų live-shopping marketplace.

**Kas nutiko.** Startavo 2020 kaip augalų priežiūros SOCIAL APP (ne marketplace!), live-shopping
pridėjo tik 2023. $25M pritraukta 2025-05 (a16z, Craft Ventures, Headline); 3M užsakymų iki
2025-08. Take rate: 5,9% (free) / 4,9% ($99/mėn) / 3,9% ($399/mėn) + Stripe 2,9%+$0,30 → efektyvus
~7–9%. **Kritinis faktas:** visoje JAV (330M žmonių) turi tik ~500 live sellers, iš jų ~200
aktyvių. Ir net su tuo 2025 PALIKO grynų augalų nišą — plėtėsi į madą, beauty, rankines ($175K
rankinių per 3 mėn.), nes augalų vertikalė per maža net JAV mastu.

**Kodėl mums svarbu.** (1) Patvirtina „indas pirma, prekyvietė rezultatas" seką (H-S4). (2)
Kalibruoja H-M2 (80 mokančių LT sellers): jei JAV su 330M turi ~200 aktyvių, 80 mokančių LT (2,8M)
= 100× geresnis tankis nei Palmstreet — be precedento. (3) Variklis buvo ne „pasitikėjimas duomenų
modelyje", o LIVE-SHOPPING pramoga (FOMO, aukcionai). (4) H-C4 7–10% take rate pats savaime NĖRA
problema — benchmark'as teisingas; LT BAZĖ ne ta.

**Šaltiniai.**
- https://palmstreet.app/blog/fees-on-palmstreet
- https://www.inc.com/jennifer-conrad/how-palmstreet-is-growing-millionaires-livestreaming-ecommerce/91229413
- https://www.prnewswire.com/news-releases/palmstreet-accelerates-growth-into-fashion-beauty-and-lifestyle-following-breakout-success-in-live-plant-commerce-302683564.html
- https://www.modernretail.co/technology/definitely-not-on-my-bingo-card-plants-are-the-latest-live-shopping-trend/

### 2.4. Decorum / Royal FloraHolland — „EU Costa atitikmuo"

**Kas tai.** Decorum — 76 pirmaujančių NL augintojų rinkodaros/pardavimų organizacija su bendru
prekės ženklu. Royal FloraHolland — NL gėlių aukcionų ekosistema, €5,4 mlrd apyvarta (2025).

**Kodėl mums svarbu.** War-game'as ieškojo, kas galėtų suvaidinti „EU Costa" rolę — t. y. didelį
augintojų konsorciumą, su kuriuo Greg/Planta galėtų pasirašyti QR+app sandorį. Decorum ir RFH turi
būtent tą mastą ir bendrą brand'ą. Jei toks sandoris įvyktų, care app srautas atvažiuotų į LT ant
importo grandinės — ir LapasID neturi nei kapitalo, nei augintojų konsorciumo atsakui.

**Šaltiniai.**
- https://www.floraldaily.com/article/9006887/nl-tropical-plant-grower-specialized-in-particular-species-and-cultivars/
- https://www.royalfloraholland.com/en/news-2026/week-13/royal-floraholland-succesvol-2025-productomzet-groeit-naar-5-4-miljard-euro

### 2.5. Vinted 2016 fee krizė — „neapmokestink ribojamos pusės"

**Kas tai.** LT vienaragis (€3,5 mlrd vertė), antrų rankų rūbų marketplace.

**Kas nutiko.** 2016 įvedė **20% seller fee → masinis pardavėjų išėjimas, 9–12 mėn. iki bankroto**.
Thomas Plantenga gelbėjimas: seller fee = 0, įvestas **buyer protection fee 5% + €0,70**. Likvidumas
grįžo: 2025 — €10,8B GMV, €1,1B pajamų, €62M grynojo pelno. Efektyvus take ~10%, bet IŠ PIRKĖJO už
APSAUGĄ, ne iš pardavėjo už privilegiją parduoti.

**Kodėl mums svarbu.** LapasID L4 (7–10% iš seller'io per mokėjimus) prieš likvidumą = tiksliai ta
klaida, kuri vos nenužudė Vinted. Jei kada bus transakcijos (S3 niša) — buyer protection fee modelis,
ne seller fee. Antra pamoka (iš „LT mokėtojo" redteam): Vinted vartotojai NEMOKĖJO NIEKO iki
pan-europinio masto; pirkėjo apsaugos mokestis LT įvestas tik ~2021 pab. — PO vienaragio statuso.

**Šaltiniai.**
- https://www.insightpartners.com/ideas/part-of-the-fabric-of-society-how-thomas-plantenga-is-making-vinted-the-amazon-of-secondhand/
- https://company.vinted.com/newsroom/financial-results-2025
- https://www.vinted.com/help/342-vinted-pirkejo-apsaugos-mokestis

### 2.6. Candide — consumer gardening app žlugimas, B2B pivot

**Kas tai.** Bristolio consumer gardening app su AR augalų etiketėmis ir botanikos sodų
partnerystėmis.

**Kas nutiko.** Uždarė vartotojišką programėlę **2023-12-07** („nebeturime komandos ir resursų");
išgyveno tik pivot'avusi į B2B paslaugas viešiesiems sodams (bilietai, Candide AI; Bristol + Cape
Town).

**Kodėl mums svarbu.** Tiesioginis įspėjimas H-M5 (botanikos sodai kaip launch kanalas):
sodų partnerystės yra distribucija ir credibility, bet NE verslo modelis consumer programėlei —
sodai moka už operacines paslaugas SAU. Tai pamatas sprendimui laikyti institucijas credibility
sluoksniu su kietu valandų capu, ne kasa.

**Šaltiniai.**
- https://thedirt.news/candide-app-to-shut-down/
- https://www.hortweek.com/gardening-app-close/retail/article/1848231
- https://candide.com/
- https://techspark.co/blog/2019/07/25/top-gardening-innovator-candide-launches-new-ar-labelling-app/

### 2.7. UK HTA kodeksas — veikiantis savanoriško toksiškumo ženklinimo playbook'as

**Kas tai.** UK Horticultural Trades Association „Guide to Potentially Harmful Plants" (3 leid.,
2022): savanoriškas mažmenos kodeksas, kuriame augalai ženklinami **A/B/C kategorijomis pagal
pavojaus sunkumą pirkimo momentu**; nuo 3 leidimo įtraukta rizika gyvūnams; dalyvauja Veterinary
Poisons Information Service.

**Kodėl mums svarbu.** Įrodo: (1) toksiškumo ženklinimas pirkimo vietoje yra industrijos
asociacijos, ne įstatymo produktas; (2) jį galima padaryti BE jokio mandato; (3) A/B/C + žmonės/
gyvūnai atskirai išsprendžia H-P6 problemą („vienas ženklas visiems" rizikingą). **REDTEAM
INVERSIJA (svarbu):** kodeksas egzistuoja 30 metų ir niekas ES jo nenukopijavo — tikėtiniausias
paaiškinimas, kad jis NEKELIA pardavimų ir nemažina kaštų, todėl niekam neapsimoka. „Atvira
pozicija" ir „pozicija, kurios niekas nenori" iš išorės atrodo identiškai. Be to, HTA legitimumas
kyla iš ASOCIACIJOS narystės — vieno žmogaus įmonės „kodeksas" yra PDF su logotipu. Išvada:
naudoti HTA METODOLOGIJĄ produkto viduje (cituojama, ne kopijuojama), be pretenzijų į industrijos
standartą.

**Šaltiniai.**
- https://hta.org.uk/potentiallyharmfulplants
- https://www.vpisglobal.com/2022/05/10/the-horticultural-trades-association-hta-guide-to-potentially-harmful-plants-3rd-edition/

### 2.8. Böen vyno NFC — vienintelė įrodyta NFC ekonomika

**Kas tai.** Kalifornijos vyno gamintojas, 2019 paleidęs 1M butelių su Guala Closures e-WAK NFC
kamščiu + SharpEnd platforma (be app — tap atveria turinį).

**Kodėl mums svarbu.** Veikia, nes butelis premium ir žyma integruota į GAMYBOS liniją, ne retrofit.
Vyno NFC žymos $0,28–0,60/vnt @500+ pasiteisina prie $150+ butelių, kur žymos kaštas
„inconsequential". Tai vienintelis precedentas, kur NFC ekonomika ĮRODYTA — todėl palaiko H-C5 (L5
provenance retiems augalams €50–500+, analogiškiems premium vynui). ATSARGA (red-team A9): vyno
analogija klaidinga viena dimensija — Böen butelio vertė nekrenta dėl klonavimo, o variegatų vertė
KRENTA dėl tissue culture (žr. 2.20).

**Šaltiniai.**
- https://www.beveragedaily.com/Article/2019/08/06/Boeen-transports-consumers-to-its-vineyard-in-California-with-NFC-enabled-wine-bottles
- https://www.mediapost.com/publications/article/338860/california-wine-maker-launches-1-million-nfc-conne.html
- https://www.resourcelabel.com/blog/2019/01/15/nfc-applications-for-wine-and-spirits-brands/

### 2.9. Thinfilm / Nike Connect — NFC kapinės

**Kas tai.** Du žlugę fizinio+skaitmeninio NFC hibrido pavyzdžiai.

**Kas nutiko.** **Thinfilm Electronics** (Norvegija/San Jose) — NFC smart label pionierius su printed
electronics ekonomika. 2019: adoption „substantially slower than anticipated", pajamos −35%, 50%
darbuotojų atleista, NFC verslas parduotas, pivot į baterijas (dabar Ensurge Micropower). **Nike
Connect** (2017, NBA jersey NFC, $110–200 produktai) — tyliai numarinta; vartotojų skundai apie
neveikiančias žymas ir nutrauktus benefit'us.

**Kodėl mums svarbu.** Pamoka H-S1 („žyma — pamatas") ir H-P4/P5 (Toxicity Dial): net žemiausi unit
kaštai (Thinfilm) ir net Nike+NBA brand'as nesugebėjo išlaikyti tap-engagement įpročio. Fizinė žyma
be ĮRODYTO skaitmeninio demand'o = kapitalo deginimas. Pamatas yra /p/{id} pasas (jau veikia), žyma
— pigiausias carrier (QR ant esamos etiketės).

**Šaltiniai.**
- https://www.securingindustry.com/pharmaceuticals/thin-film-seeks-buyer-for-nfc-platform-blaming-slow-uptake/s40/a10781/
- https://www.beveragedaily.com/Article/2019/09/27/Thinfilm-to-sell-NFC-business-due-to-slow-market-adoption/
- https://www.engadget.com/2017-09-16-nike-connect-nba-jersey-nfc.html

### 2.10. Yuka — saugos wedge ekonomika (geriausias precedentas IR įspėjimas)

**Kas tai.** Prancūzų maisto/kosmetikos saugos skeneris.

**Kas nutiko.** ~80M vartotojų (22M US, +25K/dieną organiškai), bet **2024 pajamos tik $7,3M**, 98%
iš premium €10–50/metus „pay what you want". Tai **ARPU ~$0,09–0,13/vartotojui/metus**.

**Kodėl mums svarbu.** Sauga = fenomenalus ACQUISITION variklis (zero marketing), bet baisus
MONETIZATION variklis. Yuka veikia tik todėl, kad pasiekė dešimtis milijonų — **LT-only lubos
(2,8M) struktūriškai nesuderinamos su Yuka modeliu.** Tai pagrindas K-7 („sauga = acquisition wedge,
ne pajamų variklis"). Net 5M vartotojų prie Yuka ARPU = ~$0,5–0,7M/metus — be venture neįmanoma.

**Šaltiniai.**
- https://breakevenpointcalculator.com/how-does-yuka-make-money-revenue-model-explained/
- https://www.uschamber.com/co/good-company/the-leap/yuka-app-organic-growth
- https://help.yuka.io/l/en/article/hkzw2hkj5w-cost-membership

### 2.11. Solid Starts — pozityvusis saugos-DB šablonas

**Kas tai.** JAV kūdikių maisto saugos produktas: nemokama saugos DB („First Foods Database") +
mokamas tracking/planavimas viršuje. ~$1M/mėn pajamų, 4M+ tėvų.

**Kodėl mums svarbu.** Įrodo teisingą struktūrą: saugos DB = pasitikėjimo/SEO vartai, o moka žmonės
už KASDIENĘ UTILITY (tracking), ne už saugą. Tai tiesioginis šablonas dviejų dalių modeliui
(`40`): atvira saugos DB (1 segmentas) + Pro care utility (2 segmentas).

**Šaltiniai.**
- https://solidstarts.com/app/
- https://app.sensortower.com/overview/1564189151?country=US

### 2.12. MasterTag / MyGardenLife — consumer engagement sluoksnis per žymų pardavimą

**Kas tai.** JAV hortikultūros etikečių gigantas (MasterTag); MyGardenLife (nuo 2012) — jų
priežiūros platforma, į kurią veda QR ant žymos. Finansuojama ne atskiru mokesčiu, o per žymų
pardavimą.

**Kas nutiko / tyrimo duomenys.** MasterTag tyrimas: **70% pirkėjų skaito žymą parduotuvėje, 98%
žymas pasilieka**; nesėkmė išlaikyti augalą gyvą = #1 priežastis NEPIRKTI.

**Kodėl mums svarbu.** Modelis (consumer sluoksnis kaip etiketės kainos priedas, ne atskiras SaaS)
— tas pats, ką daro Plantbeeb. Tai struktūrinis spaudimas H-C2 (L2 SaaS €15–30/mėn): industrija
prie šio sluoksnio pratusi GAUTI UŽ DYKĄ. **ATSARGA (red-team A-1):** „70% skaito / 98% pasilieka"
yra ŽYMŲ GAMINTOJO savitarnos apklausa — cituoti su skepsiu; „skaito" ≠ „skenuoja". Bet #1
nepirkimo priežastis („nemoku išlaikyti gyvo") + shrinkage 5–15% yra realus B2B skausmas, kuriam
nereikia mandato.

**Šaltiniai.**
- https://mastertag.com/
- https://mastertag.com/products/feature-plant-label-tags/
- https://mygardenlife.com/about
- https://mastertag.com/any-grower-can-go-custom-with-their-plant-tags-and-labels-heres-how/

### 2.13. Joy of Plants — skaitmeninis sluoksnis ant etiketės yra NEMOKAMA komodybė

**Kas tai.** UK augalų DB, dalijanti QR kodus kiekvienam DB augalui etikečių gamintojams
**NEMOKAMAI**.

**Kodėl mums svarbu.** Pati esmė kelioms hipotezėms: skaitmeninis sluoksnis ant augalo etiketės
pramonėje JAU yra free commodity. Tai griauna prielaidą, kad seller mokės už QR→info sluoksnį, ir
sustiprina „tag=failas, ne produktas" logiką (`42`).

**Šaltiniai.**
- https://joyofplants.com/qrcodes.php

### 2.14. Petals / Known Plants / TagLog / PlantTAGG — D2C augalų NFC/QR žymos JAU egzistuoja

**Kas tai.** Tiesiogiai vartotojams parduodamos augalų žymos: **Petals** (UK) — £6/5 vnt =
£1,20/žymai (~€1,40), be app, be prenumeratos, „lifetime platform access"; **Known Plants** (indoor
NFC markers); **TagLog**, **GrowTags** (eBay indie); **PlantTAGG** (Dallas, nuo 2019) — garden
center programa su QR + nuotraukos atpažinimu iš SPAUSDINTOS etiketės (Tag ID, 2025).

**Kodėl mums svarbu.** Griauna H-P3 „buyer inherits, not restarts — rinkoje unikalu" NFC lygmenyje:
NFC augalo žyma be app jau parduodama. Unikalumas liko tik perdavimo/istorijos SEMANTIKOJE (software
claim), ne fizinės žymos claim'e. PlantTAGG įrodo, kad konkurentas išsprendė „fizinis touchpoint"
problemą BE naujos fizinės žymos. Nė vienas neturi B2B seller kanalo — visi parduoda entuziastams
tiesiogiai (palaiko HW Strategiją B „Petals-LT", bet traction nežinoma — galimi zombie verslai).

**Šaltiniai.**
- https://www.petalsapp.com/ ; https://petalsapp.com/shop/
- https://www.knownplants.com/shop/indoor-labels
- https://plants.taglog.app/
- https://planttagg.com/garden-center-program-2/

### 2.15. MPS / GlobalG.A.P. — sertifikatui mokama TIK su kanalo mandatu

**Kas tai.** Ornamentals sertifikavimo schemos: MPS-ABC nuo €700/m + ha priedas (MPS-Compact
smulkiems); GlobalG.A.P. F&O metiniai auditai (FloriCompact smulkiems).

**Kas nutiko.** Vokietijos DIY tinklai reikalauja GlobalG.A.P. visoms gėlėms ir augalams.

**Kodėl mums svarbu.** Kritinė pamoka H-C2: ornamentals srityje už ženklus mokama NE dėl vartotojo,
o dėl **KANALO MANDATO**. „LapasID Patvirtinta" mandato neturi, vartotojas neatpažįsta — vartotojų
WTP už generic ženklą +$0,08 (beveik nieko). Suma €15–30/mėn įkandama (POS benchmark $59–149/mėn),
bet vertės pagrindo be mandato nėra.

**Šaltiniai.**
- https://my-mps.com/nieuws/mps-presenteert-vernieuwd-mps-abc/?lang=en
- https://www.globalgap.org/what-we-offer/solutions/ifa-flowers-and-ornamentals/
- https://www.floraldaily.com/article/9000859/germany-s-diy-market-requires-globalg-a-p-certification-for-all-flowers-and-ornamentals/

### 2.16. EDUKA klasė — LT-only mokamo consumer skaitmeninio produkto precedentas

**Kas tai.** LT švietimo platforma; tėvai patys perka mokinio licenciją mokslo metams („moku pats"
opcija, metinė licencija VIII.1–VII.31).

**Kodėl mums svarbu.** Tai realus LT-only mokamo consumer skaitmeninio produkto precedentas — bet
jis veikia TIK ten, kur yra (1) BŪTINYBĖ + INSTITUCIJA (vaiko mokslas, mokykla kaip kanalas) arba
(2) kasdienis turinys (Go3, „Žmonės Cinema"). **EDUKA ne gelbsti LapasID — ji parodo, ko LapasID
NETURI:** nei būtinybės framingo, nei institucinio kanalo. Augalų priežiūra — gryniausias hobby/
lifestyle, o tokioje kategorijoje LT precedentas = 0. Stipriausia emocinė ašis — ne augalas, o
GYVŪNAS/vaikas („patikrink kolekciją prieš parsinešant katę" = būtinybės framingas).

**Šaltiniai.**
- https://eduka.lt/pradzia/licencija
- https://www.eduka.lt/duk/eduka-klases-licencijos/

### 2.17. Trafi — LT B2C niekada nemokėjo, pivot į B2B/B2G

**Kas tai.** LT MaaS (mobility-as-a-service) startuolis.

**Kas nutiko.** B2C buvo NEMOKAMA; founder'is viešai: „we said we can't continue like this, we're
not going to make money out of it" → 2016–2017 pivot į B2B/B2G (Jelbi/BVG Berlyne), 2025 parduota
Enghouse. LT consumer'is jiems niekada nemokėjo.

**Kodėl mums svarbu.** Su Vinted ir CityBee sudaro LT consumer app pamoką: nė vienas neužsidirbo
vien LT rinkoje; visi naudojo LT kaip poligoną ir greitai ėjo į kaimynus. Palaiko K-3 (LT = poligonas;
B2C monetizacija užsidaro tik su PL).

**Šaltiniai.**
- https://www.lucileramackers.com/english/can-maas-find-a-business-model-that-works
- https://www.trendingtopics.eu/the-lithuanian-startup-trafi/

### 2.18. HN 75:2016 — egzistuojantis LT mikro-mandatas (nė vienas iš 12 agentų jo nerado!)

**Kas tai.** Lietuvos higienos norma HN 75:2016 (ikimokyklinio/priešmokyklinio ugdymo sveikatos
saugos reikalavimai).

**Kas nutiko / faktas.** DRAUDŽIAMA darželių teritorijoje ir patalpose sodinti/auginti nuodingus
augalus iš normos PRIEDO sąrašo; priede nesantys, bet rizikingi — tik vaikams neprieinamose vietose.
Tikrina NVSC. Pakeitimai 2024-11/2025 — sąrašas PILDOMAS (kryptis griežtėja). (TODO: patikrinti
mokyklų higienos normą — analogiškas punktas tikėtinas.)

**Kodėl mums svarbu.** Founder'is norėjo nacionalinio mažmenos ženklinimo reikalavimo („be šansų" —
teisingai). RASTA: reikalavimas JAU egzistuoja kitame segmente. Šimtai LT darželių turi TEISINĘ
pareigą žinoti, kurie augalai nuodingi + inspekcijas. Atrakina nemokamą įrankį „Ar šis augalas
leidžiamas darželyje?" + spausdinamą kortelę „Patikrinta pagal HN 75" (darželiui = inspekcijos
dokumentacija, ne nice-to-have). Missijinis (vaikų sauga) + grantinis + reali įstatymu paremta
auditorija be pardavimo. „Judo seka": nemokamas standartas ten, kur mandatas JAU yra → plinta kur
missija gyva (sodai/mokyklos/vet) → jei kada LT diskusija dėl mažmenos ženklinimo, ant stalo jau
guli veikiantis standartas.

**Šaltiniai.**
- https://e-seimas.lrs.lt/portal/legalAct/lt/TAD/TAIS.371081
- https://e-tar.lt/portal/lt/legalAct/TAR.AF02472A1EBF/asr

### 2.19. Fitosanitarinis registras — nemokamas B2B CRM + nuotolinės prekybos kabliukas

**Kas tai.** LT Valstybinės augalininkystės tarnybos (VAT/VATŽŪM) registras: visi subjektai,
prekiaujantys augalais (įsk. internetinę/nuotolinę prekybą), privalo registruotis; duomenys VIEŠI
ir ATVIRI (pavadinimas, veiklos adresas, specializacija).

**Kodėl mums svarbu.** (1) Pilnas LT augalų prekiautojų sąrašas su adresais = vienos dienos darbas,
€0 — paruoštas B2B lead-list'as (K-13). (2) Nuotolinės prekybos kabliukas: parduodant augalus
NUOTOLINIU būdu, augalo paso išimtis galutiniam vartotojui NETAIKOMA — pardavėjas privalo išduoti
pasą net B2C siuntai. T. y. ES paso infrastruktūra užgęsta ties vartotoju TIK fizinėje parduotuvėje,
bet NE e-prekyboje. Sąžiningumo riba: mandatas čia taikomas PARDAVĖJUI, ne LapasID. ATSARGA (LT
redteam): patikrinti enforcement — jei VATŽŪM nebaudžia FB pardavėjų, „prievolė" nemotyvuoja.

**Šaltiniai.**
- https://data.gov.lt/dataset/fitosanitarinio-registro-viesieji-duomenys
- https://is.vic.lt/Fis/Public/PublicData.aspx
- https://vatzum.lrv.lt/lt/naujienos/kokie-reikalavimai-taikomi-internetinei-prekybai-augalais/
- https://www.agroakademija.lt/s/verta-zinoti/ar-visais-atvejais-augalo-pasas-reikalingas/

### 2.20. Variegatų kainos + tissue culture — provenance saugo defliuojantį turtą

**Kas tai.** Retų margaspalvių (variegata) kambarinių augalų antrinė rinka.

**Kas nutiko.** Variegatų kainos piką pasiekė 2020–2022 ir stabilizavosi ŽEMYN, nes tissue culture
laboratorijos (Tailandas, NL) skaliuoja pasiūlą.

**Kodėl mums svarbu.** S3 (kolekcinė provenance niša) prielaida, kad retų augalų vertė išliks —
sužeista. Provenance pasas dokumentuoja kilmę turto klasės, kurios retumą biotechnologija aktyviai
TIRPDO. Lieka ultra-retų kultivarų mikro-niša ($1 500+ ūgliai) — bet LT mastu tai vienetai žmonių.
S3 timeline turi būti TRUMPAS (testas 2026, ne „strategija 2027+").

**Šaltiniai.**
- https://greenboog.com/product/tissue-culture-monstera-borsigiana-variegated-albo/
- https://simplifygardening.com/variegated-monstera-is-their-price-justified/

### 2.21. Planta Graveyard — „niekas nerenka mirties duomenų" yra pusiau klaidinga JAU DABAR

**Kas tai.** Planta (SE) — augalų priežiūros app, 10M userių / 40M augalų. Turi **Graveyard**
funkciją: augalo mirties įvykis su data fiksuojamas bazėje.

**Kodėl mums svarbu.** Tiesiogiai atakuoja K-10 / H-MO6 („deathReason — unikaliausias turtas, niekas
nerenka"). Plantai trūksta tik struktūruoto „kodėl" lauko — vieno dropdown'o. Skaičiai: Planta 40M
augalų × 10% mirtingumas = ~4M mirčių/metus ≈ 11K/dieną; net 10% completion = ~1100 įrašų/dieną.
**LapasID geriausių metų derlius (~1400) ≈ 1,3 Plantos dienos.** Unikalumas susitraukia iki:
struktūruotas post-mortem su pamoka, kurio „niekas dar nepridėjo prie jau renkamo įvykio". Tai ne
moat (kopijavimo kaina nulis), o feature idėja + first-mover PR naratyvas. Lieka kaip PRODUKTO
feature (retention/brand) ir kaip ĮSIGIJIMO turtas (war-game §5), ne kaip parduodamas B2B dataset.

**Šaltiniai.**
- https://support.getplanta.com/can-i-restore-a-plant-from-the-graveyard/
- https://www.prweb.com/releases/planta-the-plant-app-reaches-6-million-users-and-launches-new-discover-feature-862944738.html

### 2.22. PLD 2024/2853 — griežtoji atsakomybė už PATĮ APP'Ą (didžiausia nepastebėta rizika)

**Kas tai.** Naujoji ES Atsakomybės už produktus direktyva.

**Kas nutiko.** Software/app'ai = produktai GRIEŽTOSIOS atsakomybės (strict liability) režime;
taikoma produktams, pateiktiems į rinką **po 2026-12-09**. „Defektas" apima ir kibernetinio saugumo
silpnybes bei nepateiktus atnaujinimus.

**Kodėl mums svarbu.** Produktas, kurio pitch'as „saugumas vaikams/augintiniams", atsako BE KALTĖS
įrodinėjimo, jei klaidinga toksiškumo info prisidės prie žalos. Sujungus su 03-assets §6: **catalog
WRITE atviras bet kuriam authed user'iui (firestore.rules:86)** — piktavalis gali „toksiškas
katėms" perrašyti į „saugus" ŠIANDIEN. Konsiliumas sudegino ~600K tokenų licencijų rizikai
(€200–500 fix) ir NULĮ — atsakomybei už patį saugos pažadą (potencialiai neribota). Veiksmai:
(1) uždaryti rules NEDELSIANT (write tik isAdmin); (2) disclaimer/teisinė architektūra; (3)
toksiškumo source-of-truth auditas su atsekamumu; (4) civilinės atsakomybės draudimo kaina į unit
economics; (5) IP teisininko valandą praplėsti PLD klausimu. Tai paverčia švarų atsekamą
source-of-truth iš „higienos" į TEISINĖS GYNYBOS (state-of-the-art defence) pamatą.

**Šaltiniai.**
- https://eur-lex.europa.eu/eli/dir/2024/2853/oj/eng
- https://www.reedsmith.com/articles/eu-product-liability-directive-software-digital-products-cybersecurity/
- https://www.gibsondunn.com/eu-product-liability-directive-responding-to-software-ai-and-complex-supply-chains/

---

## 3. VERIFIKUOTŲ FAKTŲ REGISTRAS

> Faktai, kuriais galima remtis nekartojant tyrimo. Visi su šaltiniais raportuose.

### 3.1. ES reguliacija

| Faktas | Esmė | Šaltinis |
|---|---|---|
| **ES augalo pasas (Regl. 2016/2031)** | Privalomas B2B (ligų prevencija); atsekamumo kodas NEreikalingas medžiagai galutiniam vartotojui → infrastruktūra UŽGĘSTA ties vartotoju (fizinėje parduotuvėje). LT administruoja VAT. | https://eur-lex.europa.eu/eli/reg/2016/2031/oj/eng |
| **Regl. 2024/3115 (nuo 2025-01-05)** | Augalo pasas gali būti išduodamas ELEKTRONINE forma (Komisijai priėmus įgyvendinimo aktus). Didesni medelynai migruoja iš barkodų į RFID. „The EU built the registry, we build the reader" turi DALINĘ substanciją — bet TIK B2B atsekamumo, ne vartotojų saugos sluoksnyje. | https://www.europarl.europa.eu/thinktank/en/document/EPRS_BRI(2024)753189 |
| **DPP (ESPR 2024/1781)** | Ritasi 2027–2030 beveik visoms kategorijoms, BET gyvi augalai EKSPLICITIŠKAI IŠBRAUKTI. DPP duomenų nešiklis = QR (ne NFC). | (briefing 01); https://blog.st.com/digital-product-passport/ |
| **GPSR 2023/988, 2 str. 2 d. (d)** | Gyvus augalus IŠBRAUKIA iš taikymo srities EKSPLICITIŠKAI (verbatim: „living plants and animals..."). Gyviems augalams NĖRA JOKIO ES vartotojų saugos teisinio kablio; GPSR griežtėjimo banga augalų NELIEČIA pagal dizainą. | https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R0988 |
| **H-R5 falsifikacija** | „Already in discussion at parliamentary level" — NERASTA JOKIŲ ĮRODYMŲ (EP klausimų DB, PETI, Bundestago Drucksachen, LR Seimas). Vienintelis artefaktas — UK e-peticija #639186: **125 parašai iš 10 000, jokio atsako, užsidarė 2023-12-19**. SAKINĮ IŠTRINTI iš vision doc. | https://petition.parliament.uk/petitions/639186 |
| **Žala (kontekstas)** | ES nuodų centrai 2008–2022: 17 636 vaikų kontaktai su kambariniais augalais; DE iki 1/3 <5 m. apsinuodijimų — augalai; gyvūnai 5–11% užklausų. | (briefing 01) |
| **SĄŽININGUMO RIBA** | Valstybės mandato, kurį LapasID „vykdo", NĖRA. Joks įstatymas nereikalauja atskleisti toksiškumo vartotojui. Framing = plyšys/upside, NE mandatas. LapasID NĖRA „DPP augalams". | (briefing 01, REG raportas) |

### 3.2. Rinkos skaičiai

| Faktas | Reikšmė | Šaltinis |
|---|---|---|
| **LT gyvų augalų importas (HS06)** | ~$182M/m (2023), didelė dalis per NL hub'ą (Van Vliet C&C Vilnius/Kaunas, grupės apyvarta €90M) | https://tradingeconomics.com/lithuania/imports/live-trees-plants-bulbs-roots-cut-flowers |
| **LT adresuojama B2B bazė** | ~145 medelynai; ~30 aktyvių gėlių augintojų; top-10 gėlių prekybos įmonių 2022 = €37,4M pajamų / 282 darbuotojai (€1,9–6,2M kiekviena). Realių mokamo B2B kandidatų ~40–60 subjektų. | https://infocloud.lt/didziausios-geliu-prekybos-imones-lietuvoje/ ; https://floramore.lt/medelynai/ |
| **LT kambarinių augalų retail TAM** | Vertinimas (ne statistika): €15–40M/m, beveik visa offline. Tiksli statistika neegzistuoja (OSP turi tik bendrą prekybą). | (LT raportas, MP raportas) |
| **Garden center maržos** | Bruto 60–70% (augalai), neto tik 4–10%, EBITDA 6–12%; shrinkage 5–15% pelno erozija. IT/admin eilutė tik ~5% kaštų. | https://dealstream.com/industry-guides/garden-centers/rules-of-thumb |
| **Garden center POS kaina** | $59–149/mėn (KORONA, Lightspeed nuo $89, Square nuo $60) — kalibruoja H-C2 €15–30/mėn sumą | https://fitsmallbusiness.com/garden-center-pos-systems/ |
| **Etikečių kainų inkaras** | Tuščia plastikinė žyma <$0,02; termo pot-stake ~$0,03; Euroko tyvek €0,035/vnt; custom spausdinta ~$0,11; picture tag ~$0,18. Pardavėjai priešinosi net ~7p paso priedui. Patentuotų veislių tag+royalty $0,25–1+ (TIK premium). | https://www.euroko.eu/plant-labels.html ; https://www.hortweek.com/cost-plant-passport-labelling-requirements-concern-growers/ornamentals/article/1661296 |
| **NFC žymų kainos** | NTAG213 lipdukai EU: €0,65–0,89 @10 vnt → €0,18–0,47 volume; NFC hang-tags €0,95–1,19/vnt mažais kiekiais; Kinija $0,06–0,15 @500 MOQ; inlay floor ~$0,05–0,10 @100K. Encoding: £0,03/žymai + £15 setup. | https://shopnfc.com/en/30-ntag213 ; https://seritag.com/pricelist |
| **Toxicity Dial unit kaštas** | Pilotas 250–1000 vnt: ~€1,0–2,5/vnt (be tooling); 10K vnt: ~€0,75–1,60; 100K: ~€0,35–0,70. Injection mold tooling $3–6K. Marža €0,20–0,50 atsiranda TIK ≥10K vnt ir tik pardavinėjant €1–2/vnt (5–10× inkaras). | (HW raportas §1.2) |
| **Freemium benchmarks** | Download→paid mediana ~2,1–2,2%; hard paywall ~10,7–12,1%; „gera" freemium 3–5%; 4%+ = viršutinis kvartilis. Metinių 12 mėn. retention 50–60%, mėnesinių 20–40%, savaitinių <10%. App D30 retention vidurkis ~5,7%; 48% app'ų ištrinama per 30 d. | https://www.revenuecat.com/state-of-subscription-apps-2025/ |
| **Konkurentų pajamos/kainos** | PictureThis $29,99/m, 100M+ atsisiuntimų, ~$5M/mėn vien US iOS, sezoninis pikas gegužę; PlantIn $6,99/SAVAITĘ, 35M; Planta $35,99/m, 3,3M, ~$300K/mėn; Greg $29,99/m, $5,4M seed; Blossom ~$20/m. | https://app.sensortower.com/overview/1252497129?country=US ; https://appfigures.com/resources/insights/20220610?f=3 |
| **Scan rate realybė** | „43% skenavę QR" = KADA NORS gyvenime (ne per-unit). Pasyvus informacinis QR be vertės pasiūlymo: realistiškai **0,3–2% vienetų**; be stipraus CTA krenta žemiau 0,5%. Pilnas funnel: 10 000 etikečių × 1% × ~10% signup × 3% paid = **0,3 mokančio vartotojo**. | https://www.qr-insights.com/blog/2026-03-19-connected-packaging-cpg-qr-codes-2026 |
| **AI Overviews CTR** | AIO numuša pozicijos-1 CTR iki 58%; informacinių AIO užklausų pozicijos-1 CTR 1,6%; organinis CTR −61%. „Ar X nuodinga katėms" = idealus zero-click taikinys. | https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/ |
| **Google scaled content abuse** | Po 2024-03 update: 837 iš 49 345 svetainių deindeksuotos, 100% turėjo AI turinį. Naujas domenas + šimtai AI puslapių = deindeksacijos profilis. | https://www.searchenginejournal.com/googles-march-2024-core-update-impact-hundreds-of-websites-deindexed/510981/ |
| **Take rate benchmarks** | Vidurkis ~9,2% per ~5000 marketplace, top-10 — 12,4%; Whatnot EU 6,67%; Etsy konsoliduotas 23,3–24,9%; ManoMano €100/mėn + 15–25% (GMV krito €1,24B→€1,0B). LT P2P augalų GMV optimistiškai €0,3–1M/m → @8% = €24–80K net 100% rinkos. | https://www.sharetribe.com/marketplace-glossary/commission-take-rate/ |
| **Augalų ID komoditizuotas** | iNaturalist CV: 109 680 taksonų, 88,7% tikslumas, NEMOKAMAS; Pl@ntNet API 500 ID/d nemokamai; plant ID apps >80% lauke. Atpažinimas = table stakes, ne moat. | https://www.inaturalist.org/blog/107012-new-computer-vision-model |
| **Community-data moat precedentai** | Vivino: 40M+ userių, 1,5 mlrd etikečių foto, 200M atsiliepimų; Strava: 10 mlrd veiklų, 3 trln taškų (B2B Strava Metro). Moat = UGC SLUOKSNIS ant public fakto + agregacija, ne pats faktas. | https://coolhunting.com/food-drink/vivinos-user-compiled-data-catalogs-millions-of-wines/ ; https://a16z.com/the-empty-promise-of-data-moats/ |
| **LT demografija** | 2,7M iki 2030, −33% iki 2100; 60+ → 31% iki 2030; mediana → 53 m. Core demo (25–44 m.) = emigruojanti kohorta. LT TAM ~1%/m traukiasi. | https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Population_projections_in_the_EU |

### 3.3. Licencijų / teisės faktai

| Faktas | Esmė | Šaltinis |
|---|---|---|
| **PFAF = CC BY-NC-SA** | NC = NEKOMERCINĖ — tiesiogiai prieštarauja mokamam produktui. SA = derivatyvai paveldi licenciją. AI vertimas iš NC šaltinio PAVELDI NC. Didžiausia teisinė bomba (pfaf.json 2481 turiningi įrašai). | https://pfaf.org/user/cmspage.aspx?pageid=136 |
| **pre-db = 3 autorinės knygos** | AHS Encyclopedia (2011), Beckett (1995), Cheng (2019) — parafrazuotas turinys, 8178 rūšys. Antra didžiausia bomba. | (03-assets §1) |
| **Faktai NEcopyright'inami** | Saugoma tik IŠRAIŠKA ir kompiliacija. Sprendimas: imk FAKTUS iš public/CC BY šaltinių, rašyk SAVO išraišką. Pakaitalai NEMOKAMI: WCVP (Kew) CC BY 4.0; USDA GRIN US Public Domain (46K+ rūšių); Wikidata CC0; EFSA OpenFoodTox. Remediation ~16–24 d. + €200–500. | https://powo.science.kew.org/about-wcvp ; https://data.nal.usda.gov/dataset/germplasm-resources-information-network-grin |
| **EU TDM išimtis (DSM Art. 4)** | Leidžia komercinį AI treniravimą ant copyright turinio, jei rightholder'is neopt-out'ino machine-readable būdu; LT 1998 žodynas to nepadarė → „AI negali nukopijuoti ne-anglų" SILPNA. | https://knowledgerights21.org/news-story/eu-tdm-exceptions-can-be-used-for-ai/ |
| **AI-vaizdai ES nesaugomi** | Visiškai AI-sugeneruoti vaizdai NESAUGOMI copyright'u (nėra žmogaus autorystės, CJEU originalumo testas). Gemini ToS leidžia komercinį naudojimą, BET „gali negebėti uždrausti kitiems kopijuoti". Akvarelė = identitetas, NE gintinas turtas (H-MO4 teisiškai griūva). | https://www.europarl.europa.eu/thinktank/en/document/EPRS_BRI(2025)782585 ; https://terms.law/ai-output-rights/gemini/ |
| **EU sui-generis database right** | Gali apsaugoti KOMPILIACIJĄ (15 m., „substantial investment"), bet NE pavienius faktus. LT kompiliacijai realus, bet kuklus turtas (H-MO2 dalinai). | https://eur-lex.europa.eu/EN/legal-content/summary/legal-protection-databases.html |

### 3.4. Viešasis finansavimas (kas realu)

| Instrumentas | Verdiktas | Šaltinis |
|---|---|---|
| **InoStartas** (Inovacijų agentūra) | VIENINTELIS realus grant'as: €40–200K, iki 80–85% intensyvumas, +iki €30K patentavimui. Kvietimai planuoti 2026-04 (€5M) ir 2027 (€4M); oversubscription ~3–6×. RIZIKA: Vilniaus apskritis VVL kvietimuose tikėtinai netinkama. | https://inovacijuagentura.lt/site/finansavimo-kvietimai/inostartas.html |
| **Startuok** (ILTE) | PASKOLA, ne dotacija (rinkos sąlygomis); realu tik atsiradus pajamoms. | https://ilte.lt/paslaugos/25/startuok-90 |
| **Horizon Europe CL6** | NE solo: success 10,1–12,2%, konsorciumai, 4–6 mėn. rašymo, >€12K; 2026–27 temose consumer plant safety NĖRA. | https://innovarum.es/en/horizon-europe/horizon-europe-cluster-6-calls-insights-and-recommendations-for-applicants/ |
| **EIC Accelerator** | NE pre-PMF: success <3–6%, ~300 val. paraiškai (neigiama tikėtina vertė). Neiti iki €8K+ MRR. | https://www.strata.team/eic-accelerator-frequently-asked-questions-faq/ |
| **Digital Europe / EUPHRESCO / BŽŪP subsidijos** | Netaikytina (≥5 šalių konsorciumai / nacionalinės institucijos / ūkininkams). | (REG raportas §1.5) |

### 3.5. Founder'io realybės konstantos

- **Tvarus „šalia darbo" biudžetas:** 12–18 val./sav. (gilaus darbo 8–12). >18 val./sav. >3 mėn. =
  paslėptas full-time sprendimas. Burnout = #1 solo žlugimo priežastis (54%; 70% solo žlunga per 2 m.).
- **B2B sales nedeleguotinas:** ~60% B2B kelio valandų NEdeleguotinos AI (sales call'ai darbo
  valandomis); B2C ~75% deleguotina.
- **Pirmas €1K MRR:** 6–12 mėn. nuo monetizacijos įjungimo (kuri ŠIANDIEN neįjungta — Stripe kode
  nėra). 70% micro-SaaS niekada nepasiekia $1K MRR.
- **AI COGS:** Pro €29–39/m vs AI kaštas €6–18/m → marža teigiama TIK su chat per Haiku (5–10× pigiau)
  + soft cap'ai. Lūžis ~10–20 Pro dengia hobio-masto infrastruktūrą (€30–150/mėn <500 userių).
- **Velocity = nuomojama stiprybė:** gyvena Anthropic/Gemini ToS; rate-limit ar kainos pokytis
  perkainoja vienintelį struktūrinį pranašumą.

---

## 4. NUŽUDYTŲ TEIGINIŲ SĄRAŠAS (kill-board)

> Kad ateityje niekas jų neprikeltų. Ž=žudo, S=silpnina, ★=išgyveno sustiprėjęs.

### 4.1. MIRĖ (negrįžtamai, su įrodymais)

- **H-P4/P5 — Toxicity Dial (sukamas NFC žiedas).** €1–2,5/vnt pilotuose; marža tik ≥10K vnt; mold
  $3–6K; jokio precedento „sukamas dial + NFC" consumer rinkoje. Lieka kartoninis volvelle PR
  artefaktas (€500–1200), ne SKU.
- **H-C1 — L1 žymos kaip wedge (€0,20–0,50 marža, „perka nuo 1 dienos").** Etikečių inkaras
  $0,02–0,18; pats V1 pripažino „hobby economics" (D2). €0,20–0,50 precedentas tik premium/patented
  segmente.
- **H-C4 — L4 marketplace 7–10% GMV (Y1–Y3 pajamų eilutė).** LT GMV dugnas @8% = €24–80K net 100%
  rinkos; Vinted 2016 pamoka. Take rate pats OK; bazė ne ta. Lieka kaip OPCIONAS po PL.
- **H-M2 — trajektorija (80 sellers + 4000 users, €280K ARR Y3).** Plačiausiai žudoma (5 lęšiai, 3
  nepriklausomos aritmetikos). 4000 mokančių ÷ 2,2% = ~180K MAU = 6,3% LT populiacijos; Palmstreet
  visoje JAV ~200 aktyvių sellers.
- **H-MO1 — „moat is data nobody else has".** Public faktai; EU TDM; a16z: kaupimas ≠ gintis. 3
  stipriausi „moat" turtai (pfaf, pre-db, lt-names) = licencijuoti/skreipinti faktai iš public.
- **H-MO4/MO5 — „cannot copy / cannot retrofit".** Costa×Greg jau veikia; Plantbeeb sektoriaus mastu
  nuo 2026; AI-vaizdai ES nesaugomi; Joy of Plants QR nemokamai; alignment neegzistuoja kaip teisinė
  kategorija.
- **H-R5 — „parlamentinės diskusijos".** Falsifikuota; UK peticija 125/10000 parašų. IŠTRINTI iš
  vision doc.
- **H-R6 — non-dilutive „realistic capital path".** Horizon/EIC/DigEU/EUPHRESCO/BŽŪP — spąstai solo;
  lieka tik InoStartas (su regiono rizika).
- **H-S1 — „žyma — pamatas" (kaip seka).** Thinfilm bankrotas; Nike Connect mirtis; pamatas =
  /p/{id} (veikia), žyma = upsell/carrier.

### 4.2. SUNKIAI SUŽEISTA / SILPNINTA

- **H-P3 perduodama istorija — „rinkoje unikalu".** Žymos jau parduodamos (Petals £1,20); unikali tik
  istorijos SEMANTIKA (software claim).
- **H-P6 vienas ženklas visiems.** Saugumo požiūriu rizikinga (lelija katei vs žmogui); HTA A/B/C +
  žmonės/gyvūnai atskirai.
- **H-C2 L2 €15–30/mėn.** Suma OK (POS benchmark), bet ornamentals ženklai perkami tik su KANALO
  MANDATU; rišti prie scan'ų. CENTRINIS B2B produktas, bet vertės pagrindo dar nėra.
- **H-C3 lead-gen €2/8/20.** Be closed-loop atribucijos neįmanoma; €20/€60 augalo = 33% > Etsy 24,9%.
  Perdaryti į flat prenumeratą.
- **H-C5 / H-C9 — L5 royalty, memorial monetizacija.** Veikia tik kolekcinėje sub-nišoje; royalty
  reikalauja L4 prieš L5. Memorial — jokio precedento.
- **H-M1 / H-S6 — „tik LT Y1–Y3 / PL Y4".** PL anksčiau (12–18 mėn.); H-M1 ir H-M2 negali būti
  teisingi kartu.
- **H-M3 investuojamumas 18–22 mėn.** Realiau 30–40 mėn. arba full-time.
- **H-M4 NFC funnel „4 sek be paskyros".** Mass-carrier = QR; Greg'ui reikėjo 3 mėn. free premium;
  „4 sek atsakymas" KANIBALIZUOJA registraciją (saugos intencija vienkartinė).
- **H-M5 botanikos sodai launch.** Candide žlugimas → mugės + QR ekspozicija, capas ≤2 val./sav.
- **H-R1/R2/R7 registry-reader, partnerysčių matrica.** Vartotojų kablio nėra; „regulator endorsement"
  mechanizmo LT teisėje nėra (max — neformalus neprieštaravimas). Matricą siaurinti iki: Apsinuodijimų
  biuras, LUBSA/VU sodas, Sodininkų sąjunga.
- **H-MO2 LT duomenys kaip moat.** Skaičiai kuklūs (high-conf LT vardų tik 371, ne 5786); sui-generis
  gina kompiliaciją, ne faktus. Realus, bet kuklus.

### 4.3. IŠGYVENO / SUSTIPRĖJO

- **H-S4 „safety is the wedge" ★ — perrėminta.** Sauga = ACQUISITION (Yuka/Solid Starts), NE pajamos;
  Palmstreet patvirtina app→commerce seką. Tai virsta missijos branduoliu (founder-market fit).
- **H-C5 L5 provenance ★ — gyva nišoje.** Vyno NFC (Böen) — vienintelė įrodyta NFC ekonomika. BET S3
  niša ~dešimtys žmonių; pasas = savideklaracija, ne autentifikacija (ne StockX); provenance saugo
  defliuojantį turtą. Testas, ne strategija.
- **H-MO6 mirtingumo duomuo ★ — siaurąja forma.** Kaip PRODUKTO feature (retention/brand) + unikalus
  TURINYS (SEO) + ĮSIGIJIMO turtas. MIRĖ kaip „moat/B2B dataset" (N aritmetika: ±15 p.p. reikia ~43
  mirčių/rūšiai, ±10 p.p. ~96; Planta surenka LapasID metinį derlių per ~1,3 dienos; self-report
  šališkumas; produkto sėkmė slopina moat'ą).
- **H-S3 marketplace inkrementiškai — su Vinted sąlyga.** Nemonetizuoti supply iki likvidumo.

### 4.4. Meta-aklosios zonos (ką VISI 8 lęšiai pražiūrėjo)

- **PLD 2024/2853 atsakomybė už patį app'ą** (žr. 2.22) — didžiausia nepastebėta rizika.
- **AI COGS nepaskaičiuotas** — kainodaros diskusija be gross margin eilutės = teatras.
- **Pauzės tolerancija (founder dingsta 3 mėn.)** — modeliuota tik val./sav. VIDURKIS, ne DISPERSIJA.
  Vienintelė pauzei tolerantiška strategija — duomuo, kuris kaupiasi pats; B2C su mokančiais =
  nesustabdomi įsipareigojimai.
- **GDPR + vaikai** — „saugumas šeimai" produktas be privatumo analizės (LT Art. 8 riba 14 m.; foto
  EXIF, zonos = namų išplanavimas).
- **Founder'io darbo sutartis** — IP assignment / nekonkuravimo sąlygos nepatikrintos (pigiausia
  due-diligence skylė).
- **Konsiliumo meta-akloji zona:** 8 lęšiai = 1 modelis su 8 kepurėmis → KORELIUOTOS klaidos. „6
  lęšių konvergencija į S2" yra silpnesnis įrodymas, nei atrodo (6 to paties liudininko parafrazės).
  Praktinė pasekmė: sprendimo TAISYKLES (3+/5 pasirašo) laikyti šventomis; konvergenciją diskontuoti.

---

## 5. PROCESINĖ PASTABA — kaip atgaminti tokį konsiliumą

1. **Briefing book pirma.** Trys failai, kuriuos VISI agentai skaito: (a) teiginių inventorius kaip
   FALSIFIKUOJAMOS hipotezės (ne naratyvas); (b) SĄŽININGAS turto inventorius iš kodo/duomenų (ne iš
   vizijos); (c) kalibracija + verifikuoti faktai + ankstesnio darbo išvados.
2. **Lygiagretūs nepriklausomi lęšiai.** Kiekvienas agentas — sava ekspertizės kepurė, PRIVALOMAS web
   research su URL, konkretu iki skaičių ir pavadinimų. Reikalauti: galimybių žemėlapis + 3 strategijos
   + kill-list (kuriuos H-* griauna) + top-5 neapibrėžtumai (pigiausi testai) + šaltiniai.
3. **Sintezė tarp fazių.** Vienas agentas suveda: konsensusai (kur 3+ lęšiai sutaria), konfliktai
   (su sprendimo mechanizmu), kill-board, ryškėjančios strategijos, pigiausi testai. SVARBU:
   sekretorius privalo įvardyti, kur konsiliumas gali MELUOTI SAU (saviapgaulės vietos).
4. **Adversarinė raudonoji komanda.** Atskiri agentai atakuoja IŠGYVENUSIUS teiginius + patį
   konsiliumą. Technika: PRE-MORTEM („2028, žlugo, kaip?") atskleidžia single-point-of-failure;
   ribotas web research tik kill-shot verifikacijai; sąžiningas „išgyvenusiųjų sąrašas".
5. **Sprendimo rėmas, ne dar strategijos.** Finalas — ne „2-3 naujos strategijos", o realūs žaidimai
   su sprendimo TAISYKLĖMIS (kas patvirtina/žudo, ką founder duomenys jau sako). Vertinti pagal
   founder'io TIKRĄ kartelę (čia: pelningas-laiko-atžvilgiu + mylimas + naudingas visuomenei, NE
   venture) — netinkama liniuotė nužudo gyvus dalykus.

**Pamoka apie patį metodą:** vertingiausi artefaktai — TESTAI su realybės kontaktu ir KILL-BOARD,
ne strategijos. Strategijų konvergencija tarp modelių-agentų yra trapesnė nei atrodo (koreliuotos
klaidos). Founder'io kartelės patikslinimas (32) pakeitė pusės kill-board'o reikšmę — KALIBRACIJA
yra svertinis taškas.
