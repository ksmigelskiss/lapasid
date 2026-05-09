// Visos priežiūros frazės — vienas šaltinis tonui ir žodynui.
// Redaguojama TIK čia. Komponentai parinka Lucide ikonas atskirai
// (pagal bucket'ą / kontekstą), todėl unicode emojis čia nenaudojami.
//
// Tonas: skatinimas ir reward, ne pamokslavimas. „Vėluoja" tipo žodžiai
// pakeisti į „po pauzės", „ramiai". Augalas patenkintas / atsigauna /
// kantrus; tu — atsargus / sąmoningas / žinai.

export const CARE_COPY = {
  // ─── Single-plant po veiksmo (CareWateringSheet, mikro-toast)
  // Vienas augalas, viena trumpa frazė. Random pick iš sąrašo.
  single: {
    watering: {
      perfect: [
        'Tobula. Pataikei lygiai į ritmą.',
        'Šis augalas tikrai tave myli.',
        'Augalas patenkintas čepsi.',
      ],
      early: [
        'Atsargus tu — sausa žemė neapkartys.',
        'Truputį anksčiau, bet matei ir žinai geriau.',
        'Augalas tau patikės — nieko bloga.',
      ],
      late: [
        'Šiek tiek po prognozės — augalas atsigers ramiai.',
        'Sąlygos pasikeitė? Dabar viskas tvarkoj.',
        'Drėgna žemė — geriausia dovana.',
      ],
      waylate: [
        'Augalas kantrus, atsigaus po šio gurkšnio.',
        'Šaltinis pagaliau — augalui šventė.',
        'Po dienos atrodys kitaip.',
      ],
    },
    fertilizing: {
      perfect: ['Lygiai laiku — augalas pasiruošęs maistui.'],
      early:   ['Maistas anksčiau — augalas užaugs greičiau, jei šviesos užteks.'],
      late:    ['Pirmas maistas po pauzės — augalas pasipras.'],
      waylate: ['Po ilgesnės pauzės — augalas šitaip atgims.'],
    },
    inspection: [
      'Patikrinai ir palaikei pauzę — geras sprendimas.',
      'Augalas dėkoja, kad nepripyldė ant nereikalingo.',
      'Sąmoningas laistymas — geriausia priežiūra.',
    ],
  },

  // ─── Bulk care mode po veiksmo (toast / summary)
  bulk: {
    // Trumpos label'ės bucket'ams — kompaktiškai (pvz. "5 laiku" vietoj "5 pataikei laiku")
    label: {
      perfect: 'laiku',
      early:   'anksti',
      late:    'ramiai',
      waylate: 'po pauzės',
    },
    // Sekcijų antraštės — verb-style, count po žodžio („Palaistei 8")
    section: {
      watering: [
        'Palaistei',
        'Vandens davei',
        'Atgaivinai',
      ],
      fertilizing: [
        'Pamaitinai',
        'Maisto gavo',
        'Valgo ir čepsi',
      ],
    },
    // Antraštės pagal bendrą rezultatą (>50% perfect = pirma, kitaip pagal kontekstą)
    headline: {
      mostlyPerfect: [
        'Geras ritmas šiandien',
        'Tu šaunuolis',
        'Geras tu žmogus',
        'Augalai tave gerai pažįsta',
        'Tikras augintojas',
        'Auginimo meistras',
        'Žinai, ką darai',
        'Žaliasis nykštys',
        'Augalų bičiulis',
        'Augalų globėjas',
        'Pataikei lygiai',
        'Tikras profas',
        'Augalams pasisekė',
        'Auginimo dovana',
        'Priežiūros guru',
      ],
      mixed: [
        'Pasirūpinta',
        'Atnaujinta priežiūra',
        'Diena augalams',
        'Pasidirbėta gerai',
        'Augalai padaryti',
        'Užbaigta sesija',
        'Šiandien padaryta',
        'Augalai pasidžiaugė',
        'Dėmesys atskirtas',
        'Sodas atjaunintas',
      ],
      manyLate: [
        'Augalai atsigauna — ačiū',
        'Šventė augalams',
        'Atgaivinai',
        'Augalams palengvėjo',
        'Atokvėpis',
        'Pasipila gyvybė',
        'Augalai dėkingi',
        'Ilgiau lauktas vanduo, daugiau džiaugsmo',
      ],
    },
  },

  // ─── Zone circuit (kai zonoje nelieka jokių todo)
  // {zone} = template'as, įstatomas per fillTemplate()
  circuit: [
    '{zone} — viskas vietose',
    '{zone} pasirūpinta',
    '{zone} dabar tvarkinga',
  ],

  // ─── Confidence pill ant Priežiūros mygtuko + summary
  confidence: {
    none: 'Susipažįstam',           // <33% (0–1 įrašas/augalui)
    low:  'Mokausi tavo ritmą',     // 33–66%
    high: 'Pažįstu tavo augalus',   // 66%+
  },
}

// Random pick iš sąrašo
export function pick(arr) {
  if (!arr || arr.length === 0) return ''
  return arr[Math.floor(Math.random() * arr.length)]
}

// Template'o pakeitimas: '{zone}' → 'Virtuvė'
export function fillTemplate(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

// Lt. plural form'a "augalas" (vardininkas)
export function plPlants(n) {
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 19) return 'augalų'
  const last = n % 10
  if (last === 1)             return 'augalas'
  if (last >= 2 && last <= 9) return 'augalai'
  return 'augalų'
}

// Lt. plural "augalas" — įnagininkas (po veiksmažodžių „Pasirūpinai")
export function plPlantsInstr(n) {
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 19) return 'augalų'
  const last = n % 10
  if (last === 1)             return 'augalu'
  return 'augalais'
}
