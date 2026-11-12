import { useEffect, useLayoutEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { NavItem } from '../data/nav'

/**
 * The main navigation: one row of tabs under the title bar, scrolling sideways when it does not fit.
 * A single pill sits behind the open tab and slides to the next one on a soft spring-like curve; its position
 * is written straight to CSS variables, so moving between pages never waits on React.
 */
export default function Nav({ items, dueCount }: { items: NavItem[]; dueCount: number }) {
  const navRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const place = () => {
      const a = nav.querySelector<HTMLElement>('a.active')
      if (!a) {
        nav.style.setProperty('--pill-o', '0')
        return
      }
      nav.style.setProperty('--pill-o', '1')
      nav.style.setProperty('--x', `${a.offsetLeft}px`)
      nav.style.setProperty('--y', `${a.offsetTop}px`)
      nav.style.setProperty('--w', `${a.offsetWidth}px`)
      nav.style.setProperty('--h', `${a.offsetHeight}px`)
    }
    place()
    const watch = new ResizeObserver(place)
    watch.observe(nav)
    /* labels change width once the web font arrives */
    void document.fonts?.ready.then(place)
    return () => watch.disconnect()
  }, [pathname, items, dueCount])

  /* the first placement is not animated; every move after it is */
  useEffect(() => {
    const id = requestAnimationFrame(() => navRef.current?.setAttribute('data-ready', ''))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="nav-row">
      <nav className="nav" aria-label="Main" ref={navRef}>
        <i className="nav__pill" aria-hidden />
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            <n.icon size={17} strokeWidth={2} aria-hidden />
            <span>{n.label}</span>
            {n.badge === 'dues' && dueCount > 0 && (
              <b className="badge" aria-label={`${dueCount} pending ${dueCount === 1 ? 'due' : 'dues'}`}>
                {dueCount}
              </b>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
