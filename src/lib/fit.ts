import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Shrinks an element, as a whole, until it fits the window height, so a short screen shows the full design
 * (logo, labels, captcha, button) at a smaller size instead of hiding parts or needing a scroll.
 * The element reads the result from the CSS variable --fit (1 = full size).
 */
export function useFitToScreen(ref: RefObject<HTMLElement | null>, margin = 24) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      /* offsetHeight is the layout height, so it ignores the scale we apply */
      /* never below 0.3: a window that is still being sized (height near 0) must not collapse the card */
      const scale = Math.max(0.3, Math.min(1, (window.innerHeight - margin) / el.offsetHeight))
      el.style.setProperty('--fit', String(Math.round(scale * 1000) / 1000))
    }
    fit()
    window.addEventListener('resize', fit)
    window.visualViewport?.addEventListener('resize', fit)
    /* the page element changes size with the window, which also catches resizes that fire no window event */
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    watch.observe(document.documentElement)
    return () => {
      window.removeEventListener('resize', fit)
      window.visualViewport?.removeEventListener('resize', fit)
      watch.disconnect()
    }
  }, [ref, margin])
}
