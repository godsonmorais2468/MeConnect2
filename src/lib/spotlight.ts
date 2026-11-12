import { useEffect } from 'react'
import { getTier } from './perf'

/* Cards that glow where the pointer is. One listener for the whole app: it finds the card under the pointer and hands its CSS the pointer's position (--mx, --my). */
const CARDS = '.sheet, .cover, .strip, .fbar, .menu, .ptile, .meet, .state, .opt, .qrpanel, .pcard, .plan, .mode, .help-hero, .help-card, .pf__side, .mv__side, .acc, .inv, .plist, .sub-card-list, .bcard, .wcard, .tbl, .dir2 > section'

export function useSpotlight() {
  useEffect(() => {
    if (getTier() === 'low' || !window.matchMedia('(hover: hover)').matches) return
    let frame = 0
    let last: PointerEvent | null = null

    const paint = () => {
      frame = 0
      if (!last) return
      const card = (last.target as Element | null)?.closest?.(CARDS)
      if (!(card instanceof HTMLElement)) return
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${last.clientX - r.left}px`)
      card.style.setProperty('--my', `${last.clientY - r.top}px`)
    }
    const onMove = (e: PointerEvent) => {
      last = e
      if (!frame) frame = requestAnimationFrame(paint)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
}
