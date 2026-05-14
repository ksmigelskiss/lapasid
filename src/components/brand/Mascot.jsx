import { useEffect, useRef } from 'react'
// Inline SVG content per ?raw import — kad galėtume target'inti #eye-dot,
// `.is-{state}` class'es + #thought elementus inside SVG'o per CSS.
// Naudojam -think.svg variantus kaip canonical (jie turi `#thought` element'ą,
// kuris CSS valdomas per `.is-think` opacity). Kitose state'uose elementai
// hidden per CSS, todėl vienas SVG dengia visus state'us.
import plantSvg    from '../../assets/mascot/plant-think.svg?raw'
import gardenerSvg from '../../assets/mascot/gardener-think.svg?raw'
// mascot.css importuotas src/main.jsx'e kartą (animation rules apply globally
// kiekvienam [data-mascot] element'ui).

const SVG_BY_TYPE = {
  plant:    plantSvg,
  gardener: gardenerSvg,
}

const STATE_CLASSES = ['is-blink', 'is-happy', 'is-wilt', 'is-think', 'is-tilt', 'is-wave']

/**
 * Mascot — Animus character renderer su state-based animations.
 *
 * Props:
 *   type   — 'plant' | 'gardener'
 *   state  — 'idle' (default) | 'blink' | 'happy' | 'wilt' | 'think' | 'tilt' | 'wave'
 *   size   — pikseliais (default 64)
 *   blink  — boolean (default true): random blink kas 3-7s, kad atrodytų gyvas
 *   hoverable — boolean (default false): hover sway interakcija
 *   className — extra CSS class'ė wrap'eriui
 *
 * Pavyzdys:
 *   <Mascot type="gardener" state="wave" size={120} />
 *   <Mascot type="plant" state="wilt" size={40} blink={false} />
 */
export default function Mascot({
  type = 'plant',
  state = 'idle',
  size = 64,
  blink = true,
  hoverable = false,
  className = '',
}) {
  const wrapperRef = useRef(null)

  // State class'ė ant SVG root'o — keičiama be re-mount'inimo
  useEffect(() => {
    const svg = wrapperRef.current?.querySelector('[data-mascot]')
    if (!svg) return
    STATE_CLASSES.forEach(c => svg.classList.remove(c))
    if (state !== 'idle') svg.classList.add(`is-${state}`)
    if (hoverable) svg.classList.add('hoverable')
    else svg.classList.remove('hoverable')
  }, [state, hoverable])

  // Random-blink helper'is — animation life kai augalas „idle" arba „tilt"
  // (state'uose kur kūnas neanimuojamas pats). Skip'inam kai is-blink jau
  // taikomas iš props (vienkartinis trigger'is) arba states su savo animation
  // (happy bounces, wilt droops, etc.).
  useEffect(() => {
    if (!blink) return
    const blinkStatesAllowed = ['idle', 'tilt', 'think', 'wave']
    if (!blinkStatesAllowed.includes(state)) return
    const dot = wrapperRef.current?.querySelector('#eye-dot')
    if (!dot) return
    let timer
    const tick = () => {
      dot.classList.add('is-blink')
      setTimeout(() => dot.classList.remove('is-blink'), 200)
      timer = setTimeout(tick, 3000 + Math.random() * 4000)
    }
    timer = setTimeout(tick, 3000 + Math.random() * 4000)
    return () => clearTimeout(timer)
  }, [blink, state])

  const svgContent = SVG_BY_TYPE[type] ?? SVG_BY_TYPE.plant

  return (
    <span
      ref={wrapperRef}
      className={`inline-block flex-shrink-0 ${className}`}
      style={{ width: size, height: size, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}
