import RightPanel from './RightPanel'

/**
 * DesktopLayout — split panel wrapper for desktop/tablet (≥1024px).
 *
 * Etapas 1: tik right panel default state. Modal'ai dar fullscreen
 *   (Etapas 2 pridės portal context'ą).
 * Etapas 3: pridės DesktopHeader (top tabs + AccuracySprite + collection).
 *
 * Kol DesktopHeader nėra, Dashboard lieka su savo internal header'iu —
 * vizualiai matosi tarsi du-laipsnio header (galima per Etapas 1 testavimą,
 * bus išspręsta Etapas 3).
 */
export default function DesktopLayout({ children }) {
  return (
    <div className="flex h-dvh">
      <main className="flex-1 overflow-hidden flex flex-col relative">
        {children}
      </main>
      <RightPanel />
    </div>
  )
}
