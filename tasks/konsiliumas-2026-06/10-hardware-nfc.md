# Hardware/NFC GTM lęšis — Toxicity Dial unit ekonomika ir fizinio+skaitmeninio hibrido precedentai

## 1. Galimybių žemėlapis (ką matau iš hardware lentos)

### 1.1. NFC žymų kainos at volume (verifikuota 2026-06)

**EU reseller (Shop NFC, kainos su ES PVM logika, mažos partijos):**

| Forma | 10 vnt | Volume kaina |
|---|---|---|
| NTAG213 wet inlay 12×19 mm | €0,69 | **€0,19/vnt nuo 20K** |
| Lipdukas ø22 mm | €0,65 | €0,18/vnt nuo 10K |
| IP67 popierinis lipdukas ø29 mm | €0,69 | €0,22/vnt nuo 5K |
| Kietas PVC 30 mm (lauko sąlygos) | €0,89 | €0,47/vnt nuo 10K |
| Custom printed lipdukai | €0,79 (nuo 100) | €0,69/vnt nuo 500 |

**Kinijos gamykla (Chuangxinjia/nfctagfactory, ZBTech):** NTAG213 PVC žymos **$0,06–0,15/vnt jau nuo 500 MOQ**; NFC inlay'ų pramoninis diapazonas $0,15–1,00, UHF analogas nukrenta iki $0,05 @100K — realus NFC inlay floor 100K partijai ~**$0,05–0,10/vnt** (reikia RFQ patvirtinimo).

**Encoding (unikalus URL kiekvienai žymai):** Seritag — **£0,03/žymai + £15 setup** variable encoding su lock; šimtai tūkstančių žymų/dieną įmanoma. Tai ne kliūtis.

**Kontekstas, kurio V1 nemato: augalų etikečių pramonės kainų inkaras.** Nursery pramonėje spausdinta žyma kainuoja **$0,02–0,18/vnt** (tuščios <$0,02 @1000; custom printed 2000 vnt = $217,99 → $0,11/vnt; MasterTag MOQ 1000). Pardavėjas yra įpratęs mokėti CENTUS. NFC žyma už €0,50–1,50 = **5–50× kategorijos kainų norma** — tai psichologinis barjeras B2B deryboms, nepriklausomai nuo ROI argumento.

### 1.2. Toxicity Dial (H-P4/H-P5) gamybos realybė

Sukamas dial = du komponentai: mechanizmas + NFC. Artimiausi masinės gamybos analogai:

- **Parkavimo diskai (Parkscheibe)** — funkciškai identiškas mechanizmas (sukamas diskas + langelis). Vokietijos promo rinkoje: kartoninis nuo **€0,17–0,28/vnt**, plastikinis nuo **€0,98–1,37/vnt** promo tiražais. Tai įrodo: mechanizmas pats savaime pigus, BET be NFC, be UV/lauko atsparumo, be smaigulio.
- **Volvelle/wheel chart spauda** — Whitney Woods (UK): MOQ **250 vnt**, 350gsm kartonas, eyelet surinkimas; American Slide Chart (US) — custom. Pilotinis kelias be jokio tooling.
- **Injection molding tooling:** paprastas vienos ertmės mold'as Kinijoje **$1500–3000** (dauguma $1000–10K; slider/undercut +$500). Dviejų dalių dial'ui — du mold'ai arba family mold: realistiškai **$3–6K tooling**.

**Dial unit kaštų modelis (mano sintezė iš aukščiau pateiktų kainų):**

| Scenarijus | Komponentai | Landed unit kaštas |
|---|---|---|
| **Pilotas 250–1000 vnt** (kartoninis volvelle + NFC inlay + smaigulis, rankinis surinkimas) | inlay €0,25–0,69 + spauda/eyelet ~€0,50–1,50 + smaigulis ~€0,05–0,10 + encoding €0,04 + darbas | **~€1,0–2,5/vnt** (be tooling) |
| **10K vnt** (injection mold Kinijoje, integruotas surinkimas) | mold amortizacija €0,30–0,60 + plastikas €0,15–0,40 + inlay €0,06–0,15 + surinkimas €0,05–0,15 + ID spauda €0,02–0,05 + smaigulis €0,03–0,08 + logistika/muitai +15–25% | **~€0,75–1,60/vnt** |
| **100K vnt** | tooling amortizacija €0,03–0,06 + visa kita scale'inasi | **~€0,35–0,70/vnt** |

Pastaba: lazerinis graviravimas ant bambuko — service rinkos kaina $1–3/min; masinei gamybai keisti į spausdintą/inkjet ID (centai). Lazeris pasiteisina tik in-house pilotui (capex ~€500–2000, marginal cost ~centai).

**Verdiktas H-C1 (€0,20–0,50 marža/žymai):** matematiškai pasiekiama TIK nuo ~10K vnt partijų ir TIK pardavinėjant po €1,00–2,00/vnt (5–10× pramonės inkaras). Pilotinėse apimtyse (≤1K) dial'as yra **nuostolingas per definiciją**. Paprastesnė alternatyva — paruoštas IP67 NFC lipdukas ant esamos pardavėjo etiketės: unit kaštas **€0,30–0,55** mažomis partijomis, €0,15–0,25 nuo 10K — marža €0,20–0,50 įmanoma pardavinėjant po €0,50–0,75/vnt. **Dial vs lipdukas kainų skirtumas: ~3–5×.** O QR ant esamos etiketės = **€0,00 inkrementinis kaštas**.

### 1.3. Precedentai: fizinis+skaitmeninis hibridas — kapinės ir išimtys

**ŽLUGĘ / užgesę:**
- **Thinfilm Electronics** (Norvegija/San Jose) — NFC smart label pionierius su printed electronics ekonomika. 2019: adoption „substantially slower than anticipated", pajamos -35%, 50% darbuotojų atleista, NFC verslas parduotas, pivot į baterijas (dabar Ensurge Micropower). **Pamoka: net žemiausi unit kaštai neišgelbėja, jei paklausa neegzistuoja.**
- **Nike Connect** (2017, NBA jersey NFC, $110–200 produktai) — tyliai numarinta; vartotojų skundai apie neveikiančias žymas ir nutrauktus benefit'us. **Pamoka: net Nike+NBA nesugebėjo išlaikyti tap-engagement įpročio.**

**VEIKIANTYS (siauros nišos):**
- **Böen vynas** (2019): 1M butelių su Guala Closures e-WAK NFC kamščiu + SharpEnd, be app. Veikia, nes butelis premium ir žyma integruota į GAMYBOS liniją, ne retrofit. Vyno NFC žymos $0,28–0,60/vnt @500+; pasiteisina prie $150+ butelių, kur žymos kaštas „inconsequential".
- **Pet ID tags** (PetHub, PawView, RFIDSilicone OEM) — gyvas segmentas: NFC+QR kombinuotos žymos, IP67, D2C kanalu. Veikia, nes turtas (gyvūnas) emociškai ir finansiškai vertingas, o žyma perkama VIENĄ kartą savininkui, ne tūkstančiais B2B.
- **Augalų NFC žymos JAU egzistuoja D2C:** **Petals** (UK) — £6/5 vnt = **£1,20/žymai (~€1,40)**, be app, be prenumeratos, „lifetime platform access"; **Known Plants** (indoor NFC markers); **TagLog**, **GrowTags** (eBay indie). Nė vienas neturi B2B seller kanalo — visi parduoda augalų entuziastams tiesiogiai. **H-P3 teiginys „rinkoje unikalu" NFC lygmenyje — klaidingas; unikalumas liko tik perdavimo/istorijos semantikoje.**
- **PlantTAGG** (Dallas, nuo 2019) — garden center programa Š. Amerikoje: QR + nuotraukos atpažinimas iš SPAUSDINTOS etiketės (Tag ID, 2025) — t. y. konkurentas išsprendė „fizinis touchpoint" problemą BE naujos fizinės žymos. **Joy of Plants** (UK) QR kodus kiekvienam DB augalui dalija **NEMOKAMAI** etikečių gamintojams. **Skaitmeninis sluoksnis ant augalo etiketės pramonėje jau yra free commodity.**

### 1.4. QR vs NFC adoption ES vartotojams

- ~**94% išmaniųjų** — NFC-enabled; iPhone XS+ skaito NDEF URL fone be jokios app (nuo iOS 12).
- BET elgsena: **43% vartotojų yra skenavę QR ant pakuotės** (Bitly 2025); QR laiko ~**50% connected packaging pajamų** (Mordor 2024); ES DPP duomenų nešikliu pasirinko **QR, ne NFC** (nuo 2027).
- NFC privalumas prieš QR realus tik: (a) premium tactile UX („tap"), (b) unikalus UID prieš klastojimą, (c) veikia be vizualinio kontakto. Toksiškumo info užduočiai (b) ir (c) nereikalingi.
- Loftware 2025: 41% vartotojų skenuoja QR/NFC kelis kartus/sav; 87% brand'ų planuoja NFC per 12 mėn — kryptis NFC palanki, bet šiandien mass-reach = QR.

### 1.5. Fulfillment solo founder'iui

ES 3PL: pick&pack **€1,50–3,00/order**, pilnas kaštas su siuntimu **€5–10/order**, setup €100–1000. B2B batch siuntoms (200 žymų dėžė vienam seller'iui) — nereikšminga; D2C pakuotėms (5 žymų pack) — fulfillment suvalgo visą maržą, nebent siunčiama per LT paštomatus (~€2–3) ir pack kaina ≥€9. Petals modelis (£6/5-pack su free shipping) įmanomas tik kaip loss-leader platformai arba su laiško formato siunta.

## 2. Trys strategijos iš hardware lentos

### Strategija A — „QR-first, NFC-premium" (mano rekomendacija)
- **Wedge:** QR kodas, spausdinamas ant pardavėjo ESAMOS etiketės (€0,00 unit kaštas, jokio naujo SKU, jokio fulfillment) → veda į /p/{id} pasą su toksiškumu. NFC rezervuojamas premium/retų augalų provenance segmentui (L5), kur vyno precedentas įrodo ekonomiką.
- **Seka:** (1) įdiegti scan counter (dabar jo NĖRA — 03-assets §3); (2) 1–2 LT sellers QR pilotas, 500–1000 etikečių; (3) jei scan rate >3–5%, pridėti NFC „Premium pasą" €2–5/augalui retiems augalams (paruoštas IP67 lipdukas €0,30–0,55, jokio tooling); (4) dial — tik kaip Strategijos C teatras.
- **Pajamos:** L2 ženklo licencija (€15–30/mėn) tampa pirmuoju realiu B2B produktu, nes QR nieko nekainuoja, o vertė — duomenys+ženklas; L5 premium NFC marža €1,50–4,50/vnt.
- **Iš founder'io:** 5–10 val./sav., <€500 kapitalo (lipdukai+encoding), full-time nereikia.
- **Rizika:** QR scan rate gali būti <1% (pakuočių pramonės tylioji tiesa); be counter'io to net nesužinosim — todėl counter pirmas.

### Strategija B — „Petals-LT": D2C NFC rinkinukai entuziastams
- **Wedge:** NFC žymų pack'ai tiesiai augalų entuziastams (ne sellers): Petals įrodė kainos tašką £6/5 vnt be app. LapasID diferenciacija — toksiškumas + LT kalba + perdavimo istorija + memorial.
- **Seka:** paruošti IP67 NTAG213 (€0,22–0,47/vnt @5K) + Seritag encoding (£0,03) + LT paštomatai → pack „5 žymos €8,99" → COGS ~€2–3 + fulfillment €2–3 = **marža €3–5/pack** (33–55%). Vėliau white-label seller'iams kaip POS prekė (seller perparduoda pack'us — apeina „seller nemoka už žymas" problemą: MOKA GALUTINIS VARTOTOJAS).
- **Pajamos:** tiesioginė prekyba + funnel į Pro tier; 100 pack'ų/mėn = €300–500 contribution.
- **Iš founder'io:** €300–1000 inventoriui, ~5 val./sav. pakavimui (arba LT 3PL), full-time nereikia.
- **Rizika:** Petals/Known traction nežinoma (gali būti zombie verslai); LT rinkos dydis pack'ams mažas; tai funnel taktika, ne verslas.

### Strategija C — „Dial kaip teatras, ne produkto linija"
- **Wedge:** dial'as turi išskirtinę naratyvinę/PR vertę („analoginis įspėjimo prietaisas") — bet gaminti jį reikia kaip **artefaktą, ne SKU**: 250–500 kartoninių volvelle (Whitney Woods MOQ 250 arba LT spaustuvė + eyelet) botanikos sodų launch'ui, žiniasklaidai, investoriniam demo. Unit kaštas €1,5–2,5 — tai MARKETINGO biudžetas (€500–1200 viso), ne COGS.
- **Seka:** injection mold ($3–6K) liečiamas TIK kai yra ≥10K vnt committed užsakymų iš sellers arba grant'as padengia tooling; iki tol dial neegzistuoja kaip komercinis produktas.
- **Pajamos:** netiesioginės — PR, botanikos sodų partnerystė (H-M5), investorinė istorija.
- **Iš founder'io:** €500–1200 vienkartinai, ~20 val. dizainui/koordinacijai.
- **Rizika:** kartoninis dial lauko sąlygomis gyvens savaites, ne metus — komunikuoti kaip „limited edition", ne kaip gaminį.

## 3. Kill-list (H-* su įrodymais)

| Hipotezė | Verdiktas | Įrodymai |
|---|---|---|
| **H-C1** „L1 žymos perka nuo 1 dienos, €0,20–0,50 marža" | **KILL kaip wedge** (pilotinėms apimtims) | Dial unit kaštas pilote €1,0–2,5 (be tooling); net paprastas NFC lipdukas €0,30–0,55; pramonės kainų inkaras $0,02–0,18/žymai (MasterTag/nursery norma); pats V1 pripažįsta €5–8/mėn/seller „hobby economics" (D2). Marža matematiškai atsiranda tik ≥10K vnt — bet tada tai jau ne day-1 wedge, o scale produktas. |
| **H-P4/H-P5** Toxicity Dial konstrukcija | **SILPNINTI: pilotas ≠ produktas** | Mechanizmas pigus tik be NFC ir be lauko atsparumo (Parkscheibe €0,17–1,37 promo tiražais); NFC+UV+smaigulis+surinkimas = custom gamyba, tooling $3–6K, MOQ realybė 5–10K; jokio precedento „sukamas dial + NFC" consumer rinkoje nėra (patikrinta per wine/pet/packaging/promo lentas). |
| **H-P3** „buyer inherits, not restarts — rinkoje unikalu" | **SILPNINTI** | NFC augalo žyma be app jau parduodama: Petals £1,20/žymai (UK), Known Plants, TagLog, GrowTags. Unikalu liko tik perdavimo semantika ir istorijos paveldėjimas — bet tai software claim, ne fizinės žymos claim. |
| **H-M4** „NFC nuskaitymas 4 sek be paskyros" kaip funnel pradžia | **SILPNINTI: QR yra mass-carrier** | 94% telefonų NFC-enabled ir iPhone XS+ skaito fone — techniškai tiesa; BET ES vartotojo elgsena = QR (43% skenavę pakuotės QR; QR ~50% connected packaging pajamų; DPP pasirinko QR). NFC = premium UX sluoksnis, ne pagrindinis kanalas. |
| **H-S1** „Žyma — pamatas" | **KILL kaip seka, KEEP kaip metafora** | Thinfilm (bankrutavęs NFC pionierius) ir Nike Connect (numarinta) rodo: fizinė žyma be įrodyto skaitmeninio demand'o = kapital deginimas. Pamatas yra /p/{id} pasas (jau veikia!) — žyma tėra carrier, ir pigiausias carrier yra QR ant esamos etiketės. |
| **H-C5** L5 provenance €2–5 išleidimas | **PALAIKYTI** (vienintelis segmentas, kur NFC ekonomika įrodyta) | Vyno NFC: $0,28–0,60/žymai veikia prie premium kainų; Böen 1M butelių precedentas; retų augalų kainos (€50–500+) analogiškos premium vynui. |

## 4. Top-5 neapibrėžtumai ir pigiausi testai

1. **Realus scan rate ant augalų etikečių LT.** Be šito visi fiziniai planai akli — o app šiandien NETURI scan counter'io (03-assets §3). Testas: counter į /p/{id} (kelios valandos darbo) + 200–500 QR lipdukų (€20–50) pas vieną draugišką seller'į; matuoti 4–6 sav. Kaštai: <€100.
2. **Tikra Kinijos RFQ kaina dial'ui ir lipdukui @1K/10K/100K.** Mano modelis — sintezė iš viešų kainų. Testas: spec sheet + RFQ trims tiekėjams (Chuangxinjia, ZBTech, custom-rfid-tags.com Dongguan) — nemokama, 1 val. darbo, atsakymai per savaitę.
3. **Ar LT sellers mokės >€0,20/žymai virš €0,02–0,18 normos?** Testas: 5 pokalbiai su LT garden centers rodant fizinį prototipą (10 vnt rankinių pavyzdžių, ~€50) ir klausiant kainos kortele (Van Westendorp). Kaštai: laikas + €50.
4. **Petals/Known/PlantTAGG traction** — ar D2C NFC augalų žymos apskritai turi paklausą, ar tai zombie? Testas: review skaičiai, Companies House (Petals UK) finansai, socialinių augimas, Similarweb — 2–3 val. desk research, €0.
5. **iPhone „tap" elgsenos žinomumas LT.** Background NFC veikia nuo XS, bet ar žmonės ŽINO, kad galima liesti? Testas: 20 žmonių koridoriaus testas su viena žyma (€5): „sužinok apie šitą augalą" — fiksuoti, kiek pasiekia pasą per NFC vs QR vs neranda. €5 + 1 diena.

## 5. Šaltiniai

**NFC žymų kainos ir encoding:**
- Shop NFC NTAG213 katalogas (EU volume kainos): https://shopnfc.com/en/30-ntag213
- Shop NFC wet inlays: https://shopnfc.com/en/58-nfc-nfc-wet-inlays / https://shopnfc.com/en/58-nfc-wet-inlays
- Seritag encoding kainoraštis (£0,03/tag + setup): https://seritag.com/pricelist
- Chuangxinjia / NFC Tag Factory (Kinija, $0,06–0,15 @500): https://www.nfctagfactory.com/products/NFC-Tag-Manufacturer.htm ir https://www.nfctagfactory.com/products/NFC-Pet-Tag.htm
- ZBTech custom NFC: https://nfcntag.com/custom-nfc-tags/
- RFID kaštų gidas (UHF $0,05 @100K; NFC inlay $0,15–1,00): https://cpcongroup.com/insights/article/rfid-chip-cost-guide/
- GoToTags store (US palyginimui): https://store.gototags.com/nfc-tags/

**Gamyba (dial/tooling/spauda):**
- Injection mold kaštai Kinijoje ($1,5–3K paprastas): https://boyanmfg.com/injection-mold-cost-in-china/ ir https://www.plastopialtd.com/pricing-guide/
- Parkscheibe promo kainos (nuo €0,17 kartonas / €0,98 plastikas): https://www.werbemittel24.com/werbeartikel/parkscheibe ir https://www.promostore.de/freizeit/kfz-werbeartikel/parkscheiben.html
- Volvelle gamintojai: Whitney Woods (MOQ 250) https://whitneywoods.com/us/products/promotional-wheel-charts/ ; American Slide Chart https://www.americanslidechart.com/wheel-charts
- Lazerinio graviravimo įkainiai ($1–3/min): https://themakerschest.com/blogs/laser-engravers/how-much-should-i-charge-for-laser-engraving-services
- Bambuko smaigulių didmena (1000/bundle): https://terratech.net/products/bamboo/2-natural-8-10-mm-bamboo-stakes-1000bndl/

**Augalų etikečių pramonė (kainų inkaras):**
- Nursery žymų kainos ($0,02–0,18): https://growingourretirement.com/nursery-plant-tags/
- MasterTag (MOQ 1000, custom): https://mastertag.com/any-grower-can-go-custom-with-their-plant-tags-and-labels-heres-how/
- Joy of Plants — NEMOKAMI QR kiekvienam augalui: https://joyofplants.com/qrcodes.php
- PlantTAGG garden center programa + Tag ID: https://planttagg.com/garden-center-program-2/ ir https://www.prnewswire.com/news-releases/planttaggs-new-tag-id-provides-garden-center-shoppers-instant-location-specific-plant-information-and-care-302398032.html

**Precedentai (hibridas fizinis+skaitmeninis):**
- Thinfilm NFC žlugimas: https://www.securingindustry.com/pharmaceuticals/thin-film-seeks-buyer-for-nfc-platform-blaming-slow-uptake/s40/a10781/ ir https://www.beveragedaily.com/Article/2019/09/27/Thinfilm-to-sell-NFC-business-due-to-slow-market-adoption/
- Nike Connect (2017 launch, vėliau numarinta; user skundai): https://www.engadget.com/2017-09-16-nike-connect-nba-jersey-nfc.html ir https://justuseapp.com/en/app/1267635264/nikeconnect/reviews
- Böen 1M NFC butelių (Guala e-WAK + SharpEnd): https://www.beveragedaily.com/Article/2019/08/06/Boeen-transports-consumers-to-its-vineyard-in-California-with-NFC-enabled-wine-bottles ir https://www.mediapost.com/publications/article/338860/california-wine-maker-launches-1-million-nfc-conne.html
- Vyno NFC žymų kainos ($0,28–0,60): https://www.resourcelabel.com/blog/2019/01/15/nfc-applications-for-wine-and-spirits-brands/ ir https://www.alibaba.com/product-insights/how-to-use-nfc-tags-on-private-cellar-bottles-for-smart-inventory.html
- Petals D2C NFC augalų žymos (£6/5-pack, be app): https://www.petalsapp.com/ ir https://petalsapp.com/shop/
- Known Plants (konkurentas): https://www.knownplants.com/shop/indoor-labels
- TagLog: https://plants.taglog.app/ ; pet tag rinka (PetHub ir kt.): https://www.rfidsilicone.com/product/nfc-tags/nfc-pet-tag/

**Adoption (QR vs NFC):**
- QR/NFC ES statistika (43% pakuočių QR, 41% skenuoja kas savaitę, 80% palankumas): https://www.loftware.com/resources/white-papers/2025/from-qr-codes-to-connected-experiences-the-new-era-of-food-and-beverage-packaging ir https://qrcodekit.com/news/qr-code-adoption/
- Connected packaging rinka (QR ~50% pajamų): https://www.mordorintelligence.com/industry-reports/connected-packaging-market
- NFC telefonų penetracija (~94%): https://electroiq.com/stats/nfc-payment-statistics/
- iPhone background NFC (XS+, be app, tik URL): https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading ir https://gototags.com/help/ios/nfc/reading/background
- DPP duomenų nešiklis = QR: https://blog.st.com/digital-product-passport/

**Fulfillment:**
- ES 3PL įkainiai (pick&pack €1,50–3; pilnas €5–10/order): https://www.massoninternational.com/blog/third-party-logistics-costs-europe
