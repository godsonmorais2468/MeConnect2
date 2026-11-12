import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { getTier } from '../lib/perf'

/* How long the splash plays before it leaves, and how long the leaving takes (ms). */
const HOLD = 3200
const LEAVE = 900
/* Reduced motion and weak devices get a still logo for a moment, then a plain fade. */
const HOLD_CALM = 800
const LEAVE_CALM = 300

const WORD = 'ME-CONNECT'
const TAGS = ['Connect.', 'Collaborate.', 'Grow.']

/* The splash belongs to the sign-in screen: it plays when someone who is signed out opens the app, once per browser tab session.
   A refresh while signed in, or another refresh of the sign-in page, goes straight to the screen. */
const SEEN_KEY = 'mc.splashSeen'
function shouldPlay() {
  try {
    const signedIn = !!(localStorage.getItem('me-connect:session') || sessionStorage.getItem('me-connect:session'))
    if (signedIn) return false
    return !sessionStorage.getItem(SEEN_KEY)
  } catch {
    return false
  }
}

const step = (i: number, base: number, gap: number) => ({ '--d': `${(base + i * gap).toFixed(2)}s` }) as CSSProperties

/** The opening screen, for the sign-in page only: a glow blooms, the mark springs in with a light sweeping round it and its M drawn by hand, the name sharpens out of a blur, the tagline rolls through its three words, and the screen splits open along a bright seam onto the app. Tap, click or any key skips it. */
export default function Splash() {
  const [play] = useState(shouldPlay)
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>(play ? 'in' : 'gone')
  const calm = getTier() === 'low' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    /* the plain cover from index.html hands over to this one at the same colour, so there is no flash */
    document.getElementById('boot')?.remove()
    if (!play) return
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* blocked storage: it may play again on the next refresh */
    }
    const hold = calm ? HOLD_CALM : HOLD
    const leave = calm ? LEAVE_CALM : LEAVE
    const leaving = window.setTimeout(() => setPhase('out'), hold)
    const done = window.setTimeout(() => setPhase('gone'), hold + leave)
    return () => {
      window.clearTimeout(leaving)
      window.clearTimeout(done)
    }
  }, [calm, play])

  /* the page cannot scroll while the splash covers it, and must the moment it is gone (the component stays mounted after it hides, so this cannot wait for unmount) */
  useEffect(() => {
    if (phase === 'gone') return
    const root = document.documentElement
    root.classList.add('splash-on')
    return () => root.classList.remove('splash-on')
  }, [phase])

  /* skipping: close now, and drop the pending timers' work by moving straight to leaving */
  useEffect(() => {
    if (phase !== 'in') return
    const skip = () => setPhase('out')
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [phase])

  useEffect(() => {
    if (phase !== 'out') return
    const t = window.setTimeout(() => setPhase('gone'), calm ? LEAVE_CALM : LEAVE)
    return () => window.clearTimeout(t)
  }, [phase, calm])

  if (phase === 'gone') return null

  return (
    <div className={`splash${phase === 'out' ? ' splash--out' : ''}${calm ? ' splash--calm' : ''}`} role="status" aria-label="Loading ME-CONNECT" onPointerDown={() => phase === 'in' && setPhase('out')}>
      {/* the two halves that part on exit; they carry the page colour */}
      <div className="splash__half splash__half--t" aria-hidden />
      <div className="splash__half splash__half--b" aria-hidden />

      <div className="splash__glow" aria-hidden />
      <div className="splash__stage" aria-hidden>
        <div className="splash__orb">
          <span className="splash__halo" />
          <span className="splash__pulse" style={step(0, 1.15, 0)} />
          <span className="splash__pulse" style={step(1, 1.15, 0.22)} />
          <div className="splash__tile">
            <svg viewBox="0 0 64 64" className="splash__mark">
              <path className="splash__m" d="M16 46V20l16 18 16-18v26" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
              <circle className="splash__dot" cx="32" cy="38" r="6.5" fill="#FBBF24" />
            </svg>
            <i className="splash__shine" />
          </div>
        </div>

        <h1 className="splash__word">
          {WORD.split('').map((ch, i) => (
            <span key={i} className={ch === '-' ? 'splash__dash' : undefined} style={step(i, 1.25, 0.055)}>
              {ch}
            </span>
          ))}
        </h1>

        {/* the tagline rolls through its words, one at a time, and rests on the last */}
        <div className="splash__roll">
          <ul>
            {TAGS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="splash__foot" aria-hidden>
        <div className="splash__bar">
          <i style={{ '--t': `${calm ? HOLD_CALM : HOLD}ms` } as CSSProperties} />
        </div>
        <p>Powered By Geosys IT Solutions Pvt Ltd</p>
      </div>
    </div>
  )
}
