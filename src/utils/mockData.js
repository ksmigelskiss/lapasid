// Mock data for desktop-ux branch (VITE_USE_MOCK_USER=true).
// Naudojama Vercel preview'ams be Google OAuth + lokaliam dev'ui be Firebase'o.
// NEdeplo'inama į master / production.
//
// PLANTS: importuojama iš src/dev/realPlants.json — tikri vartotojo augalai
// su (TEST) sufiksu. Buvo eksportuoti per PlantExport dev tool'ą 2026-05-12.

import realPlants from '../dev/realPlants.json'

export const MOCK_USER = {
  uid: 'mock-user',
  displayName: 'Kęstutis',
  email: 'mock@lapasid.lt',
  photoURL: null,
  isAnonymous: false,
}

export const MOCK_COLLECTION_ID = 'mock-collection'
export const MOCK_COLLECTION_NAME = 'Lapasid (TEST)'

// Real zonaId'iai iš eksportuoto JSON — placeholder Lt vardai, gali pervadinti
// per UI Zonų manager'į (mock mode'e local'iam) jei reikia.
export const MOCK_ZONES = [
  { id: '5fuykvq8', name: 'Virtuvė' },     // 13 augalai
  { id: '6w18r9o8', name: 'Svetainė' },    // 6 augalai
  { id: 'e4pcc5vh', name: 'Miegamasis' },  // 2 augalai
  { id: 't97y7eb8', name: 'Balkonas' },    // 9 augalai
]

// MOCK_PLANTS — vartotojo realūs augalai su (TEST) sufiksu (iš PlantExport).
// Filtruojami tušti įrašai (wishlist'o placeholderiai be pavadinimo).
export const MOCK_PLANTS = realPlants.filter(p => p.lietuviškas?.trim() && p.lietuviškas.trim() !== '(TEST)')

// Tuščia žinyno + nustatymų struktūra
export const MOCK_DATA = {
  plants: MOCK_PLANTS,
  zinynas: [],
  zones: MOCK_ZONES,
  settings: {},
}

// Helper: ar mock mode aktyvus
export const isMockMode = () => import.meta.env.VITE_USE_MOCK_USER === 'true'
