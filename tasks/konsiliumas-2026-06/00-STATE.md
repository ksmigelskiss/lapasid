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
