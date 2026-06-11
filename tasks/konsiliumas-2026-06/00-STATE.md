# KONSILIUMAS 2026-06 — BŪSENOS FAILAS (resume mechanizmas)

**Paskutinis atnaujinimas:** 2026-06-11, prieš 3 fazę (raudonoji komanda).
**Jei skaitai šitą naujoje sesijoje:** čia visa būsena darbui tęsti. Dirbk ~/lapasid (branch main).

## Proceso architektūra (patvirtinta founder'io)

0. Kalibracija ✅ — opcionalumas (bootstrap-first, venture durys atviros); resursai = strategijos IŠVESTIS (default „šalia darbo + AI agentai", gali ir full-time jei kelias to vertas); pirma kasa — atvira (B2B vs B2C ginčytina); LT — ginčytinas default.
1. Briefing book ✅ — 01-briefing.md, 02-v1-claims.md, 03-assets.md
2. 8 specialistų panelė ✅ — 10-*.md (8 raportai, ~600K tokenų research)
3. Raudonoji komanda 🔄 — turi rašyti į 20-redteam-*.md (žr. žemiau)
4. Sintezė į 2-3 strategijas + teisėjai ⏳
5. Diskusija su founder'iu → vision V2 + roadmap ⏳

## Failai

- 00-STATE.md — šitas
- 01/02/03 — briefing book
- 10-{b2b-hortikultura,marketplace-ekonomistas,consumer-strategas,hardware-nfc,regulatory-strategas,data-ai-moat,lt-rinka,founder-realybe}.md — specialistai
- 11-sinteze.md — kryžminė sintezė (konsensusai K-1..13, konfliktai KF-1..8, kill-board, 5 strategijos S1-S5, top-10 testų, 3 saviapgaulės vietos)
- 20-redteam-*.md — raudonosios komandos raportai (4 agentai; jei jų nėra arba ne visi 4 — 3 fazė nebaigta, perleisti trūkstamus)

## 3 fazės dizainas (jei reikia perleisti)

4 agentai, kiekvienas skaito 11-sinteze.md + susijusius 10-*.md, ribotas web research (tik kill-shot verifikacijai), RAŠO į savo failą Write tool'u:
- 20-redteam-s2-ekonomika.md — atakuoja S1+S2 hibridą (scan rate, seller WTP, QR komoditizacija per Plantbeeb/GS1)
- 20-redteam-lt-moketojas.md — atakuoja „LT vartotojas mokės" prielaidą + S1 (SEO tūriai, PWA distribucijos handicap, nulinės apatinės ribos scenarijus)
- 20-redteam-wargame.md — konkurencinis war-game (PictureThis/Plantbeeb/Greg/lokalūs; Floramedia QR atvažiavimas į LT; ar LT-localized sluoksnis išgyvena; acquisition scenarijai)
- 20-redteam-aklosios-zonos.md — atakuoja H-MO6 (mirtingumo moat — ar ne nauja iliuzija?), S3/S5, IR patį konsiliumą: ko VISI 8 lęšiai nepamatė

## Po 3 fazės (4 fazė)

Sintezatorius skaito viską → 2-3 koherentiškos galutinės strategijos (wedge→seka→pajamos→ko reikalauja iš founder'io→90d planas) → teisėjų panelė vertina pagal kalibracijos kriterijus → pateikti founder'iui diskusijai.

## Founder'io UŽSAKYTA ateičiai (nepamiršti!)

1. **Išsamesnės apžvalgos tekstai** iš konsiliumo medžiagos — YPAČ apie atrastus precedentus: Plantbeeb×Floramedia + GS1 2027, Costa Farms×Greg, Palmstreet anatomija, Vinted 2016 pamoka, Candide žlugimas, UK HTA kodeksas, Böen vyno NFC, Yuka ekonomika, Thinfilm/Nike Connect NFC kapinės, MasterTag tyrimai, fitosanitarinis registras. Šaltinių URL'ai yra 10-*.md failuose.
2. Vision doc'e IŠTRINTI falsifikuotą „already in discussion at parliamentary level" (H-R5).

## Commit discipline

Po kiekvieno fazės žingsnio: git add tasks/konsiliumas-2026-06/ && commit && push. Jei radai nesucommit'intų failų — commit'ink pirmiausia.

## ATNAUJINIMAS po 3 fazės (2026-06-11)

3 fazė ✅ — 4 redteam raportai (20-redteam-*.md). Esminiai poslinkiai 4 fazei:
- S1+S2 hibridas SUNKIAI SUŽEISTAS: realus scan rate <0,5-2% (ne 14-38%), seller WTP = kategorijos klaida (privalomas POS vs diskrecinis ženklas), „antro QR problema" (importas atvažiuos su Plantbeeb QR), S1 SEO fabrikas = deindeksavimo profilis, reali LT B2C Y1 eilutė €0,5-2K (ne €20-35K).
- **S3 (kolekcinė provenance) — IŠĖJO SUSTIPRĖJUSI iš visų atakų** (nėra antro QR, moka pirkėjas, NFC ekonomika įrodyta). Atlaikiusieji keliai konverguoja į S3+Stripe.
- deathReason: PRIEŠTARA tarp raportų — wargame išsaugojo kaip ACQUISITION turtą (niekas nerenka), aklosios-zonos nužudė kaip MOAT (N aritmetika: reikia 43-96 mirčių/rūšiai; Planta Graveyard jau egzistuoja). 4 fazė privalo sutaikyti: feature+acquisition story TAIP, B2B dataset NE.
- S5 kodeksas krito (valstybė negali endorsinti komercinio; lieka vienašalis gidas ≤2 val./sav.).
- Testų eilė pasikeitė: seller offer-sheets PRIEŠ Stripe testą; Stripe testas — binarinis egzistencijos, ne A/B (n per mažas).
- Acquisition kaip outcome įvardintas pirmąkart (Plantbeeb LT-data tiekėjo kelias; Decorum/RFH = EU Costa atitikmuo).

## 🔴 URGENT veiksmas kodui (PRIEŠ bet ką kito kitoje sesijoje)

**firestore.rules:86 — catalog WRITE atviras bet kuriam authed user.** Redteam + PLD 2024/2853 kontekstas (software griežtoji atsakomybė nuo 2026-12): „saugumo" produkte bet kas gali perrašyti „toksiškas"→„saugus". Fix: write tik isAdmin. Deploy — Firebase Console (manual, kaip storage.rules). Žinoma vulnerabilitė iš catalog-vision-2026-06-02.md:161 — dabar su atsakomybės dimensija.

## 4 fazės užduotis (naujame lange) — STATYTI ANT 32-founder-market-fit.md!
NE „dar 2-3 strategijos", o SPRENDIMO RĖMAS: 3 realūs žaidimai (mažas-pelningas saugumu-vedamas augalų / variklis-pivotas / kill+toliau), kas kiekvieną patvirtina/žudo, ką founder duomenys jau sako. Founder kartelė = pelningas-laiko-atžvilgiu + mylimas + naudingas visuomenei (NE venture). Pagrindinė gija: 32-founder-market-fit (toksiškumo missija + užkampio parduotuvės). Šalia: S3 provenance, 31-demand-signal. + precedentų tekstai (žr. žemiau).

Sintezatorius skaito 11-sinteze.md + 4 redteam → 2-3 galutinės strategijos su redteam korekcijomis (S3 svoris aukštyn, S1+S2 su perrašyta ekonomika, acquisition outcome) → teisėjai pagal kalibraciją → founder'iui diskusijai. + Founder'io užsakymas: precedentų tekstai (žr. aukščiau).
