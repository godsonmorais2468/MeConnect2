import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Loader2, Phone, RefreshCw, ShieldCheck } from 'lucide-react'
import ChapterList from '../components/ChapterList'
import AuthArt from '../components/AuthArt'
import LoginPass from '../components/LoginPass'
import { BrandMark, Toggle } from '../components/ui'
import { HOME } from '../data/nav'
import { useAuth } from '../lib/auth'
import type { AuthInfo } from '../lib/auth'
import { useFitToScreen } from '../lib/fit'
import { applyPinInput } from '../lib/pin'
import { chooseChapter, signIn, signOut } from '../lib/store'
import type { Membership } from '../lib/types'
import { useToast } from '../lib/toast'

/** The policies shown under the sign-in card. They open inside the app. */
const POLICY_LINKS = [
  ['Terms & Conditions', '/terms'],
  ['Privacy Policy', '/privacy'],
  ['Refund Policy', '/refund'],
] as const

/** A fresh 4-digit captcha, from the browser's secure random source. */
function newCaptcha() {
  const n = new Uint32Array(1)
  crypto.getRandomValues(n)
  return String(1000 + (n[0] % 9000))
}

/** First sign-in goes to the profile page (it can be skipped there); everyone else to their own home. */
function landing(auth: AuthInfo) {
  if (auth.role === 'member' && auth.member?.profileState === 'pending') return '/profile'
  return auth.role ? HOME[auth.role] : '/login'
}

export default function Login() {
  const auth = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [remember, setRemember] = useState(true)
  const [code, setCode] = useState(newCaptcha)
  const [typed, setTyped] = useState('')
  /* set when the number belongs to more than one chapter: they pick one before getting in */
  const [choose, setChoose] = useState<{ name: string; memberships: Membership[] } | null>(null)
  const [opening, setOpening] = useState(false)
  /* true from pressing Login Now until the answer comes back, so the button shows it is working */
  const [signingIn, setSigningIn] = useState(false)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])
  const cardRef = useRef<HTMLElement>(null)
  useFitToScreen(cardRef, 124) /* extra room top and bottom for the "Powered By" and policy lines */

  if (auth.role) return <Navigate to={landing(auth)} replace />

  function setDigit(i: number, raw: string) {
    const { next, focus } = applyPinInput(pin, i, raw)
    if (next !== pin) setPin(next)
    if (focus !== null) pinRefs.current[focus]?.focus()
  }

  function refreshCaptcha() {
    setCode(newCaptcha())
    setTyped('')
  }

  /* the prototype needs no credentials: whatever is typed, or nothing, opens the app */
  async function open(as: string) {
    if (signingIn) return
    setSigningIn(true)
    const res = await signIn(as, '', remember)
    /* on success the page is replaced by the dashboard, so "Processing…" stays until then; any other outcome frees the button */
    if (res.error || res.setPin || res.choose) setSigningIn(false)
    if (res.setPin) {
      /* first login: the region admin's PIN only opens the "set your own MPIN" screen */
      navigate('/set-mpin', { state: res.setPin, replace: true })
      return
    }
    if (res.choose) {
      setChoose(res.choose)
      return
    }
    if (res.error) {
      toast(res.error, 'info')
    }
    /* every attempt, right or wrong, uses up the code */
    refreshCaptcha()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void open('member')
  }

  async function pickChapter(memberId: string) {
    if (opening) return
    setOpening(true)
    const res = await chooseChapter(memberId, remember)
    setOpening(false)
    if (res.error) toast(res.error, 'info')
  }

  function useAnotherNumber() {
    signOut()
    setChoose(null)
    setPin(['', '', '', ''])
    refreshCaptcha()
  }

  return (
    <>
      <div className="login">
        <AuthArt />
        <section className="login__card" ref={cardRef}>
          <LoginPass />
          <div className="login__pane">
          <div className="login__top">
            <BrandMark size={76} />
            <h1>ME-CONNECT</h1>
            <p>Login Panel</p>
          </div>

          {choose ? (
            <div className="login__form">
              <div className="login__pick">
                <h2>Choose your chapter</h2>
                <p>Hi {choose.name}, you are a member of more than one chapter.</p>
              </div>
              <ChapterList memberships={choose.memberships} busy={opening} onPick={pickChapter} />
              <div className="login__links">
                <button type="button" className="link-btn" onClick={useAnotherNumber}>
                  Use a different number
                </button>
              </div>
            </div>
          ) : (
          <form className="login__form" onSubmit={submit} noValidate>
            <label className="pill-field">
              <Phone size={18} />
              <span className="pill-field__prefix">+91</span>
              <input
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="Mobile number"
                aria-label="Mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                autoFocus
              />
            </label>

            <div className="field">
              <span className="field__label" id="pin-label">
                4-digit PIN
              </span>
              <div className="pin" role="group" aria-labelledby="pin-label">
                {pin.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      pinRefs.current[i] = el
                    }}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={`PIN digit ${i + 1}`}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !d && i > 0) pinRefs.current[i - 1]?.focus()
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field__label" id="captcha-label">
                Captcha
              </span>
              <div className="captcha" role="group" aria-labelledby="captcha-label">
                <div className="captcha__code" aria-label={`Captcha code ${code.split('').join(' ')}`} role="img">
                  {code.split('').map((d, i) => (
                    <span key={i} style={{ transform: `translateY(${((Number(d) + i * 3) % 5) - 2}px) rotate(${((Number(d) * 7 + i * 5) % 17) - 8}deg)` }}>
                      {d}
                    </span>
                  ))}
                </div>
                <button type="button" className="iconbtn captcha__new" onClick={refreshCaptcha} aria-label="Show a new captcha code">
                  <RefreshCw size={17} />
                </button>
                <input
                  className="captcha__in"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="done"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="Enter code"
                  aria-label="Type the 4 digits shown in the captcha"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </div>
            </div>

            <div className="login__row">
              <span>Remember me</span>
              <Toggle checked={remember} onChange={setRemember} label="Remember me" />
            </div>

            <button className="btn btn--primary btn--block login__submit" type="submit" disabled={signingIn} aria-busy={signingIn}>
              {signingIn ? (
                <>
                  <Loader2 size={19} className="spin" /> Processing…
                </>
              ) : (
                <>
                  <ShieldCheck size={19} /> Login Now <ArrowRight size={17} />
                </>
              )}
            </button>

            <div className="login__links">
              <Link className="link-btn" to="/forgot-pin">
                Forgot PIN?
              </Link>
            </div>

            <div className="login__as">
              <span>Open as</span>
              <button type="button" className="link-btn" onClick={() => void open('region_admin')}>
                Region Admin
              </button>
              <button type="button" className="link-btn" onClick={() => void open('super_admin')}>
                Super Admin
              </button>
            </div>
          </form>
          )}
          </div>
        </section>
        <div className="login__foot">
          <div className="login__foot-in">
            <p className="login__powered">
              Powered By{' '}
              <a href="https://www.geosysitsolutions.com" target="_blank" rel="noopener noreferrer">
                Geosys IT Solutions Pvt Ltd
              </a>
            </p>
            <p className="login__policies">
              {POLICY_LINKS.map(([label, path], i) => (
                <span key={path}>
                  {i > 0 && <i aria-hidden>|</i>}
                  <Link to={path}>{label}</Link>
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
