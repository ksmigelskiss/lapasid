// Visos priežiūros frazės — vienas šaltinis tonui ir žodynui.
// Redaguojama TIK čia. Komponentai parinka Lucide ikonas atskirai
// (pagal bucket'ą / kontekstą), todėl unicode emojis čia nenaudojami.
//
// Tonas: skatinimas ir reward, ne pamokslavimas. „Vėluoja" tipo žodžiai
// pakeisti į „po pauzės", „ramiu tempu". Augalas patenkintas / atsigauna /
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

  // ─── Bulk care mode po veiksmo (toast su breakdown)
  bulk: {
    label: {
      perfect: 'pataikei laiku',
      early:   'truputį anksčiau',
      late:    'ramiu tempu',
      waylate: 'po ilgesnės pauzės',
    },
    headline: {
      mostlyPerfect: ['Geras ritmas šiandien', 'Augalai tave gerai pažįsta'],
      mixed:         ['Pasirūpinta', 'Atnaujinta priežiūra'],
      manyLate:      ['Augalai atsigauna — ačiū', 'Šventė augalams'],
    },
  },

  // ─── Zone circuit (kai zonoje nelieka jokių todo)
  // {zone} = template'as, įstatomas per fillTemplate()
  circuit: [
    '{zone} — viskas vietose',
    '{zone} pasirūpinta',
    '{zone} dabar tvarkinga',
  ],

  // ─── Confidence pill ant Priežiūros mygtuko (visada matomas)
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

// Lt. plural form'a "augalas" pagal skaičių
export function plPlants(n) {
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 19) return 'augalų'
  const last = n % 10
  if (last === 1)             return 'augalas'
  if (last >= 2 && last <= 9) return 'augalai'
  return 'augalų'
}
