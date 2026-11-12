import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CircleCheck, X } from 'lucide-react'
import { dayOf, totalOf } from '../lib/dues'
import { inr } from '../lib/format'
import { useNow } from '../lib/hooks'
import { kindOfMode, modesOf } from '../lib/payments'
import { payInvoices, useDB } from '../lib/store'
import type { Invoice } from '../lib/types'

type Phase = 'pay' | 'done'

/** Pay dues: see the amount, pick how it was paid (the chapter's Mode of Pay list), fill that mode's details and save. */
export default function PayDialog({ invoices, memberId, onClose }: { invoices: Invoice[]; memberId: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('pay')
  const [receipt, setReceipt] = useState('')
  const [error, setError] = useState('')
  const [modeName, setModeName] = useState('')
  const db = useDB()
  const now = useNow(60_000)
  const today = dayOf(now)
  const [txnId, setTxnId] = useState('')
  const [txnDate, setTxnDate] = useState(today)
  const [chequeNo, setChequeNo] = useState('')
  const [chequeDate, setChequeDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const total = totalOf(invoices)
  const chapterId = db.members.find((m) => m.id === memberId)?.chapterId
  const modes = modesOf(db, chapterId)
  const method = modeName ? kindOfMode(modeName) : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    if (!method || saving) return setError('Select the mode of pay.')
    setSaving(true)
    setError('')
    const res = await payInvoices(memberId, invoices.map((i) => i.id), method, { txnId, txnDate, chequeNo, chequeDate, modeName })
    setSaving(false)
    if (res.error) return setError(res.error)
    setReceipt(res.id ?? '')
    setPhase('done')
  }

  return createPortal(
    <div className="scan" role="dialog" aria-modal="true" aria-label="Pay dues">
      <div className="scan__card pay">
        <div className="scan__head">
          <h2>{phase === 'done' ? 'Payment successful' : 'Pay dues'}</h2>
          <button type="button" className="scan__x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {phase === 'done' ? (
          <div className="pay__done">
            <span className="pay__tick">
              <CircleCheck size={44} />
            </span>
            <b>{inr(total)} paid</b>
            <span>
              Receipt <strong>{receipt}</strong> · {modeName}
            </span>
            <button className="btn btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <ul className="pay__items">
              {invoices.map((i) => (
                <li key={i.id}>
                  <span>{i.label}</span>
                  <b>{inr(i.amount)}</b>
                </li>
              ))}
              <li className="pay__total">
                <span>Total</span>
                <b>{inr(total)}</b>
              </li>
            </ul>

            <div className="upi__txn">
              <label className="field">
                <span className="field__label">
                  Mode of pay<span className="req">*</span>
                </span>
                <select
                  className="field__control native-select"
                  value={modeName}
                  onChange={(e) => {
                    setModeName(e.target.value)
                    setError('')
                  }}
                >
                  <option value="">Select mode of pay</option>
                  {modes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              {method === 'UPI' && (
                <>
                  <label className="field">
                    <span className="field__label">
                      Transaction number<span className="req">*</span>
                    </span>
                    <input className="field__control" value={txnId} onChange={(e) => setTxnId(e.target.value.replace(/\s/g, ''))} autoComplete="off" />
                  </label>
                  <label className="field">
                    <span className="field__label">
                      Transaction date<span className="req">*</span>
                    </span>
                    <input className="field__control" type="date" value={txnDate} max={today} onChange={(e) => setTxnDate(e.target.value)} />
                  </label>
                </>
              )}

              {method === 'Cheque' && (
                <>
                  <label className="field">
                    <span className="field__label">
                      Cheque number<span className="req">*</span>
                    </span>
                    <input className="field__control" inputMode="numeric" value={chequeNo} onChange={(e) => setChequeNo(e.target.value.replace(/\D/g, ''))} autoComplete="off" />
                  </label>
                  <label className="field">
                    <span className="field__label">
                      Cheque date<span className="req">*</span>
                    </span>
                    <input className="field__control" type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
                  </label>
                </>
              )}
            </div>

            {error && <div className="form-error">{error}</div>}
            <button className="btn btn--primary" onClick={save} disabled={saving}>
              <Check size={17} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
