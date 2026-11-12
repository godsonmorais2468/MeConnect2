import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, HandCoins, Search, X } from 'lucide-react'
import HeadSelect from '../../components/HeadSelect'
import { Avatar, Field, FieldGroup, PageHead, Sheet } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { byDueDate, dayOf, remainingOnRequest } from '../../lib/dues'
import { headsOf } from '../../lib/heads'
import { fmtDate, inr } from '../../lib/format'
import { useNow } from '../../lib/hooks'
import { kindOf, kindOfMode, modesOf } from '../../lib/payments'
import { recordManualPayment, recordPayment, recordPaymentForRequest, useDB } from '../../lib/store'
import { useToast } from '../../lib/toast'

/** Records a payment the chapter received outside the app: for a member's pending dues, or a manual payment for an income head. */
export default function PaymentManualUpdate() {
  const { member, chapter } = useAuth()
  const db = useDB()
  const toast = useToast()
  const now = useNow(60_000)
  const today = dayOf(now)

  const [find, setFind] = useState('')
  const [saving, setSaving] = useState(false)
  const [memberId, setMemberId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [payAll, setPayAll] = useState(false)
  /* A manual payment is one no request asked for: the member gave money, the head table records which income head it is for. */
  const [manual, setManual] = useState(false)
  const [headId, setHeadId] = useState('')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [modeName, setModeName] = useState('')
  const [txnId, setTxnId] = useState('')
  const [txnDate, setTxnDate] = useState('')
  const [chequeNo, setChequeNo] = useState('')
  const [chequeDate, setChequeDate] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!member || !chapter) return null
  const members = db.members.filter((m) => m.chapterId === chapter.id && m.loginEnabled !== false)
  /* Only the modes of pay this chapter has created (Accounts > Mode of Pay). */
  const modes = modesOf(db, chapter.id)
  const activeMode = modes.includes(modeName) ? modeName : modes[0]
  const method = kindOfMode(activeMode)
  const chapterName = (id: string) => db.chapters.find((c) => c.id === id)?.name ?? 'Chapter'
  /* What a manual payment can be for: the chapter's active income heads. */
  const incomeHeads = headsOf(db, chapter.id).filter((h) => h.isActive && h.headType === 'income').sort((a, b) => a.name.localeCompare(b.name))

  const chosen = members.find((m) => m.id === memberId)
  const f = find.trim().toLowerCase()
  const matches = f && !chosen ? members.filter((m) => `${m.name} ${m.mobile} ${m.organisation}`.toLowerCase().includes(f)).slice(0, 6) : []
  const owed = chosen ? db.invoices.filter((i) => i.memberId === chosen.id && i.status === 'due').sort(byDueDate) : []
  const picked = owed.find((i) => i.id === invoiceId)
  /* The rest of the same recurring request, including dates that have not come yet: one payment can settle all of it, in advance. */
  const left = picked?.requestId && chosen ? remainingOnRequest(db, chosen.id, picked.requestId, today) : null
  const restCount = left?.count ?? 0
  const restTotal = left?.total ?? 0
  const allMode = payAll && restCount > 1

  function chooseMember(id: string) {
    setMemberId(id)
    setFind('')
    setErrors({})
    setPayAll(false)
    setAmount('')
    const first = db.invoices.filter((i) => i.memberId === id && i.status === 'due').sort(byDueDate)[0]
    setInvoiceId(first?.id ?? '')
    /* A member with nothing pending can only be recorded as a manual payment. */
    setManual(!first)
    setHeadId('')
    setNote('')
  }

  function clearMember() {
    setMemberId('')
    setInvoiceId('')
    setPayAll(false)
    setAmount('')
    setManual(false)
    setHeadId('')
    setNote('')
    setErrors({})
  }

  function chooseKind(isManual: boolean) {
    setManual(isManual)
    setPayAll(false)
    setAmount('')
    setErrors({})
  }

  function resetForm() {
    setErrors({})
    clearMember()
    setTxnId('')
    setTxnDate('')
    setChequeNo('')
    setChequeDate('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const details = { txnId, txnDate: txnDate || today, chequeNo, chequeDate: chequeDate || today, modeName: activeMode }
    if (manual) {
      if (!chosen) return
      const money = Number(amount)
      if (!headId) return setErrors({ headId: 'Select the income head.' })
      if (!(money > 0)) return setErrors({ amount: 'Enter the amount received.' })
      setSaving(true)
      const done = await recordManualPayment({ memberId: chosen.id, headId, amount: money, description: note, method, details })
      setSaving(false)
      if (done.error) return setErrors({ [done.field ?? 'form']: done.error })
      toast(`${inr(money)} recorded for ${chosen.name}`)
      return resetForm()
    }
    if (!picked) return setErrors({ invoiceId: 'Choose the payment that was received.' })
    if (allMode && picked.requestId && !(Number(amount) > 0)) return setErrors({ amount: 'Enter the amount received.' })
    setSaving(true)
    const res = await (allMode && picked.requestId ? recordPaymentForRequest(picked.memberId, picked.requestId, Number(amount), method, details) : recordPayment(picked.id, method, details))
    setSaving(false)
    if (res.error) return setErrors({ [res.field ?? 'form']: res.error })
    toast(allMode ? `${inr(restTotal)} recorded for ${chosen?.name ?? 'member'}: ${restCount} dues paid` : `${inr(picked.amount)} recorded for ${chosen?.name ?? 'member'}`)
    resetForm()
  }

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={HandCoins}
        tone="green"
        title="Payment Manual Update"
        subtitle="Record a cheque, cash or UPI payment you have received: against a member's pending dues, or for an income head."
        actions={
          <Link className="btn btn--line btn--sm" to="/payments">
            <ArrowLeft size={16} /> Manage Payments
          </Link>
        }
      />

      <div className="att">
        <Sheet icon={Check} tone="green" title="Manual Payment Update">
          <form className="form-stack" onSubmit={submit} noValidate>
            <FieldGroup label="Member" required>
              {chosen ? (
                <div className="pick__chosen">
                  <Avatar name={chosen.name} photo={chosen.photo} size={38} />
                  <span>
                    <b>{chosen.name}</b>
                    <small>
                      {chapterName(chosen.chapterId)} · {chosen.mobile}
                    </small>
                  </span>
                  <button type="button" className="iconbtn" onClick={clearMember} aria-label="Choose a different member">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="pick">
                  <div className="pick__bar">
                    <label className="pick__search">
                      <Search size={16} />
                      <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search any member by name or mobile" aria-label="Search members" />
                    </label>
                  </div>
                  {f && (
                    <ul className="pick__list">
                      {matches.length === 0 && <li className="pick__none">No member matches “{find}”.</li>}
                      {matches.map((m) => (
                        <li key={m.id}>
                          <button type="button" className="pick__row" onClick={() => chooseMember(m.id)}>
                            <Avatar name={m.name} photo={m.photo} size={34} />
                            <span className="pick__who">
                              <b>{m.name}</b>
                              <small>
                                {chapterName(m.chapterId)} · {m.mobile}
                              </small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </FieldGroup>

            {chosen && (
              <>
                <FieldGroup label="Payment type">
                  <div className="seg" role="radiogroup" aria-label="Payment type">
                    <button type="button" role="radio" aria-checked={!manual} aria-pressed={!manual} onClick={() => chooseKind(false)}>
                      Pending dues{owed.length > 0 ? ` (${owed.length})` : ''}
                    </button>
                    <button type="button" role="radio" aria-checked={manual} aria-pressed={manual} onClick={() => chooseKind(true)}>
                      Manual payment
                    </button>
                  </div>
                </FieldGroup>

                {manual && (
                  <>
                    <Field label="Income head" required error={errors.headId}>
                      <HeadSelect value={headId} onChange={setHeadId} placeholder="Select income head" options={incomeHeads.map((h) => ({ id: h.id, name: h.name, kind: h.headType }))} />
                    </Field>
                    <div className="form-grid">
                      <Field label="Amount received (₹)" required error={errors.amount}>
                        <input className="field__control" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} autoComplete="off" />
                      </Field>
                      <Field label="Note (optional)">
                        <input className="field__control" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
                      </Field>
                    </div>
                  </>
                )}

                {!manual && (
                  <FieldGroup label="Payment received for" required error={errors.invoiceId}>
                    {owed.length === 0 ? (
                      <p className="pick__empty">{chosen.name} has nothing pending.</p>
                    ) : (
                      <ul className="owed">
                        {owed.map((i) => (
                          <li key={i.id}>
                            <label className={`pick__row ${invoiceId === i.id ? 'is-on' : ''}`}>
                              <input type="radio" name="invoice" checked={invoiceId === i.id} onChange={() => setInvoiceId(i.id)} />
                              <span className="pick__who">
                                <b>{kindOf(i)}</b>
                                <small>{i.dueDate ? <em className="duepill">Due {fmtDate(i.dueDate)}</em> : 'No due date'}</small>
                              </span>
                              <b className="owed__amt">{inr(i.amount)}</b>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </FieldGroup>
                )}

                {(manual || owed.length > 0) && (
                  <>
                    {!manual && restCount > 1 && (
                      <>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={payAll}
                            onChange={(e) => {
                              setPayAll(e.target.checked)
                              setAmount(e.target.checked ? String(restTotal) : '')
                              setErrors({})
                            }}
                          />{' '}
                          Pay all remaining dues of this request ({restCount} dues, {inr(restTotal)})
                        </label>
                        {allMode && (
                          <Field label="Amount received (₹)" required hint={`Must equal the total of the ${restCount} remaining dues: ${inr(restTotal)}${left && left.coming.length > 0 ? `. ${left.coming.length} of them are not due yet; their invoices are made now, already paid.` : ''}`} error={errors.amount}>
                            <input className="field__control" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} autoComplete="off" />
                          </Field>
                        )}
                      </>
                    )}

                    <FieldGroup label="Mode of payment" required>
                      <div className="seg" role="radiogroup" aria-label="Mode of payment">
                        {modes.map((m) => (
                          <button key={m} type="button" role="radio" aria-checked={activeMode === m} aria-pressed={activeMode === m} onClick={() => setModeName(m)}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </FieldGroup>

                    {method === 'UPI' && (
                      <div className="form-grid">
                        <Field label="Transaction ID" required error={errors.txnId}>
                          <input className="field__control" value={txnId} onChange={(e) => setTxnId(e.target.value.replace(/\s/g, ''))} autoComplete="off" />
                        </Field>
                        <Field label="Transaction date" required error={errors.txnDate}>
                          <input className="field__control" type="date" max={today} value={txnDate || today} onChange={(e) => setTxnDate(e.target.value)} />
                        </Field>
                      </div>
                    )}
                    {method === 'Cheque' && (
                      <div className="form-grid">
                        <Field label="Cheque number" required error={errors.chequeNo}>
                          <input className="field__control" inputMode="numeric" value={chequeNo} onChange={(e) => setChequeNo(e.target.value.replace(/\D/g, ''))} autoComplete="off" />
                        </Field>
                        <Field label="Cheque date" required error={errors.chequeDate}>
                          <input className="field__control" type="date" value={chequeDate || today} onChange={(e) => setChequeDate(e.target.value)} />
                        </Field>
                      </div>
                    )}

                    {errors.form && <div className="form-error">{errors.form}</div>}
                    <div>
                      <button className="btn btn--primary" type="submit" disabled={saving}>
                        <Check size={16} /> Save payment
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </form>
        </Sheet>
      </div>
    </div>
  )
}
