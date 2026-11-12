import { useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { KeyRound } from 'lucide-react'
import { changeMpin } from '../lib/pinReset'
import { useToast } from '../lib/toast'
import PinBoxes from './PinBoxes'

const EMPTY = ['', '', '', '']

/** Change your own MPIN: the current one, then the new one twice. */
export default function ChangeMpinDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [current, setCurrent] = useState(EMPTY)
  const [next, setNext] = useState(EMPTY)
  const [again, setAgain] = useState(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const cur = current.join('')
    const pin = next.join('')
    const check = again.join('')
    if (cur.length !== 4) return setError('Enter your current 4-digit MPIN.')
    if (pin.length !== 4) return setError('The new MPIN must be exactly 4 digits.')
    if (pin !== check) return setError('The two new MPINs do not match.')
    setBusy(true)
    setError('')
    const res = await changeMpin(cur, pin, check)
    setBusy(false)
    if (res.error) return setError(res.error)
    toast('MPIN changed')
    onClose()
  }

  return createPortal(
    <div className="confirm" onMouseDown={onClose}>
      <form className="confirm__card mpin__card" role="dialog" aria-modal="true" aria-labelledby="mpin-title" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} noValidate>
        <span className="confirm__ico">
          <KeyRound size={22} />
        </span>
        <h2 id="mpin-title">Change MPIN</h2>
        <div className="mpin__fields">
          <PinBoxes label="Current MPIN" value={current} onChange={(v) => { setCurrent(v); setError('') }} autoFocus />
          <PinBoxes label="New MPIN" value={next} onChange={(v) => { setNext(v); setError('') }} />
          <PinBoxes label="Confirm new MPIN" value={again} onChange={(v) => { setAgain(v); setError('') }} />
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="confirm__acts">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn confirm__ok" disabled={busy}>
            {busy ? 'Saving…' : 'Change MPIN'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
