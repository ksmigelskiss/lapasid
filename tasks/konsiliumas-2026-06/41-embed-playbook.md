# Embed-kortelės playbook'as — „įterpiamas saugumo widget'as" (2026-06-11)
_Pirmos dalies (atviros bibliotekos) distribucijos svertas. Detalus apžaidimas._

## Strateginis lūžis
Embed apverčia kopijavimo problemą per PATOGUMĄ, ne apsaugą: įterpimas lengvesnis už kopijavimą
→ žmonės renkasi įterpimą. Kopija negyva (pasensta); embed gyvas (pataisymai propaguojasi),
gražus, autoritetingas. + Kiekvienas embed = backlink → lapasid.lt tampa kanoniniu Google šaltiniu
„ar X nuodinga katėms" (SEO be AI turinio fabriko, kurį redteam nužudė).

## Kortelės anatomija
Akvarelė + vardas (LT+lot) + TOKSIŠKUMAS HEROJUS (ženklas, severity, kam pavojinga) +
disclaimer „informacinio pobūdžio" ANT kortelės (D5 liability) + kuklus LapasID wordmark/link.
Vėliau: „Patikrinta ekspertų" ženkliukas (akademija) — akimirka kai kortelė tampa cituojama.

## KRITINĖ sekos detalė (licencijos)
Pradinė kortelė = TIK vardas+akvarelė+toksiškumas → deriveToxicity (mūsų algoritmas) + ASPCA
faktai + akvarelės = TEISIŠKAI ŠVARU → embed'us galima leisti NELAUKIANT PFAF/knygų valymo.
Aprašymai prisideda po valymo. Licencijų problema nebeblokuoja starto.

## 4 formos (friction tvarka)
1. OG/social kortelės — FB nuoroda pati išsiskleidžia su akvarele+ženklu. LT augalų žmonės GYVENA
   FB grupėse. OG meta + /api/og/{slug} (@vercel/og). 1-2 d.
2. iframe widget + „Įterpti" mygtukas (YouTube modelis) — be raktų/registracijos. Kelios d.
3. oEmbed endpoint — WordPress plika nuoroda → kortelė. 1 d., neproporcingas poveikis blogams.
4. Statinė PNG + PRINT CSS → popierinis tag su toksiškumo ratu = tos pačios kortelės offline brolis.
   Sodo lentelė = atspausdintas embed su QR atgal. Vienas šaltinis, trys pavidalai.

## Kam ir kodėl JIEMS (dovana įterpėjui, ne paslauga mums)
- FB grupės/influenceriai: autoritetingas atsakymas į „ar nuodingas?" vienu link'u
- Mažos parduotuvės (e-shop): jų puslapis nemokamai gauna prof. saugumo kortelę → soft-B2B durys
  BE pardavimo (pardavėjų-kasos idėja apversta: dovanoji; Pro sluoksnis vėliau jei norėsis)
- Botanikos sodas: lentelės = jų edukacinė misija be jų darbo („50 lentelių ekspozicijai" pilotas)
- Mokyklos/darželiai: „saugūs augalai klasei" įterpiamas SĄRAŠAS (ne pavienė kortelė)
- Vet klinikos: augintinių toksiškumo kortelės
- Žiniasklaida: sezoninis press-kit (puansetija Kalėdom, lelijos Velykom)

## Technika (stack'e)
/embed/{slug} — grynas HTML+CSS <50KB, be framer/firebase, edge-cached; /api/og/{slug} (@vercel/og);
/api/oembed pagal spec; „Įterpti" mygtukas species puslapiuose; analitika: rodymai + referrer
DOMENAS (be asmeninės info) → KPI ir šilčiausių partnerių žemėlapis susidaro pats.
**KPI: unikalūs embed'inantys DOMENAI** (ne views) = „tampu standartiniu formatu" matas.

## Ko NEdaryti
Sunkaus widget'o (lėtas = neįterps) · reklamos kortelėje (D3) · gate'inimo (raktai/limitai žudo) ·
tobulumo laukimo (OG + top-50 augalų pakanka startui).

## Seka
1. OG + gražūs species URL (1-2 d.) → 2. /embed + mygtukas, safety-only (kelios d.) →
3. oEmbed (1 d.) → 4. print CSS → sodo pilotas → 5. outreach: 5 bloggeriai + 2 parduotuvės + sodas.
Pirma banga ~savaitė techninio darbo, dauguma deleguojama AI.
