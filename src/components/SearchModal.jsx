import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'
import { ArrowLeft, Search, X, Camera, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { fetchPhotos, resizeImage, fetchWikipediaContext } from '../utils/imageService'
import { fetchPlantNames } from '../utils/plantNames'
import { fromAIResult } from '../hooks/usePlants'
import { getCatalogEntry, saveToCatalog, searchCatalog, catalogEntryToAIResult, catalogDocId } from '../utils/catalog'
import { getCachedSearchResponse, setCachedSearchResponse } from '../utils/searchResponseCache'
import { taxonGroupDocId, saveTaxonGroup, MAX_BULK_BATCH, CATALOG_SCHEMA_VERSION } from '../utils/taxonGroups'
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

// ── Phase 1: LEAN identification preview ─────────────────────────
//
// 2026-05 admin-use-case rewrite: preview'as dabar yra TIK identification +
// disambiguation kandidatai. Anksčiau (žiūr. git tag `user-search-v1`) tas
// pats tool'as grąžindavo aprasymas / idomybes / careInfo / savybes — bet
// admin'ui to nereikia (jis daro Bulk save'ą kuris perpildo catalog'ą su
// rich info per TOOL_BULK_SERIES).
//
// Slim'inimas duoda ~70% mažiau token'ų ir ~10-20s greitesnį atsaką.
// Heavy field'ai liko schema'oje kaip OPTIONAL — jei AI vis tiek nori
// užpildyti high-confidence atveju (single plant save), neblokuojam.
// Bet `required` masyve jų nebėra — AI gali grąžinti tuščius/null.
export const TOOL_PREVIEW = {
  name: 'plant_preview',
  description: 'IDENTIFIKUOK augalą + grąžink disambiguation kandidatus jei abejoji. SLIM mode — TIK identification info (latinName, ltName, candidates, confidence). NEPILDYK aprašymo, kilmės, priežiūros, savybių, įdomybių — palik null arba tuščius. Rich info pildoma vėliau per bulk_series (kai admin paspaudžia „Pridėti seriją") arba plant_details (kai vartotojas paspaudžia Save).',
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
        description: 'JEI confidence != "high" IR yra plausibly identifikuojamų kandidatų — surašyk juos. Kiekiai: cultivar serijoms (Boulevard, Wave, Knock Out) — VISI žinomi nariai iki 15; vizualiai panašios rūšys disambiguation atveju — 2-5. Vartotojas paskui pasirinks vieną → nauja paieška su tiksliu pavadinimu → high confidence rezultatas. Tuščia array jei kandidatai neaišku arba confidence == high.',
        maxItems: 15,
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
    // SLIM required'as — TIK identification + honesty. Visi rich field'ai
    // (tipas, savybes, aprasymas, kilme, sviesa, vanduo, idomybes ir t.t.)
    // optional'iai — AI gali grąžinti null/tuščius, ir mes nelaužiam build'o.
    // (Žiūr. `user-search-v1` git tag — pilna senesnė required lista.)
    required: ['confidence', 'matchLevel', 'uncertaintyReason', 'sources', 'candidates',
               'name', 'latinName', 'emoji'],
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

// ── Bulk series save — vienu call'u pildo VISĄ seriją (shared + per-cultivar) ──
//
// Užklausus seriją (pvz. „Clematis 'Boulevard'") AI grąžina:
//   • series block (SHARED — visiems cultivars vienodi field'ai)
//   • cultivars array (PER-CULTIVAR — tik kas skiriasi)
//
// Naive bulk = 20× pilnas schema = 30K tokens ≈ $0.45
// Smart bulk = 1× series + 20× minimal cultivar = 5K tokens ≈ $0.08
// 6x pigiau, semantiškai aligned su mūsų TaxonGroup + Catalog split'u.

export const TOOL_BULK_SERIES = {
  name: 'bulk_series',
  description: 'Pateik PILNĄ cultivar serijos info su VISAIS žinomais cultivars (iki 25). Shared care/savybės eina į series block; per-cultivar — į cultivars array.',
  input_schema: {
    type: 'object',
    properties: {
      series: {
        type: 'object',
        description: 'Shared atributai visiems šios serijos cultivars',
        properties: {
          type:               { type: 'string', enum: ['cultivar-series', 'species', 'hybrid', 'genus-care', 'cultivar-group', 'variety', 'subspecies'] },
          name:               { type: 'string', description: 'Serijos pavadinimas (pvz. „Boulevard", „Hosta sieboldiana")' },
          genus:              { type: 'string', description: 'Genus (pvz. „Clematis")' },
          breeder:            { type: ['string', 'null'], description: 'Brand owner / breeder (pvz. „Raymond Evison"). null jei nežinai arba neaktualus.' },
          aliases:            { type: 'array', items: { type: 'string' }, description: 'Alternative serijos pavadinimai („Boulevard®", „Evison Boulevard")' },
          aprasymas:          { type: 'string', description: '3-5 sakiniai apie seriją — kilmė, charakteristika, naudojimas' },
          kilme:              { type: 'string', description: 'Serijos kilmė (šalis, breeder, metai)' },
          tipas:              { type: 'string', description: 'Augalo tipas (pvz. „Vijoklinis daugiametis")' },
          augimo_greitis:     { type: 'string', enum: ['lėtas', 'vidutinis', 'greitas'] },
          sunkumas:           { type: 'integer', minimum: 1, maximum: 5 },
          cultivationContext: { type: 'string', enum: ['indoor', 'outdoor', 'both'], description: 'Kur augo: kambaryje, lauke, arba abu' },
          lifecycle:          { type: 'string', enum: ['annual', 'biennial', 'perennial', 'woody', 'bulbous'] },
          hardiness:          { type: ['object', 'null'], description: 'Hardiness — TIK outdoor augalams; indoor → null', properties: { usdaZone: { type: 'string' }, minTempC: { type: 'integer' } } },
          typicalHeight:      { type: 'string', description: '„0.8-1.2m" formato range' },
          typicalSpread:      { type: ['string', 'null'] },
          careInfo: {
            type: 'object',
            description: 'Shared care — visiems serijos nariams vienodi',
            properties: {
              sviesa:              { type: 'object', properties: { taskai: { type: 'integer' }, lygis: { type: 'string' }, ppfd: { type: 'object', properties: { min: { type: 'integer' }, max: { type: 'integer' } } } } },
              vanduo:              { type: 'object', properties: { taskai: { type: 'integer' }, lygis: { type: 'string' } } },
              laistymasIntervalas: { type: 'object', properties: { vasara: { type: 'integer' }, ziema: { type: ['integer', 'null'] }, metodas: { type: 'string' } } },
              tresimas:            { type: 'object', properties: { intervalVasara: { type: 'integer' }, intervalZiema: { type: ['integer', 'null'] }, tipas: { type: 'string' } } },
              substratas:          { type: 'string' },
              persodinimas:        { type: 'string' },
              ziemojimas:          { type: 'string' },
              prieziura:           { type: 'object', properties: { sviesa: { type: 'string' }, laistymas: { type: 'string' }, temperatura: { type: 'string' }, dregme: { type: 'string' } } },
            },
          },
          savybes: {
            type: 'object',
            description: 'Pavojai/valgomumas/vaistinis — paprastai shared genus-level',
            properties: {
              pavojai:      { type: 'array', items: { type: 'object', properties: { tipas: { type: 'string', enum: ['toksiskas', 'alergiskas', 'dirginantis'] }, target: { type: 'string', enum: ['zmonems', 'gyvunams'] }, severity: { type: 'string', enum: ['silpnas', 'vidutinis', 'stiprus'] } } } },
              pavojingumas: { type: 'object', properties: { yra: { type: 'boolean' }, lygis: { type: ['string', 'null'] }, detales: { type: 'string' } } },
              valgomumas:   { type: 'object', properties: { statusas: { type: 'string' }, dalys: { type: 'string' }, detales: { type: 'string' } } },
              vaistinis:    { type: 'object', properties: { statusas: { type: 'string' }, naudojama: { type: 'string' }, detales: { type: 'string' } } },
            },
          },
          dauginimas:         { type: 'array', items: { type: 'string' } },
          problemos:          { type: 'array', items: { type: 'object', properties: { pavadinimas: { type: 'string' }, sprendimas: { type: 'string' } } } },
          idomybes:           { type: 'array', items: { type: 'string' }, description: '2-3 serijos faktai' },
          sources:            { type: 'array', items: { type: 'string' }, description: 'Web search šaltiniai (URLs)' },
        },
        required: ['type', 'name', 'genus', 'cultivationContext', 'lifecycle', 'careInfo', 'savybes', 'tipas'],
      },
      cultivars: {
        type: 'array',
        description: 'Visi žinomi šios serijos cultivars (iki 25). TIK per-cultivar info — kas skiriasi nuo serijos defaults.',
        items: {
          type: 'object',
          properties: {
            latinName:             { type: 'string', description: 'TRADE name (rinkos / gardener pavadinimas, KURĮ ŽMONĖS NAUDOJA) su cultivar žymeniu. Pvz. „Clematis \'Olympia\'", „Clematis \'Boulevard Bourbon\'", „Rosa \'Knock Out\'". NIEKADA neįrašyk patent/registracijos kodų (EVIPO006, EVIPO078, RADrazz, MEIcobuis, KORnacapi) į šitą lauką — jie eina į registeredAs. Jei žinai abu — pirmenybė TRADE name.' },
            ltName:                { type: ['string', 'null'], description: 'Lietuviškas pavadinimas jei žinai (pvz. „Olimpija")' },
            distinguishingFeature: { type: 'string', description: 'Vizualus aprašymas (žiedų spalva/forma) — kuo atskiriasi nuo kitų serijos narių' },
            emoji:                 { type: 'string', description: 'Vienas emoji' },
            bloom:                 { type: ['object', 'null'], properties: { color: { type: 'string' }, period: { type: 'string' }, fragrant: { type: 'boolean' }, doubleFlower: { type: 'boolean' } } },
            registeredAs:          { type: ['string', 'null'], description: 'BREEDER patent/registration kodas (EVIPO006, EVIPO078, RADrazz, KORnacapi). Šitur, NE į latinName.' },
            overrides:             { type: ['object', 'null'], description: 'Per-cultivar overrides KAI TIKRAI skiriasi nuo serijos defaults (pvz. unikalus aukštis). Daugumai cultivars — null/empty.' },
          },
          required: ['latinName', 'distinguishingFeature', 'emoji'],
        },
        minItems: 2,
        maxItems: 25,
      },
    },
    required: ['series', 'cultivars'],
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
DISAMBIGUATION — KANDIDATAI (PRIVALOMA SĄLYGA)
═════════════════════════════════════════════════════════

🛑 GRIEŽTA TAISYKLĖ — jei tavo uncertaintyReason arba description
TEKSTE PAMINĖSI bet kuriuos KONKREČIUS cultivar pavadinimus (pvz.
„Cézanne, Rebecca, Olympia, Chantilly"), tada VISI ŠITIE pavadinimai
PRIVALO būti candidates array'uje su pilna informacija.

Negali sakyti „yra cultivars X, Y, Z" tekste BE jų sąrašo candidates'e.
Tai bug'as user'iui: jis mato problemą bet negali pasirinkti sprendimo.

Kiekvienas kandidatas turi turėti:
  • latinName — tikslus pavadinimas (su cultivar žymeniu, pvz „Clematis 'Cézanne'")
  • ltName — lietuviškas pavadinimas jei žinai, kitaip null
  • description — 1-2 sakiniai (serija, kilmė, charakteristika)
  • distinguishingFeature — GRYNAI VIZUALUS aprašymas (žiedų spalva, forma)
  • imageUrl — jei web_search rezultate matei photo URL, kitaip null

User'is paspausta vieną kandidatą → nauja paieška su tikslesniu pavadinimu
→ high confidence rezultatas → saugomas į catalog.

KADA PILDYTI candidates (privaloma):
  ✓ Užklausa: serijos pavadinimas („Clematis 'Boulevard'") → surašyk
    bent 4-5 populiarius serijos narius
  ✓ Photo identifikacija ne 100% tikra → surašyk top 3-5 plausibly rūšis
  ✓ Tekste paminėjai konkrečių cultivar pavadinimų → visi į candidates
  ✓ matchLevel == 'genus' arba 'species' kai pati genus turi cultivar'us

NEPILDYK candidates TIK jei:
  ✗ Confidence == 'high' (tikrai žinai augalą)
  ✗ Užklausa visiškai neaiški („kažkoks žalias augalas") — per daug,
    geriau low confidence + uncertaintyReason be konkrečių pavardžių

PAVYZDYS — Clematis 'Boulevard' užklausa:
  ✗ BLOGAI:
    uncertaintyReason: „Boulevard serijoje yra Cézanne, Rebecca, Olympia"
    candidates: []  ← NĖRA SĄRAŠO! User nemato sprendimo!

  ✓ GERAI:
    uncertaintyReason: „Boulevard yra cultivar serija, ne konkretus augalas."
    candidates: [
      { latinName: "Clematis 'Cézanne'", ltName: "Klematis Sezanas",
        description: "Boulevard serijos narys, kompaktiškas",
        distinguishingFeature: "Šviesiai mėlyni dideli žiedai su balta juostele",
        imageUrl: null },
      { latinName: "Clematis 'Rebecca'", ... },
      { latinName: "Clematis 'Olympia'", ... },
      ...
    ]

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

  // Wikidata verification — VISADA paraleliai (abiems branches), kad main
  // result'as gautų ✓ badge'ą tokia pat tvarka kaip candidates. Hit'as ant
  // structured entity'o = stiprus signal'as, kad augalas realiai egzistuoja
  // (atmeta AI hallucinations).
  const wdPromise = fetchWikidataPlant(parsed.latinName)

  // iNaturalist NETURI cultivar coverage'o — stripCultivar() vidiniame
  // fetch'e nuima quotes prieš API call'ą, todėl grąžinama artimiausia
  // RŪŠIS (pvz. „Gelsvoji raganė" Clematis 'Boulevard' užklausai).
  //
  // Apsauga: jei AI explicitly grąžino cultivar (matchLevel=='cultivar'
  // arba latinName turi quote'us) — NEPERRAŠOM AI suggested name'o iNat
  // species'o vardu. iNat lieka species'ams kaip:
  //   - photo fallback'as (jei Brave neranda)
  //   - gallery extras (kelios nuotraukos cycling'ui PhotoSheet'e)
  //   - LT name + sinonimai + englishNames (per fetchPlantNames)
  //
  // Low-confidence rezultatai — atmetam iNat enrichment'ą visiškai.
  const trustInat = !isCultivar && parsed.confidence !== 'low'

  if (trustInat) {
    // Species path. UNIFIED photo priority — Brave FIRST (gardener-style
    // photos, ne wild collection nuotraukos), iNat fallback'as ir gallery.
    // Visa keturi šaltiniai paraleliai — bendras laikas = max(brave, inat,
    // names, wikidata), o ne suma.
    const [bravePhoto, inatPhotos, namesData, wd] = await Promise.all([
      fetchBraveImage(parsed.latinName),
      fetchPhotos(parsed.latinName),
      fetchPlantNames(parsed.latinName),
      wdPromise,
    ])

    // Primary image priority chain:
    //   1. Brave (gardener photo) → 2. iNat[0] (species photo) → 3. Wikidata P18
    //   → 4. Wikipedia thumb (paskutinis fallback'as, sequential)
    let mainImage = bravePhoto ?? inatPhotos[0] ?? wd?.imageUrl ?? null
    if (!mainImage) mainImage = await fetchWikiThumbnail(parsed.latinName)

    // Gallery — Brave pirma (jei yra), paskui iNat extras (deduped).
    // Tai užtikrina cycling'ą PhotoSheet'e su Brave kaip default'iniu.
    const gallery = [
      ...(bravePhoto ? [bravePhoto] : []),
      ...inatPhotos.filter(p => p && p !== bravePhoto),
    ]

    const inatLtName = namesData?.inatLtName ?? null
    return {
      ...parsed,
      name:             inatLtName ?? parsed.name,
      image:            mainImage,
      photos:           gallery.length > 0 ? gallery : (mainImage ? [mainImage] : []),
      inatLtName,
      inatTaxonId:      namesData?.inatTaxonId ?? null,
      sinonimai:        namesData?.sinonimai    ?? [],
      englishNames:     namesData?.englishNames ?? [],
      wikidataId:       wd?.id ?? null,
      wikidataVerified: !!wd?.id,
    }
  }

  // Cultivar / low-confidence path — multi-source priority chain:
  //   1. Brave Image Search (paid primary, ~85-90% hit rate)
  //   2. iNaturalist Taxa autocomplete (free, plant-focused, strict cultivar match)
  //   3. Wikidata P18 (free)
  //   4. Wikipedia direct + opensearch thumbnail (free)
  // null jei visi miss → UI rodo plant card be photo.
  let mainImage = await fetchBraveImage(parsed.latinName)
  if (!mainImage) mainImage = await fetchInatCultivarImage(parsed.latinName)
  const wd = await wdPromise  // join — naudojam ir image fallback'ui ir verification'ui
  if (!mainImage && wd?.imageUrl) mainImage = wd.imageUrl
  if (!mainImage) mainImage = await fetchWikiThumbnail(parsed.latinName)

  return {
    ...parsed,
    name:             parsed.name,
    image:            mainImage,
    photos:           mainImage ? [mainImage] : [],
    wikidataId:       wd?.id ?? null,
    wikidataVerified: !!wd?.id,
    inatLtName:       null,
    inatTaxonId:      null,
    sinonimai:        [],
    englishNames:     [],
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

// Brave Image Search API — proxy'inta per /api/plant-image. Primary
// photo source (highest hit rate, ~85-90% populiariems cultivars'ams).
// Free tier 2000 queries/mėn, paskui $3/1000.
//
// (Anksčiau bandėm Google Custom Search — Google account-level blokavo
// naujiems projektams. Brave laisvesnis.)
//
// Strict filter'is: returned image title arba url privalo turėti BOTH
// genus IR cultivar word'us. Atmetam random / unrelated photos.
async function fetchBraveImage(latinName) {
  if (!latinName) return null
  const cleaned = cleanLatinForSearch(latinName)
  if (!cleaned) return null
  const genus    = cleaned.split(/\s+/)[0].toLowerCase()
  const cultivar = cleaned.replace(/['"]/g, '').toLowerCase().split(/\s+/).slice(1).join(' ').split(/\s+/)[0]

  // Client-side timeout — server'is jau turi 4s abort, bet jei Vercel cold
  // start ar tinklas užkimba, neturim laukti 30s+ ERR_TIMED_OUT'o, kol kybos
  // visi candidates. 5s viršyti = grįžtam null ir leidžiam iNat/Wikidata/
  // Wikipedia/Commons fallback'us pradėti. (2026-05 regresija: Brave kybėjo
  // → 23s photo collection → user'iui atrodė kad photos „neveikia".)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)

  try {
    const r = await fetch(`/api/plant-image?q=${encodeURIComponent(cleaned)}`, { signal: ctrl.signal })
    if (!r.ok) return null
    const data = await r.json()
    const candidates = data.images ?? []

    // Strict filter — title arba source url turi turėti BOTH genus IR cultivar.
    // Jei nei vienas neatitinka, grąžinam pirmą tik jei genus matosi
    // (genus-level fallback be cultivar mention).
    const strict = candidates.find(img => {
      const haystack = `${img.title ?? ''} ${img.source ?? ''} ${img.url ?? ''}`.toLowerCase()
      return haystack.includes(genus) && cultivar && haystack.includes(cultivar)
    })
    if (strict?.url) return strict.url

    // Genus-only fallback — atmetam tikrą false positive (irrelevant photo)
    const genusOnly = candidates.find(img => {
      const haystack = `${img.title ?? ''} ${img.source ?? ''} ${img.url ?? ''}`.toLowerCase()
      return haystack.includes(genus)
    })
    return genusOnly?.url ?? null
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('[brave-image] timed out after 5s — falling through to iNat/Wikidata/Wikipedia/Commons')
    } else {
      console.warn('[brave-image] fetch failed:', e)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
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

// Enrich'ina candidates su image URL'ais + Wikidata verification flag'u.
//
// Image priority chain (unchanged):
//   1. AI parinko imageUrl iš savo web_search (retas hit)
//   2. Brave Image Search (PAID primary, ~85-90% hit rate)
//   3. iNaturalist Taxa Autocomplete (free, plant-focused fallback)
//   4. Wikidata SPARQL (free)
//   5. Wikipedia REST direct + opensearch (free)
//   6. Wikimedia Commons strict filter (free)
//   7. null → UI fallback'ina į emoji
//
// Wikidata verification — VISADA paralelinis call'as (ne tik image fallback'ui).
// Naudojamas trust signal'ui — UI candidate card'as rodo ✓ ikonėlę „Patvirtinta
// per Wikidata" kai entity rastas. Wikidata yra human-curated structured data,
// todėl hit'as = high confidence kad cultivar realiai egzistuoja (atmeta AI
// hallucinations).
//
// Per-candidate sekvencialiai image'ams (early-exit), tarp candidates paraleliai.
async function enrichCandidates(candidates) {
  // Defensive — visada grąžinam masyvą, net jei AI'us nukrypo nuo schema'os
  // (pvz. grąžino object'ą ar null kai schema sako array). Anksčiau grąžindavom
  // input'ą as-is, kas vesdavo prie `.filter is not a function` error'o post-AI
  // verification cross-check'e.
  if (!Array.isArray(candidates) || candidates.length === 0) return []
  return Promise.all(candidates.map(async c => {
    // Wikidata — startuoja iš karto, lygiagrečiai su image enrichment'u
    const wdPromise = fetchWikidataPlant(c.latinName)

    // Image chain — early-exit kai pirmas šaltinis grąžina
    let imageUrl = c.imageUrl ?? null
    if (!imageUrl) imageUrl = await fetchBraveImage(c.latinName)
    if (!imageUrl) imageUrl = await fetchInatCultivarImage(c.latinName)

    // Join Wikidata — naudojamas tiek image fallback'ui, tiek verification flag'ui
    const wd = await wdPromise
    if (!imageUrl && wd?.imageUrl) imageUrl = wd.imageUrl

    if (!imageUrl) imageUrl = await fetchWikiThumbnail(c.latinName)
    if (!imageUrl) imageUrl = await fetchCommonsImage(c.latinName)

    return {
      ...c,
      imageUrl,
      wikidataId:       wd?.id ?? null,
      wikidataVerified: !!wd?.id,   // ✓ badge UI'e
    }
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

  // Bulk save state — kai admin'as save'ina visus serijos cultivars iš karto.
  // null = neaktyvu; objektas = vyksta su progress info; 'done' / 'error' — terminus.
  const [bulkState, setBulkState] = useState(null)
  // { phase: 'ai'|'images'|'saving'|'done'|'error', total, completed, seriesName, savedCount, msg }

  useEffect(() => {
    if (!loading) { setDots(''); return }
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(t)
  }, [loading])

  // Real-time progress tracking — vietoj fake timer cycling (kuris atrodo
  // random nes nieko neatspindi), naudojam helper, kurį iškviečia konkretūs
  // search flow žingsniai. Konsoleje log'inam timings, kad galim matyti
  // kuris žingsnis lėtas ir optimizuoti.
  const stepStartRef = useRef(null)
  const trackStep = (label) => {
    const now = Date.now()
    if (stepStartRef.current) {
      const prevLabel = stepStartRef.current.label
      const elapsed   = ((now - stepStartRef.current.startedAt) / 1000).toFixed(2)
      console.log(`[search] ✓ ${prevLabel} — ${elapsed}s`)
    }
    if (label) {
      stepStartRef.current = { label, startedAt: now }
      setStatusMsg(label)
    } else {
      stepStartRef.current = null
      setStatusMsg('')
    }
  }

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

  // ── Bulk save entire series → taxonGroups + catalog ─────────────────
  // Vienas AI call'as su TOOL_BULK_SERIES grąžina (series + cultivars).
  // Save'inam į DB ir paraleliai įkeliam image URL'us per Brave/iNat chain'ą.
  // Costs: ~$0.05-0.15 priklausomai nuo cultivars sk., +Brave queries.
  const bulkSaveSeries = async (seriesQuery, initialCandidates = []) => {
    setBulkState({ phase: 'ai', msg: 'AI surenka visą serijos info...' })
    try {
      // 1) AI bulk call su web_search (max_uses=3, nes serija dažnai reikalauja research'o)
      const r = await claudeCall({
        maxTokens:   8000,
        temperature: 0.3,
        system:      PLANT_SYSTEM,
        tools: [
          TOOL_BULK_SERIES,
          { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
        ],
        messages: [{
          role: 'user',
          content: `Pateik PILNĄ info apie augalų seriją „${seriesQuery}" naudojant bulk_series tool'ą. Surašyk VISUS žinomus cultivars (iki ${MAX_BULK_BATCH}). Series block — shared care/savybės; cultivars array — tik vizualinis aprašymas + bloom info per cultivar.

KRITIŠKAI SVARBU: cultivars[].latinName lauke naudok TRADE name (rinkos pavadinimą), pvz. „Clematis 'Olympia'", „Clematis 'Boulevard Bourbon'" — TAI, KĄ ŽMONĖS NAUDOJA. Patent/registracijos kodus (EVIPO006, EVIPO078, RADrazz) rašyk į registeredAs lauką, NIEKADA į latinName. Jei serijoje cultivars yra dvigubo pavadinimo (trade name + EVIPO kodas) — latinName = trade name, registeredAs = EVIPO kodas.

Naudok web_search RHS / Wikipedia / breeder svetainėse jei reikia patvirtinti tikrus trade name'us.`,
        }],
      })
      const block = r.content.find(b => b.type === 'tool_use' && b.name === 'bulk_series')
      if (!block) throw new Error('AI negrąžino bulk_series struktūros')

      // Defensive — AI'us kartais nukrypsta nuo schema'os (object vietoj array,
      // null vietoj field'o). Normalize'inam viską į saugias reikšmes prieš naudojant.
      const series    = block.input?.series ?? {}
      const cultivars = Array.isArray(block.input?.cultivars) ? block.input.cultivars : []
      if (cultivars.length === 0) throw new Error('AI grąžino tuščią cultivars sąrašą — bandyk dar kartą')

      const seriesId = taxonGroupDocId({ genus: series.genus, name: series.name, type: series.type })
      if (!seriesId) throw new Error('Negalima sukurti seriesId (trūksta genus/name)')

      setBulkState({ phase: 'saving', msg: 'Saugomas serijos doc...', seriesName: series.name, total: cultivars.length, completed: 0 })

      // 2) Save series → taxonGroups. Visi array field'ai (aliases, dauginimas,
      // problemos, idomybes, sources) normalize'inami su Array.isArray check'u —
      // kad AI grąžintas object/null nekirtų downstream'ui.
      await saveTaxonGroup({
        id:             seriesId,
        type:           series.type,
        name:           series.name,
        genus:          series.genus,
        breeder:        series.breeder ?? null,
        aliases:        Array.isArray(series.aliases) ? series.aliases : [],
        aprasymas:      series.aprasymas,
        kilme:          series.kilme,
        tipas:          series.tipas,
        augimo_greitis: series.augimo_greitis,
        sunkumas:       series.sunkumas,
        cultivationContext: series.cultivationContext,
        lifecycle:      series.lifecycle,
        hardiness:      series.hardiness,
        typicalHeight:  series.typicalHeight,
        typicalSpread:  series.typicalSpread,
        careInfo:       series.careInfo ?? {},
        savybes:        series.savybes ?? {},
        dauginimas:     Array.isArray(series.dauginimas) ? series.dauginimas : [],
        problemos:      Array.isArray(series.problemos)  ? series.problemos  : [],
        idomybes:       Array.isArray(series.idomybes)   ? series.idomybes   : [],
        sources:        Array.isArray(series.sources)    ? series.sources    : [],
        verificationStatus: 'auto-verified',
        aiVerifiedAt:   new Date().toISOString(),
      })

      // 3) Per kiekvieną cultivar: fetch image + save į catalog (paraleliai)
      setBulkState({ phase: 'images', msg: 'Renku nuotraukas ir saugau cultivars...', seriesName: series.name, total: cultivars.length, completed: 0 })

      let completed = 0
      // Defensive — initialCandidates ateina iš result.candidates (caller passes
      // SearchModal'io state'ą), kuris teoriškai jau masyvas po enrichCandidates
      // normalizacijos. Bet jei kažkas pakeitė state'ą tarp render'o ir bulk save'o —
      // nenorim cracked'inti čia.
      const safeInitial = Array.isArray(initialCandidates) ? initialCandidates : []
      const initialImageMap = new Map(
        safeInitial.map(c => [c.latinName, c.imageUrl ?? null])
      )

      await Promise.all(cultivars.map(async (c) => {
        const cultId = catalogDocId(c.latinName)
        if (!cultId) { completed++; return }

        // Image enrichment + Wikidata verification — paraleliai.
        // Wikidata flag'ai saugomi catalog'e, kad library-first short-circuit'as
        // grąžintų cultivar'us su ✓ badge'ais (kaip ir AI-served candidates).
        const [imageUrl, wd] = await Promise.all([
          (async () => {
            let img = initialImageMap.get(c.latinName) ?? null
            if (!img) img = await fetchBraveImage(c.latinName)
            if (!img) img = await fetchInatCultivarImage(c.latinName)
            if (!img) img = await fetchWikiThumbnail(c.latinName)
            return img
          })(),
          fetchWikidataPlant(c.latinName),
        ])

        await saveToCatalog({
          lotyniskas:            c.latinName,
          lietuviškas:           c.ltName ?? c.latinName,
          emoji:                 c.emoji ?? '🌿',
          distinguishingFeature: c.distinguishingFeature,
          bloom:                 c.bloom ?? null,
          registeredAs:          c.registeredAs ?? null,
          overrides:             c.overrides ?? null,
          image:                 imageUrl,
          taxonGroupId:          seriesId,
          schemaVersion:         CATALOG_SCHEMA_VERSION,
          verificationStatus:    'auto-verified',
          wikidataId:            wd?.id ?? null,
          wikidataVerified:      !!wd?.id,
          aiVerifiedAt:          new Date().toISOString(),
        }).catch(e => console.warn('[bulk] cultivar save failed:', c.latinName, e))

        completed++
        setBulkState(s => s ? { ...s, completed } : s)
      }))

      setBulkState({ phase: 'done', msg: `Pridėta ${cultivars.length} cultivars iš „${series.name}" serijos.`, seriesName: series.name, total: cultivars.length, completed: cultivars.length })
      console.log(`[bulk] ✓ ${series.name} — ${cultivars.length} cultivars saved`)
    } catch (e) {
      console.error('[bulk] failed:', e)
      setBulkState({ phase: 'error', msg: e?.message ?? 'Klaida bulk save metu' })
    }
  }

  // ── Text search — Phase 1 (preview) + Phase 2 (details) ────────
  const searchByText = async (q) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true); setResult(null); setError(null); setPreview(null)
    const totalStartedAt = Date.now()

    try {
      // ── Phase 0: Library-first short-circuit ──────────────────
      // Prieš leidžiant AI'ą (~60s + $) — patikrinam mūsų catalog'ą fuzzy
      // search'u. Jei žmonės jau yra ieškoję / admin'as bulk save'inęs šitą
      // augalą — gauname rezultatą per ~100ms be AI cost'o.
      // Library hit'ai konvertuojami į AI result shape'ą (catalogEntryToAIResult)
      // ir naudojami kaip kandidatai, kad UI'us veiktų identiškai kaip su AI.
      trackStep('Tikrinu mūsų bibliotekoje...')
      const ownedIds = new Set(plants.map(p => catalogDocId(p.lotyniskas)).filter(Boolean))
      // Limit 20 — kad serijos search'as (Boulevard, kuri turi 15 cultivars)
      // grąžintų visus narius vienu kartu. Autocomplete'as (line 1340 žemiau)
      // lieka su default'iniu 6 — kompaktiškas dropdown'as.
      const catalogHits = await searchCatalog(q.trim(), ownedIds, 20)
      if (controller.signal.aborted) return

      if (catalogHits.length > 0) {
        // Catalog entry → candidate card shape (UI naudoja imageUrl / ltName).
        // Wikidata flag'ai propaguojami iš catalog'o (saugomi per bulk save'ą)
        // — kad library-first cultivar'ai gautų ✓ badge'us, ne tik AI-served.
        const candidates = catalogHits.map(c => ({
          ...catalogEntryToAIResult(c),
          imageUrl:         c.image ?? null,
          ltName:           c.lietuviškas ?? c.name ?? null,
          wikidataVerified: !!c.wikidataVerified,
          wikidataId:       c.wikidataId ?? null,
        }))
        // Single strong hit — set'inam kaip pagrindinį rezultatą.
        // Multiple — set'inam pirmąjį (best fuzzy score) + visus kaip candidates,
        // kad user'is galėtų pasirinkti kitą jei nepatinka.
        const primary = candidates[0]
        setResult({
          ...primary,
          candidates: candidates.length > 1 ? candidates : undefined,
          fromCatalog: true,
        })
        setLoading(false)
        trackStep(null)
        console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s (library-first, ${catalogHits.length} match'as${catalogHits.length === 1 ? '' : 'ai'}, AI praleistas)`)
        return
      }

      // ── Phase 0.5: Query response cache ──────────────────────
      // Catalog'as nieko nerado — patikrinam ar ankstesnis AI atsakymas tam
      // pačiam query yra cache'intas (48h TTL). Visi enrichment'ai (photos,
      // Wikidata verification) jau pritaikyti — instant replay.
      const cachedResponse = getCachedSearchResponse(q.trim())
      if (cachedResponse) {
        setResult(cachedResponse)
        setLoading(false)
        trackStep(null)
        console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s (response cache hit, AI praleistas)`)
        return
      }

      trackStep('AI ieško augalo...')

      // ── Phase 1: AI preview su web_search tool'u ───────────────
      // Web search'as įgalintas — Claude'as gali apsilankyti RHS, Wikipedia,
      // MissouriBotanical, kai užklausa neaiški (cultivar, hybrid, recent
      // introduction). max_uses=2 riboja latency + cost. tool_choice = auto
      // (Anthropic API leidžia web_search server-side tool'ą veikti šalia
      // forced tool'o; Claude'as gali iškviesti web_search prieš plant_preview).
      const r1 = await claudeCall({
        // SLIM preview'ui užtenka mažiau token'ų — nepildom rich field'ų.
        // 2500 = identification + iki 15 candidate'ų su distinguishingFeature
        // (Boulevard serija turi ~25 cultivars, 15 yra praktinis preview limit'as).
        maxTokens:   2500,
        temperature: 0.3,
        system:      PLANT_SYSTEM,
        tools: [
          TOOL_PREVIEW,
          // max_uses 2 → 1: identification'ui užtenka vieno verification trip'o.
          // Rich research'as eina į bulk_series flow'ą su max_uses=3.
          { type: 'web_search_20250305', name: 'web_search', max_uses: 1 },
        ],
        messages: [{
          role: 'user',
          content: `IDENTIFIKUOK augalą: "${q}".

SLIM MODE — admin'o disambiguation use case'as, NE user-facing rich preview:
• Užtenka: latinName, ltName, candidates[] (jei abejoji), confidence, sources
• NEPILDYK: aprašymo, kilmės, priežiūros (sviesa/vanduo/substratas/...), savybių (toksiškumo/valgomumo/vaistinio), įdomybių, tipo, augimo greičio — palik null/tuščius
• Jei tai cultivar serija (Boulevard, Wave, Knock Out, Hosta sieboldiana ir t.t.) → candidates[] su VISAIS žinomais nariais, iki 15. Tai admin'o disambiguation prieš bulk save'ą — kuo daugiau, tuo geriau.
• Jei abejoji konkrečiu cultivar — web_search vieną kartą RHS/Wikipedia, paskui grąžink kandidatus

Rich info (aprašymas, priežiūra, savybės) bus pildoma vėlesniame žingsnyje per kitą tool'ą.`,
        }],
      })
      if (controller.signal.aborted) return

      const previewBlock = r1.content.find(b => b.type === 'tool_use' && b.name === 'plant_preview')
      if (!previewBlock) { setError('Augalas nerastas'); setLoading(false); trackStep(null); return }

      const aiResult = previewBlock.input

      // ── Catalog-first override ──────────────────────────────────
      // Jei catalog'as turi expert-verified arba high-confidence entry'į
      // šitam latin name'ui — naudojam jį vietoj fresh AI rezultato.
      // Catalog yra source of truth verified info'ai. Skip'iname enrich
      // (iNat photo) — naudojam catalog saved photo.
      trackStep('Tikrinu mūsų bibliotekoje...')
      const cached = await getCatalogEntry(aiResult.latinName)
      const trustCatalog = cached && (
        cached.verificationStatus === 'expert-verified' ||
        cached.aiConfidence === 'high'
      )

      if (trustCatalog) {
        setResult({ ...catalogEntryToAIResult(cached), fromCatalog: true })
        setLoading(false)
        trackStep(null)
        console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s (from catalog)`)
        return
      }

      // ── Catalog miss arba unverified — naudojam AI + enrich ─────
      const hasCandidates = Array.isArray(aiResult.candidates) && aiResult.candidates.length > 0
      trackStep(
        hasCandidates
          ? `Renku nuotraukas (${aiResult.candidates.length} kandidatams)...`
          : 'Renku nuotrauką...'
      )
      // Paraleliai — enrich AI result (iNat photo, names) + enrich candidates (multi-source thumbnails)
      const [enriched, candidatesWithImages] = await Promise.all([
        enrich(aiResult),
        enrichCandidates(aiResult.candidates),
      ])
      enriched.candidates = candidatesWithImages
      if (controller.signal.aborted) return

      // Reliability cross-check — jei AI'us drąsiai sakė „high", bet Wikidata
      // neaptiko nei main result'o, nei nieko iš kandidatų, sąžiningai pažeminam
      // confidence į „medium" ir pridedam uncertaintyReason. Wikidata yra
      // structured human-curated source — jo absence reiškia: galimai reta
      // cultivar (dar nekatalog'inta) arba AI spėjimas, ne tikras augalas.
      // UI rodys confidence banner'į ir admin'as žinos, kad reikia žiūrėti
      // atidžiau prieš save'inant į biblioteką.
      // Defensive — enriched.candidates teoriškai jau masyvas (enrichCandidates
      // normalizuoja), bet papildomas Array.isArray guard'as apsaugo nuo
      // edge case'ų (pvz. catalog entry su corrupted candidates field'u).
      const candidatesList = Array.isArray(enriched.candidates) ? enriched.candidates : []
      const verifiedCount = (enriched.wikidataVerified ? 1 : 0) +
        candidatesList.filter(c => c.wikidataVerified).length
      if (aiResult.confidence === 'high' && verifiedCount === 0) {
        enriched.confidence = 'medium'
        const wdNote = '(Wikidata neaptiko šio cultivar entity\'o — galimai reta registracija arba AI spėjimas.)'
        enriched.uncertaintyReason = enriched.uncertaintyReason
          ? `${enriched.uncertaintyReason} ${wdNote}`
          : wdNote
        console.log('[search] ⚠ AI sakė high bet Wikidata neverify\'no — downgrade į medium')
      }

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
      trackStep(null)
      // Cache pilną enriched result'ą (su image'ais + Wikidata verification) —
      // kitą kartą šitą query'į gausim per 0ms be AI / web_search latency'o.
      setCachedSearchResponse(q.trim(), enriched, aiResult.confidence)
      console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s`)
    } catch (e) {
      if (e.name === 'AbortError' || controller.signal.aborted) return
      if (e.code === 'limit_reached') {
        setLoading(false); trackStep(null)
        setPaywallLimitType(e.limitType); setPaywallOpen(true)
        return
      }
      console.error('[SearchModal] error:', e)
      setError('Klaida ieškant augalo.')
      setLoading(false)
      trackStep(null)
    }
  }

  // ── Photo search — Phase 1 (preview) + Phase 2 (details) ───────
  const searchByPhoto = async (file) => {
    setLoading(true); setResult(null); setError(null); setQuery('')
    const totalStartedAt = Date.now()
    trackStep('Apdorojama nuotrauka...')
    try {
      const dataUrl = await resizeImage(file, 1200, 0.9)
      const base64  = dataUrl.split(',')[1]
      setPreview(dataUrl)
      trackStep('AI identifikuoja augalą...')

      const userMsg = {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text',  text: 'IDENTIFIKUOK augalą šioje nuotraukoje (arba ant etiketės). SLIM mode — užtenka latinName, ltName, candidates jei abejoji, confidence. NEPILDYK aprašymo / priežiūros / savybių — palik null/tuščius.' },
        ],
      }

      // ── Phase 1: AI preview su web_search ──────────────────────
      // Photo search'ui irgi pridedam web_search — pvz. kai user'is įkelia
      // cultivar'o nuotrauką iš augalų pirkliautojo, AI gali patvirtinti
      // pavadinimą per RHS/Wikipedia.
      const r1 = await claudeCall({
        // SLIM mode — žiūr. searchByText komentarą prie TOOL_PREVIEW.
        maxTokens:   1500,
        temperature: 0.3,
        system:      PLANT_SYSTEM,
        tools: [
          TOOL_PREVIEW,
          { type: 'web_search_20250305', name: 'web_search', max_uses: 1 },
        ],
        messages:    [userMsg],
      })

      const previewBlock = r1.content.find(b => b.type === 'tool_use' && b.name === 'plant_preview')
      if (!previewBlock) { setError('Nepavyko identifikuoti augalo.'); setLoading(false); trackStep(null); return }

      const aiResult = previewBlock.input

      // Catalog-first override (žiūr. searchByText komentarą)
      trackStep('Tikrinu mūsų bibliotekoje...')
      const cached = await getCatalogEntry(aiResult.latinName)
      const trustCatalog = cached && (
        cached.verificationStatus === 'expert-verified' ||
        cached.aiConfidence === 'high'
      )

      if (trustCatalog) {
        setResult({ ...catalogEntryToAIResult(cached), fromCatalog: true })
        setLoading(false)
        trackStep(null)
        console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s (from catalog)`)
        return
      }

      const hasCandidates = Array.isArray(aiResult.candidates) && aiResult.candidates.length > 0
      trackStep(
        hasCandidates
          ? `Renku nuotraukas (${aiResult.candidates.length} kandidatams)...`
          : 'Renku nuotrauką...'
      )
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
      trackStep(null)
      console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s`)
    } catch (e) {
      if (e.code === 'limit_reached') {
        setLoading(false); trackStep(null)
        setPaywallLimitType(e.limitType); setPaywallOpen(true)
        return
      }
      console.error('[SearchModal photo] error:', e)
      setError('Nepavyko identifikuoti augalo. Bandykite aiškesnę nuotrauką.')
      setLoading(false)
      trackStep(null)
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

                {/* Admin bulk save — vienas AI call'as save'ina VISĄ seriją
                    (taxonGroup + cultivars + photos) į catalog'ą. Pigesnis nei
                    po vieną. Tinka admin/manager flow'ui — user'iui slėpti
                    vėliau (žiūr. backlog). */}
                <button
                  onClick={() => bulkSaveSeries(query.trim() || result.latinName, result.candidates)}
                  disabled={!!bulkState && bulkState.phase !== 'done' && bulkState.phase !== 'error'}
                  className="w-full mb-2 bg-forest-700 hover:bg-forest-800 disabled:opacity-40 text-bone-50 rounded-2xl px-4 py-2.5 text-[13px] font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  💾 Pridėti visą seriją į biblioteką
                  <span className="font-mono text-[10px] opacity-70">(iki {MAX_BULK_BATCH} cultivars · ~$0.10)</span>
                </button>
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
                          <p className="font-semibold text-forest-800 text-[15px] leading-tight flex items-center gap-1.5">
                            <span className="truncate">{c.ltName || c.latinName.replace(/^[A-Z][a-z]+\s+['"]/, '').replace(/['"]$/, '')}</span>
                            {/* Wikidata verification badge — ✓ ikonėlė reiškia,
                                kad cultivar yra Wikidata entity'je (human-curated
                                structured data). Stiprus signal'as, kad AI
                                nehallucinuoja — toks cultivar realiai egzistuoja. */}
                            {c.wikidataVerified && (
                              <CheckCircle2
                                size={13}
                                className="text-forest-600 flex-shrink-0"
                                title="Patvirtinta per Wikidata"
                                aria-label="Patvirtinta per Wikidata"
                              />
                            )}
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
      {bulkState && (
        <BulkSaveOverlay key="bulk" state={bulkState} onClose={() => setBulkState(null)} />
      )}
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

// ── BulkSaveOverlay — bulk series save progress + final summary ──────
//
// state structure (žiūr. bulkSaveSeries handler):
//   { phase: 'ai'|'saving'|'images'|'done'|'error', msg, seriesName, total, completed }
//
// Trys faze: AI generuoja → Saugomas series doc → Per-cultivar saves su images
// (visa tai client-side, paraleliai per Promise.all). „Done" faze su summary
// ir Close button'u.
function BulkSaveOverlay({ state, onClose }) {
  const isDone   = state.phase === 'done'
  const isError  = state.phase === 'error'
  const isActive = !isDone && !isError
  const progress = state.total ? Math.round((state.completed ?? 0) / state.total * 100) : 0

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-forest-800/55 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-bone-50 rounded-3xl p-7 mx-6 flex flex-col items-center gap-4 shadow-[0_12px_32px_rgba(28,58,42,0.24)] border border-bone-400/50 w-full max-w-[360px]"
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
      >
        {isActive && <BrandLoader />}
        {isDone   && <div className="text-5xl">✓</div>}
        {isError  && <div className="text-5xl">⚠</div>}

        <div className="text-center">
          <p className="font-display text-base font-semibold tracking-tight text-forest-800">
            {isDone ? 'Pridėta!' : isError ? 'Klaida' : 'Bulk save…'}
          </p>
          {state.seriesName && (
            <p className="font-mono text-[11px] text-forest-500 mt-0.5">
              {state.seriesName}
            </p>
          )}
          <p className="text-sm text-forest-600 mt-1.5 leading-snug">
            {state.msg}
          </p>
        </div>

        {/* Progress bar — rodom kai turim total */}
        {isActive && state.total > 0 && (
          <div className="w-full">
            <div className="h-1.5 bg-bone-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-forest-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="font-mono text-[10px] text-forest-400 text-center mt-1.5">
              {state.completed} / {state.total} cultivars
            </p>
          </div>
        )}

        {/* Close — tik kai done arba error */}
        {(isDone || isError) && (
          <button
            onClick={onClose}
            className="w-full h-11 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
          >
            Uždaryti
          </button>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}
