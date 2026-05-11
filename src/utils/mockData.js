// Mock data for desktop-ux branch (VITE_USE_MOCK_USER=true).
// Naudojama Vercel preview'ams be Google OAuth.
// NEdeplo'inama į master / production.

const TODAY = new Date()
const daysAgo = (n) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export const MOCK_USER = {
  uid: 'mock-user',
  displayName: 'Rūta',
  email: 'mock@lapasid.lt',
  photoURL: null,
  isAnonymous: false,
}

export const MOCK_COLLECTION_ID = 'mock-collection'
export const MOCK_COLLECTION_NAME = 'Stepono'

export const MOCK_ZONES = [
  { id: 'zone-virtuve',    name: 'Virtuvė' },
  { id: 'zone-svetaine',   name: 'Svetainė' },
  { id: 'zone-miegamasis', name: 'Miegamasis' },
]

// Spalvota augalų rinkinys įvairiems UI testams:
// - Kelios overdue laistymui, kelios — tręšimui, kelios abiem
// - Kelios su nuotrauka (placeholder URL), kelios be (emoji)
// - Per zonas + nepriskirti
// - Su varying confidence (kelios 3+ same-season waterings → 100%)
// - Toxic flagai, istorija, nori
export const MOCK_PLANTS = [
  // ─── auginama (Dashboard) ───
  {
    id: 'p1',
    lietuviškas: 'Kininis piniginis augalas',
    lotyniskas: 'Pilea peperomioides',
    kategorija: 'auginama',
    zonaId: 'zone-virtuve',
    image: null, emoji: '🪴',
    sviesa: { lygis: 'Vidutinė', taskai: 2 },
    vanduo: { lygis: 'Vidutinis', taskai: 2 },
    laistymasIntervalas: { vasara: 10, ziema: 21, metodas: 'Žemei pradžiūvus' },
    sunkumas: 2,
    toksiskas: false,
    data_prideta: daysAgo(120),
    timeline: [
      { id: 'p1w1', type: 'watering',  date: daysAgo(2) },
      { id: 'p1n1', type: 'note',      date: daysAgo(8), note: 'Pradėjo geltonuoti apatinis lapas, gali būti per drėgna.\nPamiršau patikrinti grunto sausumą prieš laistant.' },
      { id: 'p1w2', type: 'watering',  date: daysAgo(12) },
      { id: 'p1t1', type: 'treatment', date: daysAgo(18), preparatas: 'Confidor', tikslas: 'amarai', metodas: 'lapų purškimas', note: 'Pastebėjau amarus apatiniame lapelyje. Profilaktiškas purškimas.' },
      { id: 'p1w3', type: 'watering',  date: daysAgo(22) },
      { id: 'p1m1', type: 'move',      date: daysAgo(28), fromZoneId: 'zone-svetaine', toZoneId: 'zone-virtuve' },
      { id: 'p1w4', type: 'watering',  date: daysAgo(33) },
      { id: 'p1r1', type: 'repotting', date: daysAgo(60), potSize: '14 cm', note: 'Perkėliau į didesnį vazoną — šaknys jau išlindo per dugno skylę.' },
    ],
  },
  {
    id: 'p2',
    lietuviškas: 'Krotonmedis',
    lotyniskas: 'Codiaeum variegatum',
    kategorija: 'auginama',
    zonaId: 'zone-virtuve',
    image: null, emoji: '🌿',
    sviesa: { lygis: 'Ryški', taskai: 3 },
    vanduo: { lygis: 'Daug', taskai: 3 },
    laistymasIntervalas: { vasara: 7, ziema: 14, tresimasIntervalas: 21, metodas: 'Reguliariai, drėgnai' },
    sunkumas: 4,
    toksiskas: true,
    data_prideta: daysAgo(200),
    timeline: [
      { id: 'p2w1', type: 'watering',    date: daysAgo(1) },
      { id: 'p2f1', type: 'fertilizing', date: daysAgo(5) },
      { id: 'p2w2', type: 'watering',    date: daysAgo(8) },
      { id: 'p2w3', type: 'watering',    date: daysAgo(15) },
    ],
  },
  {
    id: 'p3',
    lietuviškas: 'Vaškinė hoja',
    lotyniskas: 'Hoya carnosa',
    kategorija: 'auginama',
    zonaId: 'zone-virtuve',
    image: null, emoji: '🌱',
    sviesa: { lygis: 'Ryški', taskai: 3 },
    vanduo: { lygis: 'Mažai', taskai: 1 },
    laistymasIntervalas: { vasara: 14, ziema: 28 },
    sunkumas: 1,
    toksiskas: false,
    data_prideta: daysAgo(300),
    // OVERDUE laistymui — paskutinis prieš 16 dienų
    timeline: [
      { id: 'p3w1', type: 'watering', date: daysAgo(16) },
      { id: 'p3w2', type: 'watering', date: daysAgo(30) },
    ],
  },
  {
    id: 'p4',
    lietuviškas: 'Sansevierija',
    lotyniskas: 'Dracaena trifasciata',
    kategorija: 'auginama',
    zonaId: 'zone-virtuve',
    image: null, emoji: '🪴',
    sviesa: { lygis: 'Bet kokia', taskai: 2 },
    vanduo: { lygis: 'Mažai', taskai: 1 },
    laistymasIntervalas: { vasara: 14, ziema: 28, tresimasIntervalas: 30 },
    sunkumas: 1,
    toksiskas: true,
    data_prideta: daysAgo(400),
    // ABU OVERDUE — laistyti + tręšti
    timeline: [
      { id: 'p4w1', type: 'watering',    date: daysAgo(22) },
      { id: 'p4f1', type: 'fertilizing', date: daysAgo(45) },
    ],
  },
  {
    id: 'p5',
    lietuviškas: 'Anturiumas',
    lotyniskas: 'Anthurium gladiifolium',
    kategorija: 'auginama',
    zonaId: 'zone-svetaine',
    image: null, emoji: '🌺',
    sviesa: { lygis: 'Vidutinė', taskai: 2 },
    vanduo: { lygis: 'Daug', taskai: 3 },
    laistymasIntervalas: { vasara: 5, ziema: 10 },
    sunkumas: 3,
    toksiskas: true,
    data_prideta: daysAgo(150),
    timeline: [
      { id: 'p5w1', type: 'watering', date: daysAgo(1) },
      { id: 'p5w2', type: 'watering', date: daysAgo(6) },
      { id: 'p5w3', type: 'watering', date: daysAgo(12) },
      { id: 'p5w4', type: 'watering', date: daysAgo(17) },
    ],
  },
  {
    id: 'p6',
    lietuviškas: 'Medinilė',
    lotyniskas: 'Medinilla magnifica',
    kategorija: 'auginama',
    zonaId: 'zone-svetaine',
    image: null, emoji: '🌸',
    sviesa: { lygis: 'Ryški (be tiesioginių)', taskai: 3 },
    vanduo: { lygis: 'Vidutinis', taskai: 2 },
    laistymasIntervalas: { vasara: 7, ziema: 21 },
    sunkumas: 4,
    toksiskas: false,
    data_prideta: daysAgo(180),
    // OVERDUE laistymui (8d)
    timeline: [
      { id: 'p6w1', type: 'watering', date: daysAgo(8) },
      { id: 'p6w2', type: 'watering', date: daysAgo(15) },
    ],
  },
  {
    id: 'p7',
    lietuviškas: 'Perlinis siūlas',
    lotyniskas: 'Senecio rowleyanus',
    kategorija: 'auginama',
    zonaId: 'zone-miegamasis',
    image: null, emoji: '🌿',
    sviesa: { lygis: 'Ryški', taskai: 3 },
    vanduo: { lygis: 'Mažai', taskai: 1 },
    laistymasIntervalas: { vasara: 18, ziema: 42 },
    sunkumas: 2,
    toksiskas: false,
    data_prideta: daysAgo(90),
    // OVERDUE
    timeline: [
      { id: 'p7w1', type: 'watering', date: daysAgo(20) },
    ],
  },
  {
    id: 'p8',
    lietuviškas: 'Ananasas',
    lotyniskas: 'Ananas comosus',
    kategorija: 'auginama',
    zonaId: 'zone-miegamasis',
    image: null, emoji: '🍍',
    sviesa: { lygis: 'Ryški', taskai: 3 },
    vanduo: { lygis: 'Vidutinis', taskai: 2 },
    laistymasIntervalas: { vasara: 10, ziema: 21, tresimasIntervalas: 28 },
    sunkumas: 3,
    toksiskas: false,
    data_prideta: daysAgo(220),
    // ABU OVERDUE
    timeline: [
      { id: 'p8w1', type: 'watering',    date: daysAgo(12) },
      { id: 'p8f1', type: 'fertilizing', date: daysAgo(40) },
    ],
  },
  {
    id: 'p9',
    lietuviškas: 'Raudonžiedė kalankė',
    lotyniskas: 'Kalanchoe blossfeldiana',
    kategorija: 'nori',
    image: null, emoji: '🌷',
    sviesa: { lygis: 'Ryški', taskai: 3 },
    vanduo: { lygis: 'Mažai', taskai: 1 },
    laistymasIntervalas: { vasara: 14, ziema: 30 },
    sunkumas: 1,
    toksiskas: true,
    data_prideta: daysAgo(15),
    timeline: [],
  },
  {
    id: 'p10',
    lietuviškas: 'Ripsalis',
    lotyniskas: 'Rhipsalis',
    kategorija: 'nori',
    image: null, emoji: '🌿',
    sviesa: { lygis: 'Vidutinė', taskai: 2 },
    vanduo: { lygis: 'Vidutinis', taskai: 2 },
    sunkumas: 2,
    toksiskas: false,
    data_prideta: daysAgo(7),
    timeline: [],
  },
  {
    id: 'p11',
    lietuviškas: 'Pamirštas augalas',
    lotyniskas: 'Forgottus mockus',
    kategorija: 'istorija',
    image: null, emoji: '👻',
    diedDate: daysAgo(60),
    deathReason: 'Per daug laisto',
    data_prideta: daysAgo(180),
    timeline: [],
  },
]

// Tuščia žinyno + nustatymų struktūra
export const MOCK_DATA = {
  plants: MOCK_PLANTS,
  zinynas: [],
  zones: MOCK_ZONES,
  settings: {},
}

// Helper: ar mock mode aktyvus
export const isMockMode = () => import.meta.env.VITE_USE_MOCK_USER === 'true'
