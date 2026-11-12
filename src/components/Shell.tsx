import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { ArrowLeftRight, ChevronDown, Headset, KeyRound, LogOut, UserRound } from 'lucide-react'
import { HOME, NAV } from '../data/nav'
import { useAuth } from '../lib/auth'
import { isHeadTable } from '../lib/designations'
import { useDismiss } from '../lib/hooks'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { useReveal } from '../lib/useReveal'
import { useSpotlight } from '../lib/spotlight'
import { useNotifications } from '../lib/notifications'
import { percent } from '../lib/profile'
import { linkUser, pushConfigured } from '../lib/oneSignal'
import { refreshIfStale, signOut, useDB, useMemberships } from '../lib/store'
import ChangeMpinDialog from './ChangeMpinDialog'
import BottomNav from './BottomNav'
import Nav from './Nav'
import NotificationBell from './NotificationBell'
import PushPermissionBanner from './PushPermissionBanner'
import RouteErrorBoundary from './RouteErrorBoundary'
import SwitchChapterDialog from './SwitchChapterDialog'
import ThemeMenu from './ThemeMenu'
import { Avatar, BrandMark, Glyph } from './ui'

export default function Shell() {
  const auth = useAuth()
  const db = useDB()
  const notes = useNotifications(auth.member)
  const navigate = useNavigate()
  const location = useLocation()
  const outlet = useOutlet()
  useReveal(location.pathname)
  useSpotlight()
  /* each page is tagged on <html> (data-route="accounts", data-sub="banks"), so every page can have its own layout in CSS */
  useEffect(() => {
    const [first, second] = location.pathname.split('/').filter(Boolean)
    const root = document.documentElement
    root.dataset.route = first || 'home'
    if (second && !/^\d+$/.test(second) && second.length < 24) root.dataset.sub = second
    else delete root.dataset.sub
  }, [location.pathname])
  const [open, setOpen] = useState(false)
  const [changingMpin, setChangingMpin] = useState(false)
  const [switching, setSwitching] = useState(false)
  /* a person who belongs to more than one chapter can move between them */
  const memberships = useMemberships()
  const menuRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(menuRef, open, close)

  /* Fresh data while the app is open, and again whenever another page is opened. */
  useAutoRefresh(!!auth.role)
  useEffect(() => {
    if (auth.role) refreshIfStale(15_000)
  }, [location.pathname, auth.role])

  /* Once the first screen is up, quietly fetch the other pages so moving around feels instant. */
  const role = auth.role
  useEffect(() => {
    if (!role) return
    const load = () => {
      if (role === 'member') {
        void import('../pages/member/Directory')
        void import('../pages/member/DueList')
        void import('../pages/member/Attendance')
        void import('../pages/member/Dues')
        void import('../pages/member/Wishes')
        void import('../pages/member/OfficeBearers')
        void import('../pages/member/Rsvp')
        void import('../pages/member/MemberView')
        void import('../pages/member/MyProfile')
        void import('../pages/member/ManagePayments')
        void import('../pages/member/Meetings')
        void import('../pages/member/ManageRsvp')
      }
    }
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    const t = idle ? idle(load) : window.setTimeout(load, 1200)
    return () => {
      if (!idle) window.clearTimeout(t)
    }
  }, [role])

  /* A new page starts at the top. This runs in the same step that swaps the page in, before the screen is painted, so the old page never jumps up on its own and the new one never shows at the old scroll position. */
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  /* Point OneSignal at the signed-in user, so their device receives their notifications. */
  useEffect(() => {
    if (pushConfigured() && auth.role) void linkUser().catch(() => undefined)
  }, [auth.role])

  if (!auth.role) return null
  const { member } = auth
  const nav = NAV[auth.role].filter((item) => !item.headTable || isHeadTable(db, member))
  const pct = member ? percent(member) : 0
  const dueCount = member ? db.invoices.filter((i) => i.memberId === member.id && i.status === 'due').length : 0
  const sub = auth.chapter ? `${auth.chapter.name} · ${auth.region?.name ?? ''}` : auth.role === 'super_admin' ? 'Super Admin' : (auth.region?.name ?? '')

  return (
    <div className="app">
      <div className="frame">
      <header className="bar-top">
        <div className="bar-top__row">
          <NavLink to={HOME[auth.role]} className="bar-top__brand" aria-label="ME-CONNECT home">
            <BrandMark size={30} />
            <span className="bar-top__word">ME-CONNECT</span>
          </NavLink>

          {sub && <span className="bar-top__ctx">{sub}</span>}

          <div className="bar-top__tools">
            <ThemeMenu />
            {member && <NotificationBell notes={notes} memberId={member.id} />}
            <div className="me" ref={menuRef}>
              <button
                className="me__btn"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={member ? `My account, profile ${pct}% complete` : 'My account'}
              >
                {member ? (
                  <>
                    <Avatar name={member.name} photo={member.photo} size={34} />
                    <span className="me__progress">
                      <span className={`me__pct ${pct >= 100 ? 'is-done' : ''}`}>{pct}%</span>
                      <span className={`me__bar ${pct >= 100 ? 'is-done' : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                        <i style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <Glyph icon={UserRound} tone={auth.role === 'super_admin' ? 'wine' : 'gold'} size={34} />
                    <span className="me__text">
                      <span className="me__name">{auth.name}</span>
                      <span className="me__role">{auth.subtitle}</span>
                    </span>
                  </>
                )}
                <ChevronDown size={15} aria-hidden />
              </button>

              {open && (
                <div className="pop">
                  <div className="pop__head">
                    <Avatar name={auth.name} photo={member?.photo} size={42} />
                    <div>
                      <div className="pop__name">{auth.name}</div>
                      <div className="pop__sub">{auth.subtitle}</div>
                    </div>
                  </div>
                  {member && (
                    <>
                      <div className="pop__pct">
                        <span>Profile completed</span>
                        <b>{pct}%</b>
                      </div>
                      <button
                        className="menu-item"
                        onClick={() => {
                          setOpen(false)
                          navigate('/profile')
                        }}
                      >
                        <UserRound size={16} /> My profile
                      </button>
                    </>
                  )}
                  {auth.role === 'member' && memberships.length > 1 && (
                    <button
                      className="menu-item"
                      onClick={() => {
                        setOpen(false)
                        setSwitching(true)
                      }}
                    >
                      <ArrowLeftRight size={16} /> Switch chapter
                    </button>
                  )}
                  <button
                    className="menu-item"
                    onClick={() => {
                      setOpen(false)
                      setChangingMpin(true)
                    }}
                  >
                    <KeyRound size={16} /> Change MPIN
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setOpen(false)
                      navigate('/help')
                    }}
                  >
                    <Headset size={16} /> Help Desk
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      signOut()
                      navigate('/login')
                    }}
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <Nav items={nav} dueCount={dueCount} />
      </div>

        {changingMpin && <ChangeMpinDialog onClose={() => setChangingMpin(false)} />}
        {switching && member && <SwitchChapterDialog currentId={member.id} onClose={() => setSwitching(false)} />}

        <PushPermissionBanner />

        {/* The page area stays in place; only the page inside it changes. The Suspense boundary stays mounted too, so while the next page's code is still downloading (slow phone, slow host) the current page stays on screen instead of going blank. */}
        <main>
          <RouteErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<div className="page" />}>
              <div key={location.pathname} className="route-in">
                {outlet}
              </div>
            </Suspense>
          </RouteErrorBoundary>
        </main>

      <BottomNav items={nav} dueCount={dueCount} />

    </div>
  )
}
