import { useEffect } from 'react'
import { animate } from 'motion'
import { getTier } from './perf'

/* A page's blocks rise in one after another, and its headline numbers count up. Only the first moments after opening a page. */
const BLOCKS = '.page > *'
const ITEMS = '.hlist > *, .list > *, .grp__rows > *, .acc > *, .wgrid > *, .bearers > *, .plans > *, .ctrl__grid > *, .strip__item'
const ALL = `${BLOCKS}, ${ITEMS}`
const NUMBERS = '.strip__value, .dues__total'
const WINDOW_MS = 1800
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

let opened = false
/* no reveal on reduced motion, and none on a device that has to save every frame */
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || getTier() === 'low'

/** Fades and lifts the elements that have not been shown yet, one after another. */
function rise(els: Element[], seen: WeakSet<Element>, startDelay: number) {
  const fresh = els.filter((e): e is HTMLElement => e instanceof HTMLElement && !seen.has(e))
  if (!fresh.length) return
  fresh.forEach((e) => {
    seen.add(e)
    e.style.opacity = '0'
  })
  void animate(fresh, { opacity: [0, 1], y: [18, 0] }, { duration: 0.5, delay: (i: number) => startDelay + Math.min(i, 12) * 0.045, ease: EASE }).finished.then(() => {
    fresh.forEach((e) => {
      e.style.opacity = ''
      e.style.transform = ''
    })
  })
}

/** Counts a plain number (or an amount in rupees) up from zero. The text node is edited in place, so React keeps hold of it. */
function countUp(root: ParentNode, seen: WeakSet<Element>) {
  root.querySelectorAll<HTMLElement>(NUMBERS).forEach((el) => {
    if (seen.has(el) || el.childNodes.length !== 1 || el.firstChild?.nodeType !== Node.TEXT_NODE) return
    const node = el.firstChild as Text
    const text = node.nodeValue ?? ''
    const m = text.trim().match(/^(₹\s?)?([\d,]+)(\.\d+)?$/)
    if (!m) return
    const target = Number(m[2].replace(/,/g, ''))
    if (!target) return
    seen.add(el)
    /* if the page changes the number while it counts (fresh data arrived), the page's value wins and the count stops */
    let wrote = text
    const run = animate(0, target, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (v) => {
        if (node.nodeValue !== wrote) {
          run.stop()
          return
        }
        wrote = `${m[1] ?? ''}${Math.round(v).toLocaleString('en-IN')}${m[3] ?? ''}`
        node.nodeValue = wrote
      },
      onComplete: () => {
        if (node.nodeValue === wrote) node.nodeValue = text
      },
    })
  })
}

/** Plays the reveal for whatever page is open, and for the parts of it that arrive a moment later (lazy pages, data). */
export function useReveal(pathname: string) {
  useEffect(() => {
    if (calm()) return
    const stage = document.querySelector('.stage')
    if (!stage) return
    const seen = new WeakSet<Element>()
    const until = performance.now() + WINDOW_MS

    const play = (root: ParentNode) => {
      const hits = [...(root instanceof Element && root.matches(ALL) ? [root] : []), ...root.querySelectorAll(ALL)]
      rise(
        hits.filter((e) => e.matches(BLOCKS)),
        seen,
        0,
      )
      rise(
        hits.filter((e) => !e.matches(BLOCKS)),
        seen,
        0.12,
      )
      countUp(root, seen)
    }

    /* the page that is already on screen when the app opens; after that, a new page arrives as an added node */
    const main = stage.querySelector('main')
    if (main && !opened) play(main)
    opened = true

    const watch = new MutationObserver((records) => {
      if (performance.now() > until) return
      for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && n.closest('main') && play(n))
    })
    watch.observe(stage, { childList: true, subtree: true })
    const stop = window.setTimeout(() => watch.disconnect(), WINDOW_MS)
    return () => {
      watch.disconnect()
      window.clearTimeout(stop)
    }
  }, [pathname])
}
