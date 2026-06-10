# LapasID V1 Vizija — Struktūruotas Teiginių Inventorius

*Skirta strateginei tarybai: kiekvienas teiginys traktuojamas kaip falsifikuojama hipotezė. Ekstrahuota iš public/vision-doc.html 2026-06-10.*

## 1. Kertinė teorija (Core thesis)

LapasID nėra augalų programėlė, o **patvirtintas, perduodamas „pasas" kiekvienam augalui** — pasiekiamas per NFC žymą, QR, viešą URL, programėlę ar spausdintą etiketę. Produktas yra **pasas**, programėlė yra tik vienas „paviršius", o prekyvietė yra **rezultatas, ne įsiveržimo taškas**. Wedge — **saugumas** (toksiškumas pirkimo momentu, nemokamai). Seka: **„Žyma — pamatas. Programėlė — indas. Prekyvietė — rezultatas."** Rinka — tik Lietuva Y1–Y3, pozicionuojantis kaip „vartotojo sluoksnis" ant privalomo ES augalo paso (Reg. 2016/2031).

## 2. Hipotezės

### H-PRODUCT
- **H-P1.** Produktas yra pasas, ne programėlė; pasas gyvena ant 5 paviršių: NFC, QR, viešas URL, app, spausdinta etiketė.
- **H-P2.** Pasas — perduodamas objektas už bet kurios paskyros ribų; vienas NFC nuskaitymas — naujasis savininkas paveldi viską.
- **H-P3.** Priežiūros istorija keliauja su augalu perparduodant/dovanojant; „The buyer inherits, not restarts"; teigiama, kad rinkoje unikalu.
- **H-P4.** NFC žyma = analoginis įspėjimo prietaisas („Ciferblatas v2"): sukamas spalvinis žiedas rodo toksiškumo lygį be programėlės/baterijos; nuskaitymas atveria pilną pasą.
- **H-P5.** Žymos konstrukcija: sukamasis žiedas (nustatomas augintojo ūkyje), NFC ritė + QR fallback, lazeriu graviruotas ID, ant standartinio bambukinio smaigulio.
- **H-P6.** Toksiškumas — pirmaeilis metaduomuo; NEdaroma skirtumo tarp auditorijų (vaiko tėvas vs katės šeimininkas) — „The badge is for whichever audience is reading."
- **H-P7.** Pasas: HEADER (tapatybė+saugumas) + 7 skyriai (apie; priežiūra su PPFD; substratas/sezonai; dauginimas; problemos; įdomybės; viešas pasas).
- **H-P8.** Atpažinimo pipeline — 7 pakopų kaskada, pigesnė anksčiau: katalogas ($0) → pre-DB (1655 gentys) + Wiki/iNat/Wikidata → augalo filtras → AI → praturtinimas (ASPCA+PFAF) → akvarelė → katalogas F1.
- **H-P9.** Du AI personažai (augalas + sodininkas), vienas pokalbio paviršius, žinių bazė.
- **H-P10.** Marketplace — ne tab'as, o „natural endpoint of having a global passport"; „Trust is built into the data model, not bolted onto a transaction."
- **H-P11.** Kiekvienas pipeline įrašas praturtina globalų katalogą (network amortization).

### H-CUSTOMER (B2B 5 sluoksniai + B2C tiers)
- **H-C1 (L1 Fizinės žymos):** wedge; perka nuo 1 dienos (atsakomybės apsauga + „akademiškai patvirtinta"); **€0,20–0,50 marža/žyma**.
- **H-C2 (L2 Ženklo licencija):** „LapasID Patvirtinta" pardavėjo kanaluose, nesusieta su LapasID pardavimu; **€15–30/mėn (~€200–350/m)**.
- **H-C3 (L3 Pakopinis lead-gen):** šiltas signalas; **€2 · €8 · €20 už klientą pagal augalo kainos pakopą**.
- **H-C4 (L4 Marketplace komisinis):** mokėjimai per LapasID; perka kai L3 įrodo konversiją; **7–10% GMV**.
- **H-C5 (L5 Kilmė/perdavimas):** retų augalų provenance; perparduodant pradinis pardavėjas gauna mikro-royalty; **€2–5 išleidimas, €0,20–0,50 perdavimas**.
- **H-C6 (Free):** 15 augalų; toksiškumas visada nemokamai; ~5–10 AI atpažinimų/mėn; memorial puslapiai.
- **H-C7 (Lite €2,99/mėn / €19/m):** 50 augalų; 20 AI/mėn; vision ID; šeima iki 2; analitika.
- **H-C8 (Pro €6,99/mėn / €59/m):** neriboti augalai+AI; AI pokalbiai; kelios kolekcijos; eksportai; early provenance.
- **H-C9:** Memorial = „high-intent re-acquisition moment"; augintojai remia „pakeitimo siūlymą" per L3; „Monetization without paywalling grief."

### H-MARKET
- **H-M1.** Tik Lietuva Y1–Y3.
- **H-M2.** Trajektorija: ~€15K ARR Y1 → ~€100K Y2 → ~€280K Y3 (~80 mokančių sellers + ~4000 mokančių users). PL/DE plėtra 3–5×.
- **H-M3.** Investuojamumo slenkstis: 40 B2B sellers · €8K+ MRR · ARPU>€3 · konversija>4% · churn<5% · plėtros planas. **18–22 mėn.**
- **H-M4.** Funnel prasideda fiziniame pasaulyje: atradimas (botanikos sodai, ekspertų turinys, SEO „ar toksiška katėms") → NFC nuskaitymas be paskyros (4 sek) → Google registracija → įprotis (care, AI, žinynas).
- **H-M5.** Launch kanalas — botanikos sodai (nemokamos žymos pradžiai).

### H-MOAT
- **H-MO1.** „The moat is data nobody else has"; AI negali nukopijuoti to, ko nėra anglų kalba.
- **H-MO2.** Konkretika: 5786 LT pavadinimai (Botanikos vardų žodynas 1998) + 1029 vietinio asortimento SKU (Geliustebuklai.lt) + 300 kuruojamų įrašų + 10 šaltinių.
- **H-MO3.** Šaltiniai: Beckett 1995, Cheng, AHS Encyclopedia; LT: Botanikos žodynas, Gaspadorius, Derlingas; API: iNat/GBIF/Wiki/Wikidata; toksiškumas: ASPCA+PFAF.
- **H-MO4.** 6 išskirtinumai (4 „struktūriškai sunku nukopijuoti"): ES-aligned; toksiškumas nemokamai (PictureThis užrakina); lietuviškai pirmiausia; perduodamas pasas; sellers kanalas; akvarelės identitetas.
- **H-MO5.** „PictureThis is a recognition app; we are the consumer wrapper around a public-safety infrastructure"; konkurentai „cannot retrofit regulatory alignment overnight."
- **H-MO6.** Failure-mode learning (planuojama): anonimizuotos žūties priežastys → rūšies lygio įspėjimai.

### H-REGULATORY
- **H-R1.** „We extend the EU's mandatory plant passport"; „the regulator knows it"; mes — trūkstamas consumer sluoksnis.
- **H-R2.** Metafora: „The EU built the registry. We build the reader."
- **H-R3.** Apsidraudimas: „LapasID does not replace the EU passport. We wrap it."
- **H-R4.** DPP plyšys: DPP apima ~viską, „explicitly leaves living plants out"; ES pasas „goes dark" augalui pasiekus namus; statome savanoriškai, į reguliacijos kryptį.
- **H-R5.** SPEKULIACIJA: „if the EU tightens consumer plant safety regulation (already in discussion at parliamentary level), we are first on the table" — atskirti nuo fakto!
- **H-R6.** Non-dilutive: LT Inovacijų agentūra, Horizon Europe (6 klasteris), Digital Europe, žemės ūkio subsidijos — „realistic capital path before venture money."
- **H-R7.** Partnerysčių matrica: VAT (LT reguliatorius), LŽŪKT, VU+Kauno botanikos sodai, Sodininkų sąjunga, EPPO, EUPHRESCO, ASPCA·PFAF. „A regulator endorsement is worth a year of marketing."
- **H-R8.** „Aligned with" ≠ patvirtinta — siekiamybė, ne partnerystė.

### H-SEQUENCE
- **H-S1.** „Žyma — pamatas. Programėlė — indas. Prekyvietė — rezultatas."
- **H-S2.** B2B sluoksniai pakopiškai: L1 (d.1) → L2 → L3 → L4 (po L3 įrodymo) → L5.
- **H-S3.** Marketplace plinta inkrementiškai (jau live: Parduotuvių naujienos + Noriu/Pirkti).
- **H-S4.** „The marketplace is not the wedge. Safety is."
- **H-S5.** Verifikacijos pakopos: Provisional → Community/Seller → Verified (toksikologas+botanikas).
- **H-S6.** LT (Y1–Y3) → PL/DE.

## 3. Atviri klausimai, kuriuos V1 PATS pripažįsta

- **D1:** Žymą monetizuoti ar subsidijuoti adoption'ui? Botanikos sodų startas tikriausiai free — kas po to?
- **D2:** Phase 0 maržos spąstai: €0,50×50 žymų = gross, ne contribution; po NFC unit cost/SEPA/VAT/fulfillment — **€5–8/mėn/seller ≥12 mėn. „Tag-only mode is hobby economics until L2 or L3 unlocks."**
- **D3:** Žymos vertė priklauso nuo mylimos app; mylima app reikalauja NE-seller-branded user erdvės; „perpetual impression" išlieka tik jei nepermonetizuojam user space.
- **D4:** Prieš viešai sakant „official implementation" — reikia teisinio audito. Pozicija: wrapper/extender, never replacement.
- **D5:** Apimties neatitikimas: ES pasas = augalų sveikata (ligos); mūsų sluoksnis = vartotojų sauga (toksiškumas). Skirtingos teisinės kategorijos — liability ribos turi būti švarios.
- **D6:** Atitiktis prieš greitį: civic infrastruktūra iteruoja lėčiau nei consumer soft — sąmoninga kaina už credibility moat.

## 4. „Real today / in flight" (statusas pagal V1 doc)

**LIVE:** kolekcija+dashboard; toksiškumo UI; laistymo žurnalas+prognozė (tikslumo % ant kortelės); 3 laistymo srautai; dvigubas AI pokalbis; akvarelės identitetas; paieška+AI atpažinimas (tekstu/foto, „Animus"); marketplace v1 (Parduotuvių naujienos + Noriu/Pirkti, pvz. Filodendras „Birkin" €18); žinynas; plant-sitter dalijimasis; family sharing; PWA+offline; async akvarelės generavimas; wishlist alert (push kai norimas augalas atsiranda pas seller'į).

**VYKDOMA:** katalogas F1 + verifikacijos sluoksnis; data-protection sprintas (JWT done); LT vardų pipeline v2; katalogo auditas+dedup; soft-warn vartai; hero raw save.

**PLANUOJAMA (koncepcija!):** NFC žyma (Toxicity Dial) fizinė; ES paso integracija (VAT, atsekamumo kodai); viešojo finansavimo paraiškos; eksperto patvirtinimo srautas; paso perdavimas per NFC; botanikos sodų launch; pilna B2B marketplace; L2 ženklo licencija; aplinkos atitikties įvertinimas; failure-mode learning; ekspertų turinio serija.

**Kalibravimas tarybai:** veikia „indas" (app) + pirmas marketplace touchpoint; „pamatas" (žyma) ir „rezultatas" (pilna marketplace) — dar nepastatyti.

## 5. Emociniai/naratyviniai kabliukai (atskirai nuo verslo)

„Pasas augalui — ramybė namuose" · „Saugumas — ne funkcija, tai pirmas dalykas" · „Augalas prisimena" · „Duomenys gyvuoja ilgiau už nuosavybę" · „Augalas tiesiog gyvuoja toliau" · „Įrodymas, ne pažadas / Autoritetas, ne rizika / Istorija, kuri keliauja" · Memorial + „monetization without paywalling grief" · „Civic infrastructure that happens to enable commerce" · Animus talismanas; augalas+sodininkas personažai · Akvarelė „cared-for, not algorithmic" · „Patikrina per 4 sekundes" be paskyros.

## 6. Vidinės įtampos ir prieštaravimai (kritinis skaitymas)

1. **Pamatas dar nepastatytas, bet seka jį vadina pamatu** — NFC žyma yra koncepcija; visa naratyvinė architektūra (perdavimas, L5) priklauso nuo neegzistuojančio fizinio objekto.
2. **Unit-ekonomika paneigia L1 kaip wedge** — pats doc'as pripažįsta „hobby economics" (€5–8/mėn/seller) iki L2/L3.
3. **„Reguliatorius žino" vs „reikia teisinio audito prieš viešai skelbiant"** — endorsement implikacija be patvirtinimo; „aligned with VAT/EPPO" — siekiamybė.
4. **Apimties neatitikimas gilesnis nei pripažinta** — ligos (B2B) vs toksiškumas (vartotojai) yra skirtingos teisinės kategorijos; „wrap it" gali nereikšti JOKIO teisinio ryšio.
5. **L5 royalty + „perpetual impression" prieštarauja D3** („no seller branding user space") — monetizacija reikalauja branding'o, kurį vizija pati įvardija žalingu.
6. **„Ženklas visiems vienodas" (H-P6) saugumo požiūriu rizikinga** — lelija katei vs žmogui radikaliai skiriasi; vienas ženklas gali būti pavojingai neinformatyvus; įtampa su liability (D5).
7. **„AI negali nukopijuoti ne-anglų" — trapu** — 1998 m. žodynas publikuotas; šiandienos LLM LT vertimą generuoja neblogai; tikrasis moat (kuruotas patvirtinimas, rinkos signalas) realesnis, bet „years to copy" neįrodyta.
8. **Finansinė trajektorija nesutampa su investuojamumu** — Y1 €15K ARR vs slenkstis €96K ARR; tarpinius 12–22 mėn dengia tik grant'ų viltis.
9. **Marketplace deklaruojamas „rezultatu", bet shipinamas PIRMAS** — reali build seka prieštarauja deklaruotai (indas+marketplace yra, pamatas-žyma — ne).
10. **Free tier dosnumas vs B2C ekonomika** — toksiškumas amžinai nemokamas (etinis pažadas) struktūriškai siaurina mokamą paviršių; 4% konversija ir ARPU>€3 — neįrodytos slenksčio sąlygos.
