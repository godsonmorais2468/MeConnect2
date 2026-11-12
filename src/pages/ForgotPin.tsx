import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CircleCheck, KeyRound, MessageSquareText, Phone, RefreshCw, ShieldCheck } from 'lucide-react'
import AuthArt from '../components/AuthArt'
import LoginPass from '../components/LoginPass'
import { BrandMark } from '../components/ui'
import PinBoxes from '../components/PinBoxes'
import { useAuth } from '../lib/auth'
import { useFitToScreen } from '../lib/fit'
import { confirmPinReset, requestPinReset, verifyPinReset } from '../lib/pinReset'

/* Forgot PIN, in four screens:
     1 mobile number + captcha -> a code is texted to the number
     2 enter the code          -> swapped for a one-time reset token
     3 new PIN twice           -> PIN changed
     4 done                    -> back to login
   The captcha on the first screen stops the page being used to flood someone's phone with codes. */

type Step = 1 | 2 | 3 | 4

const HEADINGS: Record<Step, [string, string]> = {
  1: ['Forgot PIN?', 'Enter your registered mobile number'],
  2: ['Enter Verification Code', 'Type the code we just texted you'],
  3: ['Set Your New PIN', 'Choose a 4-digit PIN for your account'],
  4: ['PIN Changed', 'You can log in with your new PIN'],
}

/** A fresh 4-digit captcha, from the browser's secure random source. */
function newCaptcha() {
  const n = new Uint32Array(1)
  crypto.getRandomValues(n)
  return String(1000 + (n[0] % 9000))
}

export default function ForgotPin() {
  const auth = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState(newCaptcha)
  const [typed, setTyped] = useState('')
  const [otp, setOtp] = useState('')
  const [otpLength, setOtpLength] = useState(6)
  const [sentTo, setSentTo] = useState('')
  const [debugOtp, setDebugOtp] = useState('')
  const [token, setToken] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [again, setAgain] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  useFitToScreen(cardRef)

  if (auth.role && step !== 4) return <Navigate to="/" replace />

  const [title, subtitle] = HEADINGS[step]

  function refreshCaptcha() {
    setCode(newCaptcha())
    setTyped('')
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!/^\d{10}$/.test(phone)) return setError('Enter your 10-digit mobile number.')
    if (typed !== code) {
      setError(typed ? 'The digits do not match. Try the new code.' : 'Enter the 4 digits shown.')
      return refreshCaptcha()
    }
    setBusy(true)
    setError('')
    const res = await requestPinReset(phone)
    setBusy(false)
    /* every attempt, right or wrong, uses up the captcha */
    refreshCaptcha()
    if (res.error) return setError(res.error)
    setSentTo(res.sentTo ?? '')
    setOtpLength(res.otpLength ?? 6)
    setDebugOtp(res.debugOtp ?? '')
    setOtp('')
    setStep(2)
  }

  async function checkCode(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (otp.length !== otpLength) return setError(`Enter the ${otpLength}-digit code.`)
    setBusy(true)
    setError('')
    const res = await verifyPinReset(phone, otp)
    setBusy(false)
    if (res.error || !res.token) return setError(res.error ?? 'The code could not be checked. Try again.')
    setToken(res.token)
    setStep(3)
  }

  async function savePin(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const next = pin.join('')
    const check = again.join('')
    if (next.length !== 4) return setError('The PIN must be exactly 4 digits.')
    if (next !== check) return setError('The two PINs do not match.')
    setBusy(true)
    setError('')
    const res = await confirmPinReset(token, next, check)
    setBusy(false)
    if (res.error) return setError(res.error)
    setToken('')
    setPin(['', '', '', ''])
    setAgain(['', '', '', ''])
    setStep(4)
  }

  function startOver() {
    setStep(1)
    setOtp('')
    setDebugOtp('')
    setError('')
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
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          {step === 1 && (
            <form className="login__form" onSubmit={sendCode} noValidate>
              <label className="pill-field">
                <Phone size={18} />
                <span className="pill-field__prefix">+91</span>
                <input
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="Mobile number"
                  aria-label="Mobile number"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                    setError('')
                  }}
                  autoFocus
                />
              </label>

              <div className="field">
                <span className="field__label" id="fp-captcha-label">
                  Captcha
                </span>
                <div className="captcha" role="group" aria-labelledby="fp-captcha-label">
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
                    onChange={(e) => {
                      setTyped(e.target.value.replace(/\D/g, '').slice(0, 4))
                      setError('')
                    }}
                  />
                </div>
              </div>

              {error && <div className="form-error">{error}</div>}

              <button className="btn btn--primary btn--block login__submit" type="submit" disabled={busy}>
                <MessageSquareText size={19} /> {busy ? 'Sending…' : 'Send Code'} <ArrowRight size={17} />
              </button>

              <div className="login__links">
                <Link className="link-btn" to="/login">
                  <ArrowLeft size={14} /> Back to login
                </Link>
              </div>
            </form>
          )}

          {step === 2 && (
            <form className="login__form" onSubmit={checkCode} noValidate>
              <p className="fp__note">
                {sentTo ? (
                  <>
                    If this number is registered, a code was sent to <b>{sentTo}</b>. It stays valid for 10 minutes.
                  </>
                ) : (
                  'If this number is registered, a code was sent to it.'
                )}
              </p>
              <label className="field">
                <span className="field__label">Verification code</span>
                <input
                  className="field__control fp__otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={'•'.repeat(otpLength)}
                  maxLength={otpLength}
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, otpLength))
                    setError('')
                  }}
                  autoFocus
                />
              </label>

              {debugOtp && (
                <div className="fp__dev">
                  Development build: your code is <b>{debugOtp}</b>
                </div>
              )}

              {error && <div className="form-error">{error}</div>}

              <button className="btn btn--primary btn--block login__submit" type="submit" disabled={busy}>
                <ShieldCheck size={19} /> {busy ? 'Checking…' : 'Verify Code'} <ArrowRight size={17} />
              </button>

              <div className="login__links">
                <button type="button" className="link-btn" onClick={startOver}>
                  <ArrowLeft size={14} /> Change number or resend
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form className="login__form" onSubmit={savePin} noValidate>
              <PinBoxes label="New 4-digit PIN" value={pin} onChange={(v) => { setPin(v); setError('') }} autoFocus />
              <PinBoxes label="Confirm new PIN" value={again} onChange={(v) => { setAgain(v); setError('') }} />

              {error && <div className="form-error">{error}</div>}

              <button className="btn btn--primary btn--block login__submit" type="submit" disabled={busy}>
                <KeyRound size={19} /> {busy ? 'Saving…' : 'Save New PIN'} <ArrowRight size={17} />
              </button>
            </form>
          )}

          {step === 4 && (
            <div className="login__form">
              <p className="fp__done">
                <CircleCheck size={22} /> Your PIN has been changed.
              </p>
              <Link className="btn btn--primary btn--block login__submit" to="/login">
                <ShieldCheck size={19} /> Go to Login <ArrowRight size={17} />
              </Link>
            </div>
          )}
          </div>
        </section>
      </div>
    </>
  )
}
