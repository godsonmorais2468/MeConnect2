import { useState } from 'react'
import { CircleCheck, Download, History, Hourglass, IndianRupee, Receipt } from 'lucide-react'
import PayDialog from '../../components/PayDialog'
import { Glyph, PageHead } from '../../components/ui'
import { byDueDate, isOverdue, totalOf } from '../../lib/dues'
import { downloadInvoice, downloadReceipt, downloadReceipts, downloadStatement, invoiceNo, receiptNo } from '../../lib/invoicePdf'
import { modeDetails } from '../../lib/payments'
import { useAuth } from '../../lib/auth'
import { fmtDate, inr } from '../../lib/format'
import { useNow } from '../../lib/hooks'
import { useDB } from '../../lib/store'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { Invoice } from '../../lib/types'

type Tab = 'dues' | 'history'

export default function Dues() {
  const { member, chapter, region } = useAuth()
  const db = useDB()
  const [q, setQ] = useState('')
  const now = useNow(60_000)
  const [tab, setTab] = useState<Tab>('dues')
  const [paying, setPaying] = useState<Invoice[] | null>(null)

  if (!member) return null

  const mine = db.invoices.filter((i) => i.memberId === member.id)
  const due = mine.filter((i) => i.status === 'due').sort(byDueDate)
  /* Paid by the member, waiting for the chapter to verify it in Payment Verifications. */
  const waiting = mine.filter((i) => i.status === 'pending').sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
  const verified = mine.filter((i) => i.status === 'paid').sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
  const history = [...waiting, ...verified]
  const find = (i: Invoice) => matches(q, i.label, i.kind, i.description, i.no, i.amount, i.dueDate, i.ref, i.txnId, i.method)
  const dueShown = due.filter(find)
  const historyShown = history.filter(find)
  const overdue = due.filter((i) => isOverdue(i, now))
  const save = (invoice: Invoice) => downloadInvoice({ invoice, member, chapter, region })
  const saveReceipt = (invoice: Invoice) => downloadReceipt({ invoice, member, chapter, region })

  return (
    <div className="page">
      <PageHead eyebrow="Payments" icon={IndianRupee} tone="gold" title="Dues" subtitle="What you owe your chapter, and everything you have paid so far." />

      <div className="seg dues__tabs" role="tablist" aria-label="Dues and payment history">
        <button type="button" role="tab" aria-selected={tab === 'dues'} aria-pressed={tab === 'dues'} onClick={() => setTab('dues')}>
          Dues{due.length > 0 && <span className="dues__n">{due.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'history'} aria-pressed={tab === 'history'} onClick={() => setTab('history')}>
          Payment history
        </button>
      </div>

      {tab === 'dues' ? (
        <div className="att">
          {due.length === 0 && waiting.length > 0 ? (
            <section className="state state--wait">
              <Glyph icon={Hourglass} tone="gold" size={64} />
              <div>
                <h2>Verification Pending</h2>
                <p>
                  {inr(totalOf(waiting))} paid in {waiting.length} {waiting.length === 1 ? 'payment' : 'payments'}. It shows as paid once your chapter verifies it.
                </p>
              </div>
              <button className="btn btn--line" onClick={() => setTab('history')}>
                <History size={16} /> Payment history
              </button>
            </section>
          ) : due.length === 0 ? (
            <section className="state state--ok">
              <Glyph icon={CircleCheck} tone="green" size={64} />
              <div>
                <h2>You are all paid up</h2>
                <p>{verified[0] ? `Last payment of ${inr(verified[0].amount)} on ${fmtDate(verified[0].paidAt ?? '')}.` : 'You have no pending dues.'}</p>
              </div>
              {history.length > 0 && (
                <button className="btn btn--line" onClick={() => setTab('history')}>
                  <History size={16} /> Payment history
                </button>
              )}
            </section>
          ) : (
            <>
              <section className="dues__sum">
                <div>
                  <span className="dues__label">Total due</span>
                  <b className="dues__total">{inr(totalOf(due))}</b>
                  <span className="dues__sub">
                    {due.length} pending {due.length === 1 ? 'invoice' : 'invoices'}
                    {overdue.length > 0 && ` · ${overdue.length} overdue`}
                  </span>
                </div>
                <div className="dues__acts">
                  <button className="btn btn--glassw" onClick={() => downloadStatement(due.map((invoice) => ({ invoice, member, chapter, region })))}>
                    <Download size={16} /> {due.length > 1 ? 'Download invoices' : 'Download invoice'}
                  </button>
                  <button className="btn btn--primary" onClick={() => setPaying(due)}>
                    <IndianRupee size={16} /> {due.length > 1 ? 'Pay all' : 'Pay now'}
                  </button>
                </div>
              </section>

              {waiting.length > 0 && (
                <section className="state state--wait">
                  <Glyph icon={Hourglass} tone="gold" size={50} />
                  <div>
                    <h2>Verification Pending</h2>
                    <p>
                      {inr(totalOf(waiting))} paid in {waiting.length} {waiting.length === 1 ? 'payment' : 'payments'}, waiting for your chapter to verify.
                    </p>
                  </div>
                </section>
              )}

              <ListSearch value={q} onChange={setQ} placeholder="Search dues" />
              {q && dueShown.length === 0 && <NoMatch query={q} />}
              <ul className="inv">
                {dueShown.map((i) => {
                  const late = isOverdue(i, now)
                  return (
                    <li key={i.id} className={`inv__row ${late ? 'is-late' : ''}`}>
                      <Glyph icon={Receipt} tone={late ? 'red' : 'gold'} size={50} />
                      <div className="inv__main">
                        <b>{i.label}</b>
                        <span className="inv__id">{invoiceNo(i)}</span>
                        <span>{i.dueDate ? <em className="duepill">Due {fmtDate(i.dueDate)}</em> : 'No due date'}</span>
                        {i.description && <span className="inv__note">{i.description}</span>}
                      </div>
                      <span className={`stat ${late ? 'stat--bad' : 'stat--idle'}`}>{late ? 'Overdue' : 'Due'}</span>
                      <b className="inv__amt">{inr(i.amount)}</b>
                      <button className="btn btn--line btn--sm inv__dl" onClick={() => save(i)} aria-label={`Download invoice ${invoiceNo(i)}`}>
                        <Download size={15} /> Download invoice
                      </button>
                      <button className="btn btn--primary btn--sm" onClick={() => setPaying([i])}>
                        Pay
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div className="att">
          <section className="dues__sum dues__sum--calm">
            <div>
              <span className="dues__label">Total paid</span>
              <b className="dues__total">{inr(totalOf(verified))}</b>
              <span className="dues__sub">
                {verified.length} {verified.length === 1 ? 'payment' : 'payments'}
                {waiting.length > 0 && ` · ${waiting.length} waiting for verification`}
              </span>
            </div>
            {verified.length > 0 && (
              <div className="dues__acts">
                <button className="btn btn--glassw" onClick={() => downloadReceipts(verified.map((invoice) => ({ invoice, member, chapter, region })))}>
                  <Download size={16} /> Download receipt
                </button>
              </div>
            )}
          </section>

          {history.length > 0 && <ListSearch value={q} onChange={setQ} placeholder="Search payments" />}
          {q && history.length > 0 && historyShown.length === 0 && <NoMatch query={q} />}
          {history.length === 0 ? (
            <div className="empty">
              <b>No payments yet.</b>
              Your payments will be listed here.
            </div>
          ) : (
            <ul className="inv">
              {historyShown.map((i) => (
                <li key={i.id} className="inv__row">
                  <Glyph icon={Receipt} tone={i.status === 'pending' ? 'gold' : 'green'} size={50} />
                  <div className="inv__main">
                    <b>{i.label}</b>
                    <span className="inv__id">{invoiceNo(i)}</span>
                    <span>
                      Paid {fmtDate(i.paidAt ?? '')} · {i.method} · {receiptNo(i)}
                    </span>
                    {modeDetails(i).length > 0 && (
                      <span className="inv__note">
                        {modeDetails(i)
                          .map((d) => `${d.label}: ${d.value}`)
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                  <span className={`stat ${i.status === 'pending' ? 'stat--idle' : 'stat--ok'}`}>{i.status === 'pending' ? 'Verification pending' : 'Paid'}</span>
                  <b className="inv__amt">{inr(i.amount)}</b>
                  {i.status === 'paid' ? (
                    <button className="btn btn--line btn--sm inv__dl" onClick={() => saveReceipt(i)} aria-label={`Download receipt ${receiptNo(i)}`}>
                      <Download size={15} /> Download receipt
                    </button>
                  ) : (
                    <span className="inv__note">Receipt after verification</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {paying && <PayDialog invoices={paying} memberId={member.id} onClose={() => setPaying(null)} />}
    </div>
  )
}
