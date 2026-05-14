// Dev tool — Theme palette inspector (Level 1).
// Pasiekiama per /?playground=theme. Atvaizduoja visus brand paletės tonus
// su HEX reikšmėmis + naudojimo notes. „Copy palette" išmeta JSON snippet'ą,
// kurį galima paste'inti į tailwind.config.js.

import { useState } from 'react'

// Šios reikšmės sutampa su tailwind.config.js. Jei keiti config'ą — atnaujink čia.
//
// Legacy semantic tokens (const P viršuje tailwind.config.js'e) — likę iš pre-Brandbook
// v1.0 versijos. Daugelis pakeisti į brand bone/forest/terracotta tonus, bet kai kur
// vis dar naudojama (pvz. bg-app, bg-surface). Palaipsniui phase out.
const SEMANTIC_TOKENS = [
  { name: 'bg-app',         hex: '#f1ebdd', use: 'Page canvas (= bg-bone DEFAULT, legacy alias)' },
  { name: 'bg-app-warm',    hex: '#faf8f3', use: 'Desktop right panel bg (legacy)' },
  { name: 'bg-lib',         hex: '#f2f2f7', use: 'Biblioteka grouped bg (legacy iOS)' },
  { name: 'bg-surface',     hex: '#f2f2f7', use: 'Cards, sections (legacy — pakeičiamas į bg-bone-50)' },
  { name: 'bg-surface-2',   hex: '#e8e8ed', use: 'Inputs, chips (legacy iOS)' },
  { name: 'border-warm',    hex: '#d1d1d6', use: 'Hairline borders (legacy)' },
  { name: 'bg-primary',     hex: '#2e5238', use: 'Buttons, CTAs (= forest-500, legacy alias)' },
  { name: 'bg-primary-dark',hex: '#1c3a2a', use: 'Hover/pressed (= forest-700/INK, legacy)' },
  { name: 'bg-primary-light',hex:'#e8efe9', use: 'Pill backgrounds (= forest-50, legacy)' },
  { name: 'bg-accent',      hex: '#2e5238', use: '= bg-primary (legacy semantic alias)' },
]

const PALETTES = [
  {
    name: 'BONE (PAPER)',
    description: 'Brandbook v1.0 pagrindinis warm cream. Sluoksniuojama nuo lighter'+
      ' (Tier 2 elevation) iki darker (canvas, chrome).',
    colors: [
      { key: 50,      hex: '#fefdfa', use: 'Tier 2 elevation — modal/widget/card body (bg-bone-50)' },
      { key: 100,     hex: '#f7f1e3', use: 'Header'+'\'iai (bg-bone-100/95 su subtle transparency)' },
      { key: 'DEFAULT', hex: '#f1ebdd', use: 'PAPER — page canvas (bg-bone, bg-app)' },
      { key: 200,     hex: '#f1ebdd', use: '= DEFAULT alias (legacy)' },
      { key: 300,     hex: '#e7e0cf', use: 'Browser chrome, mygtuko outline state' },
      { key: 400,     hex: '#d8cfb8', use: 'Hairline borders, divider'+'\'iai (bone-400/40)' },
    ],
  },
  {
    name: 'FOREST (INK)',
    description: 'Brandbook v1.0 pagrindinė identiteto spalva. Sluoksniuojama nuo'+
      ' šviesių (subtle bg) iki tamsių (mark, primary text, CTA).',
    colors: [
      { key: 50,  hex: '#e8efe9', use: 'Vandens tone background pavojų pill\'ams' },
      { key: 100, hex: '#c7d6c9', use: 'Active tab bg, count badges' },
      { key: 200, hex: '#9bb7a0', use: 'Active states (water pill open)' },
      { key: 300, hex: '#6e9778', use: 'Secondary borders + ring outline' },
      { key: 400, hex: '#456d52', use: 'Subtle icons, muted state' },
      { key: 500, hex: '#2e5238', use: 'Section header labels, mid-tone forest' },
      { key: 600, hex: '#264530', use: 'Body text, secondary content' },
      { key: 700, hex: '#1c3a2a', use: 'INK — brand pagrindinė; primary text, T4Mark, CTA' },
      { key: 800, hex: '#142b1f', use: 'Death modal, INK gravity contexts' },
      { key: 900, hex: '#0c1c14', use: 'Visi tamsiausi accent\'ai' },
    ],
  },
  {
    name: 'TERRACOTTA (ACCENT)',
    description: 'Brandbook v1.0 akcentas — TIK callout\'ams (severity, severity, tręšimas).'+
      ' Niekada nenaudoti ant T4Mark.',
    colors: [
      { key: 50,      hex: '#f8ece2', use: 'Pavojai silpnas (dirgina) — light pill bg' },
      { key: 100,     hex: '#efd2bb', use: 'Pavojai vidutinis bg + saugiklis ATSARGIAI bg' },
      { key: 200,     hex: '#dba887', use: 'Pavojai alergiškas — medium tipas bg' },
      { key: 300,     hex: '#c88456', use: '(Reserved)' },
      { key: 'DEFAULT', hex: '#b86a3a', use: 'Pavojai toksiškas — solid tipas bg + Skull' },
      { key: 400,     hex: '#b86a3a', use: '= DEFAULT alias (legacy)' },
      { key: 500,     hex: '#9a5328', use: 'Pavojų pill silpnas text, callout vidutinis text' },
      { key: 600,     hex: '#7c411f', use: 'PAVOJAI section header, callout titles' },
    ],
  },
]

// Tailwind config'o output formatas — copy-paste'inkit į tailwind.config.js
function paletteToTailwindString(palettes) {
  return palettes.map(p => {
    const name = p.name.split(' ')[0].toLowerCase()
    const lines = p.colors.map(c => {
      const keyStr = c.key === 'DEFAULT' ? 'DEFAULT' : String(c.key)
      return `          ${keyStr.padEnd(8)} '${c.hex}',`
    }).join('\n')
    return `        ${name}: {\n${lines}\n        },`
  }).join('\n')
}

function ColorSwatch({ palette, color }) {
  const isLight = parseInt(color.hex.slice(1), 16) > 0x808080
  return (
    <div className="flex items-center gap-3 py-2 border-b border-bone-400/30 last:border-b-0">
      <div
        className="w-14 h-14 rounded-xl flex-shrink-0 border border-bone-400/50 shadow-sm flex items-center justify-center font-mono text-[9px] font-semibold"
        style={{ backgroundColor: color.hex, color: isLight ? '#1c3a2a' : '#fefcf6' }}
      >
        {color.key}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <code className="font-mono text-[12px] font-semibold text-forest-800">{color.hex}</code>
          <code className="font-mono text-[10px] text-forest-500">
            bg-{palette.split(' ')[0].toLowerCase()}-{color.key === 'DEFAULT' ? '' : color.key}
          </code>
        </div>
        <p className="text-[12px] text-forest-600 leading-snug mt-0.5">{color.use}</p>
      </div>
    </div>
  )
}

export default function ThemeStudio() {
  const [copied, setCopied] = useState(false)

  const copyPaletteAsJson = async () => {
    const text = paletteToTailwindString(PALETTES)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: log to console
      console.log(text)
    }
  }

  return (
    <div className="min-h-screen bg-bone">
      <header className="px-8 py-6 border-b border-bone-400/40 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-forest-800">Theme Studio</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500 mt-1">DEV TOOL · palette inspector (level 1)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={copyPaletteAsJson}
            className="px-4 py-2 bg-bone-50 border border-bone-400/50 rounded-btn font-display font-semibold text-sm text-forest-700 hover:bg-bone-100"
          >
            {copied ? '✓ Nukopijuota' : 'Copy tailwind palette'}
          </button>
          <a href="/" className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-600 hover:text-forest-800">← back to app</a>
        </div>
      </header>

      <div className="px-8 py-8 max-w-[900px] mx-auto space-y-10">
        <p className="text-sm text-forest-600 leading-relaxed">
          Visi mūsų brand'o tonų atlasai. Kiekvieną tonas turi HEX reikšmę + kur naudojamas.
          Norėdamas redaguoti — keisk reikšmes <code className="font-mono text-[12px] bg-bone-50 px-1.5 py-0.5 rounded border border-bone-400/40">tailwind.config.js</code> + atnaujink šitame faile aprašymą.
          Kompiliavimas Vite HMR'ina iškart.
        </p>

        {/* Brand palettes — Brandbook v1.0 oficiali sistema */}
        {PALETTES.map(palette => (
          <section key={palette.name}>
            <h2 className="font-display text-lg font-semibold tracking-tight text-forest-800">
              {palette.name}
            </h2>
            <p className="text-[13px] text-forest-600 leading-relaxed mt-1 mb-3">{palette.description}</p>
            <div className="bg-bone-50 border border-bone-400/40 rounded-2xl px-4 py-2">
              {palette.colors.map(c => (
                <ColorSwatch key={String(c.key)} palette={palette.name} color={c} />
              ))}
            </div>
          </section>
        ))}

        {/* Legacy semantic tokens — `const P` viršuje tailwind.config.js */}
        <section>
          <h2 className="font-display text-lg font-semibold tracking-tight text-forest-800">
            LEGACY SEMANTIC TOKENS
          </h2>
          <p className="text-[13px] text-forest-600 leading-relaxed mt-1 mb-3">
            Iš pre-Brandbook v1.0 versijos. Likę kaip iOS-stiliaus semantic žymos
            (<code className="font-mono text-[11px]">bg-app</code>, <code className="font-mono text-[11px]">bg-surface</code>,
            <code className="font-mono text-[11px]"> bg-primary</code> etc.). Daug kur jau pakeisti į brand bone/forest tonus,
            bet vis dar yra apvalkalų. <strong>Editingui:</strong> keisk <code className="font-mono text-[11px]">const P = {'{}'}</code> bloką tailwind.config.js'o viršuje.
          </p>
          <div className="bg-bone-50 border border-bone-400/40 rounded-2xl px-4 py-2">
            {SEMANTIC_TOKENS.map(t => {
              const isLight = parseInt(t.hex.slice(1), 16) > 0x808080
              return (
                <div key={t.name} className="flex items-center gap-3 py-2 border-b border-bone-400/30 last:border-b-0">
                  <div
                    className="w-14 h-14 rounded-xl flex-shrink-0 border border-bone-400/50 shadow-sm flex items-center justify-center"
                    style={{ backgroundColor: t.hex, color: isLight ? '#1c3a2a' : '#fefcf6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3">
                      <code className="font-mono text-[12px] font-semibold text-forest-800">{t.hex}</code>
                      <code className="font-mono text-[10px] text-forest-500">{t.name}</code>
                    </div>
                    <p className="text-[12px] text-forest-600 leading-snug mt-0.5">{t.use}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Surface examples — kaip atrodo praktikoje */}
        <section>
          <h2 className="font-display text-lg font-semibold tracking-tight text-forest-800 mb-1">Surface preview</h2>
          <p className="text-[13px] text-forest-600 mb-3">Tier'iai vizualizuoti šalia, kad matytum kontrastą.</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="aspect-square bg-bone rounded-2xl flex flex-col items-center justify-center text-center px-2 border border-bone-400/40">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-700 font-semibold">TIER 1</p>
              <p className="text-xs text-forest-600 mt-1">Canvas<br/>bg-bone (#f1ebdd)</p>
            </div>
            <div className="aspect-square bg-bone-50 rounded-2xl flex flex-col items-center justify-center text-center px-2 border border-bone-400/40">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-700 font-semibold">TIER 2</p>
              <p className="text-xs text-forest-600 mt-1">Elevation<br/>bg-bone-50 (#fefcf6)</p>
            </div>
            <div className="aspect-square bg-bone-100 rounded-2xl flex flex-col items-center justify-center text-center px-2 border border-bone-400/40">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-700 font-semibold">HEADER</p>
              <p className="text-xs text-forest-600 mt-1">Sticky bar<br/>bg-bone-100 (#f7f1e3)</p>
            </div>
          </div>
        </section>

        {/* Color combos — kaip jie sąveikauja */}
        <section>
          <h2 className="font-display text-lg font-semibold tracking-tight text-forest-800 mb-1">Combo preview</h2>
          <p className="text-[13px] text-forest-600 mb-3">Tipinės pill'ų / mygtukų kombinacijos.</p>
          <div className="bg-bone-50 border border-bone-400/40 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] bg-terracotta-50 text-terracotta-500">DIRGINA</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] bg-terracotta-200 text-terracotta-600">ALERGIŠKA</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] bg-terracotta text-bone">TOKSIŠKA</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] bg-forest-100 text-forest-700">VALGOMA</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] bg-bone-300 text-forest-700">LIAUDIES VAISTINĖ</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="h-9 px-4 rounded-btn font-display font-semibold text-sm bg-forest-700 text-bone">Primary CTA</button>
              <button className="h-9 px-4 rounded-btn font-display font-semibold text-sm bg-bone-50 text-forest-700 border border-bone-400/50">Secondary</button>
              <button className="h-9 px-4 rounded-btn font-display font-semibold text-sm bg-terracotta text-bone">Destructive</button>
            </div>
          </div>
        </section>

        <footer className="pt-4 pb-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-400">
            file: src/dev/ThemeStudio.jsx · sync'inta su tailwind.config.js
          </p>
        </footer>
      </div>
    </div>
  )
}
