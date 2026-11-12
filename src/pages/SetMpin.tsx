import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound } from 'lucide-react'
import PinBoxes from '../components/PinBoxes'
import AuthArt from '../components/AuthArt'
import LoginPass from '../components/LoginPass'
import { BrandMark } from '../components/ui'
import { useFitToScreen } from '../lib/fit'
import { confirmPinReset } from '../lib/pinReset'
import { useToast } from '../lib/toast'

/* First login of someone added by the region admin: the PIN the admin typed only got them here.
   They choose their own MPIN, then go back to the login screen and sign in with it. */
export default function SetMpin() {
  const { state } = useLocation() as { state: { token?: string; name?: string } | null }
  const navigate = useNavigate()
  const toast = useToast()
  const [pin, setPin] = useState(['', '', '', ''])
  const [again, setAgain] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  useFitToScreen(cardRef)

  /* opened directly, with no sign-in behind it */
  if (!state?.token) return <Navigate to="/login" replace />
  const token = state.token
  const first = (state.name ?? '').trim().split(' ')[0]

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const next = pin.join('')
    const check = again.join('')
    if (next.length !== 4) return setError('The MPIN must be exactly 4 digits.')
    if (next !== check) return setError('The two MPINs do not match.')
    setBusy(true)
    setError('')
    const res = await confirmPinReset(token, next, check)
    setBusy(false)
    if (res.error) return setError(res.error)
    toast('MPIN set. Log in with your new MPIN.')
    navigate('/login', { replace: true })
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
            <h1>Set Your MPIN</h1>
            <p>{first ? `Welcome, ${first}. Choose a 4-digit MPIN for your account` : 'Choose a 4-digit MPIN for your account'}</p>
          </div>

          <form className="login__form" onSubmit={submit} noValidate>
            <PinBoxes
              label="New MPIN"
              value={pin}
              onChange={(v) => {
                setPin(v)
                setError('')
              }}
              autoFocus
            />
            <PinBoxes
              label="Confirm MPIN"
              value={again}
              onChange={(v) => {
                setAgain(v)
                setError('')
              }}
            />

            {error && <div className="form-error">{error}</div>}

            <button className="btn btn--primary btn--block login__submit" type="submit" disabled={busy}>
              <KeyRound size={19} /> {busy ? 'Saving…' : 'Set MPIN'} <ArrowRight size={17} />
            </button>
          </form>
          </div>
        </section>
      </div>
    </>
  )
}
