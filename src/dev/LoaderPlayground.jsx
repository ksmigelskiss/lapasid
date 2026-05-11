// Dev-only playground for BrandLoader iteration.
// Available at /?playground=loaders when VITE_USE_MOCK_USER=true.

import { useState } from 'react'
import BrandLoader from '../components/brand/BrandLoader'

export default function LoaderPlayground() {
  const [size, setSize] = useState(96)
  const [duration, setDuration] = useState(2.4)
  const [ink, setInk] = useState('bone')
  const [inline, setInline] = useState(false)

  return (
    <div className="min-h-screen bg-bone">
      <header className="px-8 py-6 border-b border-bone-400/40 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-forest-800">BrandLoader Playground</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500 mt-1">DEV TOOL · mock mode only</p>
        </div>
        <a href="/" className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-600 hover:text-forest-800">← back to app</a>
      </header>

      <div className="px-8 py-8 max-w-[1100px] mx-auto space-y-10">

        {/* ── Tweak sandbox ─────────────────────────────────────────── */}
        <section>
          <h2 className="font-display text-lg font-semibold tracking-tight text-forest-800 mb-4">Tweak sandbox</h2>

          <div className="bg-bone-50 rounded-3xl p-6 border border-bone-400/40 space-y-5">
            <ControlRow label={`Size · ${size}px`}>
              <input type="range" min="16" max="200" value={size} onChange={e => setSize(+e.target.value)} className="w-full accent-forest-700" />
              <Chips values={[20, 28, 40, 48, 64, 80, 96, 120, 160]} active={size} onChange={setSize} suffix="px" />
            </ControlRow>

            <ControlRow label={`Duration · ${duration.toFixed(1)}s`}>
              <input type="range" min="0.6" max="4" step="0.1" value={duration} onChange={e => setDuration(+e.target.value)} className="w-full accent-forest-700" />
              <Chips values={[0.8, 1.2, 1.6, 2.0, 2.4, 3.0]} active={duration} onChange={setDuration} suffix="s" />
            </ControlRow>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <ControlRow label="Ink · bars color">
                <Toggle
                  options={[
                    { value: 'bone', label: 'BONE' },
                    { value: 'forest', label: 'FOREST' },
                  ]}
                  active={ink}
                  onChange={setInk}
                />
                <p className="text-[10px] text-forest-500 mt-1.5 italic">
                  {ink === 'bone' ? 'Light bars — use on dark surfaces' : 'Dark bars — use on light surfaces'}
                </p>
              </ControlRow>

              <ControlRow label="Mode">
                <Toggle
                  options={[
                    { value: false, label: 'SQUARE' },
                    { value: true, label: 'INLINE' },
                  ]}
                  active={inline}
                  onChange={setInline}
                />
                <p className="text-[10px] text-forest-500 mt-1.5 italic">
                  {inline ? 'Naked SVG — for use inside dark/light buttons' : 'T4Icon-style container (antspaudas)'}
                </p>
              </ControlRow>
            </div>

            {/* Preview surfaces */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <SurfaceCard label="bone canvas" bg="bg-bone">
                <BrandLoader size={size} duration={duration} ink={ink} inline={inline} />
              </SurfaceCard>
              <SurfaceCard label="glass on photo" style={{ background: 'linear-gradient(135deg, #5a7062 0%, #38483e 100%)' }}>
                <div className="bg-white/55 backdrop-blur-xl rounded-2xl p-5 border border-white/40">
                  <BrandLoader size={size} duration={duration} ink={ink} inline={inline} />
                </div>
              </SurfaceCard>
              <SurfaceCard label="forest surface" bg="bg-forest-700">
                <BrandLoader size={size} duration={duration} ink={ink} inline={inline} />
              </SurfaceCard>
            </div>
          </div>
        </section>

        {/* ── Realistic contexts ────────────────────────────────────── */}
        <section>
          <h2 className="font-display text-lg font-semibold tracking-tight text-forest-800 mb-1">Realūs scenarijai</h2>
          <p className="text-sm text-forest-500 mb-4">Kaip atrodo realioje vietoje (animacija loop'inasi).</p>

          <div className="grid grid-cols-2 gap-4">
            <Ctx label="1 · App boot" hint="main.jsx · LG default ant bone canvas">
              <Frame bg="bg-bone">
                <BrandLoader />
              </Frame>
            </Ctx>

            <Ctx label="2 · Auth loading" hint="App.jsx · LG + mono caps message">
              <Frame bg="bg-bone">
                <BrandLoader />
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-500 mt-4">Kraunama kolekcija</p>
              </Frame>
            </Ctx>

            <Ctx label="3 · Kantrybės modal" hint="SearchModal · LG ant bone-50 modal kortelės">
              <Frame bg="bg-bone">
                <div className="bg-bone-50 rounded-3xl p-8 flex flex-col items-center gap-5 shadow-[0_12px_32px_rgba(28,58,42,0.24)] border border-bone-400/50">
                  <BrandLoader />
                  <div className="text-center">
                    <p className="font-display text-base font-semibold tracking-tight text-forest-800">Kantrybės...</p>
                    <p className="text-sm text-forest-500 mt-1.5">Augalas atpažįstamas</p>
                  </div>
                </div>
              </Frame>
            </Ctx>

            <Ctx label="4 · Search loading" hint="SearchModal:478 · LG ant bone modal">
              <Frame bg="bg-bone">
                <BrandLoader />
                <p className="text-sm text-forest-600 font-medium mt-3">Ieškoma...</p>
                <p className="text-xs text-forest-400 italic mt-1">monstera</p>
              </Frame>
            </Ctx>

            <Ctx label="5 · Search go button" hint="SearchModal:456 · inline 28px ant forest-700 mygtuko">
              <Frame bg="bg-bone">
                <button className="bg-forest-700 rounded-2xl flex items-center justify-center text-bone" style={{ width: 52, height: 52 }}>
                  <BrandLoader inline size={28} />
                </button>
              </Frame>
            </Ctx>

            <Ctx label="6 · Google login" hint="LoginScreen:47 · inline 20px forest ant balto mygtuko">
              <Frame bg="bg-bone">
                <button className="flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-2xl px-6 py-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
                  <BrandLoader inline ink="forest" size={20} />
                  <span className="text-sm font-semibold text-gray-800">Jungiamasi...</span>
                </button>
              </Frame>
            </Ctx>
          </div>
        </section>

        {/* ── Size scan ─────────────────────────────────────────────── */}
        <section>
          <h2 className="font-display text-lg font-semibold tracking-tight text-forest-800 mb-1">Dydžių skalė</h2>
          <p className="text-sm text-forest-500 mb-4">Default ink=bone (forest square), duration 2.4s.</p>
          <div className="bg-bone-50 rounded-3xl p-6 border border-bone-400/40 flex items-end justify-around gap-4">
            {[40, 56, 72, 96, 120, 160].map(s => (
              <div key={s} className="flex flex-col items-center gap-2">
                <BrandLoader size={s} />
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500">{s}px</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Duration scan ─────────────────────────────────────────── */}
        <section>
          <h2 className="font-display text-lg font-semibold tracking-tight text-forest-800 mb-1">Trukmės skalė</h2>
          <p className="text-sm text-forest-500 mb-4">96px default, ink=bone.</p>
          <div className="bg-bone-50 rounded-3xl p-6 border border-bone-400/40 grid grid-cols-5 gap-4">
            {[1.2, 1.6, 2.0, 2.4, 3.0].map(d => (
              <div key={d} className="flex flex-col items-center gap-2">
                <BrandLoader duration={d} />
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500">{d.toFixed(1)}s</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="pt-4 pb-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-400">
            file: src/dev/LoaderPlayground.jsx · gated via VITE_USE_MOCK_USER + ?playground=loaders
          </p>
        </footer>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function ControlRow({ label, children }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500 mb-2">{label}</p>
      {children}
    </div>
  )
}

function Chips({ values, active, onChange, suffix = '' }) {
  return (
    <div className="flex gap-1.5 mt-2 flex-wrap">
      {values.map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
            active === v ? 'bg-forest-700 text-bone' : 'bg-bone-300 text-forest-600 hover:bg-bone-400/60'
          }`}
        >
          {v}{suffix}
        </button>
      ))}
    </div>
  )
}

function Toggle({ options, active, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.14em] rounded transition-colors ${
            active === opt.value ? 'bg-forest-700 text-bone' : 'bg-bone-300 text-forest-600 hover:bg-bone-400/60'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function SurfaceCard({ label, bg = '', style, children }) {
  return (
    <div className="flex flex-col">
      <div
        className={`aspect-square rounded-2xl flex items-center justify-center overflow-hidden ${bg}`}
        style={style}
      >
        {children}
      </div>
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-forest-500 text-center mt-1.5">{label}</p>
    </div>
  )
}

function Ctx({ label, hint, children }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-600 mb-0.5">{label}</p>
      <p className="text-[11px] text-forest-500 mb-2">{hint}</p>
      {children}
    </div>
  )
}

function Frame({ bg, children }) {
  return (
    <div className={`${bg} aspect-[3/2] rounded-2xl flex flex-col items-center justify-center border border-bone-400/40`}>
      {children}
    </div>
  )
}
