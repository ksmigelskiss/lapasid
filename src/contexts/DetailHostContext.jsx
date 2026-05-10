import { createContext, useContext, useState, useCallback, useMemo } from 'react'

/**
 * DetailHostContext — desktop split panel modal portaliavimui.
 *
 * RightPanel pateikia DOM container'į (`setContainer(node)`).
 * Modal'ai (PlantDetail, CareWateringSheet, SearchModal, ProfileSheet)
 *   skaito `container` ir, jei isDesktop, render'ina ten per createPortal,
 *   o ne fullscreen overlay'uje.
 *
 * `activeCount` leidžia RightPanel paslepti default brand state, kai bent
 *   vienas modalas atidarytas.
 */
const DetailHostContext = createContext(null)

export function DetailHostProvider({ children }) {
  const [container, setContainerState] = useState(null)
  const [activeCount, setActiveCount] = useState(0)

  const setContainer = useCallback((node) => {
    setContainerState(node)
  }, [])

  const open = useCallback(() => setActiveCount(c => c + 1), [])
  const close = useCallback(() => setActiveCount(c => Math.max(0, c - 1)), [])

  const value = useMemo(() => ({
    container, setContainer,
    isActive: activeCount > 0,
    open, close,
  }), [container, setContainer, activeCount, open, close])

  return (
    <DetailHostContext.Provider value={value}>
      {children}
    </DetailHostContext.Provider>
  )
}

export function useDetailHost() {
  return useContext(DetailHostContext)
}
