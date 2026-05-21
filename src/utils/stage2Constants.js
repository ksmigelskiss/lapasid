/**
 * Stage 2 (RAG enrichment) shared constants — naudojami iš:
 *   • SearchModal.fetchDetails (inline Phase 2 RAG injection)
 *   • searchStage2.enrichPlantStage2 (standalone utility wrapper)
 *
 * Tikslas: viena vieta visam RAG-related prompt'avimui. Jei keičiam
 * climate kontekstą ar vet links — pakeitimas vienoje vietoje, ne dviejose.
 */

// Lietuvos klimato kontekstas — Stage 2 AI'us turi žinoti, kad augalas eis
// LT klimato sąlygas, ne UK ar US (kur dauguma source'ų yra).
export const LT_CLIMATE_CONTEXT = `
=== LIETUVA: KLIMATO KONTEKSTAS ===
Hardiness zona: 5b-6a (visa Lietuva, su išimtimis 7a Klaipėdoje)
Šaltų periodų minimas: -25°C kraštutinai, -15°C tipinis
Vegetacijos sezonas: maždaug gegužė-rugsėjis (frost-free)
Žiemos diena (gruodis-vasaris): tik 7-8 val šviesos — kambariniams augalams
  reikia papildomo apšvietimo arba toleruoti dormancy
Vasaros diena (birželis-liepa): iki 17 val šviesos — geri saulės mėgėjams
Vidutinė buto drėgmė šildymo sezonu (spalis-balandis): 30-40%

CARE adjustments LT klimato:
- USDA zona > 7 → tik kambarinis arba šiltnamio
- USDA zona 5-6 → tinka lauke
- USDA zona < 5 → puikiai tinka lauke
- Žiemą laistyti rečiau (mažiau šviesos, lėtesnis augimas)
- Vasarą galima išnešti į balkoną/lauką po paskutinio šalčio (maždaug gegužės vidurio)
`

// External vet links — naudojami toxic plants atveju. AI NEGENERUOJA first-aid
// medical advice'o; vietoj to linkuoja vartotoją į autoritetingus šaltinius.
export const VET_LINKS = `
=== EXTERNAL SOURCES (toxicity-related) ===
- ASPCA Animal Poison Control: https://www.aspca.org/pet-care/animal-poison-control
- Pet Poison Helpline: https://www.petpoisonhelpline.com/
- Lietuvos veterinarijos pagalba: konsultuokitės su veterinaru
`

// RAG priority instrukcija (2026-05-21 v3): nuo „RAG > memory" prie
// „RAG = ANCHOR + EXPAND". Pamatėm, kad AI'us interpretavo per stipriai
// — kopijuoja PFAF 1-sakinio intro be expand'inimo, praleidžia toxicity
// narrative. Mūsų SAVO botanikos žinių nepakanka be RAG, BET RAG vienas
// nepakanka be AI EXPAND.
//
// Tikslas: 99.9% AI'us sudeda RICH LT NARRATIVE (kaip Adenium ekrane —
// mechanism, simptomai, kultūrinis kontekstas). Deterministic backfill
// lieka kaip safety net 0.1% atvejų.
export const RAG_PRIORITY_INSTRUCTION = `
=== RAG CONTEXT — ANCHOR + EXPAND (NOT JUST COPY) ===

You will receive VERIFIED FACTS below from our scraped plant database
(AHS Encyclopedia, Beckett, Cheng, PFAF, ASPCA, Wikipedia, lt-names).

🎯 YOUR ROLE: USE RAG AS ANCHOR, THEN GENERATE RICH LITHUANIAN NARRATIVE.

RAG yra MINIMAL FACTS — anchor'as, nuo kurio tavęs reikia ekspand'inti
PILNĄ rich content. Vartotojui reikia plant detail puslapio, NE Beckett
encyclopedia 1-sakinio intro tiesioginio vertimo.

INTERPRET RAG correctly:
  ✅ RAG fact'as "PFAF: knownHazards = 'plant is highly toxic, causes
     paralysis of nerve centers...'" reiškia, kad TU PRIVALAI generuoti
     3-5 sakinių LT narrative apie toxicity — mechanism, simptomai,
     kultūrinis kontekstas, first-aid pointer. NE tiesiog versti vieną
     sakinį.
  ❌ NEPRIIMK RAG kaip celling — tai grindys, ne lubos.

RULES:
  • RAG facts yra UNDENIABLE. Niekada neprieštaruok.
  • Iš RAG kaip seed ekspand'ink su savo botanikos žiniomis: etymology,
    geographic specifics, ecological role, cultivation history, cultural/
    medicinal uses, distinctive morphology.
  • Mark uncertain extensions su „tikriausiai" / „galimai".

FIELD-LEVEL EXPECTATIONS:

📝 APRASYMAS — 3-5 PILNŲ sakinių LT.
  Pavyzdys: „Aconitum napellus (kurpelė) yra vienas iš nuodingiausių
  Europos žolinių augalų, priklausančių vėdryninių (Ranunculaceae) šeimai.
  Augalas pasižymi būdingais šalmiečių žiedais, dėl kurių anglų kalba
  vadinamas „monkshood". Auga Europos kalnų pievose ir miškuose, ypač
  Alpėse. Senovėje sultys naudotos strėlių nuodais, šiandien — homeopatijai
  ir labai retai medicinai (po griežtos dozavimo)."
  ❌ Per trumpa: „Kurpelė yra vėdrynių šeimos augalų rūšis."

⚠️ SAVYBES.PAVOJAI[] + PAVOJINGUMAS.DETALES — REIKIA RICH NARRATIVE
  Toxic augalams pavojingumas.detales PRIVALO turėti 3-5 sakinius LT:
    1. KAS toksiška (visi audiniai / tik sultys / tik šaknys / sėklos)
    2. KOKIE mechanism'as (širdies glikozidai? Kalcio oksalatai? Saponinai?)
    3. SIMPTOMAI gyvūnams + žmonėms (kontaktas su oda, nurijus, t.t.)
    4. KAM ypač pavojinga (vaikai, naminiai gyvūnai)
    5. KAS DARYTI nelaimei (Pet Poison Helpline, veterinaras — žiūr.
       =EXTERNAL SOURCES= žemiau)

  Pavyzdys, kuris VEIKIA:
  „Visuose Adenium audiniuose, ypač latekso sultyse, yra širdies glikozidų
  (digitalino tipo junginių — oleandrin, neriine ir kt.), kurie net mažais
  kiekiais nurijus sukelia širdies ritmo sutrikimus, pykinimą, vėmimą ir
  gali būti mirtini žmonėms bei gyvūnams. Kontaktas su sultimis sukelia
  odos ir gleivinių dirginimą. Ypač pavojinga vaikams ir augintiniams
  (katėms, šunims). Kai kuriose Afrikos kultūrose sultys naudotos kaip
  strėlių nuodai. Kilus įtarimui — kreipkitės į veterinarą ar Pet Poison
  Helpline."

  pavojai[] entries (struct'urized) — pildyk GENEROUSLY:
    • Severity: stiprus (death/fatal/lethal), vidutinis (paralysis/vomit/severe),
      silpnas (irritation/rash/mild)
    • target: zmonems / gyvunams
    • Default 'vidutinis' kai info patvirtinta bet specifika neaiški

✨ IDOMYBES[] — 2-3 items su REAL facts.
  Pavyzdys: „Augalas pavadinimą gavo iš graikų „akoniton", kuris reiškė
  bet kokį nuodingą augalą." (etymology), „Senovėje romėnai juo nuodydavo
  griežtai prižiūrimus persekiojamuosius." (history), „Žiedų formą ūkininkai
  vadina ‚vienuolio gobtuvu' arba ‚kurpe' — iš ko ir lietuviškas pavadinimas."

🌱 PRIEZIURA — Strukturizuok PFAF cultivation prose į schema:
  prieziura: 4 narrative LT (sviesa, laistymas, temperatura, dregme)
  sviesa.lygis: žema/vidutinė/ryški + ppfd range
  vanduo.lygis: mažai/vidutiniškai/daug
  laistymasIntervalas.vasara/ziema (dienų skaičius)

🦴 VAISTINIS / VALGOMUMAS — Iš PFAF ratings.
  rating > 0 → pildyk; rating = 0 → statusas:'none', tuščia.

🩹 FIRST-AID — Niekada negeneruok dosing'o ar treatment'o.
  Toxic plants → pavojingumas.detales paminėk „kreipkitės į veterinarą
  ar Pet Poison Helpline", linkuok external sources žemiau.
`
