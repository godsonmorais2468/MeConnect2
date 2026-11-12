import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Banknote, Check, Search } from 'lucide-react'
import PaidRow from '../../components/PaidRow'
import VisitorPaidRow from '../../components/VisitorPaidRow'
import { PageHead } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { inr } from '../../lib/format'
import { kindOf, modeLabel, modesOf, paidInChapter } from '../../lib/payments'
import { undoMemberPayment, undoVisitorPayment, useDB, verifyPayments } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import type { VisitorPayment } from '../../lib/types'

/** The payments waiting for the chapter to verify, and the ones already verified. Recording a payment by hand is on Payment Manual Update. */
export default function PaymentUpdate() {
  const { member, chapter, region } = useAuth()
  const db = useDB()
  const toast = useToast()
  const confirm = useConfirm()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [mode, setMode] = useState('All')
  /* what the list shows: payments waiting for the chapter to verify (first), everything, or the ones already updated */
  const [status, setStatus] = useState<'pending' | 'all' | 'updated'>('pending')

  if (!member || !chapter) return null
  /* Only the modes of pay this chapter has created (Accounts > Mode of Pay). */
  const modes = modesOf(db, chapter.id)
  const chapterName = (id: string) => db.chapters.find((c) => c.id === id)?.name ?? 'Chapter'

  const paid = paidInChapter(db, chapter.id, true)
  const q = query.trim().toLowerCase()
  const rows = paid.filter(({ invoice: i, member: m }) => {
    if (status === 'pending' && i.status !== 'pending') return false
    if (status === 'updated' && i.status !== 'paid') return false
    if (mode !== 'All' && modeLabel(i) !== mode) return false
    if (!q) return true
    return `${m.name} ${m.mobile} ${m.organisation} ${kindOf(i)} ${i.ref ?? ''} ${i.txnId ?? ''} ${i.chequeNo ?? ''}`.toLowerCase().includes(q)
  })

  /* The fee visitors paid when registering: already paid, listed with the members' payments, newest first. */
  const visitorRows = (db.visitorPayments || []).filter((v) => v.chapterId === chapter.id).filter((v) => {
    if (status === 'pending') return false /* a visitor's fee is paid at registration: nothing to verify */
    if (mode !== 'All' && v.mode !== mode) return false
    return !q || `${v.visitorName} ${v.visitorPhone} visitor ${v.mode} ${v.receipt} ${v.referredByName}`.toLowerCase().includes(q)
  })
  const entries = [
    ...rows.map((r) => ({ at: r.invoice.paidAt ?? '', row: r, visitor: undefined })),
    ...visitorRows.map((v) => ({ at: v.paidAt, row: undefined, visitor: v })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  const everything = paid.length + (db.visitorPayments || []).filter((v) => v.chapterId === chapter.id).length
  const pendingCount = paid.filter((p) => p.invoice.status === 'pending').length

  /* Payments members have made that still need the chapter to confirm them. */
  const waiting = rows.filter((r) => r.invoice.status === 'pending')
  const picks = selected.filter((id) => waiting.some((r) => r.invoice.id === id))
  const allPicked = waiting.length > 0 && waiting.every((r) => selected.includes(r.invoice.id))

  function togglePick(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  function toggleAllPicks() {
    const ids = waiting.map((r) => r.invoice.id)
    setSelected((cur) => (allPicked ? cur.filter((id) => !ids.includes(id)) : [...new Set([...cur, ...ids])]))
  }

  /** Takes a payment back. A request payment goes back to Due so the member can pay again; a manual one is removed. */
  async function removePayment(row: (typeof rows)[number]) {
    const { invoice: i, member: m } = row
    const count = row.together?.length ?? 1
    const manualOnly = !i.requestId && !i.dueDate
    const message = manualOnly
      ? `${m.name}'s payment of ${inr(i.amount)} (${i.ref}) will be removed from the records.`
      : `${m.name}'s payment of ${inr(count > 1 ? row.together!.reduce((sum, x) => sum + x.amount, 0) : i.amount)} (${i.ref}) will be taken back. ${count > 1 ? `The ${count} dues paid together go` : 'The due goes'} back to pending and ${m.name} can pay again.`
    if (!(await confirm({ title: 'Delete payment?', message }))) return
    const res = await undoMemberPayment(i.id)
    toast(res.error ?? 'Payment deleted', res.error ? 'info' : undefined)
    setSelected((cur) => cur.filter((id) => id !== i.id))
  }

  async function removeVisitorPayment(v: VisitorPayment) {
    if (!(await confirm({ title: 'Delete visitor fee?', message: `${v.visitorName}'s fee of ${inr(v.amount)} (${v.receipt}) will be taken back. The visitor stays registered but is no longer marked as paid.` }))) return
    const res = await undoVisitorPayment(v.id)
    toast(res.error ?? 'Visitor fee deleted', res.error ? 'info' : undefined)
  }

  async function verify() {
    if (picks.length === 0) return
    const res = await verifyPayments(picks)
    if (res.error) return toast(res.error, 'info')
    toast(`${picks.length} ${picks.length === 1 ? 'payment' : 'payments'} verified`)
    setSelected([])
  }

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={Banknote}
        tone="green"
        title="Payment Verifications"
        subtitle="See which members have paid and how, and verify the payments members have made."
        actions={
          <Link className="btn btn--line btn--sm" to="/payments">
            <ArrowLeft size={16} /> Manage Payments
          </Link>
        }
      />

      <div className="att">
        <div className="list">
          <h2 className="list__title">
            Pending Verifications <span>{entries.length}</span>
          </h2>

          <div className="filterbar">
            <label className="pick__search pick__search--wide">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all members, receipt, transaction or cheque number" aria-label="Search payments" />
            </label>
            <div className="fgroup">
              <span className="fgroup__label">Status</span>
            <div className="seg seg--fill" role="radiogroup" aria-label="Filter by status">
              {([['all', 'All'], ['pending', `Verification pending${pendingCount > 0 ? ` (${pendingCount})` : ''}`], ['updated', 'Updated']] as const).map(([key, label]) => (
                <button key={key} type="button" role="radio" aria-checked={status === key} aria-pressed={status === key} onClick={() => setStatus(key)}>
                  {label}
                </button>
              ))}
            </div>
            </div>
            <div className="fgroup">
              <span className="fgroup__label">Mode of pay</span>
            <div className="seg seg--fill" role="radiogroup" aria-label="Filter by mode of pay">
              {['All', ...modes].map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {m}
                </button>
              ))}
            </div>
            </div>
          </div>

          {waiting.length > 0 && (
            <div className="verifybar">
              <label className="check">
                <input type="checkbox" checked={allPicked} onChange={toggleAllPicks} /> Select all ({waiting.length} waiting)
              </label>
              <button type="button" className="btn btn--primary btn--sm" onClick={verify} disabled={picks.length === 0}>
                <Check size={15} /> Update{picks.length > 0 ? ` (${picks.length})` : ''}
              </button>
            </div>
          )}

          {entries.length === 0 ? (
            <div className="empty">
              <b>{everything === 0 ? 'No payments yet.' : status === 'pending' && !q && mode === 'All' ? 'Nothing waiting for verification.' : 'No payment found.'}</b>
              {everything === 0 ? 'Payments appear here once members pay.' : status === 'pending' && !q && mode === 'All' ? 'Payments members make show here until you verify them. Choose Updated to see the verified ones.' : 'Try another name, number, mode or status.'}
            </div>
          ) : (
            <ul className="plist">
              {entries.map((e) =>
                e.row ? (
                  <PaidRow key={e.row.invoice.id} row={e.row} chapter={chapterName(e.row.member.chapterId)} check={{ checked: selected.includes(e.row.invoice.id), onChange: () => togglePick(e.row.invoice.id) }} onDelete={() => removePayment(e.row)} />
                ) : e.visitor ? (
                  <VisitorPaidRow key={e.visitor.id} payment={e.visitor} chapter={chapter} region={region} onDelete={() => removeVisitorPayment(e.visitor!)} />
                ) : null,
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
