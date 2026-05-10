import RightPanel from './RightPanel'

/**
 * DesktopLayout — split panel wrapper desktop/tablet (≥1024px).
 *
 * Layout:
 *   ┌──────────────────────────────────────┬──────────────┐
 *   │ header (jei pateiktas — DesktopHeader)│              │
 *   ├──────────────────────────────────────┤              │
 *   │                                      │              │
 *   │ main (children — tab turinys)        │  RightPanel  │
 *   │                                      │   (430px)    │
 *   │                                      │              │
 *   └──────────────────────────────────────┴──────────────┘
 */
export default function DesktopLayout({ children, header }) {
  return (
    <div className="flex h-dvh">
      <div className="flex-1 flex flex-col min-w-0">
        {header}
        <main className="flex-1 overflow-hidden flex flex-col relative">
          {children}
        </main>
      </div>
      <RightPanel />
    </div>
  )
}
