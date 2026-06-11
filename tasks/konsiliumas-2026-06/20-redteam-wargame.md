# Raudonosios komandos war-game — konkurenciniai ėjimai

**Taikinys:** konsiliumo prielaida, kad LapasID turi gintiną poziciją prieš konkurentus per LT lokalizaciją, instancijos pasą, seller santykius ir mirtingumo duomenis. Žaidžiu UŽ priešus — po vieną ėjimą kiekvienam, su kaštu, laiku, tikimybe ir vienu klausimu: *ko LapasID negali nukopijuoti atgal.*

Šaltiniai, kuriais remiuosi: 11-sinteze (K-8, KF-7, kill-board H-MO4/MO5/MO6, netikėtumai 1–3, 12), 10-consumer (§1.6 Costa×Greg, §1.2 Yuka), 10-b2b (§1.3 Plantbeeb×Floramedia+GS1 2027, §1.5 LT bazė), 10-marketplace (§1.3 augaluturgus.lt 50 waitlist, Palmstreet anatomija), 10-lt-rinka (§1.3 Žalia stotelė nuosava app). Web-verifikacija: PictureThis kalbos, Decorum/NL augintojai, Plantbeeb GS1 timeline.

---

## 1. PRE-MORTEM — 2028, LapasID kaip *savarankiškas produktas* nustojo augęs

Ne staigus žlugimas. Lėtas užspaudimas iš keturių pusių vienu metu, ir nė vienas atskirai nebuvo mirtinas — bet jie atėjo per tuos pačius 18 mėn., kol founder'is solo šalia darbo testavo scan rate ir seller WTP.

**Grandinė, žingsnis po žingsnio:**

1. **2027 Q1 — kanalas užimtas iš viršaus.** Plantbeeb×Floramedia QR (sektoriaus mastu nuo 2026, GS1 dinaminis QR 2027) atvažiuoja į LT ant tos pačios olandų etiketės, kuria atkeliauja augalai — per Van Vliet C&C Vilnių/Kauną. LT seller'iui dabar „QR ant augalo" jau yra *defaultas iš tiekėjo*, nemokamai, be jokio pokalbio su LapasID. LapasID pardavimo pitch'as „uždėkime jums QR" netenka naujumo — seller atsako „jau turiu".

2. **2027 Q2 — consumer wedge nukopijuotas per sprintą.** PictureThis (jau 28 kalbos, įsk. lenkų; LT *nėra* — bet tai vieno lokalizacijos sprinto klausimas) prideda LT UI ir iškelia toksiškumą iš už paywall'o į free tier kaip retention feature. „Toksiškumas nemokamai LT kalba" — vienintelė LapasID consumer diferenciacija — nustoja egzistuoti per vieną release'ą. 100M+ atsisiuntimų distribucija prieš LapasID SEO puslapius.

3. **2027 Q3 — vietinis žaidėjas pasiima B2B distribuciją.** Žalia stotelė (jau turi nuosavą app) arba Senukai/Ermitažas su vietine skaitmenine agentūra paleidžia „savo" QR sluoksnį ant savų augalų. Jiems nereikia LapasID — jie *yra* kanalas, o kanalas nesidalina maržа su infrastruktūros tiekėju, kurį gali pasamdyti už fiksuotą sumą.

4. **2027 Q4 — marketplace niša uždaryta.** augaluturgus.lt (jau 50+ waitlist, 750 augalų enciklopedija) arba FB grupių formalizacija pasiima kolekcinę nišą pirmas. LapasID „pasas kaip provenance" lieka be transakcijų srauto, ant kurio jis turėtų prasmę.

5. **2028 — founder'io fizika.** Po 18 mėn. po 15+ val./sav. šalia darbo, scan rate pasirodė <1%, seller WTP be GMV įrodymo — nulis (KF-7 sugriuvo blogąja kryptimi). Lieka S1 su €20–35K ARR lubomis — gyvybės palaikymas, ne verslas. Burnout (54% solo žlugimo priežastis). Projektas neformaliai įšaldomas. **Vienintelis turtas, kuris nemirė — deathReason/lesson dataset — bet jis taip ir liko 4000 įrašų, per mažas rūšies-lygio statistikai, ir niekas jo nenupirko, nes pipeline'o B2B sluoksniui taip ir neatsirado.**

Esmė: LapasID nežuvo nuo vieno priešo. Jis žuvo nuo to, kad **kiekvienas jo sluoksnis buvo kopijuojamas pigiau nei jis pats jį kūrė**, o vienintelis nekopijuojamas sluoksnis (mirtingumo duomenys) augo lėčiau, nei užsidarė langai.

---

## 2. ATAKOS — ėjimas už kiekvieną priešą

### Ataka A — Floramedia/Plantbeeb QR per Van Vliet 2027

**Atakuoju:** K-8 ir B2B V-A prielaidą, kad LT lokalizacija + instancijos pasas yra pakankama užtvara prieš sektoriaus QR bangą.

**Priešo ėjimas:** Floramedia (Europos etikečių lyderis) jau deda Plantbeeb QR sektoriaus mastu nuo 2026; GS1 dinaminis QR 2027 ([bpnieuws](https://www.bpnieuws.nl/article/9804761/met-deze-stap-maken-we-digitale-plantinformatie-schaalbaar-voor-de-hele-keten/)). Į LT jie *neateina kaip įmonė* — jie atvažiuoja kaip **savybė ant etiketės**, kurią olandų augalas jau turi, kai pasiekia Van Vliet C&C Vilnių. Priešui tai kainuoja €0 papildomai į LT (pakopa jau eksportuojama kartu su augalu); laikas — automatinis su importo srautu; tikimybė — **labai aukšta (80%+)**, nes nereikalauja jokio LT-specifinio sprendimo.

**Ko LapasID negali nukopijuoti atgal:** Plantbeeb turi *produkto-lygio* (rūšies) info per visą NL eksporto grandinę — masto, kurio LapasID solo niekada nepasieks. LapasID negali nukopijuoti tiekimo grandinės pozicijos.

**Išgyveno ar krito:** *Dalinai išgyveno.* Plantbeeb duoda rūšies info; LapasID instancijos pasas (šito augalo istorija + perdavimas + LT toksiškumo kuracija) yra realus skirtumas, kurio Plantbeeb pagal dizainą neturi. **BET** užtvara veikia tik tame segmente, kur instancijos istorija turi vertę — t.y. NE ant masinio €3 augalo (ten Plantbeeb laimi nemokamai), o tik ant €15+ kolekcinio (S3). **Vietoj „LT lokalizacija = užtvara" lieka: instancijos pasas užtvara TIK premium nišoje; masinis segmentas pralaimėtas dar nepradėjus.** Tai vėluojanti mirtis masiniame B2B — ne mirtis nišoje.

### Ataka B — PictureThis prideda LT + toksiškumą per sprintą

**Atakuoju:** consumer §1.6 ir H-S4 perrėmimą („sauga = acquisition wedge"), kiek jis suponuoja, kad LapasID turi laiko tą wedge'ą paversti įpročiu.

**Priešo ėjimas:** PictureThis lokalizuotas į 28 kalbas (įsk. lenkų), bet **ne lietuvių** ([App Store](https://apps.apple.com/us/app/picturethis-plant-identifier/id1252497129)). CS teigė, kad LT + toksiškumas free tier — trivialu, ir tai teisinga: Glority lokalizuoja rutiniškai, toksiškumą jau turi DB (tik už paywall). Kaštas priešui: vienas lokalizacijos + feature-flag sprintas (~€10–30K, savaitės). Tikimybė, kad jie tai padarys *būtent dėl LapasID*: **žema (~15%)** — LapasID per mažas, kad patektų į Glority radarą. Tikimybė, kad jie tai padarys *šiaip, plėsdami EU* per 24 mėn.: **vidutinė-aukšta (~50%)**.

**Ko LapasID negali nukopijuoti atgal:** 100M+ atsisiuntimų, Apple Search Ads kanalą, $5M/mėn vien US iOS pajamų, ID modelį treniruotą ant masyvių datasetų. LapasID kaip PWA neturi App Store paieškos kanalo iš viso.

**Išgyveno ar krito:** *Krito kaip diferenciacija, išgyveno kaip pozicionavimas.* Jei PictureThis prideda LT+toksiškumą, „nemokama LT toksiškumo DB" nustoja būti unikalus. BET: (1) PictureThis žinomas dėl dark patterns (auto-charge, sunkus cancel — JustUseApp skundai) — lieka „sąžiningo LT produkto" pozicija; (2) PictureThis *neturi* instancijos paso, care istorijos, deathReason; (3) jų toksiškumas — generinis, ne LT-kuruotas (katės/vaikai/LT augalų vardai). **Vietoj „toksiškumas = wedge" lieka: toksiškumas = SEO acquisition vartai su trumpu galiojimo laiku; reikia jį konvertuoti į care įprotį GREIČIAU, nei Glority lokalizuojasi.** Tai paverčia greitį egzistenciniu, ne strateginiu klausimu. Saviapgaulės vieta #2 (sekretoriaus pastaba — „ar LT vartotojas iš viso moka") čia tampa dvigubai aštri: jei wedge'as turi galiojimo laiką, o monetizacija neįrodyta — langas dar siauresnis.

### Ataka C — Greg/Planta kopijuoja Costa modelį EU su dideliu augintoju

**Atakuoju:** K-8 ir netikėtumą #2 — kiek Costa×Greg yra „social proof LT pardavimams" vs tiesioginė grėsmė.

**Priešo ėjimas — kas būtų EU Costa atitikmuo?** Tai centrinis klausimas, ir atsakymas egzistuoja: **Decorum** (76 pirmaujančių NL augintojų rinkodaros/pardavimų organizacija) arba **Royal FloraHolland** ekosistema (€5,4 mlrd apyvarta) — abu turi mastą ir bendrą prekės ženklą, kurio reikia „EU Costa" vaidmeniui ([floraldaily — Decorum/JoGrow](https://www.floraldaily.com/article/9006887/nl-tropical-plant-grower-specialized-in-particular-species-and-cultivars/)). Greg jau turi „Partner with Greg" programą ([greg.app/partners](https://greg.app/partners/)). Ėjimas: Greg/Planta pasirašo su Decorum → QR ant 76 augintojų etikečių → free premium aktyvacija → care app default'as visoje NL eksporto grandinėje, kuri *teka per Van Vliet į LT*. Kaštas: partnerystės BD, ne kapitalas. Laikas: 6–12 mėn. Tikimybė per 24 mėn.: **vidutinė (~35%)** — Greg monetizacija silpna, jiems EU plėtra logiška.

**Ko LapasID negali nukopijuoti atgal:** $5,4M seed kapitalą, ML care modelį, ir — kritiškai — *prieigą prie NL augintojų konsorciumo*. Jei Greg×Decorum įvyksta, tas pats QR+app srautas, kuris atvažiuoja į LT per importą, jau turi care app pririštą. LapasID atsiduria toje pačioje vietoje kaip Ataka A, tik dar ir su consumer app sluoksniu pridėtu.

**Išgyveno ar krito:** *Krito „social proof" framing'as.* Konsiliumas Costa×Greg laikė įrodymu „modelis veikia, sellers tai daro" (gerai LapasID pardavimui). Raudonoji versija: tas pats precedentas reiškia, kad **rinkos lyderis su kapitalu gali atvažiuoti į LT ant importo srauto su jau-veikiančiu app sluoksniu — ir LapasID neturi nei kapitalo, nei augintojų konsorciumo atsakui.** Lieka: Costa×Greg yra ne social proof, o *grėsmės šablonas*. Vienintelis LapasID atsakas — būti per mažam ir per lokaliam, kad apsimokėtų juos pulti (žr. išgyvenusius).

### Ataka D — Žalia stotelė / Senukai / Ermitažas pasidaro savo QR sluoksnį su vietine agentūra

**Atakuoju:** seller-santykių moat (K-8) ir prielaidą, kad seller'iui reikia LapasID kaip infrastruktūros tiekėjo.

**Priešo ėjimas:** Žalia stotelė *jau turi nuosavą app* (lt.zaliastotele.app — skaitmeninio apetito įrodymas, 10-lt-rinka §1.3). Senukai (83 parduotuvės) ir Ermitažas turi IT biudžetus ir vietines agentūras. Ėjimas: bet kuris jų užsako QR→landing page sluoksnį iš LT skaitmeninės agentūros už €5–15K vienkartinai + €200–500/mėn priežiūrai. Jiems tai *pigiau ir labiau kontroliuojama* nei mokėti LapasID €15–30/mėn už seller + atiduoti consumer santykį trečiai šaliai. Kaštas: €5–15K. Laikas: 2–3 mėn. Tikimybė didžiausiems žaidėjams per 24 mėn.: **vidutinė (~30%)**; Žalia stotelei (jau pradėjusiai) — **aukštesnė**.

**Ko LapasID negali nukopijuoti atgal:** Senukų/Ermitažo *fizinę distribuciją* (83+ parduotuvės), pirkėjų srautą, prekės ženklo pasitikėjimą. Stambus retaileris yra kanalas — o kanalas struktūriškai nenori būti priklausomas nuo infrastruktūros tiekėjo, kurį gali pakeisti agentūra.

**Išgyveno ar krito:** *Krito „seller santykiai = moat" stambiems žaidėjams.* Stambus seller'is su biudžetu pasidaro pats. **BET** — ir tai svarbu — Senukams/Ermitažui augalų QR yra 0,5% jų verslo; jie to *neprioritizuoja*, todėl tikimybė vidutinė, ne aukšta. Vietoj „seller santykiai = universalus moat" lieka: **moat veikia TIK su smulkiais/nišiniais seller'iais (Leaf Place, kolekciniai medelynai), kuriems nuosava agentūra per brangu, o LapasID infrastruktūra — vienintelė prieinama.** Tai tas pats premium-nišos atsitraukimas kaip Atakoje A. Stambusis B2B segmentas (kur ir yra mastas H-M2) — pralaimėtas dviem kryptimis: arba Plantbeeb nemokamai, arba retaileris pats.

### Ataka E — augaluturgus.lt ar kitas LT žaidėjas pasiima marketplace nišą pirmas

**Atakuoju:** H-S3/S3 strategiją (marketplace inkrementiškai) ir provenance-nišos prielaidą (10-marketplace V-B).

**Priešo ėjimas:** augaluturgus.lt jau turi 50+ waitlist ir 750 augalų enciklopediją (10-marketplace §1.3) — jie *jau renka LT paklausą*. Ėjimas: jie paleidžia P2P marketplace su Stripe Connect prieš LapasID. Arba FB grupė („Kambariniai augalai – pardavinėjimas") formalizuojasi su admin'o sukurtu botu/Vinted-stiliaus sluoksniu. Kaštas: €0–10K. Laikas: 3–6 mėn. Tikimybė: **žema-vidutinė (~25%)** — bet KRITIŠKA: nišai reikia tik VIENO laimėtojo (likvidumo monopolis), ir LapasID čia *ne pirmas*.

**Ko LapasID negali nukopijuoti atgal:** likvidumo pirmumą. Jei augaluturgus pasiekia kritinę masę kolekcinėje nišoje pirmas, antras žaidėjas (LapasID) susiduria su cold-start prieš jau-likvidų konkurentą — tai beveik nelaimimas mūšis (Blossm mirė net 100× didesnėje JAV rinkoje be likvidumo).

**Išgyveno ar krito:** *Išgyveno — bet tik todėl, kad niša gali būti per maža net augaluturgui.* LT P2P augalų GMV optimistiškai €0,3–1M/metus (10-marketplace §1.4); augaluturgaus 50 waitlist po viešo landing'o yra *empirinis šalčio signalas*. Jei niša per maža LapasID — ji per maža ir augaluturgui. **Vietoj „LapasID pasiims marketplace" lieka: marketplace nepasiims NIEKAS, nes LT bazė per maža bet kam; tikras klausimas — ne kas laimės, o ar verta žaisti.** Marketplace išgyvena tik kaip H-P3/P10 *įrodymo poligonas* (parduoda ar pasas kelia kainą), ne kaip pajamų eilutė. Atakos rezultatas paradoksalus: priešas E negriauna LapasID — abu griūva ant tos pačios aritmetikos.

---

## 3. KO KONSILIUMAS NEPAMATĖ — 4 aklosios zonos iš war-game kampo

**AZ-1. Visi keturi B2B/QR priešai atvažiuoja per TĄ PATĮ Van Vliet importo srautą — tai vienas atakos vektorius, ne keturi.** Konsiliumas Plantbeeb, Costa×Greg, ir stambius retailerius nagrinėjo atskirai. Bet jie visi materializuojasi LT'oje per olandų importo grandinę. Tai reiškia: **viena gynybinė pozicija turi atlaikyti visus tris vienu metu**, ir ta pozicija negali būti „QR ant augalo" (visi tai turės). Vienintelė pozicija, kuri nepriklauso nuo importo srauto — *vietinė instancijos istorija po pirkimo* (augalas jau LT'oje, jau pas vartotoją). Tai perkelia visą gynybą iš B2B/pardavimo taško į B2C/po-pirkimo tašką — o ten monetizacija neįrodyta. Konsiliumas neįvardijo, kad importo srautas yra *bendras* visų B2B priešų vektorius.

**AZ-2. „Ko LapasID negali nukopijuoti atgal" yra simetriška problema, ir konsiliumas žiūrėjo tik viena kryptimi.** K-8 sako „cannot copy klaidinga, tikras moat = LT kuracija + seller santykiai + elgsenos duomenys". Bet kiekvienoje atakoje paaiškėja: tai, ko priešas negali nukopijuoti iš LapasID (LT kuracija, smulkūs seller santykiai) yra *mažos vertės* dalykai; o tai, ko LapasID negali nukopijuoti iš priešų (importo grandinės pozicija, 100M distribucija, kapitalas, augintojų konsorciumai) yra *didelės vertės*. **Moat'o asimetrija nepalanki: LapasID gina pilį, kurios sienos saugo kiemą, o ne lobyną.** Konsiliumas matavo „ar mus gali nukopijuoti", bet ne „ar tai, kas nekopijuojama, apskritai vertinga".

**AZ-3. Acquisition scenarijus konsiliume neegzistuoja kaip outcome — o jis gali būti GERIAUSIAS outcome, ir keičia visą strategiją.** Kill-board ir strategijos S1–S5 visos suka apie organišką augimą/monetizaciją. Niekur nesvarstoma: kas ir kodėl pirktų LapasID, ir kada exit yra teisingas tikslas (žr. §5). Tai svarbu, nes jei geriausias outcome yra acquisition, tai **mirtingumo dataset (H-MO6) ir LT kuracija įgyja vertę ne kaip pajamų variklis, o kaip įsigijimo turtas** — ir tada strategija turi optimizuoti *dataset'o unikalumą ir švarią teisinę nuosavybę*, ne ARR. Konsiliumas optimizavo neteisingą kintamąjį, jei exit yra realus kelias.

**AZ-4. Niekas nepaklausė: ar LapasID gali tapti Plantbeeb TIEKĖJU, o ne konkurentu.** Visos atakos suponuoja galvą-prieš-galvą. Bet Plantbeeb turi rūšies-info, neturi LT toksiškumo kuracijos ir instancijos paso. **Jei priešas A yra neišvengiamas (80%+), racionaliausias LapasID ėjimas gali būti ne kovoti, o tapti LT-lokalizacijos/toksiškumo data-sluoksniu Plantbeeb QR'ams** — licencijuoti savo kuraciją tam, kas laimi kanalą. Konsiliumas matė Plantbeeb tik kaip grėsmę, ne kaip galimą pirkėją/partnerį. Tai jungiasi su §5.

---

## 4. IŠGYVENUSIŲJŲ SĄRAŠAS — kas atlaikė geriausią smūgį

1. **Instancijos pasas premium nišoje (S3, H-C5 ★).** Atlaikė atakas A ir D. Plantbeeb (rūšies-info) ir stambūs retaileriai (savas QR) pagal dizainą neturi šito konkretaus augalo istorijos + perdavimo. Niša maža, bet užtvara *reali* — vienintelė vieta, kur „cannot copy" lieka tiesa. **Sąžiningai: tvirta, bet siaura. Tai įvažiavimas, ne destinacija.**

2. **deathReason/lesson/diedDate dataset (K-10, H-MO6 ★) — kaip ĮSIGIJIMO turtas, ne pajamų variklis.** Nė viena ataka jo nesunaikino, nes nė vienas priešas jo nerenka (struktūruoto rūšies-lygio mirtingumo dataseto pasaulyje nėra). Bet jis išgyveno *kitokia forma nei konsiliumas manė*: ne kaip B2B retention pajamos (tam reikia masto, kurio LT neduoda), o kaip **unikalus data turtas, kurį PictureThis/Greg/Planta norėtų nusipirkti** (žr. §5). Konsiliumo saviapgaulės pastaba #3 teisinga — jis neegzistuoja kaip pipeline — bet *jei* instrumentuojamas, jis yra vienintelis turtas, kuris auga atsparesnis, o ne silpnesnis kiekvienai atakai.

3. **„Per mažas, kad apsimokėtų pulti" — netyčinė gynyba.** Atakos B, C, E visos turėjo žemą tikimybę *būtent dėl LapasID* (ne dėl gynybos, o dėl nereikšmingumo). Tai realus, nors ir žeminantis, išgyvenimo faktorius: LT-only niša per maža Glority/Greg radarui. **Sąžiningai: tai veikia tik tol, kol LapasID lieka mažas — o tai prieštarauja augimo ambicijai. Gynyba, kuri dingsta sėkmės atveju.**

Nepateko į sąrašą (krito): masinis B2B QR moat (Ataka A+D dviem kryptimis), toksiškumas kaip diferenciacija (Ataka B), marketplace kaip pajamos (Ataka E — bet ir priešas krito), „seller santykiai" stambiems (Ataka D), Costa×Greg kaip raminantis social proof (Ataka C — apverstas į grėsmės šabloną).

---

## 5. ACQUISITION SCENARIJUS — kas, kodėl, kada (konsiliumo akloji zona AZ-3)

**Kas pirktų LapasID ir kodėl:**

| Pirkėjas | Motyvas | Ką perka | Tikimybė |
|---|---|---|---|
| **Plantbeeb / Floramedia** | Jiems reikia LT/Baltijos lokalizacijos + toksiškumo kuracijos sluoksnio savo QR'ams; pigiau nusipirkti nei sukurti | LT data kuraciją, instancijos-paso tech, vietinį seller tinklą | Vidutinė — strateginis tinkamumas geriausias |
| **PictureThis (Glority)** | Eliminuoti būsimą EU/Baltijos konkurentą + įsigyti deathReason dataset (jo neturi niekas) | Mirtingumo dataset, LT vartotojų bazę | Žema — per smulku jiems, nebent dataset unikalumas įrodytas |
| **Greg / Planta** | EU plėtra reikalauja vietinio data+lokalizacijos; care intelligence iš mirtingumo duomenų | deathReason flywheel, EU compliance tech | Žema-vidutinė |
| **Pigu / PHH Group** | Marketplace vertikalės data sluoksnis; augalų kategorijos enrichment | Katalogą, pasą kaip trust artefaktą | Žema |

**Kada acquisition yra GERIAUSIAS outcome:** kai (a) Ataka A materializuojasi (Plantbeeb LT'oje 2027) IR (b) deathReason dataset pasiekia įrodomą unikalumą (instrumentuotas, ~12–18 mėn. kaupimo) IR (c) teisinis pamatas išvalytas (data-ai-moat §5 planas — be NC/copyright bombų, kitaip due diligence nužudo sandorį). Tada LapasID parduoda *tai, ko negali nukopijuoti niekas* (LT kuracija + mirtingumo signalas) tam, *kas jau laimėjo kanalą* — užuot bandęs tą kanalą atkovoti su solo bandwidth.

**Strateginė implikacija, kurios konsiliumas nepadarė:** jei exit per Plantbeeb/Glority yra realiausias geras outcome, tai keičia prioritetus — **#1 darbas tampa ne scan-rate testas, o (1) deathReason pipeline'o instrumentavimas ir (2) teisinio pamato išvalymas.** Tie du dalykai vienu metu yra ir organiško moat'o pamatas, ir vienintelis turtas, kurį verta įsigyti. Tai sutampa su data-ai-moat rekomendacija B+A, bet iš visiškai kitos priežasties: ne „kad augtume", o „kad būtų ką parduoti, kai langai užsidarys".

---

## Santrauka raudonosios komandos vadui

War-game išvada: LapasID konkurencinė pozicija yra **siauresnė nei konsiliumas manė** — gina kiemą, ne lobyną.
