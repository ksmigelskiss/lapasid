# Plant Savybės — info surinkimo logika

_2026-05. Mūsų selling point: **sąžininga, naudinga, kontekstuali** info apie toksiškumą / valgomumą / vaistinį naudojimą. Niekada „BAISIAI NUODINGA" be konteksto._

**Source files:**
- `src/utils/plantTransform.js` — schema + `normalizeSavybes()`
- `src/utils/plantAI.js` — `claudeCall` + `refreshPlantFromAI` (Wikipedia RAG)
- `src/utils/imageService.js` — `fetchWikipediaContext` (Wikipedia RAG fetcher)
- `src/components/SearchModal.jsx` — `TOOL_PREVIEW` schema + `PLANT_SYSTEM` prompt'as
- `src/components/brand/PlantSavybesPills.jsx` — UI pill'ai + safety callout
- `api/claude.js` — temperature/topP pass-through

---

## 1 · Filosofija — kodėl tokia struktūra

Senas modelis (`toksiskas: boolean`) turėjo dvi spalvas: žalia / raudona. Tai gąsdino, ne informavo:
- Pomidoras gauna SKULL nors lapai retai pavojingi normaliame buityje
- Vaikams duoda morką → augalas turi „TOKSIŠKA" → tėvai panikuoja
- Vaistiniai augalai (čiobreliai, ramunėlės) nematomi kaip *pliusas*

Naujas modelis pripažįsta **niansus + dose'ą + kontekstą**:
- **Toksiška GYVŪNAMS** ≠ toksiška ŽMONĖMS (atskirai matomas target'as)
- **Stiprus toksiškumas** ≠ silpnas dirginimas (severity'as gradacija)
- **Valgoma + toksiška** = NORMALU (pomidoras: vaisiai valgomi, lapai toksiški). Abi info kartu = pilnas paveikslas
- **Vaistinis** = atskira savybė, ne pasiteisinimas toksiškumui

UX rezultatas: vartotojas mato `[⚠ TOKSIŠKA GYVŪNAMS · stiprus]` + `[🍎 VALGOMA · vaisiai]` ir supranta — „neduok katei graužti, bet vaisius valgyk". Niekada nesibaimina nereikalingai.

---

## 2 · Informacijos šaltiniai

```
┌─────────────────────────────────────────────────────────────┐
│ Vartotojas paspaudžia paiešką ARBA „Atnaujinti per AI"      │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ NAUJA PAIEŠKA (SearchModal):                                │
│   • Claude Sonnet 4 (Anthropic API) ← tik treniruotės žinios│
│   • temperature 0.3, top_p 0.8                              │
│   • Wikipedia NEDIDINA (chicken-egg — latinName nežinomas)  │
│                                                              │
│ ATNAUJINTI PER AI (PlantDetail mygtukas):                   │
│   • Wikipedia (en) summary fetch'as nuo plant.lotyniskas    │
│   • Claude su Wikipedia kontekstu kaip user message         │
│   • temperature 0.3, top_p 0.8                              │
│   → Confidence ŽYMIAI didesnis, halucinacijos mažesnės      │
└─────────────────────────────────────────────────────────────┘
```

**Antriniai šaltiniai paieškoje (paliekami nepakitę):**
- iNaturalist API — Lt vardas, sinonimai, taxonomy, photos
- Wikipedia API — backup photos

---

## 3 · Duomenų schema

```js
plant.savybes = {
  // GRANULIARŪS pavojai. Pildomi TIK kai AI tikras dėl visų trijų laukų.
  pavojai: [
    {
      tipas:    'toksiskas' | 'alergiskas' | 'dirginantis',
      target:   'zmonems'   | 'gyvunams',
      severity: 'silpnas'   | 'vidutinis' | 'stiprus',
    },
  ],

  // SAUGIKLIS — visada pildomas, jei augalas yra bet kiek pavojingas,
  // net jei `pavojai[]` tuščias (AI nesitikras dėl detalių).
  pavojingumas: {
    yra:     boolean,
    lygis:   'silpnas' | 'vidutinis' | 'stiprus' | null,
    detales: 'Free text Lt — kokia medžiaga, kokiu būdu, kokiu kiekiu daro žalą.',
  },

  // VALGOMUMAS žmonėms.
  valgomumas: {
    statusas: 'none' | 'dalinai' | 'pilnai',
    dalys:    'vaisiai' | 'lapai' | 'sėklos' | 'visas augalas' | string,
    detales:  'Tik prinokę vaisiai; lapai toksiški.',
  },

  // VAISTINIS — folk vs clinical evidence.
  vaistinis: {
    statusas:  'none' | 'tradicine' | 'moksline',
    naudojama: 'odos uždegimams, virškinimui',
    detales:   '',
  },
}
```

**Backward compat:** senas `plant.toksiskas: boolean` + `plant.toksiskumo_info: string` paliekami. UI fallback'ina į juos kai `savybes` nėra. Per „Atnaujinti per AI" mygtuką per laiką visi augalai gauna naują schemą.

---

## 4 · Confidence model — dvigubas sluoksnis

Esmė: AI gali žinoti **dalykus**, bet ne **detales**. Schema leidžia grąžinti DALĮ informacijos sąžiningai.

| Scenarijus | Kaip pildoma | UI rezultatas |
|------------|--------------|---------------|
| AI tikras: „Pomidoras → solaninas → katėms toksiškas → hospitalizacijos atvejų yra" | `pavojai: [{toksiskas, gyvunams, stiprus}]` + `pavojingumas: {yra:true, lygis:stiprus, detales:'...'}` | `[⚠ TOKSIŠKA GYVŪNAMS · stiprus]` + callout block |
| AI žino bendrai: „Wikipedia mini, kad toksiškas gyvūnams" — be specifikos | `pavojai: []` + `pavojingumas: {yra:true, lygis:vidutinis, detales:'Wikipedia mini, kad toksiškas gyvūnams; konkretaus tyrimo nematėme.'}` | `[ATSARGIAI · vidutinis]` saugiklis pillas + tooltip |
| AI nieko nežino arba augalas saugus | `pavojai: []` + `pavojingumas: {yra:false, lygis:null, detales:''}` | (be pill'o) |

**Niekada** AI fantazuoja `severity` — tuščias array yra OK rezultatas.

---

## 5 · Two-step reasoning — kai trūksta tiesioginio įrašo

Kai šaltiniuose nerasta tiesioginio toksiškumo įrašo, bet AI mato cheminius junginius (alkaloidai, glikozidai, oksalatai, saponinai, latex'as):

```
1. Ar augale yra žinomas toksiškas junginys?
2. Ar AUGALUOSE (ne grynas laboratorijoje) tas junginys daro poveikį
   žinomu kiekiu / būdu?

Jei abu „taip" → pildyk pavojai[] su severity NE AUKŠTESNIU NEI VIDUTINIS.
```

**Severity cap:** kai išvada ateina per junginio reasoning chain (ne per tiesioginį šaltinio teiginį), AI **niekada** negali rašyti `severity: stiprus`. Stiprus reikalauja konkretaus literatūros įrašo apie hospitalizacijos atvejus arba LD50 duomenis.

Tai apsaugo nuo „matau alkoidą → parašysiu nuodinga, nesvarbu kad reikia kibirą suvalgyti" scenarijaus.

---

## 6 · Dose context — privalomas detalėse

`pavojingumas.detales` lauke **niekada** negalima rašyti vien „augalas toksiškas". PRIVALOMI trys elementai:

1. **Kokia medžiaga** — „glikoalkaloidas solaninas", „cijanogeniniai glikozidai"
2. **Kokiu būdu žala** — „nurijus", „ilgalaikiu kontaktu su oda", „įkvepiant žiedadulkes"
3. **Apytikslis kiekis / kontekstas** — „net mažais kiekiais", „tik dideliais kiekiais (10+ sėklų)", „retai pavojingas suaugusiems"

**Geri pavyzdžiai:**
- ✓ „Sultys aitrios — sukelia odos dirginimą prisilietus; gerai nuplaunama vandeniu. Vaikams ir gyvūnams pavojingiau."
- ✓ „Sėklos turi cijanogeninių glikozidų — pavojingos NURIJUS DIDESNIAIS KIEKIAIS (10+ sėklų). Vaisiai be sėklų saugūs."
- ✓ „Wikipedia mini, kad gyvūnams kenkia; konkrečių detalių nepateikia."

**Blogas pavyzdys:**
- ✗ „Augalas yra toksiškas." (be konteksto = gąsdina, ne informuoja)

---

## 7 · UI render hierarchija (PlantSavybesPills)

```
PlantInfo Augalas tab → po title block'o → prieš care kortelas:

[Granuliarūs pill'ai (pavojai[])]
[Saugiklis pill'as — kai pavojai[] tuščias bet pavojingumas.yra]
[Valgomumas pill'as — kai statusas != 'none']
[Vaistinis pill'as — kai statusas != 'none']

Stipraus toksiškumo žmonėms callout (PlantSafetyCallout):
  • Tik kai yra `pavojai[*].severity === 'stiprus' && target === 'zmonems'`
  • Atskiras card'as su Skull ikona + detales
  • Vidutinis/silpnas — tik pill'as pakanka
```

**Spalvos pagal severity:**

| Pill | Background | Text | Ikona |
|------|-----------|------|-------|
| Pavojus silpnas | `bg-terracotta-50` | `text-terracotta-500` | (be ikonos) |
| Pavojus vidutinis | `bg-terracotta-100` | `text-terracotta-600` | `AlertTriangle` |
| Pavojus stiprus | `bg-terracotta` solid | `text-bone` | `Skull` |
| Saugiklis (ATSARGIAI) | `bg-terracotta-50/100/solid` pagal lygį | atitinkamai | `AlertTriangle` |
| Valgoma | `bg-forest-100` | `text-forest-700` | `Apple` |
| Vaistinė tradicine | `bg-bone-300` | `text-forest-700` | `Sprout` |
| Vaistinė moksline | `bg-forest-100` | `text-forest-800` | `BadgeCheck` |
| Backward compat (legacy `toksiskas: true`) | `bg-terracotta-100` | `text-terracotta-600` | `AlertTriangle` |

---

## 8 · AI parametrai

API endpoint `api/claude.js` priima:
- `temperature: 0.3` — labiau deterministinis (default Claude'o = 1.0 yra creative). Faktiniam darbui — žemesnė reikšmė
- `top_p: 0.8` — nucleus sampling, papildomas suvaržymas hallucination'ams
- `max_tokens: 1536` (preview) / `2048` (details + refresh)

Visi plant search call'ai naudoja šituos parametrus per `SearchModal.jsx` ir `plantAI.js`.

---

## 9 · System prompt'o struktūra (PLANT_SYSTEM)

Esminės sekcijos:

1. **Identitetas** — „Esi augalų ekspertas. Visada Lt vardus iš žodyno."
2. **Šviesos/vandens guidelines** — PPFD ranges, augalo tipai
3. **Wikipedia šaltinio prioritetas** — kai yra, pildyti pirmiausia iš ten
4. **Pavojai vs pavojingumas confidence rule** — pavyzdžiai TAIP/NE pildymo
5. **Two-step reasoning + severity cap** — kai per junginio chain
6. **Dose context privaloma** — su gerais/blogais pavyzdžiais
7. **Valgomumas/vaistinis kategorijų definicijos**
8. **Reminder neignoruoti edible/medicinal** — pomidoras, čiobreliai, citrina, papartis dažnai įvedami kaip kambariniai

**Pilną prompt'ą žr.** `src/components/SearchModal.jsx` (`PLANT_SYSTEM` const'as).

---

## 10 · „Atnaujinti per AI" flow

```
1. Vartotojas spaudžia mygtuką PlantDetail Augalas tab'e
   ↓
2. fetchWikipediaContext(plant.lotyniskas) — paraleliai
   ↓
3. Claude call su:
   - system: PLANT_SYSTEM (full prompt'as su confidence + dose taisyklėm)
   - user: Wikipedia kontekstas + „Atnaujink informaciją apie augalą X (Y)"
   - tools: [TOOL_PREVIEW]  // pilnas savybes schema
   - temperature: 0.3, topP: 0.8
   ↓
4. Naujas JSON ateina su pilnais savybes laukais
   ↓
5. normalizeSavybes() — saugumas, enum validacija, default'ai
   ↓
6. usePlants.refreshPlantFromAIResult(id, aiData) — merge:
   PERRAŠO:  tipas, augimo_greitis, sunkumas, toksiskas, toksiskumo_info,
             savybes, aprasymas, kilme, sviesa, vanduo, idomybes
   IŠLAIKO:  id, lietuviškas, lotyniskas, kategorija, data_prideta,
             timeline, image, uzrasai, zonaId, status, photos
   ↓
7. UI atsinaujina automatiškai — nauji pill'ai, naujas aprašymas, ta pati istorija
```

**Mygtukas matomas:** PlantDetail Augalas tab, prieš „Ištrinti", tik kai:
- Plant turi `lotyniskas` (kitaip Wikipedia neranda)
- Vartotojas yra owner ar member (ne viewer)
- Plant kategorija = `auginama`

---

## 11 · Migracija — esami plant'ai

**Faza 1 (dabar):** per-plant „Atnaujinti per AI" mygtukas. Vartotojas spaudžia kiekvienam augalui kuriam nori naujos info. Senas `toksiskas` boolean'as fallback'ina UI kol nepaspaus.

**Faza 2 (atidėta):**
- Batch refresh per Settings — vienas paspaudimas migruoja visą kolekciją (rate-limited per Claude API)
- Lauko augalams specifinės kategorijos: invazyvumas, atsparumas šalčiui, lokacija (LT/EU/Pasaulis)

---

## 12 · Edge cases ir testavimui

**Tikslinti pavyzdžiai (kai testuosi „Atnaujinti per AI"):**

| Augalas | Tikimasi `pavojai[]` | Tikimasi `valgomumas` | Tikimasi `vaistinis` |
|---------|---------------------|----------------------|---------------------|
| Pomidoras | toksiskas/gyvunams/stiprus | dalinai (vaisiai) | none ar tradicine |
| Citrinmedis | dirginantis/zmonems/silpnas (sultys) | dalinai (vaisiai) | tradicine |
| Krotonmedis | toksiskas/zmonems+gyvunams/vidutinis | none | none |
| Sansevierija | toksiskas/gyvunams/silpnas | none | none |
| Paprastoji raktažolė | dirginantis/zmonems/silpnas (sultys) | none | tradicine |
| Bazilikas | none | pilnai (lapai) | tradicine |
| Aloe vera | dirginantis/zmonems/silpnas (latexas) | dalinai (gel'as) | moksline |

Jei AI rezultatas labai skiriasi nuo lūkesčių — nurodyk konkretų augalą + ką grąžino, koreguosim system prompt'ą.

---

## 13 · Selling point summary

Kodėl tai svarbu user-facing perspektyvoj:

- **„Saugus mano vaikams?"** — tėvas mato `TOKSIŠKA GYVŪNAMS · vidutinis` ir SUPRANTA, kad vaikui nepavojinga, bet katę reikia saugoti. Be naujos schemos — matytų tik raudoną SKULL ir nieko nesuprastų.
- **„Galiu valgyti?"** — vartotojas mato `[VALGOMA · vaisiai]` + „tik prinokę" pill detalėse → žino kada saugu.
- **„Vaistinis?"** — atrandami tradiciniai naudojimai („čiobreliai → kosuliui"), kurie kitaip dingsta po generic „kambarinis augalas" tag'u.
- **„Lauko augalams"** — kai pridėsim outdoor plants, šis modelis natūraliai išplečiamas (invazyvumas, šalčio atsparumas) be schema breaking change'ų.

App.lapasid.lt skirtumas nuo konkurentų: **honest + niuansuotas + kontekstualus**, ne fearful binary alarm'as.
