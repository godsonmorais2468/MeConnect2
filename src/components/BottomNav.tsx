import { useEffect, useLayoutEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { animate, motionValue } from 'motion'
import type { NavItem } from '../data/nav'

/* Geometry of the notch, in px. The bubble sits a little above the bar's top edge and the bar is cut away around it,
   leaving a ring of page colour between the two. */
const BAR_H = 64
const BUBBLE = 52
const LIFT = 6 /* how far the bubble's centre sits above the bar's top edge */
const CUT_R = 34 /* radius of the cut-out circle: bubble radius plus the ring */
const SHOULDER = 46 /* half-width where the smooth shoulder leaves the flat top edge */

/* where the cut-out circle crosses y = DIP, the point the shoulder curve hands over to the arc */
const DIP = 12
const ARC_X = Math.sqrt(CUT_R ** 2 - (DIP + LIFT) ** 2)

/* The notch is quick and nearly critically damped; the bubble is looser, so it trails the notch a little, overshoots a few px
   and settles: that lag is what makes it float. While it travels it also rises in an arc, stretches and tilts with its speed. */
const SPRING = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 } as const
const FLOAT_SPRING = { type: 'spring', stiffness: 260, damping: 22, mass: 0.95 } as const
const ARC = 11 /* px the bubble rises at the middle of a trip */
const TILT = 8 /* degrees it leans into the direction of travel, at speed */
const STRETCH = 0.14 /* how much it elongates along the way at speed */

/** The bar's outline: a flat-topped rectangle (the pill shape comes from the clip on its box) with a smooth notch at `cx`. `o` scales the notch from 0 (closed) to 1 (open). */
function barPath(cx: number, w: number, o: number) {
  const s = SHOULDER * o
  const ax = ARC_X * o
  const dip = DIP * o
  const r = CUT_R * o
  const h = BAR_H
  const f = (n: number) => n.toFixed(2)
  if (o < 0.01) return `M-60,0 L${f(w + 60)},0 L${f(w + 60)},${h} L-60,${h} Z`
  return [
    `M-60,0`,
    `L${f(cx - s)},0`,
    `C${f(cx - s + 10 * o)},0 ${f(cx - ax - 5 * o)},${f(dip * 0.25)} ${f(cx - ax)},${f(dip)}`,
    `A${f(r)},${f(r)} 0 0 0 ${f(cx + ax)},${f(dip)}`,
    `C${f(cx + ax + 5 * o)},${f(dip * 0.25)} ${f(cx + s - 10 * o)},0 ${f(cx + s)},0`,
    `L${f(w + 60)},0`,
    `L${f(w + 60)},${h}`,
    `L-60,${h}`,
    'Z',
  ].join(' ')
}

/** Index of the tab that matches the current page, or -1 when the page is not one of the tabs. */
function activeIndex(items: NavItem[], pathname: string) {
  return items.findIndex((n) => (n.end ? pathname === n.to : pathname === n.to || pathname.startsWith(`${n.to}/`)))
}

/**
 * Phone navigation: a pill bar fixed to the bottom of the screen. The open page's icon rises into a bubble that sits
 * in a notch cut into the bar; moving to another page slides the bubble and the notch together on one spring.
 * The notch and bubble are driven straight on the DOM from motion values, so the animation never waits on React.
 */
export default function BottomNav({ items, dueCount }: { items: NavItem[]; dueCount: number }) {
  const { pathname } = useLocation()
  const index = activeIndex(items, pathname)

  const barRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([])

  /* one motion value for the notch centre, one for how open it is; both repaint the path and the bubble */
  const state = useRef<{ x: ReturnType<typeof motionValue<number>>; bx: ReturnType<typeof motionValue<number>>; o: ReturnType<typeof motionValue<number>>; w: number; placed: boolean; from: number; to: number; paint?: () => void } | null>(null)
  if (state.current == null) state.current = { x: motionValue(0), bx: motionValue(0), o: motionValue(0), w: 0, placed: false, from: 0, to: 0 }

  const centreOf = (i: number) => {
    const bar = barRef.current
    const link = linkRefs.current[i]
    if (!bar || !link) return 0
    return link.offsetLeft + link.offsetWidth / 2
  }

  /* paint: path and bubble follow the two motion values */
  useEffect(() => {
    const s = state.current!
    const paint = () => {
      const x = s.x.get()
      const o = s.o.get()
      pathRef.current?.setAttribute('d', barPath(x, s.w, o))
      const b = bubbleRef.current
      if (!b) return
      /* trip progress 0..1 (clamped, so an overshoot does not dip the bubble): the arc peaks mid-way */
      const bx = s.bx.get()
      const trip = Math.abs(s.to - s.from)
      const p = trip > 1 ? Math.min(1, Math.max(0, Math.abs(bx - s.from) / trip)) : 0
      const rise = -ARC * Math.sin(Math.PI * p)
      /* the distance still to go leans and elongates it: forward on the way out, back on an overshoot, level at rest */
      const left = s.to - bx
      const speed = Math.min(1, Math.abs(left) / 70)
      const lean = Math.sign(left) * TILT * speed
      const sx = (1 + STRETCH * speed) * (0.4 + 0.6 * o)
      const sy = (1 - STRETCH * 0.7 * speed) * (0.4 + 0.6 * o)
      b.style.transform = `translate3d(${bx - BUBBLE / 2}px, ${rise.toFixed(2)}px, 0) rotate(${lean.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
      b.style.opacity = String(Math.min(1, o * 1.4))
    }
    s.paint = paint
    const offX = s.x.on('change', paint)
    const offB = s.bx.on('change', paint)
    const offO = s.o.on('change', paint)
    const settle = s.bx.on('animationComplete', paint)
    paint()
    return () => {
      offX()
      offB()
      offO()
      settle()
    }
  }, [])

  /* measure the bar (and again whenever it changes size), placing the notch without animation */
  useLayoutEffect(() => {
    const s = state.current!
    const bar = barRef.current
    if (!bar) return
    const measure = () => {
      s.w = bar.clientWidth
      svgRef.current?.setAttribute('viewBox', `0 0 ${s.w} ${BAR_H}`)
      const i = activeIndex(items, window.location.pathname)
      if (i >= 0) {
        s.x.jump(centreOf(i))
        s.bx.jump(centreOf(i))
        s.from = s.to = centreOf(i)
      }
      s.o.jump(i >= 0 ? 1 : 0)
      s.placed = true
      s.paint?.()
    }
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(bar)
    return () => watch.disconnect()
  }, [items])

  /* a new page: glide the notch to its tab (or close it when the page has no tab) */
  useEffect(() => {
    const s = state.current!
    if (!s.placed) return
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (index < 0) {
      if (calm) s.o.jump(0)
      else void animate(s.o, 0, { duration: 0.22, ease: [0.4, 0, 0.2, 1] })
      return
    }
    const target = centreOf(index)
    if (calm) {
      s.x.jump(target)
      s.bx.jump(target)
      s.from = s.to = target
      s.o.jump(1)
      return
    }
    /* a first appearance (the notch was closed) has nowhere to travel from, so the bubble just opens in place */
    if (s.o.get() < 0.5) {
      s.x.jump(target)
      s.bx.jump(target)
      s.from = s.to = target
    } else {
      s.from = s.bx.get()
      s.to = target
    }
    const runs = [animate(s.x, target, SPRING), animate(s.bx, target, FLOAT_SPRING), animate(s.o, 1, { type: 'spring', stiffness: 360, damping: 30 })]
    /* when the trip ends, paint once more so the bubble rests level and square, whatever the frame rate was */
    void Promise.all(runs.map((r) => r.finished)).then(() => s.paint?.())
    return () => runs.forEach((r) => r.stop())
  }, [index])

  const active = index >= 0 ? items[index] : null
  const ActiveIcon = active?.icon

  return (
    <nav className="bnav" aria-label="Main">
      <div className="bnav__bar" ref={barRef}>
        <svg className="bnav__shape" ref={svgRef} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="bnav-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--acc-a)' }} />
              <stop offset="1" style={{ stopColor: 'var(--acc-b)' }} />
            </linearGradient>
          </defs>
          <path ref={pathRef} fill="url(#bnav-fill)" />
        </svg>

        <div className="bnav__items">
          {items.map((n, i) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              ref={(el) => {
                linkRefs.current[i] = el
              }}
              className={({ isActive }) => `bnav__item${isActive ? ' is-on' : ''}`}
              aria-label={n.label}
              title={n.label}
            >
              <n.icon size={22} strokeWidth={1.9} aria-hidden />
              {n.badge === 'dues' && dueCount > 0 && <b className="bnav__badge">{dueCount}</b>}
            </NavLink>
          ))}
        </div>
      </div>

      {/* the bubble carries the open page's icon; its key changes with the page so the icon pops in fresh */}
      <span className="bnav__bubble" ref={bubbleRef} aria-hidden>
        <span className="bnav__orb">
          {ActiveIcon && (
            <span className="bnav__bubble-icon" key={active.to}>
              <ActiveIcon size={22} strokeWidth={2} />
            </span>
          )}
          {active?.badge === 'dues' && dueCount > 0 && <b className="bnav__badge bnav__badge--bubble">{dueCount}</b>}
        </span>
      </span>
    </nav>
  )
}
