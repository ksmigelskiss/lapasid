import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'
import { ArrowLeft, Search, X, Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchPhotos, resizeImage, fetchWikipediaContext } from '../utils/imageService'
import { fetchPlantNames } from '../utils/plantNames'
import { fromAIResult } from '../hooks/usePlants'
import { getCatalogEntry, saveToCatalog, searchCatalog, catalogEntryToAIResult, catalogDocId } from '../utils/catalog'
import { plantFuzzyScore } from '../utils/fuzzySearch'
import { ProfileContent } from './PlantDetail'
import { auth } from '../utils/firebase'
import PaywallSheet from './PaywallSheet'
import BrandLoader from './brand/BrandLoader'
import PlantImage from './brand/PlantImage'
import T4Icon from './brand/T4Icon'
import Mascot from './brand/Mascot'

// Calls server-side proxy — Anthropic API key never in browser
// Throws { code: 'limit_reached', limitType } when free tier is exhausted
async function claudeCall(body) {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null)
  const headers = { 'Content-Type': 'application/json' }
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`

  const res = await fetch('/api/claude', {
    method:  'POST',
    headers,
    body:    JSON.stringify({ ...body, limitType: 'searches' }),
  })

  if (res.status === 403) {
    const err = await res.json().catch(() => ({}))
    if (err.error === 'limit_reached') {
      const e = new Error('limit_reached')
      e.code = 'limit_reached'
      e.limitType = err.limitType ?? 'searches'
      throw e
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Phase 1: fast preview (name, stats, description, facts) ──────
export const TOOL_PREVIEW = {
  name: 'plant_preview',
  description: 'Pateik pagrindinę augalo informaciją greitai. SVARBU — privalomi confidence ir matchLevel laukai, kad galėtume rodyti vartotojui kai info nepatikima.',
  input_schema: {
    type: 'object',
    properties: {
      // ── Confidence metadata (kritiškai svarbu — neleidžia AI tyliai
      //    grąžinti artimiausią rūšį kaip atsakymą į cultivar užklausą) ─
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Tavo tikrumas, kad atsakymas atitinka užklausą. high = aiškiai žinai šitą tiksliai augalą; medium = žinai bendrai (pvz. gentį) bet ne tikslų cultivar/sub-species; low = nežinai konkrečiai, atsakymas yra spėjimas remiantis artimiausiu giminaičiu.',
      },
      matchLevel: {
        type: 'string',
        enum: ['cultivar', 'species', 'genus', 'unknown'],
        description: 'Kokiu taksonomijos lygiu tikrai pataikei. cultivar = tikslus cultivar/hybrid identifikuotas; species = tik iki species lygio; genus = tik genties lygis; unknown = nesi tikras net dėl genties.',
      },
      uncertaintyReason: {
        type: ['string', 'null'],
        description: 'Jei confidence != high — paaiškink lietuviškai 1 sakiniu KODĖL nesi tikras. Pvz. „Šio cultivar (Clematis Boulevard) nėra mano žinių bazėje, pateikiu bendrą Clematis informaciją." arba „Nuotraukoje matomas neaiškus augalas, gali būti X arba Y." null jei confidence == high.',
      },
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'Šaltiniai, iš kurių sėmesi info. Jei naudojai web_search tool — surašyk apsilankytus URL\'us (pvz. „https://www.rhs.org.uk/plants/...", „https://en.wikipedia.org/wiki/..."). Jei rėmeisi tik savo žiniomis — palik tuščią array.',
      },
      candidates: {
        type: 'array',
        description: 'JEI confidence != "high" IR yra plausibly identifikuojamų kandidatų (cultivar serijos nariai, vizualiai panašios rūšys) — surašyk 2-5 kandidatus. User\'is paskui pasirinks vieną → nauja paieška su tiksliu pavadinimu → high confidence rezultatas. Tuščia array jei kandidatai neaišku arba confidence == high.',
        items: {
          type: 'object',
          properties: {
            latinName:             { type: 'string', description: 'Tikslus lotyniškas pavadinimas su cultivar žymeniu (pvz. „Clematis \'Acropolis\'")' },
            ltName:                { type: ['string', 'null'], description: 'Lietuviškas pavadinimas jei žinai, kitaip null' },
            description:           { type: 'string', description: '1-2 sakiniai apie šitą cultivar/variantą — kilmė, serija, charakteringa ypatybė.' },
            distinguishingFeature: { type: 'string', description: 'GRYNAI VIZUALUS aprašymas (žiedų spalva, dydis, forma, lapų formos), kuris padės user\'iui atskirti šitą cultivar nuo kitų kandidatų LYGINANT SU TIKRA AUGALO NUOTRAUKA. NEPRIDĖK serijos / sukūrimo metų / aukščio / žydėjimo periodo — tai eina į description. Pvz. „Ryškiai pink žvaigždiniai žiedai su tamsesne pink juostele per centrą; balti kuokeliai" gerai. „Pristatytas 2013m. Chelsea Flower Show, populiarus" — BLOGAI, eina į description.' },
            imageUrl:              { type: ['string', 'null'], description: 'Jei web_search rezultatuose APLANKEI puslapį, kuriame buvo direct image URL (formato https://.../something.jpg|png|webp) šios SPECIFINĖS cultivar nuotrauka, pateik čia. SVARBU: tik URL adresai, kuriuos tikrai matei web_search rezultate, ne spėjimai. Geriau null nei hallucinuotas URL. Idealiai iš RHS / nursery / Wikipedia article body, ne thumbnail.' },
          },
          required: ['latinName', 'description', 'distinguishingFeature', 'imageUrl'],
        },
      },
      name:            { type: 'string',  description: 'Tikras lietuviškas pavadinimas. NIEKADA angliškas ar lotyniškas.' },
      latinName:       { type: 'string',  description: 'Tikslus lotyniškas pavadinimas (su cultivar žymeniu jei taikoma, pvz. „Clematis \'Boulevard\'")' },
      emoji:           { type: 'string',  description: 'Vienas emoji' },
      tipas:           { type: 'string',  description: 'Augalo tipas (pvz. Sultingas, Tropinis daugiametis...)' },
      augimo_greitis:  { type: 'string',  enum: ['lėtas', 'vidutinis', 'greitas'] },
      sunkumas:        { type: 'integer', minimum: 1, maximum: 5 },
      toksiskas:       { type: 'boolean', description: 'Backward compat — TRUE jei yra bet koks pavojus' },
      toksiskumo_info: { type: ['string', 'null'], description: 'Backward compat — savybes.pavojingumas.detales kopija' },
      savybes: {
        type: 'object',
        description: 'Struktūruoti augalo savybės: pavojai (granuliariai), valgomumas, vaistinis.',
        properties: {
          pavojai: {
            type: 'array',
            description: 'GRANULIARŪS pavojai. Pildyk TIK kai TIKRAS dėl tipo+target+severity (literatūra/Wikipedia aiškiai nurodo). Jei žinai tik bendrai — palik tuščią ir pildyk pavojingumas.* saugiklį.',
            items: {
              type: 'object',
              properties: {
                tipas:    { type: 'string', enum: ['toksiskas', 'alergiskas', 'dirginantis'] },
                target:   { type: 'string', enum: ['zmonems', 'gyvunams'] },
                severity: { type: 'string', enum: ['silpnas', 'vidutinis', 'stiprus'] },
              },
              required: ['tipas', 'target', 'severity'],
            },
          },
          pavojingumas: {
            type: 'object',
            description: 'SAUGIKLIS — visada pildyk, jei augalas yra bet kiek pavojingas, net jei pavojai[] tuščias.',
            properties: {
              yra:    { type: 'boolean' },
              lygis:  { type: ['string', 'null'], enum: ['silpnas', 'vidutinis', 'stiprus', null] },
              detales: { type: 'string', description: 'Free text Lt kalba: kokia medžiaga, kokiu būdu, kokiu kiekiu daro žalą. PRIVALOMAS dose kontekstas — pvz. „nurijus dideliais kiekiais", „ilgalaikiu kontaktu su oda".' },
            },
            required: ['yra', 'lygis', 'detales'],
          },
          valgomumas: {
            type: 'object',
            properties: {
              statusas: { type: 'string', enum: ['none', 'dalinai', 'pilnai'] },
              dalys:    { type: 'string', description: 'Pvz. „vaisiai", „lapai", „sėklos", „visas augalas". Tuščia jei none.' },
              detales:  { type: 'string', description: 'Kontekstas. Pvz. „Tik prinokę vaisiai; lapai toksiški."' },
            },
            required: ['statusas', 'dalys', 'detales'],
          },
          vaistinis: {
            type: 'object',
            properties: {
              statusas:  { type: 'string', enum: ['none', 'tradicine', 'moksline'], description: 'tradicine = liaudies medicina; moksline = klinikiniai įrodymai' },
              naudojama: { type: 'string', description: 'Pvz. „odos uždegimams, virškinimui". Tuščia jei none.' },
              detales:   { type: 'string' },
            },
            required: ['statusas', 'naudojama', 'detales'],
          },
        },
        required: ['pavojai', 'pavojingumas', 'valgomumas', 'vaistinis'],
      },
      aprasymas:       { type: 'string',  description: '4-6 sakinių aprašymas — kilmė, išvaizda, kodėl populiarus' },
      kilme:           { type: 'string' },
      sviesa: {
        type: 'object',
        properties: {
          taskai: { type: 'integer', minimum: 1, maximum: 3 },
          lygis:  { type: 'string', enum: ['žema', 'vidutinė', 'ryški'] },
          ppfd:   { type: 'object', properties: { min: { type: 'integer' }, max: { type: 'integer' } }, required: ['min', 'max'] },
        },
        required: ['taskai', 'lygis', 'ppfd'],
      },
      vanduo: {
        type: 'object',
        properties: {
          taskai: { type: 'integer', minimum: 1, maximum: 3 },
          lygis:  { type: 'string', enum: ['mažai', 'vidutiniškai', 'daug'] },
        },
        required: ['taskai', 'lygis'],
      },
      idomybes: { type: 'array', items: { type: 'string' }, description: '2-3 įdomūs faktai' },
    },
    required: ['confidence', 'matchLevel', 'uncertaintyReason', 'sources', 'candidates',
               'name', 'latinName', 'emoji', 'tipas', 'augimo_greitis', 'sunkumas',
               'toksiskas', 'savybes', 'aprasymas', 'kilme', 'sviesa', 'vanduo', 'idomybes'],
  },
}

// ── Phase 2: full details (care, watering, problems, etc.) ────────
export const TOOL_DETAILS = {
  name: 'plant_details',
  description: 'Pateik išsamią augalo priežiūros informaciją.',
  input_schema: {
    type: 'object',
    properties: {
      laistymasIntervalas: {
        type: 'object',
        properties: {
          vasara:  { type: 'integer' },
          ziema:   { type: ['integer', 'null'] },
          metodas: { type: 'string' },
        },
        required: ['vasara', 'ziema', 'metodas'],
      },
      tresimas: {
        type: 'object',
        properties: {
          intervalVasara: { type: 'integer' },
          intervalZiema:  { type: ['integer', 'null'] },
          tipas:          { type: 'string' },
        },
        required: ['intervalVasara', 'intervalZiema', 'tipas'],
      },
      dormancyInfo: {
        type: 'object',
        properties: {
          reikia: { type: 'boolean' },
          tipas:  { enum: ['full', 'partial', null] },
        },
        required: ['reikia', 'tipas'],
      },
      prieziura: {
        type: 'object',
        properties: {
          sviesa:      { type: 'string' },
          laistymas:   { type: 'string' },
          temperatura: { type: 'string' },
          dregme:      { type: 'string' },
        },
        required: ['sviesa', 'laistymas', 'temperatura', 'dregme'],
      },
      substratas:   { type: 'string' },
      persodinimas: { type: 'string' },
      ziemojimas:   { type: 'string' },
      dauginimas:   { type: 'array', items: { type: 'string' } },
      problemos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            simptomas:  { type: 'string' },
            priezastis: { type: 'string' },
            sprendimas: { type: 'string' },
          },
          required: ['simptomas', 'priezastis', 'sprendimas'],
        },
      },
    },
    required: ['laistymasIntervalas', 'tresimas', 'dormancyInfo', 'prieziura',
               'substratas', 'persodinimas', 'ziemojimas', 'dauginimas', 'problemos'],
  },
}

export const PLANT_SYSTEM = `Esi augalų ekspertas. Visada ieškok tiksliai nurodyto augalo. Rašyk LIETUVIŠKAI, natūraliai.

═════════════════════════════════════════════════════════
WEB SEARCH — NAUDOJIMAS
═════════════════════════════════════════════════════════

Turi prieigą prie web_search tool'o. KADA jį naudoti:

  ✓ Cultivar/hybrid užklausoms, kurių pavadinimu nesi 100% tikras
    (pvz. „Clematis 'Boulevard Vicki'", „Coleus 'Wizard Velvet'")
  ✓ Naujesniems augalams (po 2024) — gali būti ne tavo training'e
  ✓ Specifikai cultivar serijos — patvirtink, kuriai serijai priklauso,
    kuo skiriasi nuo kitų

PIRMIAUSIA naudok web_search, paskui pildyk plant_preview tool'ą.

Šaltiniai (priority order):
  1. https://www.rhs.org.uk/plants/  (Royal Horticultural Society — autoritetas)
  2. https://en.wikipedia.org/wiki/  (cross-reference, multilingual)
  3. https://www.missouribotanicalgarden.org/PlantFinder/  (US horticulture)
  4. https://garden.org/plants/  (user-curated cultivar files)

Jei web_search patvirtina informaciją — confidence galima kelti į „high"
ir privalomai surašyti sources lauką su apsilankytais URL'ais.
Jei web_search NIEKO neranda — confidence lieka „low", uncertaintyReason
paaiškina kad cultivar net online nerandamas.

═════════════════════════════════════════════════════════
DISAMBIGUATION — KANDIDATAI
═════════════════════════════════════════════════════════

JEI confidence yra medium ar low IR yra plausibly identifikuojamų kandidatų
(pvz. cultivar serijos nariai, vizualiai panašios rūšys), pildyk
candidates lauką (array) su 2-5 įrašais.

Kiekvienas kandidatas turi turėti:
  • latinName — tikslus pavadinimas (su cultivar žymeniu)
  • ltName — lietuviškas pavadinimas jei žinai, kitaip null
  • description — 1-2 sakiniai (serija, kilmė, charakteristika)
  • distinguishingFeature — kaip užtikrintai atskirti VIZUALIAI/CHARAKTERIO
    LYGIU nuo kitų kandidatų, ne abstrakti charakteristika

User'is paspausta vieną kandidatą → nauja paieška su tikslesniu pavadinimu
→ high confidence rezultatas → saugomas į catalog.

Pavyzdžiai kada PILDYTI candidates:
  ✓ Užklausa: „Clematis 'Boulevard'" → Boulevard serija turi daug cultivars,
    surašyk 4-5 populiariausius su distinguishing features (žiedų spalva)
  ✓ Photo identifikacija: kažkoks raudonžiedis sukulent'as — surašyk plausibly
    rūšis (Aeonium 'Schwarzkopf', Echeveria 'Black Prince', ir t.t.)

NEpildyk candidates jei:
  ✗ Confidence == „high" (tikrai žinai augalą)
  ✗ Užklausa visiškai neaiški (pvz. „kažkoks žalias augalas") — kandidatų per daug,
    geriau parodyt low confidence + uncertaintyReason

═════════════════════════════════════════════════════════
HONESTY REQUIREMENT — KRITIŠKAI SVARBU
═════════════════════════════════════════════════════════

PRIVALOMI laukai: confidence, matchLevel, uncertaintyReason, sources, candidates.

Augalų pasaulis turi tris taksonomijos lygius, kurie SKIRIASI priežiūra:
  • Genus (gentis) — pvz. „Clematis"
  • Species (rūšis) — pvz. „Clematis vitalba" (laukinė)
  • Cultivar/Hybrid — pvz. „Clematis 'Boulevard'" (sodo hibridas, Raymond Evison serija)

VISKAS skiriasi tarp lygmenų: laistymas, dirvožemis, ligos, atsparumas, kvapas, žiedų spalva.
Hibrido priežiūra GALI būti dramatiškai kitokia nei laukinio giminaičio.

DRAUDŽIAMA: tyliai grąžinti laukinę rūšį (pvz. Clematis vitalba), kai
vartotojas paklausė konkretaus cultivar'o (pvz. Clematis 'Boulevard').

TEISINGAS elgesys:
  → Jei TIKRAI žinai konkrečiai šitą cultivar/hybrid →
      confidence: "high", matchLevel: "cultivar"
  → Jei žinai gentį/seriją bet ne tikslų cultivar →
      confidence: "medium", matchLevel: "genus" arba "species",
      uncertaintyReason: „Konkretus cultivar 'X' neidentifikuotas;
      pateikiama bendra genties Y informacija."
  → Jei nieko aiškaus nežinai →
      confidence: "low", matchLevel: "unknown",
      uncertaintyReason: „Augalas '…' nėra mano žinių bazėje."

Niekada nemeluok confidence — geriau pasakyti „nežinau" nei pateikti
neteisingą priežiūrą, kuri gali pakenkti augalui ar gyvūnui.

latinName lauko formate IŠLAIKYK cultivar žymenį: jei vartotojas paklausė
„Clematis 'Boulevard'", grąžink būtent „Clematis 'Boulevard'" (su quote'ais),
NE „Clematis vitalba".

latinName PRIVALO būti GRYNAS taksonominis pavadinimas — be lietuviškų
ar angliškų suffix'ų skliaustuose, be ® / ™ simbolių. Pavyzdžiai:
  ✓ „Clematis 'Olympia'"
  ✓ „Clematis 'Acropolis'"
  ✗ „Clematis 'Olympia' (Boulevard® serija)" ← serija į description lauką, ne latinName
  ✗ „Clematis 'Acropolis'® (Evison hybrid)"  ← trademark / komercinė info eina description'e

═════════════════════════════════════════════════════════

SVARBU — laukas "name": PRIVALO būti tikras lietuviškas pavadinimas (žodynas/Vikipedija). NIEKADA lotyniškas ar angliškas. Hibridams be atskiro pavadinimo — naudok genties lietuvišką (pvz. Nepenthes → "Ąsotenė").

Nuotraukų atpažinimas: identifikuok TIK pagrindinį nuotraukos augalą — tą, kuris užima daugiausiai kadro arba yra fokuse. Visiškai ignoruok fone ar šonuose matomus kitus augalus.

Šviesa: taskai 1 (žema) 50–150 μmol/m²/s; 2 (vidutinė) 150–400; 3 (ryški) 400–2000
Vanduo: 1 (mažai) sultingi; 2 (vidutiniškai) tropiniai; 3 (daug) paparčiai
Laistymas (dienomis): sultingi vasara 14–21, vidutiniai 7–14, paparčiai 3–7

═════════════════════════════════════════════════════════
SAVYBES — pavojai, valgomumas, vaistinis. KRITIŠKAI svarbu.
═════════════════════════════════════════════════════════

KAI VARTOTOJO MESSAGE'E PRIDEDAMI WIKIPEDIA ŠALTINIAI — naudok juos kaip
PIRMINĮ AUTORITETĄ. Papildyk savo treniruotės žiniomis tik kur trūksta.
Detalėse nurodyk "Wikipedia mini, kad ..." kai informacija iš ten.

PAVOJAI[] (granuliarus) vs PAVOJINGUMAS (saugiklis):

Pildyk pavojai[] TIK kai TIKRAS dėl visų trijų: tipas + target + severity.
   ✓ "Pomidoras → toksiškas glikoalkaloidas solaninas; gyvūnams sukelia
      virškinimo sutrikimus, neretai hospitalizacija" — TAIP, severity=stiprus
   ✗ "Augalas turi alkaloidų" — nepildyk pavojai[], nes severity nežinomas

JEI pavojai[] tuščias, BET žinai, kad augalas yra bet kiek pavojingas:
  → pildyk pavojingumas.yra=true + spėk lygį + detalėse nurodyk kontekstą
  → pvz. "Wikipedia mini, kad gyvūnams kenkia; konkrečių detalių nepateikia."

NIEKADA nepildyk pavojai[] su pavyzdiniais skaičiais. Tuščias array OK.

TWO-STEP REASONING toksiškumui (kai šaltiniuose nerasta tiesioginio įrašo):
  1. Ar augale yra žinomas toksiškas junginys (alkaloidai, glikozidai,
     oksalatai, saponinai, latexas)?
  2. Ar AUGALUOSE (ne gryną laboratorijoje) tas junginys daro poveikį žinomu
     kiekiu/būdu?

  Jei abu „taip" — pildyk pavojai[] su severity NE AUKŠTESNIU NEI VIDUTINIS.
  Detalėse PRIVALOMAI nurodyk:
    - kokia medžiaga
    - kokiu būdu žalą daro ("nurijus", "ilgalaikiu kontaktu su oda")
    - apytikslis kiekis ("net mažais kiekiais", "tik dideliais kiekiais")

  NIEKADA nepildyk severity=stiprus remdamasis vien junginio buvimu — tam
  reikia konkretaus literatūros įrašo apie hospitalizacijos atvejus.

DOSE KONTEKSTAS pavojingumas.detales lauke yra PRIVALOMAS:
  ✓ "Sultys aitrios — sukelia odos dirginimą prisilietus; gerai nuplaunama
     vandeniu. Vaikams ir gyvūnams pavojingiau."
  ✓ "Sėklos turi cijanogeninių glikozidų — pavojingos NURIJUS DIDESNIAIS
     KIEKIAIS (10+ sėklų). Vaisiai be sėklų saugūs."
  ✗ "Augalas yra toksiškas." (be konteksto = gąsdina, ne informuoja)

VALGOMUMAS:
  - none = nevalgomas (rodom tik kaip "trūksta"; neignoruok jei yra)
  - dalinai = kai kurios dalys (privalomai nurodyk dalys lauke)
  - pilnai = visas augalas valgomas

VAISTINIS:
  - tradicine = liaudies medicina, žiniaraščių lygis
  - moksline = klinikinis tyrimas patvirtino
  - none = nevaistinis

NIEKADA nepamiršk valgomų/vaistinių augalų — pomidoras, čiobreliai, citrina,
papartis dažnai įvedami kaip kambariniai, bet jų atskiros dalys turi
maistinę/vaistinę vertę. Tai stiprus app'o sell point — neignoruok.`



async function fetchDetails(latinName, name) {
  // Pirma tikriname katalogą — jei jau yra priežiūros duomenys, nemokami
  const cached = await getCatalogEntry(latinName)
  if (cached?.laistymasIntervalas) {
    // Grąžiname tik priežiūros duomenis — ne nuotrauką (kiekvienas vartotojas gauna savą iš iNaturalist)
    const { image: _img, updatedAt: _ts, lotyniskas: _lt, lietuviškas: _liet, ...careData } = cached
    return careData
  }

  const r = await claudeCall({
    maxTokens:  2048,
    temperature: 0.3,
    system:     PLANT_SYSTEM,
    tools:      [TOOL_DETAILS],
    toolChoice: { type: 'tool', name: 'plant_details' },
    messages:   [{ role: 'user', content: `Pateik išsamią priežiūros informaciją apie augalą "${latinName}" (${name}).` }],
  })
  const block   = r.content.find(b => b.type === 'tool_use' && b.name === 'plant_details')
  const details = block?.input ?? {}

  // Išsaugome į katalogą — kitas vartotojas gaus iš cache
  if (details.laistymasIntervalas) {
    saveToCatalog({ lotyniskas: latinName, lietuviškas: name, ...details }).catch(() => {})
  }

  return details
}

async function enrich(parsed) {
  const isCultivar =
    parsed.matchLevel === 'cultivar' ||
    /['"][^'"]+['"]/.test(parsed.latinName ?? '')

  // iNaturalist NETURI cultivar coverage'o — stripCultivar() vidiniame
  // fetch'e nuima quotes prieš API call'ą, todėl grąžinama artimiausia
  // RŪŠIS (pvz. „Gelsvoji raganė" Clematis 'Boulevard' užklausai).
  //
  // Apsauga: jei AI explicitly grąžino cultivar (matchLevel=='cultivar'
  // arba latinName turi quote'us) — NEPERRAŠOM AI suggested name'o iNat
  // species'o vardu. Tas pats — iNat photos atmetam, nes jos rodytų
  // laukinę giminaitę vietoj sodo hibrido.
  //
  // Low-confidence rezultatai — irgi atmetam iNat enrichment'ą.
  const trustInat = !isCultivar && parsed.confidence !== 'low'

  if (trustInat) {
    // Species-level — iNat path (greitas + photo + LT name iš inatLtName)
    const [photos, namesData] = await Promise.all([
      fetchPhotos(parsed.latinName),
      fetchPlantNames(parsed.latinName),
    ])
    const inatLtName = namesData?.inatLtName ?? null
    return {
      ...parsed,
      name:         inatLtName ?? parsed.name,
      image:        photos[0] ?? null,
      photos,
      inatLtName,
      inatTaxonId:  namesData?.inatTaxonId ?? null,
      sinonimai:    namesData?.sinonimai    ?? [],
      englishNames: namesData?.englishNames ?? [],
    }
  }

  // Cultivar / low-confidence path — multi-source priority chain (visi free):
  //   1. iNaturalist Taxa autocomplete (plant-focused, strict cultivar match)
  //   2. Wikidata P18 (jei entity yra)
  //   3. Wikipedia direct + opensearch thumbnail
  // null jei visi miss → UI rodo plant card be photo.
  let mainImage = await fetchInatCultivarImage(parsed.latinName)
  const wd = !mainImage ? await fetchWikidataPlant(parsed.latinName) : null
  if (!mainImage && wd?.imageUrl) mainImage = wd.imageUrl
  if (!mainImage) mainImage = await fetchWikiThumbnail(parsed.latinName)

  return {
    ...parsed,
    name:         parsed.name,
    image:        mainImage,
    photos:       mainImage ? [mainImage] : [],
    wikidataId:   wd?.id ?? null,
    inatLtName:   null,
    inatTaxonId:  null,
    sinonimai:    [],
    englishNames: [],
  }
}

// Wikipedia RAG — Pasiima en.wikipedia.org abstract'ą ir formatuoja į user
// message'o priedą. Naudojama prieš Claude call'ą savybes RAG'ui (toksiškumas,
// valgomumas, vaistinis). null jei Wikipedia neturi straipsnio.
async function buildWikipediaContextMessage(latinName) {
  const ctx = await fetchWikipediaContext(latinName)
  if (!ctx?.extract) return null
  return `--- Wikipedia (en) šaltinis: ${ctx.title} ---\n${ctx.extract}\n--- pabaiga ---\n\nNaudok šį šaltinį kaip pirminį autoritetą savybėms (pavojai, valgomumas, vaistinis). Papildyk savo žiniomis kur trūksta. Detalėse paminėk "Wikipedia mini, kad ..." kai informacija iš ten.`
}

// Išvalo latin name'ą thumbnail search'ams — strip'inam ®/™/©, parenthetical
// suffix'us („(Boulevard® serija)"), trim. Lieka švarus „Clematis 'Acropolis'".
function cleanLatinForSearch(latinName) {
  if (!latinName) return ''
  return latinName
    .replace(/\s*\([^)]*\)\s*/g, ' ')   // strip (...) suffix
    .replace(/[®™©]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// iNaturalist Taxa Autocomplete — plant-focused, free, no key. Garden
// cultivars dažnai yra iNat taksonomijoje su default_photo field'u.
//
// CONSERVATIVE filter'is: grąžinam tik jei iNat taxon name turi BOTH
// genus IR cultivar word'us (case-insensitive). Atmetam random Clematis
// vitalba photos kai paklausta apie Clematis 'Acropolis'.
async function fetchInatCultivarImage(latinName) {
  if (!latinName) return null
  const cleaned = cleanLatinForSearch(latinName)
  const m = cleaned.match(/^(\S+)\s+(.+)$/)
  if (!m) return null
  const genus    = m[1].toLowerCase()
  const cultivar = m[2].replace(/['"]/g, '').toLowerCase().split(/\s+/)[0]  // pirmas cultivar žodis
  if (!cultivar) return null

  try {
    const r = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(cleaned)}&per_page=5`)
    if (!r.ok) return null
    const data = await r.json()
    const match = data.results?.find(t => {
      const name = (t.name ?? '').toLowerCase()
      return name.includes(genus) && name.includes(cultivar)
    })
    return match?.default_photo?.medium_url
        ?? match?.default_photo?.square_url
        ?? null
  } catch (e) {
    console.warn('[inat-cultivar] failed:', e)
    return null
  }
}

// Wikidata SPARQL/Search — structured cultivar data + image. Free, ~200ms.
//
// (Pastaba: 2026-05 bandėm pridėti Google Custom Search Image API kaip
// primary photo source. Google account-level apribojo Custom Search JSON
// API naujiems projektams — net atskiras non-Firebase project'as gavo
// 403 „This project does not have the access". Drop'inta. Likę šaltiniai:
// iNat + Wikidata + Wikipedia + Commons + AI's web_search imageUrl.)
//
// Returns: { id (Q-entity), label, description, imageUrl } | null
//
// Coverage: gerokai geresnė nei Wikipedia article — Wikidata turi structured
// entity'us populiariems cultivar'ams net jei nėra atskiro Wikipedia article'o.
// Image (P18 property) → konvertuojamas į Commons Special:FilePath URL'ą.
async function fetchWikidataPlant(latinName) {
  if (!latinName) return null
  const cleaned = cleanLatinForSearch(latinName)
  if (!cleaned) return null

  try {
    // Step 1: search entities by label
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleaned)}&language=en&type=item&format=json&origin=*&limit=5`
    const r = await fetch(searchUrl)
    if (!r.ok) return null
    const data = await r.json()
    const hits = data.search ?? []
    if (!hits.length) return null

    // Filter — prefer plant-related descriptions (cultivar/plant/species/genus name)
    const genus = cleaned.split(/\s+/)[0].toLowerCase()
    const plantHit = hits.find(h => {
      const desc = (h.description ?? '').toLowerCase()
      return desc.includes('cultivar') ||
             desc.includes(genus) ||
             desc.includes('plant') ||
             desc.includes('species') ||
             desc.includes('hybrid')
    }) ?? hits[0]

    // Step 2: fetch full entity to extract image (P18)
    const entityRes = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${plantHit.id}.json`)
    if (!entityRes.ok) return { id: plantHit.id, label: plantHit.label, description: plantHit.description, imageUrl: null }
    const entityData = await entityRes.json()
    const entity = entityData.entities?.[plantHit.id]

    const imageFilename = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    const imageUrl = imageFilename
      ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFilename.replace(/ /g, '_'))}?width=300`
      : null

    return {
      id: plantHit.id,
      label: plantHit.label,
      description: plantHit.description,
      imageUrl,
    }
  } catch (e) {
    console.warn('[wikidata] lookup failed:', e)
    return null
  }
}

// Wikipedia REST API — thumbnail per latin name. Cultivar'ams retas case'as
// kad būtų atskiras article — todėl bandom kelis variantus + fallback į
// opensearch API (Wikipedia full-text search).
async function fetchWikiThumbnail(latinName) {
  if (!latinName) return null
  const cleaned = cleanLatinForSearch(latinName)
  if (!cleaned) return null

  // Step 1: direct page summary su keliais slug variantais
  const variants = [
    cleaned.replace(/\s+/g, '_'),                     // su quote'ais
    cleaned.replace(/['"]/g, '').replace(/\s+/g, '_'), // be quote'ų
  ]
  for (const slug of variants) {
    try {
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`)
      if (!r.ok) continue
      const data = await r.json()
      const url = data.thumbnail?.source ?? data.originalimage?.source ?? null
      if (url) return url
    } catch {}
  }

  // Step 2: opensearch fallback — Wikipedia search, take top hit's page summary
  try {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleaned)}&limit=1&format=json&origin=*`)
    if (!r.ok) return null
    const [, titles] = await r.json()
    if (!titles?.[0]) return null
    const slug = titles[0].replace(/\s+/g, '_')
    const r2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`)
    if (!r2.ok) return null
    const data = await r2.json()
    return data.thumbnail?.source ?? data.originalimage?.source ?? null
  } catch { return null }
}

// Wikimedia Commons — search File: namespace su STRICT title filter'iu.
// Commons search'as match'ina pagal žodžius — be filtro grąžindavo
// random false positives („Volunteer parade.jpg" už „Clematis Volunteer").
//
// Filtras: file title PRIVALO turėti BOTH genus name AND cultivar name
// (case-insensitive). Atmetam kitką — geriau emoji nei klaidinanti photo.
async function fetchCommonsImage(latinName) {
  if (!latinName) return null
  const cleaned = cleanLatinForSearch(latinName)
  if (!cleaned) return null

  // Išskaidom į genus + cultivar (jei yra quote'uotas cultivar dalis)
  const cultivarMatch = cleaned.match(/^(\w+)\s+['"]?([^'"]+?)['"]?$/)
  const genus    = cultivarMatch?.[1]?.toLowerCase()
  const cultivar = cultivarMatch?.[2]?.toLowerCase()
  if (!genus || !cultivar) return null  // nesame cultivar — palieku null

  try {
    // Bandom kelis search hit'us (ne tik top 1), kad rastume match'ą filter'iui
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${genus} ${cultivar}`)}&srnamespace=6&srlimit=5&format=json&origin=*`
    const r = await fetch(searchUrl)
    if (!r.ok) return null
    const data = await r.json()
    const hits = data.query?.search ?? []

    // Strict filter — title TURI turėti ir genus, ir cultivar name
    const validHit = hits.find(h => {
      const title = (h.title ?? '').toLowerCase()
      return title.includes(genus) && title.includes(cultivar)
    })
    if (!validHit) return null

    // Gauti thumbnail URL'ą (200px wide)
    const fileUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(validHit.title)}&prop=imageinfo&iiprop=url&iiurlwidth=200&format=json&origin=*`
    const r2 = await fetch(fileUrl)
    if (!r2.ok) return null
    const data2 = await r2.json()
    const page = Object.values(data2.query?.pages ?? {})[0]
    return page?.imageinfo?.[0]?.thumburl ?? null
  } catch { return null }
}

// Enrich'ina candidates su image URL'ais. Priority chain (visi free):
//   1. AI parinko imageUrl iš savo web_search (retas hit)
//   2. iNaturalist Taxa Autocomplete (plant-focused, geras outdoor garden
//      cultivars coverage'as su strict name match'u)
//   3. Wikidata SPARQL (populiarių cultivars entity'iai turi P18 image)
//   4. Wikipedia REST direct + opensearch (retas hit cultivar'ams)
//   5. Wikimedia Commons strict filter (occasional hit)
//   6. null → UI fallback'ina į emoji
//
// Per-candidate sekvencialiai (early-exit), tarp candidates paraleliai.
async function enrichCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return candidates
  return Promise.all(candidates.map(async c => {
    if (c.imageUrl) return c // AI jau parinko (best case)

    const inatImg = await fetchInatCultivarImage(c.latinName)
    if (inatImg) return { ...c, imageUrl: inatImg }

    const wd = await fetchWikidataPlant(c.latinName)
    if (wd?.imageUrl) return { ...c, imageUrl: wd.imageUrl, wikidataId: wd.id }

    const wikiImg = await fetchWikiThumbnail(c.latinName)
    if (wikiImg) return { ...c, imageUrl: wikiImg, wikidataId: wd?.id ?? null }

    const commonsImg = await fetchCommonsImage(c.latinName)
    return { ...c, imageUrl: commonsImg, wikidataId: wd?.id ?? null }  // gali likti null
  }))
}


export default function SearchModal({ onAddToWishlist, onAddToDashboard, onClose, plants = [], onViewPlant, onPromote, onUpdatePlant, initialQuery = '', autoCamera = false }) {
  // Desktop split panel: portaliuojam į RightPanel container'į.
  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  useEffect(() => {
    if (!useDesktopPanel || !host) return
    host.open()
    return () => host.close()
  }, [useDesktopPanel]) // eslint-disable-line react-hooks/exhaustive-deps

  // ESC keyboard shortcut — uždaryti modal'ą iš paneles desktop'e
  useEffect(() => {
    if (!useDesktopPanel) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [useDesktopPanel, onClose])

  const [query, setQuery]         = useState(initialQuery)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)
  const [dots, setDots]           = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [previewUrl, setPreview]  = useState(null) // photo search preview
  const [savingPhase2, setSavingPhase2]     = useState(false)
  const [photoIdx, setPhotoIdx]             = useState(0)
  const [paywallOpen, setPaywallOpen]       = useState(false)
  const [paywallLimitType, setPaywallLimitType] = useState(null)

  // Reset gallery index when a new result arrives
  useEffect(() => { setPhotoIdx(0) }, [result])
  const abortRef  = useRef(null)
  const inputRef  = useRef(null)
  const fileRef   = useRef(null)

  useEffect(() => {
    if (!loading) { setDots(''); return }
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(t)
  }, [loading])

  // Cycle status messages during Phase 1 loading
  useEffect(() => {
    if (!loading) return
    const steps = [
      [1200, 'Renkuoju informaciją...'],
      [3000, 'Tikrinu kilmę ir pavadinimą...'],
      [5500, 'Žiūriu šviesos ir vandens poreikius...'],
      [8000, 'Identifikuoju augalą...'],
    ]
    const timers = steps.map(([delay, msg]) => setTimeout(() => setStatusMsg(msg), delay))
    return () => timers.forEach(clearTimeout)
  }, [loading])

  // Auto-search if launched with a pre-filled query
  useEffect(() => {
    if (initialQuery.trim()) searchByText(initialQuery.trim())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-open camera picker if launched from camera button
  useEffect(() => {
    if (autoCamera) {
      const t = setTimeout(() => fileRef.current?.click(), 100)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Delayed input focus — kviečiama PO sheet animacijos pabaigos (spring
  // ~320ms). Skip jei autoCamera (kamera atsidaro pirma) arba jei initialQuery
  // jau yra (search'as triggerinasi automatiškai). iOS PWA fix'as: anksčiau
  // input autoFocus triggerindavo keyboard'ą kartu su sheet slide animacija,
  // dėl ko vyko coordinate shift mid-animation („overshoot į kairę").
  useEffect(() => {
    if (autoCamera || initialQuery.trim()) return
    const t = setTimeout(() => inputRef.current?.focus(), 320)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKeyDown = e => {
    if (e.key === 'Enter' && query.trim() && !loading) searchByText(query.trim())
  }

  // ── Text search — Phase 1 (preview) + Phase 2 (details) ────────
  const searchByText = async (q) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true); setResult(null); setError(null); setPreview(null)
    setStatusMsg('Ieškau augalo...')

    try {
      // ── Phase 1: AI preview su web_search tool'u ───────────────
      // Web search'as įgalintas — Claude'as gali apsilankyti RHS, Wikipedia,
      // MissouriBotanical, kai užklausa neaiški (cultivar, hybrid, recent
      // introduction). max_uses=2 riboja latency + cost. tool_choice = auto
      // (Anthropic API leidžia web_search server-side tool'ą veikti šalia
      // forced tool'o; Claude'as gali iškviesti web_search prieš plant_preview).
      const r1 = await claudeCall({
        maxTokens:   3072,            // didesnis nei anksčiau — web search results gali padidinti context
        temperature: 0.3,
        system:      PLANT_SYSTEM,
        tools: [
          TOOL_PREVIEW,
          { type: 'web_search_20250305', name: 'web_search', max_uses: 2 },
        ],
        // tool_choice = auto (Claude pati sprend'ia kada web_search; vis tiek
        // turi galiausiai iškviesti plant_preview pildant final result)
        messages:    [{ role: 'user', content: `Rask informaciją apie augalą: "${q}". Jei tai cultivar/hybrid, kurio nesi 100% tikras — naudok web_search.` }],
      })
      if (controller.signal.aborted) return

      const previewBlock = r1.content.find(b => b.type === 'tool_use' && b.name === 'plant_preview')
      if (!previewBlock) { setError('Augalas nerastas'); setLoading(false); setStatusMsg(''); return }

      const aiResult = previewBlock.input

      // ── Catalog-first override ──────────────────────────────────
      // Jei catalog'as turi expert-verified arba high-confidence entry'į
      // šitam latin name'ui — naudojam jį vietoj fresh AI rezultato.
      // Catalog yra source of truth verified info'ai. Skip'iname enrich
      // (iNat photo) — naudojam catalog saved photo.
      setStatusMsg('Tikrinu bibliotekoje...')
      const cached = await getCatalogEntry(aiResult.latinName)
      const trustCatalog = cached && (
        cached.verificationStatus === 'expert-verified' ||
        cached.aiConfidence === 'high'
      )

      if (trustCatalog) {
        setResult({ ...catalogEntryToAIResult(cached), fromCatalog: true })
        setLoading(false)
        setStatusMsg('')
        return
      }

      // ── Catalog miss arba unverified — naudojam AI + enrich ─────
      setStatusMsg('Ruošiu rezultatą...')
      // Paraleliai — enrich AI result (iNat photo, names) + enrich candidates (Wikipedia thumbnails)
      const [enriched, candidatesWithImages] = await Promise.all([
        enrich(aiResult),
        enrichCandidates(aiResult.candidates),
      ])
      enriched.candidates = candidatesWithImages
      if (controller.signal.aborted) return

      // Auto-save į catalog TIK jei high confidence — nepilam šiukšlių į DB.
      // Low/medium confidence rezultatai ateina į catalog tik kai user'is
      // juos išsaugo (per onAddToDashboard → fromAIResult → catalog write).
      if (aiResult.confidence === 'high') {
        saveToCatalog({
          lotyniskas:          aiResult.latinName,
          lietuviškas:         enriched.name,
          ...aiResult,
          image:               enriched.image,
          verificationStatus:  'auto-verified',
          aiConfidence:        aiResult.confidence,
          aiMatchLevel:        aiResult.matchLevel,
          aiUncertaintyReason: aiResult.uncertaintyReason,
          aiVerifiedAt:        new Date().toISOString(),
        }).catch(e => console.warn('[catalog] auto-save failed:', e))
      }

      setResult(enriched)
      setLoading(false)
      setStatusMsg('')
    } catch (e) {
      if (e.name === 'AbortError' || controller.signal.aborted) return
      if (e.code === 'limit_reached') {
        setLoading(false); setStatusMsg('')
        setPaywallLimitType(e.limitType); setPaywallOpen(true)
        return
      }
      console.error('[SearchModal] error:', e)
      setError('Klaida ieškant augalo.')
      setLoading(false)
      setStatusMsg('')
    }
  }

  // ── Photo search — Phase 1 (preview) + Phase 2 (details) ───────
  const searchByPhoto = async (file) => {
    setLoading(true); setResult(null); setError(null); setQuery('')
    setStatusMsg('Žiūriu į nuotrauką...')
    try {
      const dataUrl = await resizeImage(file, 1200, 0.9)
      const base64  = dataUrl.split(',')[1]
      setPreview(dataUrl)

      const userMsg = {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text',  text: 'Identifikuok augalą šioje nuotraukoje (arba ant etiketės) ir pateik jo informaciją.' },
        ],
      }

      // ── Phase 1: AI preview su web_search ──────────────────────
      // Photo search'ui irgi pridedam web_search — pvz. kai user'is įkelia
      // cultivar'o nuotrauką iš augalų pirkliautojo, AI gali patvirtinti
      // pavadinimą per RHS/Wikipedia.
      const r1 = await claudeCall({
        maxTokens:   3072,
        temperature: 0.3,
        system:      PLANT_SYSTEM,
        tools: [
          TOOL_PREVIEW,
          { type: 'web_search_20250305', name: 'web_search', max_uses: 2 },
        ],
        messages:    [userMsg],
      })

      const previewBlock = r1.content.find(b => b.type === 'tool_use' && b.name === 'plant_preview')
      if (!previewBlock) { setError('Nepavyko identifikuoti augalo.'); setLoading(false); setStatusMsg(''); return }

      const aiResult = previewBlock.input

      // Catalog-first override (žiūr. searchByText komentarą)
      setStatusMsg('Tikrinu bibliotekoje...')
      const cached = await getCatalogEntry(aiResult.latinName)
      const trustCatalog = cached && (
        cached.verificationStatus === 'expert-verified' ||
        cached.aiConfidence === 'high'
      )

      if (trustCatalog) {
        setResult({ ...catalogEntryToAIResult(cached), fromCatalog: true })
        setLoading(false)
        setStatusMsg('')
        return
      }

      setStatusMsg('Ruošiu rezultatą...')
      const [enriched, candidatesWithImages] = await Promise.all([
        enrich(aiResult),
        enrichCandidates(aiResult.candidates),
      ])
      enriched.candidates = candidatesWithImages
      if (aiResult.confidence === 'high') {
        saveToCatalog({
          lotyniskas:          aiResult.latinName,
          lietuviškas:         enriched.name,
          ...aiResult,
          image:               enriched.image,
          verificationStatus:  'auto-verified',
          aiConfidence:        aiResult.confidence,
          aiMatchLevel:        aiResult.matchLevel,
          aiUncertaintyReason: aiResult.uncertaintyReason,
          aiVerifiedAt:        new Date().toISOString(),
        }).catch(e => console.warn('[catalog] auto-save failed:', e))
      }
      setResult(enriched)
      setLoading(false)
      setStatusMsg('')
    } catch (e) {
      if (e.code === 'limit_reached') {
        setLoading(false); setStatusMsg('')
        setPaywallLimitType(e.limitType); setPaywallOpen(true)
        return
      }
      console.error('[SearchModal photo] error:', e)
      setError('Nepavyko identifikuoti augalo. Bandykite aiškesnę nuotrauką.')
      setLoading(false)
      setStatusMsg('')
    }
  }

  const clear = () => {
    abortRef.current?.abort()
    setQuery(''); setResult(null); setError(null); setLoading(false); setPreview(null)
    inputRef.current?.focus()
  }

  // ── Duplicate detection ──────────────────────────────────────
  const norm = s => s?.trim().toLowerCase() ?? ''
  const duplicate = result
    ? plants.find(p => norm(p.lotyniskas) === norm(result.latinName))
    : null

  // Local search: kol nėra AI result + nėra loading'o, filtruojam esamus
  // augalus (kad vartotojas pirma rastų savus, o AI lookup'ą darytume tik jei
  // tikrai naujo augalo ieško). Match'as per fuzzy search'ą — handle'ina LT
  // diacritic'us („raktazole" → „Raktažolė") + typo'us (1-3 char edit
  // distance pagal žodžio ilgį).
  const localMatches = (() => {
    const q = query.trim()
    if (!q || result || loading) return []
    return plants
      .map(p => ({ plant: p, score: plantFuzzyScore(p, q) }))
      .filter(x => x.score !== Infinity)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
      .map(x => x.plant)
  })()

  // ── Catalog (bendros bibliotekos) search — vartotojas → global → AI ────
  // Debounced 200ms. Filtruoja iš rezultatų augalus, kuriuos vartotojas
  // jau turi savo kolekcijoje (per catalogDocId match'ą).
  const [catalogMatches, setCatalogMatches] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  useEffect(() => {
    const q = query.trim()
    if (!q || q.length < 2 || result || loading) {
      setCatalogMatches([])
      return
    }
    let cancelled = false
    setCatalogLoading(true)
    const debounce = setTimeout(async () => {
      const ownedIds = new Set(plants.map(p => catalogDocId(p.lotyniskas)).filter(Boolean))
      const matches = await searchCatalog(q, ownedIds)
      if (!cancelled) {
        setCatalogMatches(matches)
        setCatalogLoading(false)
      }
    }, 200)
    return () => { cancelled = true; clearTimeout(debounce) }
  }, [query, result, loading, plants])

  // Catalog add — naudoja onAddToWishlist (kaip ir AI result), tik prieš tai
  // catalog entry konvertuojamas į AI-result shape'ą.
  const handleCatalogAdd = async (entry) => {
    const aiShape = catalogEntryToAIResult(entry)
    setSavingPhase2(true)
    try {
      await onAddToWishlist(aiShape)
    } finally {
      setSavingPhase2(false)
      onClose?.()
    }
  }

  const tree = (
    <div className={useDesktopPanel
      ? "absolute inset-0 overflow-hidden flex justify-center"
      : "fixed inset-0 z-50 overflow-hidden flex justify-center"}>
    <motion.div
      className={useDesktopPanel ? "w-full h-full max-w-full flex flex-col bg-app" : "w-full max-w-[430px] h-full flex flex-col bg-app"}
      /* iOS native pattern'as: mobile'e slide-from-bottom (y), desktop'e
         slide-from-right (x). Slide-from-right ant iOS PWA su autoFocus'inančiu
         input'u sukurdavo coordinate shift mid-animation (keyboard kyla
         tuo pat metu kai sheet slenka horizontaliai → visual „overshoot").
         Vertical slide su iOS keyboard'u eilinis pattern'as. */
      {...(useDesktopPanel ? {
        initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' },
      } : {
        initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' },
      })}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Header — X close top-right */}
      <div className="safe-top" />
      <div className="flex items-center gap-3 px-4 py-3 border-b border-bone-400/40">
        <h2 className="font-display text-base font-semibold tracking-tight text-forest-800 flex-1">Rasti augalą</h2>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-btn bg-bone-300/60 hover:bg-bone-400/60 text-forest-700 transition-colors"
          aria-label="Uždaryti"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none px-4 py-5 space-y-5">
        {/* Search input + photo button */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-bone-50 border border-bone-400/40 rounded-2xl px-4 gap-2 focus-within:border-forest-400/60 transition-colors">
            <Search size={18} className="text-forest-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              placeholder="Pvz. Monstera, Ficus, Alavijas..."
              value={query}
              onChange={e => { setPreview(null); setQuery(e.target.value); setResult(null); setError(null) }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent py-3.5 text-sm text-forest-800 placeholder-forest-400 outline-none"
              autoComplete="nope"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              /* autoFocus pašalintas — programatiškai focus'inam per useEffect
                 PO sheet'o animacijos pabaigos (delay'as 320ms = spring
                 settling). Anksčiau iOS PWA'e keyboard slide'as kildavo tuo
                 pat metu kaip sheet slide'as → modal overshoot į kairę. */
            />
            {(query || previewUrl) && (
              <button onClick={clear} className="text-forest-400 px-1 flex-shrink-0"><X size={14} /></button>
            )}
          </div>
          <button
            onClick={() => { if (query.trim() && !loading) searchByText(query.trim()) }}
            disabled={!query.trim() || loading}
            className="flex-shrink-0 bg-forest-700 disabled:opacity-40 hover:bg-forest-800 transition-colors rounded-2xl flex items-center justify-center text-bone"
            style={{ width: 52, height: 52 }}
          >
            {loading
              ? <BrandLoader inline size={28} />
              : <Search size={18} />
            }
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 bg-bone-50 border border-bone-400/40 hover:bg-bone-300/40 transition-colors rounded-2xl flex items-center justify-center text-forest-600"
            style={{ width: 52, height: 52 }}
          >
            <Camera size={22} />
          </button>
          <input
            ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files[0]; if (f) { searchByPhoto(f); e.target.value = '' } }}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            {previewUrl
              ? <img src={previewUrl} alt="" className="w-28 h-28 object-cover rounded-2xl opacity-70" />
              : <BrandLoader />
            }
            <p className="text-sm text-forest-600 font-medium">{statusMsg}{dots}</p>
            {!previewUrl && <p className="text-xs text-forest-400 italic">{query}</p>}
          </div>
        )}

        {/* Error — terracotta callout */}
        {error && !loading && (
          <div className="bg-terracotta-50 border border-terracotta-200/60 rounded-2xl p-5 text-center">
            <div className="flex justify-center mb-2 text-terracotta-400"><Search size={32} /></div>
            <p className="text-sm text-terracotta-600 font-semibold">{error}</p>
            <p className="text-xs text-terracotta-500 mt-1">Bandykite kitą pavadinimą arba aiškesnę nuotrauką</p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* From catalog — žalia juostelė kai duomenys iš mūsų verified
                biblioteckos (jokio AI hallucinacijos rizikos). */}
            {result.fromCatalog && (
              <div className="rounded-2xl px-4 py-2 mb-3 border bg-forest-50 border-forest-300/60 flex items-center gap-2">
                <span className="text-forest-500">✓</span>
                <p className="text-[12px] font-semibold text-forest-700">
                  Iš mūsų patvirtintos bibliotekos
                </p>
                {result.aiVerifiedAt && (
                  <span className="ml-auto font-mono text-[10px] text-forest-500">
                    {new Date(result.aiVerifiedAt).toLocaleDateString('lt-LT')}
                  </span>
                )}
              </div>
            )}

            {/* Sources chip — kai AI naudojo web_search ir surašė šaltinius.
                Transparency vartotojui — kur info patikrinta. */}
            {Array.isArray(result.sources) && result.sources.length > 0 && (
              <div className="rounded-2xl px-4 py-2 mb-3 border bg-bone-50 border-bone-400/40">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-500 mb-1">Šaltiniai</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.sources.slice(0, 4).map((s, i) => {
                    let label = s
                    try { label = new URL(s).hostname.replace(/^www\./, '') } catch {}
                    return (
                      <a key={i} href={s} target="_blank" rel="noreferrer"
                         className="inline-flex items-center text-[11px] text-forest-600 bg-bone-100 border border-bone-400/40 rounded-full px-2 py-0.5 hover:bg-bone-200 transition-colors">
                        {label}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Confidence banner — rodom kai AI confidence != 'high'. Augalo
                priežiūros info gali būti netiksli; matchLevel padeda suprasti
                ar tai tik genties lygis, ar visiškai nežinia. */}
            {result.confidence && result.confidence !== 'high' && !result.fromCatalog && (
              <div className={`rounded-2xl px-4 py-3 mb-3 border ${
                result.confidence === 'low'
                  ? 'bg-terracotta-50 border-terracotta-300/60'
                  : 'bg-bone-100 border-bone-400/60'
              }`}>
                <div className="flex items-start gap-2.5">
                  <span className={`text-base flex-shrink-0 mt-0.5 ${
                    result.confidence === 'low' ? 'text-terracotta' : 'text-forest-500'
                  }`}>
                    {result.confidence === 'low' ? '⚠' : 'ℹ'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-semibold ${
                      result.confidence === 'low' ? 'text-terracotta-600' : 'text-forest-700'
                    }`}>
                      {result.confidence === 'low'
                        ? 'AI nepatvirtina šio augalo'
                        : 'Apytikrė informacija'}
                      {result.matchLevel && result.matchLevel !== 'cultivar' && (
                        <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">
                          {result.matchLevel === 'genus' ? 'genties lygis'
                            : result.matchLevel === 'species' ? 'rūšies lygis'
                            : 'neaiškus'}
                        </span>
                      )}
                    </p>
                    {result.uncertaintyReason && (
                      <p className={`text-xs leading-relaxed mt-1 ${
                        result.confidence === 'low' ? 'text-terracotta-600/90' : 'text-forest-600'
                      }`}>
                        {result.uncertaintyReason}
                      </p>
                    )}
                    <p className="text-[11px] text-forest-500 mt-1.5 italic">
                      Priežiūros info gali būti netiksli — saugok kaip „nepatvirtinta" ir patikrink rankiniu būdu.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Kandidatai — pasirinkimo kortelės kai AI nepavyko 100%
                identifikuoti, bet turi 2-5 plausibly atitinkančius cultivars.
                User'is paspausta vieną → nauja paieška su tikslesniu pavadinimu
                → high confidence + saved į catalog. */}
            {Array.isArray(result.candidates) && result.candidates.length > 0 && !result.fromCatalog && (
              <div className="mb-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-500 mb-2 px-1">
                  Galimi atitikmenys — pasirink savo augalą
                </p>
                <div className="space-y-1.5">
                  {result.candidates.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQuery(c.latinName)
                        searchByText(c.latinName)
                      }}
                      className="w-full text-left bg-bone-50 border border-bone-400/40 rounded-2xl p-3 hover:bg-bone-100 hover:border-forest-300/60 active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {/* Thumbnail — photo iš multi-source chain, fallback emoji */}
                        <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-bone-200 border border-bone-400/40">
                          {c.imageUrl ? (
                            <img
                              src={c.imageUrl}
                              alt={c.ltName || c.latinName}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl">
                              🌿
                            </div>
                          )}
                        </div>
                        {/* Minimalistinis tekstas — TIK pavadinimas + vizualus
                            aprašymas. Disambiguation stadijoje user'iui
                            nereikia istorinės info, serijos paaiškinimo, ar
                            kilmės — tik kaip atskirti vizualiai. */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-forest-800 text-[15px] leading-tight">
                            {c.ltName || c.latinName.replace(/^[A-Z][a-z]+\s+['"]/, '').replace(/['"]$/, '')}
                          </p>
                          <p className="font-mono italic text-[11px] text-forest-500 mt-0.5 truncate">
                            {c.latinName}
                          </p>
                          {c.distinguishingFeature && (
                            <p className="text-[12px] text-forest-700 mt-1.5 leading-snug">
                              {c.distinguishingFeature}
                            </p>
                          )}
                        </div>
                        <span className="text-forest-400 text-lg flex-shrink-0">›</span>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-forest-400 italic mt-2 px-1">
                  Arba apačioj pridėk su bendra (nepatvirtinta) info.
                </p>
              </div>
            )}

            {/* Hero gallery — mobile bleeds (-mx-4) iki ekrano krašto; desktop'e
                lieka rounded card su parent padding'u (kad neišlystų už panel'ės) */}
            {result.image ? (
              <div className={`rounded-3xl overflow-hidden h-56 relative mb-0 ${useDesktopPanel ? '' : '-mx-4'}`}>
                {/* Cross-fade image swap */}
                <AnimatePresence mode="sync" initial={false}>
                  <motion.img
                    key={result.photos?.[photoIdx] ?? result.image}
                    src={result.photos?.[photoIdx] ?? result.image}
                    alt={result.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent pointer-events-none" />

                {/* Prev / Next arrows */}
                {(result.photos?.length ?? 0) > 1 && (
                  <>
                    <button
                      onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                      disabled={photoIdx === 0}
                      className="absolute left-3 top-1/2 -translate-y-[calc(50%+1.5rem)] w-8 h-8 bg-black/35 backdrop-blur-sm rounded-btn flex items-center justify-center text-white disabled:opacity-20 transition-opacity active:scale-90"
                    >
                      <ChevronLeft size={16} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => setPhotoIdx(i => Math.min((result.photos?.length ?? 1) - 1, i + 1))}
                      disabled={photoIdx >= (result.photos?.length ?? 1) - 1}
                      className="absolute right-3 top-1/2 -translate-y-[calc(50%+1.5rem)] w-8 h-8 bg-black/35 backdrop-blur-sm rounded-btn flex items-center justify-center text-white disabled:opacity-20 transition-opacity active:scale-90"
                    >
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                    <div className="absolute top-3 right-3 bg-black/35 backdrop-blur-sm rounded-full px-2 py-0.5">
                      <span className="text-[11px] text-white/90 font-medium">{photoIdx + 1} / {result.photos.length}</span>
                    </div>
                  </>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="font-display text-xl font-semibold tracking-tight text-bone leading-tight">{result.name}</h3>
                  <p className="text-sm text-bone/70 italic mt-1">{result.latinName}</p>
                  {(result.inatLtName || result.sinonimai?.length > 0 || result.englishNames?.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {result.inatLtName && (
                        <span className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-bone/85 bg-white/10 backdrop-blur-sm border border-white/15 rounded px-1.5 py-0.5">{result.inatLtName}</span>
                      )}
                      {result.sinonimai?.filter(s => s !== result.inatLtName).map((s, i) => (
                        <span key={i} className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-bone/85 bg-white/10 backdrop-blur-sm border border-white/15 rounded px-1.5 py-0.5">{s}</span>
                      ))}
                      {result.englishNames?.map((n, i) => (
                        <span key={i} className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone/60 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">{n}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-bone-50 border border-bone-400/40 rounded-3xl p-4 flex items-center gap-4 mb-0">
                <div className="w-16 h-16 rounded-2xl bg-bone-300 flex items-center justify-center text-4xl flex-shrink-0">
                  {result.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg font-semibold tracking-tight text-forest-800 leading-tight">{result.name}</h3>
                  <p className="text-sm text-forest-500 italic mt-1">{result.latinName}</p>
                  {(result.inatLtName || result.sinonimai?.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {result.inatLtName && <span className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-forest-600 bg-forest-100 rounded px-1.5 py-0.5">{result.inatLtName}</span>}
                      {result.sinonimai?.filter(s => s !== result.inatLtName).map((s, i) => (
                        <span key={i} className="font-mono text-[9px] uppercase tracking-[0.14em] text-forest-600 bg-bone-50 border border-bone-400/40 rounded px-1.5 py-0.5">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Profile content — same component as PlantDetail, no extra padding */}
            <ProfileContent plant={fromAIResult(result)} section="nori" onAction={null} onClose={onClose} className="pt-5 pb-2 space-y-6" />

            {/* Actions */}
            <div className="space-y-3 pt-1 pb-4">
              {duplicate ? (
                <DuplicateBanner
                  duplicate={duplicate}
                  result={result}
                  onAddToDashboard={onAddToDashboard}
                  onViewPlant={onViewPlant}
                  onPromote={onPromote}
                  onUpdatePlant={onUpdatePlant}
                  onClose={onClose}
                  onSavingChange={setSavingPhase2}
                />
              ) : (
                <>
                  {/* Primary action — solid INK button per brandbook auth pattern */}
                  <SaveButton
                    label="Pirkau, turiu!"
                    result={result}
                    className="w-full h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 disabled:opacity-60 transition-colors"
                    onSave={onAddToDashboard}
                    onClose={onClose}
                    onSavingChange={setSavingPhase2}
                  />
                  {/* Secondary — bone-50 outline (mažesnis vizualinis svoris) */}
                  <SaveButton
                    label="Pridėti į biblioteką"
                    result={result}
                    className="w-full h-12 rounded-btn font-display text-sm font-semibold text-forest-700 bg-bone-50 border border-bone-400/50 hover:bg-bone-300/40 disabled:opacity-60 transition-colors"
                    onSave={onAddToWishlist}
                    onClose={onClose}
                    onSavingChange={setSavingPhase2}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Local matches — rodom kol nėra AI lookup'o (vartotojas turi galimybę
            pirma rasti savus augalus, prieš einant ieškoti naujų internete). */}
        {!result && !loading && !error && query.trim() && localMatches.length > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em] px-1">
              Tavo augalai ({localMatches.length})
            </p>
            <div className="space-y-1.5">
              {localMatches.map(p => (
                <button
                  key={p.id}
                  onClick={() => onViewPlant?.(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-bone-50 border border-bone-400/40 rounded-2xl text-left hover:bg-bone-300/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-bone-300">
                    {p.image ? (
                      <PlantImage url={p.image} alt="" size="thumb" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">{p.emoji ?? '🌿'}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm font-semibold tracking-tight text-forest-800 truncate">{p.lietuviškas}</p>
                    <p className="text-xs text-forest-500 italic truncate">{p.lotyniskas}</p>
                  </div>
                  <span className={`font-mono text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    p.kategorija === 'auginama' ? 'bg-forest-100 text-forest-700' :
                    p.kategorija === 'nori' ? 'bg-terracotta-100 text-terracotta-600' :
                    'bg-bone-300 text-forest-500'
                  }`}>
                    {p.kategorija === 'auginama' ? 'Auginu' : p.kategorija === 'nori' ? 'Noriu' : 'Istorija'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Catalog matches — bendros bibliotekos kandidatai (rodom po lokalių,
            prieš AI button'ą). Vartotojas → global → AI hierarchija. */}
        {!result && !loading && !error && query.trim() && catalogMatches.length > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] font-medium text-terracotta-600 uppercase tracking-[0.18em] px-1">
              Iš bendros bibliotekos ({catalogMatches.length})
            </p>
            <div className="space-y-1.5">
              {catalogMatches.map(entry => (
                <div
                  key={entry._id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-bone-50 border border-bone-400/40 rounded-2xl"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-bone-300">
                    {entry.image ? (
                      <PlantImage url={entry.image} alt="" size="thumb" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">{entry.emoji ?? '🌿'}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm font-semibold tracking-tight text-forest-800 truncate">{entry.lietuviškas}</p>
                    <p className="text-xs text-forest-500 italic truncate">{entry.lotyniskas}</p>
                  </div>
                  <button
                    onClick={() => handleCatalogAdd(entry)}
                    className="flex-shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-btn-sm bg-forest-700 hover:bg-forest-800 text-bone text-xs font-display font-semibold transition-colors"
                    title="Pridėti į biblioteką"
                  >
                    + Pridėti
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI lookup CTA — UNIFIKUOTAS mygtukas visiems atvejams (su match'ais
            ar be jų). Anksčiau buvo du skirtingi stiliai + label'iai —
            dashed „Ieškoti naujų augalų: „query"" kai yra match'ai vs.
            solid „Ieškoti internete" kai nieko nėra. Dabar vienas
            patternas: ✦ Ieškoti su AI, solid bg-forest-700 full-width
            (matches ✦ Atnaujinti per AI iš PlantDetail). */}
        {!result && !loading && !error && query.trim() && (
          (localMatches.length > 0 || catalogMatches.length > 0) ? (
            <button
              onClick={() => { if (query.trim() && !loading) searchByText(query.trim()) }}
              className="w-full py-3 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
            >
              ✦ Ieškoti su AI
            </button>
          ) : (
            /* No local + no catalog matches — full empty state'as su
               hero icon'u + tuo pačiu unified AI CTA. */
            !catalogLoading && (
              <div className="text-center py-8 space-y-4">
                {/* Gardener tilt — „mąstau, ar atrasiu" empathetic momentas
                    prieš AI fallback'ą. Wilt'as būtų per dramatiškas
                    paprastam „neradome" momentui. */}
                <Mascot type="gardener" state="tilt" size={96} className="text-forest-700 mx-auto opacity-90" />
                <p className="text-sm text-forest-500">„{query}" — neradome nei tavo, nei bendroje bibliotekoje</p>
                <button
                  onClick={() => { if (query.trim() && !loading) searchByText(query.trim()) }}
                  className="w-full py-3 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
                >
                  ✦ Ieškoti su AI
                </button>
              </div>
            )
          )
        )}

        {/* Empty state — be query. Hero T4Icon 160px (3x prieš tai), be
            animacijos — proporcingas dizaineris'kai centrinis statiškas
            brand mark'as. */}
        {!result && !loading && !error && !query.trim() && (
          <div className="text-center py-8 space-y-4">
            <Mascot type="gardener" state="wave" size={140} className="text-forest-700 mx-auto" />
            <p className="font-display text-base font-semibold tracking-tight text-forest-700">Įveskite augalo pavadinimą</p>
            <p className="text-xs text-forest-400 max-w-[280px] mx-auto leading-relaxed">paieška ras tavo augalus, arba galėsi ieškoti naujų su AI</p>
          </div>
        )}
      </div>
    </motion.div>

    <AnimatePresence>
      {savingPhase2 && <SavingOverlay key="saving" />}
    </AnimatePresence>
    <PaywallSheet open={paywallOpen} limitType={paywallLimitType} onClose={() => setPaywallOpen(false)} />
    </div>
  )

  if (useDesktopPanel) return createPortal(tree, host.container)
  return tree
}

// ── Full-screen Phase 2 loading overlay ──────────────────────────
function SavingOverlay() {
  const [msgIndex, setMsgIndex] = useState(0)
  const msgs = [
    'Traukiu išmintį iš interneto...',
    'Klausiu augalų mokslininkų...',
    'Renkuoju priežiūros paslaptis...',
    'Skaičiuoju laistymo intervalus...',
    'Sudarinėju ligų diagnostiką...',
    'Beveik jau turiu viską...',
  ]
  useEffect(() => {
    const t = setInterval(() => setMsgIndex(i => (i + 1) % msgs.length), 1800)
    return () => clearInterval(t)
  }, [])

  const steps = [
    { label: 'Pagrindai', done: true },
    { label: 'Priežiūra',  active: true },
    { label: 'Išsaugota',  done: false },
  ]

  // createPortal į document.body — kitaip overlay rendinasi inside RightPanel
  // (per SearchModal'os portal'ą) ir jo z-[90] yra TIK RightPanel'io stacking
  // context'e (auto), todėl DesktopHeader (z-30) lieka virš overlay'aus.
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-forest-800/55 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-bone-50 rounded-3xl p-8 mx-6 flex flex-col items-center gap-5 shadow-[0_12px_32px_rgba(28,58,42,0.24)] border border-bone-400/50 w-full max-w-[300px]"
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
      >
        <BrandLoader />
        <div className="text-center">
          <p className="font-display text-base font-semibold tracking-tight text-forest-800">Kantrybės...</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              className="text-sm text-forest-500 mt-1.5 min-h-[20px]"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.22 }}
            >
              {msgs[msgIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress — segmented barcode (brand pattern, ne generic dot'ai).
            3 ploni bar'ai = visual indicator. Tekstas apačioje su color
            hierarchy: done vivid, active pulse, pending ghost. */}
        <div className="w-full">
          <div className="flex items-center gap-1.5 mb-2">
            {steps.map((s, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  s.done   ? 'bg-forest-700' :
                  s.active ? 'bg-forest-500 animate-pulse' :
                             'bg-bone-400/50'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <span
                key={i}
                className={`font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] transition-colors ${
                  s.done   ? 'text-forest-700' :
                  s.active ? 'text-forest-700 animate-pulse' :
                             'text-forest-300'
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── Save button: fetches Phase 2 details on click, then saves ────
function SaveButton({ label, result, className, onSave, onClose, onSavingChange }) {
  const [saving, setSaving] = useState(false)

  const handleClick = async () => {
    setSaving(true)
    onSavingChange?.(true)
    try {
      const details = await fetchDetails(result.latinName, result.name)
      onSave({ ...result, ...details })
      onClose()
    } catch (e) {
      console.error('[SaveButton] Phase 2 error:', e)
      // Fall back to saving Phase 1 data
      onSave(result)
      onClose()
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={saving} className={className}>
      {label}
    </button>
  )
}

// ── Update button: fetches Phase 2 and patches existing plant ────
function UpdateButton({ label, result, existingId, className, onUpdate, onClose, onSavingChange }) {
  const [saving, setSaving] = useState(false)

  const handleClick = async () => {
    setSaving(true)
    onSavingChange?.(true)
    try {
      const details = await fetchDetails(result.latinName, result.name)
      const merged  = { ...result, ...details }
      const full    = fromAIResult(merged)
      // Strip identity/personal fields — only update reference data
      const { id: _id, kategorija: _kat, komentaras: _kom, data_prideta: _dat, status: _st } = full
      const patch = { ...full }
      delete patch.id; delete patch.kategorija; delete patch.komentaras
      delete patch.data_prideta; delete patch.status
      onUpdate(existingId, patch)
      onClose()
    } catch (e) {
      console.error('[UpdateButton] Phase 2 error:', e)
      onClose()
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={saving} className={className}>
      {label}
    </button>
  )
}

function DuplicateBanner({ duplicate, result, onAddToDashboard, onViewPlant, onPromote, onUpdatePlant, onClose, onSavingChange }) {
  const { kategorija } = duplicate

  // ── nori: custom layout with 3 actions ──────────────────────────
  if (kategorija === 'nori') {
    return (
      <div className="bg-terracotta-50 border border-terracotta-200/60 rounded-2xl p-4 space-y-2">
        <p className="font-mono text-[10px] font-medium text-terracotta-600 uppercase tracking-[0.16em]">Jau norų sąraše</p>
        <button
          onClick={() => { onPromote?.(duplicate.id); onClose() }}
          className="w-full h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
        >
          Įsigijau!
        </button>
        <div className="flex gap-2">
          {onUpdatePlant && (
            <UpdateButton
              label="Atnaujinti įrašą"
              result={result}
              existingId={duplicate.id}
              className="flex-1 py-2.5 rounded-btn font-display text-sm font-semibold text-forest-700 bg-bone-50 border border-bone-400/50 hover:bg-bone-300/40 disabled:opacity-50 transition-colors"
              onUpdate={onUpdatePlant}
              onClose={onClose}
              onSavingChange={onSavingChange}
            />
          )}
          <button
            onClick={() => { onViewPlant?.(duplicate) }}
            className="flex-1 py-2.5 rounded-btn font-display text-sm font-semibold text-forest-700 bg-bone-50 border border-bone-400/50 hover:bg-bone-300/40 transition-colors"
          >
            Peržiūrėti
          </button>
        </div>
      </div>
    )
  }

  const configs = {
    auginama: {
      bg: 'bg-forest-50', border: 'border-forest-200/60', text: 'text-forest-700',
      message: `Jau augini šį augalą`,
      primary: { label: 'Pridėti dar vieną', onSave: onAddToDashboard },
    },
    istorija: {
      bg: 'bg-bone-300/40', border: 'border-bone-400/60', text: 'text-forest-600',
      message: `Šis augalas pas tave mirė...`,
      primary: { label: 'Bandyti dar kartą', onSave: onAddToDashboard },
    },
  }

  const cfg = configs[kategorija] ?? configs.auginama

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-4 space-y-3`}>
      <p className={`font-mono text-[10px] font-medium uppercase tracking-[0.16em] ${cfg.text}`}>{cfg.message}</p>
      <div className="flex gap-2">
        {cfg.primary.onSave ? (
          <SaveButton
            label={cfg.primary.label}
            result={result}
            className="flex-1 h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 disabled:opacity-60 transition-colors"
            onSave={cfg.primary.onSave}
            onClose={onClose}
            onSavingChange={onSavingChange}
          />
        ) : (
          <button
            onClick={cfg.primary.action}
            className="flex-1 h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
          >
            {cfg.primary.label}
          </button>
        )}
        <button
          onClick={() => { onViewPlant?.(duplicate) }}
          className="flex-1 h-12 rounded-btn font-display text-sm font-semibold text-forest-700 bg-bone-50 border border-bone-400/50 hover:bg-bone-300/40 transition-colors"
        >
          Peržiūrėti
        </button>
      </div>
    </div>
  )
}
