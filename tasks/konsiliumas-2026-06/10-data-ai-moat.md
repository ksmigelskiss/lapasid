I have comprehensive research across all angles. Now I'll synthesize the deliverable.

# Data/AI moat ir duomenų teisių strategija — LapasID konsiliumas 2026-06

*Lęšis: kuris duomuo KAUPIASI ir nekopijuojamas, ir kaip išvalyti teisinį pamatą. Visi skaičiai su šaltiniais.*

---

## 1. Galimybių žemėlapis iš mano lentos

### 1.1. Atpažinimas NEBĖRA moat — jis komoditizuotas iki nulio

- **iNaturalist v2.25 modelis: 109 680 taksonų, 88,7% vidutinis tikslumas**, treniruotas ant 200M+ stebėjimų — ir tai NEMOKAMAS, atviras CV modelis ([iNaturalist blog](https://www.inaturalist.org/blog/107012-new-computer-vision-model), [BioScience 2025](https://academic.oup.com/bioscience/article/75/11/953/8185761)).
- **Pl@ntNet API: 500 identifikacijų/dieną NEMOKAMAI**; iNaturalist, PlantNet ir Flora Incognita >80% tikslumas miesto floros lauko testuose ([Pl@ntNet pricing](https://my.plantnet.org/pricing), [tandfonline 2025](https://www.tandfonline.com/doi/full/10.1080/17550874.2025.2476938)).
- **PictureThis 30M+ vartotojų, „98% tikslumas", 400 000+ rūšių DB** — komercinis lyderis jau turi nukopijuojamą šios kategorijos moat ([App Store](https://apps.apple.com/us/app/picturethis-plant-identifier/id1252497129)).
- GPT-4o ligų diagnostikai tik 56% — generalistai dar prastesni nei specializuoti, BET kategorija lenktyniauja į apačią ([online-rpd.org](https://www.online-rpd.org/journal/view.php?number=1837)).

**Išvada:** atpažinimas yra „table stakes", ne diferencijuojantis turtas. H-P8 7-pakopų pipeline yra kaštų optimizacija, ne moat. Nei vienas LapasID euras neturi gintis ant „mes geriau atpažįstam".

### 1.2. a16z taisyklė: kaupimas ≠ gintis. Tik 5 sąlygos duoda realų moat

a16z „The Empty Promise of Data Moats": duomuo gintinas TIK kai (1) šaltinis ekskliuzyvus/reguliuotas, (2) supranti, kur domene koncentruojasi vertė, (3) marginalus tikslumas dramatiškai keičia produkto gyvybingumą, (4) kokybė/gylis sunkiai kopijuojami, (5) first-mover sudėtingumas įaugęs į produktą ([a16z](https://a16z.com/the-empty-promise-of-data-moats/)). Perishability faktoriai: diminishing returns, staleness, competitive erosion. **Vien turėjimas — ne moat.**

### 1.3. Community-data moat precedentai — KAS realiai kaupėsi

| Platforma | Kaupiamas nekopijuojamas sluoksnis | Skaičius |
|---|---|---|
| **Vivino** | UGC etiketės + reitingai + nuotraukos | 40M+ vartotojų, **1,5 mlrd. etikečių foto, 200M atsiliepimų, 10M vynų**; vartotojai 2011–15 įvertino 1,4M vynų vs ekspertai 370K ([CoolHunting](https://coolhunting.com/food-drink/vivinos-user-compiled-data-catalogs-millions-of-wines/), [arXiv](https://arxiv.org/pdf/1804.10982)) |
| **iNaturalist** | Research-grade stebėjimai su geo + bendruomenės konsensusas | **200M+ stebėjimų, 3,3M stebėtojų** ([BioScience](https://academic.oup.com/bioscience/article/75/11/953/8185761)) |
| **Strava** | Aktyvumo pėdsakai → segmentai + heatmap | **10 mlrd. veiklų, 3 trln. lokacijos taškų**; iš to high-margin B2B (Strava Metro miestų planuotojams) ([businessmodelcanvas](https://businessmodelcanvastemplate.com/blogs/how-it-works/strava-how-it-works)) |

**Pamoka visoms trims:** moat NĖRA pirminis faktas (vyno pavadinimas, rūšies vardas, GPS koordinatė) — tai PUBLIC. Moat yra **vartotojų UGC sluoksnis ant fakto** (reitingas, konsensuso ID, segmento laikas) + **agregacija į B2B produktą**. Strava net pardavinėja agreguotą sluoksnį atskirai.

### 1.4. LapasID realiai retas duomuo — TIK VIENAS

Iš 03-assets §3 patikra prieš pasaulį:

- **`deathReason` + `lesson` + `diedDate`** — „niekas pasaulyje šito nerenka". Patvirtinta: >80% kambarinių augalų miršta dėl neteisingo laistymo, BET **nėra struktūruoto rūšies-lygio mirtingumo priežasčių dataseto** — tik blog'ų anekdotai ([farmfoodfamily](https://farmfoodfamily.com/common-reasons-houseplants-fail/), [Quora](https://www.quora.com/Is-over-watering-one-of-the-primary-reasons-for-the-death-of-indoor-plants)). Tai vienintelis LapasID turtas, atitinkantis a16z sąlygą #1 (ekskliuzyvus šaltinis) + #3 (marginalus tikslumas keičia produktą — „nelaistyk X kas savaitę, jis nuo to miršta").
- **Care outcomes** (laistymo intervalai × rezultatas per rūšį) — per-augalą renkama, **pipeline'o nėra** (§3). Tai antras kandidatas, bet kol nesukauptas N, jo nėra.
- **Lokalus LT asortimentas** (1029 SKU Geliustebuklai) + **LT kalba** — reti, bet trapūs: 1998 m. žodynas publikuotas, LLM LT vertimą generuoja neblogai (vidinė įtampa #7 teisinga).

**Visi kiti „moat" turtai (pfaf, pre-db, ASPCA) — licencijuoti/skreipinti faktai, kuriuos bet kas atkartos iš tų pačių public šaltinių.** Jie NĖRA moat; jie yra teisinis įsipareigojimas (žr. §3 kill-list).

---

## 2. Trys strategijos variantai (mano lęšiu)

### Variantas A — „Mirtingumo registras" (single-asset moat play)

- **Wedge:** vienintelis nekopijuojamas duomuo = `deathReason`/`lesson`. Padaryk jį PRODUKTU: kai augalas miršta, app prašo priežasties (jau renkama!), agreguoja į rūšies-lygio įspėjimus („Calathea: 38% mūsų vartotojų prarado dėl perlaistymo žiemą").
- **Seka:** (1) instrumentuok renkamus death events → rūšies agregatas; (2) rodyk „Bendruomenės pamoka" ant care kortelės (į tai jau eina PlantCareCard darbas); (3) kai N pakanka, tai tampa care prognozės tikslumo šaltiniu — uždaras flywheel kaip Vivino/Strava.
- **Pajamų modelis:** B2C Pro (care intelligence kaip premium), vėliau agreguoto sluoksnio licencija sellers'iams/augintojams (kaip Strava Metro — „kurios jūsų parduodamos rūšys daugiausia grįžta/miršta").
- **Reikalauja iš founder'io:** mažai kapitalo; ~5–8 val./sav.; instrumentacija + agregacijos pipeline (1–2 sav. solo+AI). NE full-time.
- **Rizika:** cold-start — mirtingumo duomuo kaupiasi LĖTAI (reikia tūkstančių augalų gyvavimo ciklų). Moat realus tik per 18–24 mėn. Iki tol — pažadas, ne turtas.

### Variantas B — „Švarus pamatas pirma" (de-risk, tada augink)

- **Wedge:** teisinio pamato išvalymas (žr. §3 planą) PRIEŠ bet kokią monetizaciją — pakeisk pfaf/pre-db/ASPCA komercinei-saugiai bazei. Tada laisvai monetizuok.
- **Seka:** (1) migruok taksonomijos backbone į WCVP/GBIF CC BY; (2) toksiškumą perstatyk ant pirminių public-domain šaltinių; (3) PFAF NC turinį izoliuok/išmesk; (4) tik tada jungsk mokėjimus.
- **Pajamų modelis:** bet koks — pamatas nebevaržo NC licencijos.
- **Reikalauja:** ~40–60 val. vienkartinio remediation darbo (solo+AI: 2–3 sav.), ~€0–500 teisinei konsultacijai. NE full-time.
- **Rizika:** tai higiena, ne augimas — pats savaime nepritraukia vartotojų. Bet be jo VISKAS kita stovi ant teisinės bombos (30MB NC duomenų jau bundle'inami klientui — žr. §3).

### Variantas C — „UGC sluoksnis ant public faktų" (Vivino modelis augalams)

- **Wedge:** nustok ginti faktų bazę (ji public), pradėk kaupti UGC ant jos — vartotojų nuotraukos, care log'ai, „kas suveikė", lokalios pastabos. Tai Vivino/iNaturalist žaidimas.
- **Seka:** public taksonomija (CC BY) + LapasID UGC sluoksnis (nuotraukos po watermark, care outcomes, LT bendruomenės žinojimas) → flywheel.
- **Pajamų modelis:** B2C tier + B2B sellers (curated UGC = trust signal pirkimo momentu).
- **Reikalauja:** vidutiniškai; reikia user base augimo PRIEŠ moat (chicken-egg). ~10–15 val./sav. jei rimtai. Galimai full-time prie PL/DE plėtros.
- **Rizika:** UGC flywheel reikalauja masės — LT rinka (~2,8M žmonių) gali būti per maža kritinei masei pasiekti; gali reikėti PL/DE anksčiau nei H-S6 numato.

**Mano rekomendacija konsiliumui:** B (higiena) yra ne-pasirenkamas pamatas — daryk pirma, pigiai. A yra vienintelis tikras LapasID-specifinis moat — instrumentuok dabar, leisk kauptis fone. C yra augimo variklis, bet reikalauja masės, kurią LT viena gali neduoti.

---

## 3. Kill-list — kuriuos H-* mano duomenys griauna

- **H-MO1 („moat is data nobody else has") — GRIAUNAMA.** 3 stipriausi „moat" turtai (pfaf 2481, pre-db 8178 rūšys, lt-names) yra LICENCIJUOTI/skreipinti faktai iš public šaltinių, kuriuos bet kas atkartos iš WCVP/GBIF/Wikidata. Tai ne „nobody else has" — tai „everybody can get". a16z: kaupimas ≠ gintis.

- **H-MO1 antra dalis („AI negali nukopijuoti ne-anglų") — SILPNINAMA.** EU TDM išimtis (DSM Direktyvos Art. 4) leidžia komercinį AI treniravimą ant copyright turinio, jei rightholder'is neopt-out'ino machine-readable būdu; LT 1998 žodynas to nepadarė ([Knowledge Rights 21](https://knowledgerights21.org/news-story/eu-tdm-exceptions-can-be-used-for-ai/), [CMS](https://cms-lawnow.com/en/ealerts/2025/01/interplay-of-ai-and-copyright-law)). LLM LT vertimą generuoja gerai. „Years to copy" neįrodyta (sutampa su vidine įtampa #7).

- **H-MO4 (akvarelės kaip moat) — GRIAUNAMA teisiškai.** ES: visiškai AI-sugeneruoti vaizdai NESAUGOMI copyright'u (nėra žmogaus autorystės — CJEU originalumo testas) ([Europarl 2025](https://www.europarl.europa.eu/thinktank/en/document/EPRS_BRI(2025)782585)). Gemini ToS leidžia komercinį naudojimą, BET „gali negebėti uždrausti kitiems kopijuoti" ([terms.law](https://terms.law/ai-output-rights/gemini/)). Akvarelė = identiteto/skonio dalykas, NE gintinas turtas.

- **H-MO2 (5786 LT + 1029 SKU + 300 įrašų kaip moat) — DALINAI SILPNINAMA.** Patys skaičiai nedideli ir kilmė rizikinga (03-assets: high-conf LT vardų tik 371, ne 5786). EU sui-generis database right (15 m., „substantial investment") gali apsaugoti KOMPILIACIJĄ — bet ne pavienius faktus, ir tik jei investicija substanciali ([EUR-Lex](https://eur-lex.europa.eu/EN/legal-content/summary/legal-protection-databases.html)). Tai realus, bet kuklus turtas.

- **H-MO6 (failure-mode learning) — PATVIRTINAMA kaip VIENINTELIS tikras moat, BET dar neegzistuoja.** `deathReason`/`lesson` realiai unikalus (nėra public mirtingumo dataseto), atitinka a16z sąlygas. Bet 03-assets: pipeline'o NĖRA, kaupiasi lėtai. Tai pažadas su pamatu, ne turtas šiandien.

- **H-P11 („network amortization" — kiekvienas įrašas praturtina katalogą) — SILPNINAMA.** Tai data scale effect (diminishing returns po ~40% padengimo, a16z), NE data network effect. Katalogo praturtinimas iš licencijuotų šaltinių dar ir paveldi jų licencijos riziką.

---

## 4. Top-5 neapibrėžtumai + pigiausias patikrinimas

1. **Ar pfaf/pre-db/ASPCA realiai pakeičiami be turinio degradacijos?** → Pigus testas: paimk 50 atsitiktinių katalogo rūšių, bandyk rekonstruoti toksiškumą+priežiūrą TIK iš WCVP+GBIF+Wikidata+USDA GRIN (visi public/CC BY/CC0). Išmatuok coverage %. Kaštas: 1–2 d. solo+AI.

2. **Kiek N death events reikia, kad rūšies-lygio įspėjimas būtų statistiškai vertas?** → Patikra: simuliuok ant esamų ~99 katalogo + dabartinių event'ų; nustatyk slenkstį (pvz. min. 20 mirčių/rūšiai). Kaštas: pusė dienos analizės.

3. **Ar AI-akvarelių „pilkos teisės" kelia REALŲ verslo bloką?** → Pigiausia: 1 val. IP teisininko konsultacija (€100–200) konkrečiu klausimu „ar galim komerciškai naudoti Gemini-output su watermark". Greičiausiai TAIP (Gemini ToS leidžia), bet užfiksuok raštu.

4. **Ar EU sui-generis database right realiai gina mūsų LT kompiliaciją?** → Klausimas teisininkui kartu su #3: ar mūsų „substantial investment" (3 sav. pipeline) kvalifikuoja 15 m. apsaugai. Tas pats €100–200 vizitas.

5. **Ar LT rinka pasiekia UGC kritinę masę, ar reikia PL/DE anksčiau?** → Primary research: 10 LT garden center'ių pokalbiai (kiek augalų/mėn parduoda → potencialus passport volume). Nemokama, tik laikas.

---

## 5. KONKRETUS teisinio pamato išvalymo planas (kaštai/laikas)

**Tikslas:** pašalinti 3 didžiausias licencijų bombas (pfaf NC, pre-db autorinės knygos, 30MB klientui) pakeičiant komercinei-saugiai bazei.

| Žingsnis | Šaltinis (komercinė licencija) | Ką pakeičia | Laikas | Kaštas |
|---|---|---|---|---|
| **1. Taksonomijos backbone** | **WCVP (Kew) — CC BY 4.0**, savaitiniai dump'ai per GBIF FTP ([Kew](https://powo.science.kew.org/about-wcvp), [GBIF](https://www.gbif.org/dataset/f382f0ce-323a-4091-bb9f-add557f3a9a2)) | pre-db.json genčių/rūšių struktūrą (8178 rūšys iš 3 autorinių knygų → DIDŽIAUSIA #2 rizika) | 3–5 d. | €0 |
| **2. Antrinė taksonomija + sinonimai** | **USDA GRIN — US Public Domain** (46 000+ rūšių, common names, klasifikacija) ([GRIN](https://data.nal.usda.gov/dataset/germplasm-resources-information-network-grin)) + **Wikidata CC0** | latin-synonyms papildymas, common names | 2–3 d. | €0 |
| **3. Toksiškumas (pet)** | **ASPCA — palik (faktiniai duomenys, švelni TOS rizika), atributuok aiškiai**; faktai (toksiška/ne) nėra copyright'inami, tik išraiška | aspca-toxicity.json — mažiausiai rizikinga, NEkeisti, tik atribucija | 0,5 d. | €0 |
| **4. Toksiškumas (žmogui) — VISIŠKAS pfaf NC pakeitimas** | **Primary public domain floros** (USDA), **mokslo straipsniai (faktiniai LD50/poveikiai necopyright'inami)**, **EFSA OpenFoodTox** (EFSA owns, re-use su atribucija; chemikalai ne augalai, bet medžiagų toksiškumui naudinga) ([EFSA](https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox)) | **pfaf.json knownHazards + 2481 LT vertimą — DIDŽIAUSIA rizika, NC tiesiogiai prieštarauja mokamam produktui** | 5–8 d. | €0 |
| **5. PFAF NC izoliacija** | — | Pažymėk visus pfaf-kilmės įrašus `source:'pfaf'`, IŠJUNK iš production bundle, perrašyk faktinį turinį savo žodžiais iš necopyright faktų (faktai laisvi; tik PFAF teksto IŠRAIŠKA saugoma) | 2–3 d. | €0 |
| **6. 30MB iš kliento** | — | Perkelk JSON į serverį/Firestore už auth (03-assets: šiandien atvirai bundle'inami — ir teisinė, ir saugumo skylė) | 1–2 d. | €0 (sutampa su Firebase migracija) |
| **7. Teisinis auditas** | IP teisininkas (LT/EU) | Patvirtina #4–#5 parafrazės ribą, AI-vaizdų teises (H-MO4), sui-generis apsaugą (H-MO2) | 2 val. konsultacija | **€200–500** |

**Bendrai: ~16–24 darbo dienos solo+AI (realiai 2–3 kalendorinės sav.) + €200–500 teisinei konsultacijai. Jokio kapitalo už licencijas — visi pakaitalai CC BY / CC0 / public domain / faktinai necopyright'inami.**

### Kritinis teisinis principas (pamatas visam planui)
**Faktai (toksiška/ne, laistymo intervalas, gentis) NĖRA copyright'inami — saugoma tik išraiška ir kompiliacija.** PFAF/knygų rizika kyla iš (a) teksto IŠRAIŠKOS kopijavimo ir (b) NC licencijos akceptavimo skreipinant. Sprendimas: imk FAKTUS iš public/CC BY šaltinių, rašyk SAVO išraišką. Parafrazė iš necopyright public-domain fakto = teisiškai švaru. Parafrazė iš PFAF NC teksto = vis dar rizikinga (paveldi NC + galimas database-right pažeidimas), todėl #5 reikia FAKTUS pertraukti per neutralų public šaltinį, ne perpasakoti PFAF.

---

## 6. Šaltiniai (URL)

- iNaturalist CV modelis (88,7%, 100K+ taksonų): https://www.inaturalist.org/blog/107012-new-computer-vision-model
- iNaturalist mastas (200M+ stebėjimų, GBIF): https://academic.oup.com/bioscience/article/75/11/953/8185761
- iNat licencijos GBIF eksportui (CC0/BY/BY-NC): https://www.inaturalist.org/posts/84932-updated-choosing-licensing
- Pl@ntNet API kainos (500/d nemokamai): https://my.plantnet.org/pricing
- Plant ID apps lauko tikslumas >80%: https://www.tandfonline.com/doi/full/10.1080/17550874.2025.2476938
- GPT-4o ligų diagnostika 56%: https://www.online-rpd.org/journal/view.php?number=1837
- PictureThis (30M+, 400K rūšių): https://apps.apple.com/us/app/picturethis-plant-identifier/id1252497129
- Vivino mastas (40M/1,5mlrd foto/200M atsiliepimų): https://coolhunting.com/food-drink/vivinos-user-compiled-data-catalogs-millions-of-wines/
- Vivino UGC vs ekspertai (1,4M vs 370K): https://arxiv.org/pdf/1804.10982
- Strava (10mlrd veiklų, 3trln taškų, Metro B2B): https://businessmodelcanvastemplate.com/blogs/how-it-works/strava-how-it-works
- a16z „Empty Promise of Data Moats": https://a16z.com/the-empty-promise-of-data-moats/
- nfx „Truth About Data Network Effects": https://www.nfx.com/post/truth-about-data-network-effects
- PFAF copyright (DB NC, komercinė draudžiama): https://pfaf.org/user/cmspage.aspx?pageid=136
- WCVP CC BY 4.0 (Kew, GBIF, FTP): https://powo.science.kew.org/about-wcvp
- WCVP per GBIF: https://www.gbif.org/dataset/f382f0ce-323a-4091-bb9f-add557f3a9a2
- POWO/Kew licencija (metadata CC BY): https://www.kew.org/science/collections-and-resources/data-and-digital/terms-of-use
- USDA GRIN (US Public Domain, 46K+ rūšių): https://data.nal.usda.gov/dataset/germplasm-resources-information-network-grin
- Wikidata taksonomija CC0: https://www.wikidata.org/wiki/Wikidata:WikiProject_Taxonomy
- EFSA OpenFoodTox (EFSA owns, re-use): https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox
- ASPCA toksiškų augalų sąrašas (1000+): https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants
- EU database right (sui generis, 15 m.): https://eur-lex.europa.eu/EN/legal-content/summary/legal-protection-databases.html
- EU TDM išimtis AI treniravimui (Art. 4): https://knowledgerights21.org/news-story/eu-tdm-exceptions-can-be-used-for-ai/
- TDM opt-out machine-readable (Olandijos teismas): https://ipkitten.blogspot.com/2025/02/dutch-court-holds-that-tdm-opt-out-must.html
- ES AI-vaizdų copyright (nėra apsaugos be žmogaus autorystės): https://www.europarl.europa.eu/thinktank/en/document/EPRS_BRI(2025)782585
- Gemini output teisės (komercinė ok, bet negina nuo kopijavimo): https://terms.law/ai-output-rights/gemini/
- Gemini API terms: https://ai.google.dev/gemini-api/terms
- Kambarinių augalų mirtingumas (>80% nuo laistymo, nėra dataseto): https://farmfoodfamily.com/common-reasons-houseplants-fail/
