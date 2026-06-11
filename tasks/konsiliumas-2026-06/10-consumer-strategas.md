# Consumer Product Stratego lenta — kur plant apps uždirba ir kur lūžta

## 1. Galimybių žemėlapis

### 1.1 Kategorijos ekonomika: pinigai yra atpažinime ir diagnostikoje, NE saugume

| App | Kaina | Mastas / pajamos | Modelis |
|---|---|---|---|
| **PictureThis** (Glority, CN) | $29,99/m. | 100M+ atsisiuntimų; 2022-05 ~$13M/mėn net revenue (Appfigures); 2026 Sensor Tower: vien US iOS ~$5M/mėn | Hard paywall + 7d trial; RPD $6,68 — kategorijos čempionas |
| **PlantIn** (Genesis, UA) | **$6,99/SAVAITĘ**, lifetime $49,99 | 35M atsisiuntimų (Q2 2025), ~$900K/mėn | Agresyvus web-funnel/trial monetizavimas |
| **Planta** (SE) | $35,99/m. | 3,3M+ atsisiuntimų, ~$300K/mėn | Freemium: free = priminimai, paid = ID/light meter/custom care |
| **Greg** (US, $5,4M seed) | $29,99/m. | VC-finansuota 2021, monetizacija silpna → **pivot į Costa Farms partnerystę** | Freemium + B2B2C |
| **Blossom** | ~$20/m. | RPD $2,25 (2022) | Trial-heavy freemium |

Visi monetizuoja tą patį: **neribotą ID, ligų diagnostiką, custom care planus**. Toksiškumas niekur nėra atskiras produktas — PictureThis jį laiko UŽ paywall kaip vieną iš feature'ų. LapasID „toksiškumas nemokamai" yra reali diferenciacija prieš PictureThis, bet vertės užfiksavimo prasme — nulinės tiesioginės pajamos pagal apibrėžimą.

### 1.2 „Saugumo wedge" precedentai iš kitų kategorijų — verdiktas dviprasmis

- **Yuka (maisto sauga, FR)** — geriausias precedentas IR įspėjimas: ~80M vartotojų (22M US, +25K/dieną organiškai), bet **2024 pajamos tik $7,3M**, 98% iš premium €10–50/metus „pay what you want". Tai **ARPU ~$0,09–0,13/vartotojui/metus**. Sauga yra fenomenalus *acquisition* variklis (zero marketing) ir baisus *monetization* variklis. Yuka veikia tik todėl, kad pasiekė dešimtis milijonų — **LT-only lubos (2,9M gyventojų) struktūriškai nesuderinamos su Yuka modeliu.**
- **Solid Starts (kūdikių maisto sauga, US)** — pozityvusis šablonas: **nemokama saugos DB („First Foods Database") + mokamas tracking/planavimas viršuje**; ~$1M/mėn pajamų, 4M+ tėvų. Įrodo: saugos DB = pasitikėjimo/SEO vartai, o moka žmonės už *kasdienę utility*, ne už saugą.
- **ASPCA APCC app (gyvūnų nuodų kontrolė)** — **nemokama** su 275+ toksinų DB. Institucinė norma: saugos informacija visuomenei = free. Bandymas ją parduoti tiesiogiai neturi precedento.

**Išvada lentai:** „Safety is the wedge" teisinga tik kaip *įėjimo/pasitikėjimo* mechanika (Yuka, Solid Starts), ir tik jei yra (a) masinis organinis kanalas arba (b) kažkas kitas, kas moka — pvz., pardavėjas.

### 1.3 Freemium benchmarks — V1 slenksčio sąlygos yra top-kvartilis, ne default

- Mediana download→paid freemium: **~2,1–2,2%**; hard paywall ~10,7–12,1% (RevenueCat „State of Subscription Apps 2025", Adapty). „Gera" freemium konversija 3–5%; **4%+ (H-M3) = viršutinis kvartilis**.
- Metinių planų 12 mėn. retention 50–60%, mėnesinių 20–40%, savaitinių <10%; 43% parduodamų prenumeratų — metinės. **Industrija perėjo į annual-first.**
- Bendras app D30 retention vidurkis ~5,7%; 48% app'ų ištrinama per 30 dienų. Plant care — dar ir sezoniška (PictureThis pajamų pikas gegužę, Appfigures).

### 1.4 V1 tiers įvertinimas prieš rinką

- **Free 15 augalų (H-C6) — per dosnu.** Vidutinis namų augintojas turi mažiau nei 15 augalų; free tier dengia ~didžiąją dalį auditorijos, o dar ir toksiškumas amžinai free. Konkurentų free tiers gerokai kietesni (Planta free be ID; PictureThis — keli skenai/d.). Struktūriškai tai spaudžia konversiją ŽEMIAU 2% medianos — tiesiai prieš H-M3 4% slenkstį.
- **Lite €2,99/mėn — „dead zone".** Mėnesinė maža kaina = blogiausia kombinacija: žemas LTV (mėnesinių retention 20–40%) ir nepakankamas „skausmas" upgrade'ui į Pro. Rinkos inkaras yra **metinis $20–36** (Blossom $20, PictureThis/Greg $29,99, Planta $35,99). €19/m. metinis — normalus; mėnesinį €2,99 reikia žudyti.
- **Pro €6,99/mėn (€59/m.) — virš rinkos inkaro** (~2× PictureThis metinės kainos) neįrodytam brandui žemos perkamosios galios kategorijoje (DE — turtingiausioje ES rinkoje — žydinčių kambarinių augalų per capita išlaidos ~€11/metus, rinka 2025 traukėsi -4,5%).
- **H-M2 aritmetika neišsilaiko:** ~4000 mokančių LT vartotojų prie 2,2% medianos konversijos reikalauja ~180K aktyvių free vartotojų — **6,3% visos Lietuvos populiacijos**. Palyginimui: Planta su 3,3M downloads globaliai daro ~$300K/mėn.

### 1.5 PWA vs native — LapasID atveju PWA yra teisingas, bet dėl kitos priežasties

- PWA pliusai: 0% komisinių (vs Apple 15–30%, EU DMA atveju ~20% IAP arba sudėtinga external fee struktūra), momentiniai atnaujinimai, URL-share, Stripe web checkout be store taisyklių.
- PWA minusas kritinis consumer kategorijoje: **plant apps užauga per App Store paiešką ir Apple Search Ads** (PictureThis playbook) — PWA šio kanalo neturi. Lieka tik du skalaujami kanalai: **SEO ir fizinis QR**. Tai netiesiogiai VALIDUOJA fizinės žymos kaip distribucijos teoriją — bet žyma turi būti pigi (QR), ne brangi (NFC dial).
- Mokėjimų kode nėra išvis (03-assets §2) — bet kokia konversijos hipotezė šiandien netestuojama.

### 1.6 Seller-kanalo precedentas jau egzistuoja — Costa Farms × Greg

Costa Farms (didžiausias US houseplant augintojas) deda **paprastą QR** ant etikečių → QR atrakina **3 mėn. nemokamo Super Greg** → augintojas subsidijuoja app'o adoption, app'as duoda augintojui lojalumą. Tai beveik 1:1 LapasID L1–L3 modelis, jau veikiantis JAV. Dvi implikacijos: (1) modelis realus, sellers tikrai tai daro; (2) **„structurally hard to copy" (H-MO4/H-MO5) netiesa — tai jau nukopijuota prieš LapasID atsirandant.** Taip pat egzistuoja MasterTag (hortikultūros etikečių gigantas su smart-tag turiniu), Plantsoon, Petals, Acemaker — QR/NFC plant label erdvė nėra tuščia.

---

## 2. Trys strategijos variantai (consumer lentos perspektyva)

### Variantas A — „Solid Starts augalams" (rekomenduojamas kaip bazinis)
- **Wedge:** nemokama LT toksiškumo DB kaip **SEO vartai** — `lapasid.lt/ar-nuodinga/{augalas}` puslapiai („ar monstera nuodinga katėms" tipo intentui), kurių lietuviškai niekas kokybiškai nedengia. Sauga = acquisition, ne produktas (Yuka/Solid Starts logika).
- **Seka:** SEO/share puslapis → PWA → care utility įprotis (prognozės, AI — jau LIVE) → **vienas metinis planas €19–24/m.** (kill Lite monthly; annual-first; hard-ish paywall ant AI/neribotų augalų). Free riba: ~5 augalai, ne 15.
- **Pajamos:** sąžiningos LT lubos — 30–50K MAU (1–1,7% pop.) × 2,5–3,5% × €20 ≈ **€20–35K ARR iš B2C**. Tai gyvybės palaikymas + įrodymų bazė, ne verslas — todėl A natūraliai jungiasi su B.
- **Iš founder'io:** 10–15 val./sav., ~€0 kapitalo, jokio full-time. Pirmas darbas — Stripe + analytics (scan/search logging šiandien NĖRA, 03-assets §3).
- **Rizika:** LT paieškos apimtys gali būti per mažos; Google AI Overviews kanibalizuoja info-SEO; sezoniškumas.

### Variantas B — „Costa Farms playbook Lietuvai" (B2B2C, QR be NFC)
- **Wedge:** **paprastos QR etiketės** (ne NFC dial!) 1–2 LT augintojams/sodo centrams; vartotojui skenas atrakina pasą + X mėn. Pro free (Greg precedentas); seller moka už etiketes + aktyvacijas (L3 lead-gen logika iš praeito konsiliumo — statyti ant jos).
- **Seka:** instrumentuoti /p/{id} skenus → 2 pilotai su realiu scan-rate matavimu → lead-gen fee kai įrodyta konversija → marketplace kaip rezultatas. NFC dial atidėti iki įrodyto QR engagement (QR lipdukas ~centai; H-P5 custom konstrukcija su sukamu žiedu — niekieno nepublikuota kaina, €0,20–0,50 maržos teiginys nepagrįstas).
- **Pajamos:** B2B: etiketės kaip break-even, pinigai iš aktyvacijų/lead'ų; B2C lieka A varianto prenumerata. Tikslas Y1: 2–3 mokantys sellers, €3–8K, bet su SCAN DATA, kurios neturi niekas LT.
- **Iš founder'io:** +5–8 val./sav. sales (nauja kompetencija — didžiausias asmeninis kaštas), €1–3K spaudai/pilotams, full-time nereikia iki įrodytos seller traction.
- **Rizika:** LT augintojų rinka smulki ir fragmentuota; B2B ciklai lėti; Greg atvejis rodo, kad partnerystė yra nuomojama, ne moat.

### Variantas C — „Yuka augalams" (EU-wide, venture kelias)
- **Wedge:** multi-kalbinis augalų saugos skeneris nuo 1 dienos (LT+PL+DE), pay-what-you-want arba dosnus free, organinis/press augimas; LT-only atsisakoma sąmoningai, nes saugos wedge veikia tik masėje.
- **Seka:** scale free users → trust brand → vėlyva monetizacija (premium + B2B duomenys augintojams).
- **Pajamos:** Yuka math: net 5M vartotojų prie jų ARPU = ~$0,5–0,7M/metus. Be venture kapitalo neįmanoma; investuotojui reikia 10M+ user trajektorijos.
- **Iš founder'io:** full-time nuo ~6 mėn., €200K+ seed, paleisti „LT pirmiausia" tapatybę. **Nerekomenduoju:** prieštarauja bootstrap-first kalibracijai ir velocity-solo stiprybei.

**Lentos verdiktas: A+B kartu** (A duoda vartotojus ir duomenis, B duoda pajamas ir distribuciją per QR), C — tik jei atsiranda išorinis kapitalo argumentas.

---

## 3. Kill-list (H-* su įrodymais)

| Hipotezė | Verdiktas | Įrodymas |
|---|---|---|
| **H-S4 / Core thesis „Safety is the wedge"** | **SILPNINTI: sauga = acquisition wedge, ne pajamų wedge** | Yuka: 80M users → $7,3M (ARPU ~$0,13/m.); ASPCA APCC — free; Solid Starts uždirba iš tracking, ne iš saugos DB. Veikia tik su masiniu organiniu kanalu arba trečiu mokėtoju |
| **H-M3 (konversija >4%)** | **SILPNINTI kaip planavimo prielaidą** | Freemium mediana 2,1–2,2% (RevenueCat 2025); 4% = top kvartilis; o LapasID free tier dosnesnis už medianą turinčiųjų |
| **H-M2 (~4000 mokančių LT users)** | **ŽUDYTI dabartine forma** | 4000 ÷ 2,2% = ~180K MAU = 6,3% LT populiacijos; Planta su 3,3M downloads globaliai ~ $300K/mėn. LT-only B2C realybė — €20–35K ARR |
| **H-C6 (Free 15 augalų)** | **ŽUDYTI — mažinti iki ~5** | Vidutinė kolekcija < 15 augalų; konkurentų free tiers kietesni; kartu su free-toxicity tai struktūriškai užrakina konversiją žemiau slenksčio (vidinė įtampa #10 patvirtinta benchmarkais) |
| **H-C7 (Lite €2,99/mėn)** | **ŽUDYTI mėnesinį; palikti tik metinį €19** | Mėnesinių planų 12 mėn. retention 20–40% vs metinių 50–60%; rinkos inkaras $20–36/metus; industrija annual-first |
| **H-C8 (Pro €59/m.)** | SILPNINTI: nuleisti iki €29–39/m. | 2× virš PictureThis ($29,99) ir 1,6× virš Planta ($35,99) — neįrodytam brandui žemos WTP rinkoje (DE houseplant per capita ~€11–17/m., rinka -4,5%) |
| **H-MO4/H-MO5 („negali nukopijuoti", „cannot retrofit")** | **ŽUDYTI šią formuluotę** | Costa Farms×Greg jau veikia (QR ant etikečių + free premium); MasterTag/Plantsoon/Petals egzistuoja; PictureThis toksiškumo sluoksnį techniškai pridėtų per sprintą. Tikras moat — LT kuracija + seller santykiai + scan duomenys, ne „neįmanoma nukopijuoti" |
| **H-P4/H-P5 (NFC Toxicity Dial) + H-C1 (€0,20–0,50 marža)** | SILPNINTI: pradėti nuo QR | Paprastas NTAG lipdukas urmu — centai–dešimtys centų, bet custom sukamas žiedas + graviruotė + smaigas = unikali gamyba be jokio kainų precedento; pats V1 pripažįsta „hobby economics" (D2). Costa Farms precedentas rodo, kad QR pakanka adoption'ui |
| **H-C9 (memorial monetizacija)** | SILPNINTI | Jokio precedento jokioje kategorijoje; „high-intent re-acquisition" — neišmatuota spekuliacija (nors deathReason duomuo kaip toks — unikalus turtas, 03-assets §3) |
| **H-M4 (NFC skenas → Google reg → įprotis)** | SILPNINTI | Greg/Costa Farms funnel'iui reikėjo 3 mėn. free premium paskatos; „4 sek be paskyros" → registracija be paskatos neturi įrodymų, o scan analytics LapasID šiandien net nerenkama |

Atskirai: **PictureThis dark patterns** (trial auto-charge skundai, sunkus cancel — JustUseApp reviews) yra reali LapasID galimybė pozicionuotis „sąžiningu" — bet sąžiningumas turi kainą: atsisakai geriausiai konvertuojančių taktikų (PlantIn $6,99/sav. funnel), todėl ekonomiką privalo papildyti B2B (variantas B).

---

## 4. Top-5 neapibrėžtumai ir pigiausi testai

1. **Ar LT vartotojas iš viso moka už augalų app'ą?** → Stripe checkout ant esamos PWA (mokėjimų kode nėra — tai blokuojanti spraga) + fake-door kainų testas €19 vs €29 metinis. Kaina: ~1 sav. darbo, €0.
2. **Koks realus QR/paso engagement?** → instrumentuoti /p/{id} peržiūras ir skenus (šiandien — jokio counter, 03-assets §3) + 100 QR lipdukų pilotas per 1 draugišką pardavėją ar botanikos sodą. Kaina: kelios valandos kodo + ~€20 lipdukų.
3. **Ar yra LT toksiškumo paklausa paieškoje?** → Google Keyword Planner + Search Console: „ar monstera nuodinga katėms" ir ~50 analogiškų frazių apimtys; 10 SEO puslapių MVP ir CTR matavimas. Kaina: €0, 2 sav. laukimo.
4. **Kiek free tier dosnumas kainuoja konversijai?** → vidinis query: kokia dalis esamų vartotojų turi >5 ir >15 augalų; kur natūrali paywall riba. Kaina: 1 val.
5. **Ar LT sellers mokės už aktyvacijas (Costa Farms modelis)?** → 10 pokalbių su LT augintojais/sodo centrais rodant Costa Farms×Greg precedentą kaip social proof („JAV didžiausias augintojas tai jau daro"). Kaina: 2 sav. laiko, €0.

---

## 5. Šaltiniai

- PictureThis 2026 Sensor Tower (US iOS ~$5M/mėn): https://app.sensortower.com/overview/1252497129?country=US ; Google Play: https://app.sensortower.com/overview/cn.danatech.xingseus?country=US
- PictureThis 2022 gegužė $13M/mėn, RPD $6,68, sezoniškumas (Appfigures): https://appfigures.com/resources/insights/20220610?f=3
- PictureThis kaina/trial: https://identifythis.app/blog/picture-this-plant-identification-app ; premium feature lock (incl. toxicity): https://thepoolandlawn.com/is-the-picturethis-app-free/
- PictureThis skundai/dark patterns: https://justuseapp.com/en/app/1252497129/picturethis-plant-identifier/reviews
- PlantIn 35M downloads / #1 US: https://digitalstate.gov.ua/news/tech/v-ukrayinskoho-plantin-35-mln-zavantazen-vin-1-na-rynku-ssha ; pajamos/kainos: https://app.sensortower.com/overview/1527399597?country=US , https://myplantin.com/subscription
- Planta kainos/mastas: https://app.sensortower.com/overview/1410126781?country=US , https://www.imore.com/apps/planta-is-a-pricey-but-detailed-houseplant-care-iphone-app-for-indoor-gardeners , https://www.gardencentermag.com/news/how-this-swedish-plant-care-app-planta-can-help-plant-parents-at-any-stage/
- Greg seed $5,4M: https://techcrunch.com/2021/05/27/greg-an-app-for-plant-lovers-grows-5-4-million-in-seed-funding/ ; kaina: https://greg.app/question/3p6rr4/how-much-does-this-app-cost
- Costa Farms × Greg QR partnerystė: https://help.costafarms.com/en/knowledge/how-do-i-sign-up-for-the-greg-app , https://costafarms.com/pages/greg-app-page
- Blossom kainos: https://apps.apple.com/us/app/blossom-plant-care-guide/id1487453649 , https://greenyplace.com/is-there-a-plant-care-app-that-is-actually-free
- Yuka pajamos/modelis: https://breakevenpointcalculator.com/how-does-yuka-make-money-revenue-model-explained/ ; augimas/organika: https://www.uschamber.com/co/good-company/the-leap/yuka-app-organic-growth ; premium €10–50 PWYW: https://help.yuka.io/l/en/article/hkzw2hkj5w-cost-membership , https://yuka.io/en/premium-member/
- Solid Starts modelis/pajamos: https://solidstarts.com/app/ , https://app.sensortower.com/overview/1564189151?country=US
- ASPCA APCC free app: https://www.aspcapro.org/resource/aspca-animal-poison-control-center-app
- RevenueCat State of Subscription Apps 2025 (2,1% vs 10,7%; retention pagal plano trukmę): https://www.revenuecat.com/state-of-subscription-apps-2025/ , https://www.rocketshiphq.com/revenuecat-state-of-subscription-apps-2025-summary/ ; freemium benchmarks: https://www.withdaydream.com/library/insights/freemium-conversion-rate , https://adapty.io/blog/trial-conversion-rates-for-in-app-subscriptions/
- App retention/uninstall: https://uxcam.com/blog/mobile-app-churn-rate/ , https://getstream.io/blog/app-retention-guide/
- DE houseplant rinka €1,4 mlrd., -4,5%, per capita: https://www.floraldaily.com/article/9807230/persistent-consumer-reluctance-continues-to-weigh-on-german-flower-market/
- EU indoor plants rinka: https://www.cognitivemarketresearch.com/regional-analysis/europe-indoor-plant-market-report
- PWA vs native (fees, friction): https://nextnative.dev/comparisons/pwa-vs-native-app , https://www.magicbell.com/blog/pwa-vs-native-app-when-to-build-installable-progressive-web-app
- Apple EU DMA fees 2025–2026: https://developer.apple.com/support/dma-and-apps-in-the-eu/ , https://www.revenuecat.com/blog/growth/apple-eu-dma-update-june-2025/
- NFC tag rinka (NTAG213 bulk): https://www.tagstand.com/products/1000-count-25-25-25-stickers/ , https://www.amazon.com/1000-NFC-Stickers-Reel-NTAG213/dp/B01MS4J1HB
- QR/NFC plant label precedentai: https://mastertag.com/ , https://plantsoon.com/plantsigns , https://www.petalsapp.com/blog/how-it-works/
